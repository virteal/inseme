// ESM, Node 20+
// Variable d'env requise : OPENAI_API_KEY
// Optionnelles : OCR_ENABLED, CANON_MODEL, EMBED_MODEL, JUDGE_MODEL, LOW_SIM, HIGH_SIM

import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import os from 'node:os';
import OpenAI from 'openai';
import { convertPdfToMarkdown } from '../src/lib/pdfToMarkdown.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadConfig, getConfig, createOpenAIClient } from './lib/config.js';

// Charger la configuration
await loadConfig();

// Prompts
const PROMPT_CANON_SYSTEM_FR_OPHELIA = `
Vous intervenez dans un audit citoyen des conseils municipaux de Corte pour l’assistante Ophélia.
Objectif: retourner TOUS les items (points) sous forme JSON strictement conforme au schéma fourni.

Règles générales
- Neutralité stricte. Rien n’est inventé. Si une info manque: "" ou [].
- Conserver l’ordre d’apparition. Si aucun numéro explicite: numéroter 1,2,3...
- Nettoyer le bruit OCR (», }, >, ligatures, césures). Ignorer en-têtes/pieds « Page N ».
- Toujours remplir:
  • order (entier)
  • raw (le passage source le plus représentatif du point)
  • title (court, informatif)
  • topic (sujet principal, 4–8 mots)
  • action (voir liste)
  • domain (voir liste)
  • keywords (3–8 termes utiles: montants, votes, lots, sigles, noms propres)

Détection par type de document (automatique)
1) ODJ / Convocation:
   - Détecter les lignes numérotées/bulletées.
   - Un item = une ligne/section de l’ODJ.

2) PV / DÉLIBÉRATIONS (texte de style juridique):
   - Segmenter en « blocs de délibération » par motifs forts, même si le titre n’est pas explicite.
     Indices de début possibles (non exclusifs):
       • « Délibération » / « DELIBERATION » / « N°... » / « 25-10/081 » (format dd-mm/nnn)
       • « LE CONSEIL (MUNICIPAL) » / « Ouï l’exposé… » / « Après en avoir délibéré »
       • Verbes décisionnels en capitale suivis de « : » (ex. « DÉCIDE: », « ADOPTE », « APPROUVE », « AUTORISE », « ARRÊTE », « PREND ACTE », « DONNE POUVOIR »)
     Indices de fin probables:
       • Nouveau motif de début
       • « Questions diverses »
       • Sauts/sections marqués
   - Un item = un bloc (début → décision). Les « ARTICLES » appartiennent au même item.
   - Préserver les verbes décisionnels dans "raw".

Inférence guidée
- action ∈ { "information","délibération","vote","adoption","approbation","convention",
             "avenant","DSP","subvention","tarification","cession","acquisition","bail",
             "permis/PLU","marché","commande","emprunt","garantie","budget","DM","CA",
             "compte financier","taxe/redevance","vœu","autre" }
  Règle: si « DÉCIDE/ADOPTE/APPROUVE/AUTORISE/ARRÊTE » → action = "adoption" ou "délibération" selon le contexte explicite.
- domain ∈ { "finances","urbanisme","marchés publics","ressources humaines","patrimoine",
             "culture","sport","éducation","social","mobilité","environnement","sécurité",
             "eau-assainissement","déchets","numérique","autre" }
  Règle: déduire par mots-clés (budget/DM/CA→finances; PLU/permis→urbanisme; marché/lot/avenant→marchés publics; subvention→culture/sport/... selon bénéficiaire; etc.).
- title: concis, informatif, sans jargon. Si un identifiant existe (p.ex. « 25-10/081 »), le préfixer: « 25-10/081 — [intitulé synthétique] ».
- topic: reformulation brève du sujet (« Avenant n°1 marché éclairage public »; « DM n°2 budget principal 2025 »).
- keywords: inclure votes (« unanimité », « Pour: X / Contre: Y / Abstentions: Z »), montants (« 5 000 € »), lots, références (PLU, marché n°…).

Sortie
- Un unique JSON valide conforme au schéma. Aucun texte hors JSON.


`;

const PROMPT_JUDGE_SYSTEM_FR_OPHELIA = `
Vous comparez, pour l’assistante Ophélia, un item d’Ordre du Jour (ODJ) et l’acte correspondant (PV ou délibérations) dans le cadre d’un audit citoyen des conseils municipaux de Corte.

Statuts autorisés :
- CORRESPONDANCE : même sujet de fond, ordre identique.
- ORDRE_MODIFIE : même sujet de fond, mais position/ordre différent.
- LIBELLE_DIVERGENT : formulations différentes, fond probablement identique ou texte insuffisant pour trancher.
- PERIMETRE_MODIFIE : l’acte élargit/réduit sensiblement ce qui était annoncé (ex. ajout/retrait de lots, montants, bénéficiaires, emprise, base juridique).

Méthode :
- Appuyer le jugement sur title/topic/action/domain/keywords.
- Un regroupement ou un éclatement d’items peut relever de LIBELLE_DIVERGENT ou PERIMETRE_MODIFIE selon l’écart réel.
- Si « questions diverses » couvre un acte précis non annoncé, privilégier PERIMETRE_MODIFIE.
- Rester factuel, neutre, sans présumer d’intentions. Si le texte est insuffisant : LIBELLE_DIVERGENT avec justification.

Contraintes (Ophélia) :
- Zéro invention. Rationale courte, claire, réutilisable pour le public.
- Mention implicite : analyse fondée sur documents officiels.

Sortie : JSON strictement conforme au schéma fourni. Aucune autre sortie.
`;


const PROMPT_KB_SYSTEM_FR_OPHELIA = `
Vous construisez une base de connaissances civique pour l’assistante Ophélia à partir de Markdown issu de documents officiels municipaux (ODJ, PV, délibérations), éventuellement OCR.

Objectif : extraire listés et dédupliqués — personnes, organisations, lieux, projets, actes — pour un usage public à Corte.

Contraintes (Ophélia) :
- Zéro invention. Uniquement des informations présentes dans le texte. Si inconnu : "", [], 0.
- Priorité aux documents officiels. Si plusieurs indices, lier toutes les sources disponibles.
- Style neutre, clair, public. Pas de jugement politique. Pas de conseils juridiques.

Normalisation :
- Dates au format "YYYY-MM-DD" si explicites, sinon "".
- Montants en euros : nombre (ex. 5000) sans séparateurs ; sinon 0.
- Aliases : regrouper les variantes nominales et sigles.
- sources/source : renseigner au moins le chemin de fichier du Markdown traité si rien d’autre.

Champs à remplir conformément au schéma :
- people : name, role, org, aliases[], summary, sources[]
- orgs   : name, type, aliases[], summary, sources[]
- places : name, kind, address, aliases[], summary, sources[]
- projects : name, owner, status, budget_eur, tags[], summary, sources[]
- acts  : date, title, domain, action, amount_eur, summary, source

Sortie : JSON strictement conforme au schéma fourni. Aucune autre sortie.
`;

const PROMPT_NARRATIVE_SYSTEM_FR_OPHELIA = `
Produire une note brève et neutre pour l’audit citoyen des conseils municipaux de Corte, destinée à être reprise par l’assistante Ophélia.

Structure imposée :
- Contexte : date de séance, nature des sources (ODJ/PV/délibérations), rappel de l’objectif civique (vérification citoyenne de la concordance et de la transparence).
- Finalité : ce que mesure l’audit (information préalable du public, cohérence ODJ↔actes, lisibilité des décisions et des montants).
- Synthèse : 5–8 phrases factuelles mentionnant écarts éventuels (ordre modifié, périmètre modifié, ajouts/absences) et points notables (budgets/DM, marchés/avenants, subventions, PLU, RH, etc.). Signaler « texte OCR incertain » si applicable.
- Points sensibles : puces brèves sur les zones à clarifier (item non annoncé mais délibéré, montants manquants, périmètre élargi…).
- Recommandations : puces concrètes et praticables pour la transparence (ex. ODJ à J-6 avec annexes, index des délibérations, montants en CSV/JSON, diffusion vidéo, archivage pérenne).

Contraintes (Ophélia) :
- Neutralité stricte. Zéro procès d’intention. Zéro invention.
- Style public : phrases courtes, vocabulaire accessible, sans jargon inutile.
- Mention implicite : analyse fondée sur documents officiels et base de connaissances locale.

Sortie : JSON strictement conforme au schéma fourni. Aucune autre sortie.

`;

const execFileP = promisify(execFile);

const OFFICIEL_DIR = path.join(process.cwd(), 'public', 'docs', 'officiel');
const CONSEIL_DIR = path.join(process.cwd(), 'public', 'docs', 'conseils');     // PDFs OCR "searchable"
const CONSEILS_MD_DIR = path.join(process.cwd(), 'public', 'docs', 'conseils');  // Markdown extraits
await fs.mkdir(CONSEIL_DIR, { recursive: true });
await fs.mkdir(CONSEILS_MD_DIR, { recursive: true });

const USE_MARKITDOWN = getConfig('use_markitdown', '1') !== '0';
const CANON_MODEL = getConfig('canon_model', 'gpt-5');
const JUDGE_MODEL = getConfig('judge_model', CANON_MODEL);
const EMBED_MODEL = getConfig('embed_model', 'text-embedding-3-large');

function chunkText(txt, max = 14000) { const o = []; for (let i = 0; i < txt.length; i += max) o.push(txt.slice(i, i + max)); return o; }
function normKey(s) { return String(s || '').trim().toLowerCase(); }

const OCR_SAMPLE_PAGES = Number(getConfig('ocr_sample_pages', 3));

async function collectPdfStats(pdfPath, standardFontDataUrl) {
  const bytes = (await fs.stat(pdfPath)).size;
  let pages = 1;
  let textChars = 0;
  let imageMarkers = 0;

  // 1) numPages + échantillon de texte via pdf.js
  try {
    const u8 = new Uint8Array(await fs.readFile(pdfPath));
    const pdf = await getDocumentProxy(u8, { standardFontDataUrl });
    pages = pdf.numPages || 1;

    const sample = Math.min(pages, OCR_SAMPLE_PAGES);
    for (let p = 1; p <= sample; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const chars = tc.items.map(i => i.str).join('').replace(/\s+/g, '').length;
      textChars += chars;
    }
    // extrapolation simple
    textChars = Math.max(textChars, 0) * Math.max(Math.ceil(pages / Math.max(sample, 1)), 1);
  } catch { /* ok, on tombera sur la 2) */ }

  // 2) densité d'images + fallback pages par regex
  try {
    const rawBuf = await fs.readFile(pdfPath);
    const raw = rawBuf.toString('latin1');
    const mImg = raw.match(/\/Subtype\s*\/Image/gi);
    imageMarkers = mImg ? mImg.length : 0;

    if (!pages || pages === 1) {
      const mPg = raw.match(/\/Type\s*\/Page(?!s)/gi);
      if (mPg && mPg.length > pages) pages = mPg.length;
    }
  } catch { /* ignore */ }

  return { bytes, pages: Math.max(pages, 1), textChars: Math.max(textChars, 0), imageMarkers };
}

const HI_BPP = Number(getConfig('ocr_size_ppx_hi', 250_000)); // 250 kB/page
const LO_BPP = Number(getConfig('ocr_size_ppx_lo', 120_000)); // 120 kB/page
const MIN_TPP = Number(getConfig('ocr_text_per_page_min', 150));
const MIN_TXT = Number(getConfig('ocr_text_min', 800));
const HI_IMGPP = Number(getConfig('ocr_img_per_page_hi', 1.0));
const LO_IMGPP = Number(getConfig('ocr_img_per_page_lo', 0.5));

function shouldOCR({ bytes, pages, textChars, imageMarkers }) {
  const bpp = bytes / Math.max(1, pages);
  const tpp = textChars / Math.max(1, pages);
  const imgp = imageMarkers / Math.max(1, pages);

  const strongScan = (bpp >= HI_BPP) || (imgp >= HI_IMGPP);
  const weakScan = (bpp >= LO_BPP) || (imgp >= LO_IMGPP);

  if (strongScan && tpp < MIN_TPP) return true;
  if (weakScan && textChars < MIN_TXT) return true;
  return false;
}

// === MarkItDown runner =======================================================

/**
 * Choisit la commande Python.
 * Priorité:
 *  1) process.env.PYTHON_EXE ou PYTHON
 *  2) Windows: py -3.13 (override via PY_PYVER)
 *  3) Unix: python3 puis python
 * @returns {[string, string[]]} [cmd, preArgs]
 */
export function pythonLauncher() {
  const envCmd = getConfig('python_exe') || getConfig('python');
  if (envCmd) return [envCmd, []];

  if (process.platform === 'win32') {
    const ver = getConfig('py_pyver', '-3.13');
    return ['py', [ver]]; // ex: py -3.13 -m markitdown ...
  }
  // *nix
  return [getConfig('py_cmd', 'python3'), []];
}

/**
 * Exécute MarkItDown sur un PDF local et retourne le Markdown.
 * Requiert: pip install "markitdown[pdf]" (ou [all]) côté Python.
 *
 * @param {string} srcPdfPath - Chemin absolu ou relatif vers le PDF
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=120000] - Timeout exécution
 * @param {string[]} [opts.extraArgs=[]]   - Args additionnels MarkItDown
 * @returns {Promise<string>} Markdown (chaîne vide si sortie vide)
 * @throws Error si l’exécution échoue
 */
export async function extractWithMarkitdown(srcPdfPath, opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 120_000;
  const extraArgs = Array.isArray(opts.extraArgs) ? opts.extraArgs : [];

  // Dossier temporaire pour la sortie .md
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'markit-'));
  const outPath = path.join(
    tmpDir,
    `${path.basename(srcPdfPath, path.extname(srcPdfPath) || '.pdf')}.md`
  );

  const [cmd, pre] = pythonLauncher();
  const args = [
    ...pre,
    '-m', 'markitdown',
    srcPdfPath,
    '-o', outPath,
    ...extraArgs,
  ];

  try {
    const { stdout, stderr } = await execFileP(cmd, args, {
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 100, // 100 MB de tampon
    });

    if (stderr?.trim()) {
      // MarkItDown bavarde parfois sur stderr (warnings). On log si utile.
      if (!/DeprecationWarning/i.test(stderr)) {
        console.warn('[markitdown]', stderr.trim());
      }
    }

    // Charge le fichier produit
    const md = await fs.readFile(outPath, 'utf8').catch(() => '');
    return md || '';
  } catch (e) {
    const msg = (e?.stderr?.toString?.() || e?.message || String(e)).trim();

    // Aide typique si dépendances PDF manquantes côté Python
    if (/MissingDependencyException/i.test(msg) || /dependencies needed to read \.pdf/i.test(msg)) {
      throw new Error(
        `MarkItDown manque ses dépendances PDF. Installez côté Python:\n` +
        `  pip install "markitdown[pdf]"    # ou\n` +
        `  pip install "markitdown[all]"\n` +
        `Détail: ${msg}`
      );
    }
    throw new Error(`markitdown a échoué: ${msg}`);
  } finally {
    // Nettoyage silencieux
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { }
  }
}


/**
 * Produit une copie "searchable" via OCRmyPDF dans public/docs/conseils/.
 * Si le fichier existe déjà, on le réutilise.
 * @param {string} srcOfficialPath  chemin du PDF original (public/docs/officiel/…)
 * @returns {Promise<string>}       chemin du PDF searchable (public/docs/conseils/…)
 */

/** Retourne file:///…/node_modules/pdfjs-dist/standard_fonts/ (avec / final) */
function resolveStandardFontDataUrl() {
  try {
    const pkg = require.resolve('pdfjs-dist/package.json');
    const dir = path.join(path.dirname(pkg), 'standard_fonts') + path.sep;
    return pathToFileURL(dir).href;
  } catch {
    return undefined; // pdf.js gérera un fallback, mais les polices sont recommandées
  }
}

function buildSafeBaseName(pdfUrl, dateLabel = '', docType = '') {
  // 1) nom "source" (modules.php → name/lid)
  let origName = 'document.pdf';
  try {
    const u = new URL(pdfUrl, 'http://x/');
    const base = path.posix.basename(u.pathname) || origName;
    if (/modules\.php$/i.test(base)) {
      const lid = u.searchParams.get('lid') || '';
      const name = u.searchParams.get('name') || '';
      if (name && lid) origName = `${name}-${lid}.pdf`;
      else if (name) origName = `${name}.pdf`;
      else if (lid) origName = `document-${lid}.pdf`;
    } else {
      origName = base.endsWith('.pdf') ? base : `${base}.pdf`;
    }
  } catch { }

  // 2) type/date
  const typeMap = { odj: 'convocation-odj', pv: 'proces-verbal', delib: 'deliberations', deliberation: 'deliberations' };
  const typeLabel = typeMap[String(docType || '').toLowerCase()] || 'document';
  const datePart = dateLabel ? String(dateLabel).replace(/[^0-9A-Za-z-_]/g, '') : String(Date.now());

  // 3) safe base sans extension
  const raw = `corte_${typeLabel}_${datePart}_${origName}`;
  const safe = raw.normalize('NFKD').replace(/[^\w.\-]/g, '_').replace(/_+/g, '_').toLowerCase();
  return safe.replace(/\.pdf$/i, ''); // base sans .pdf
}

function expectedPathsForDoc(pdfUrl, dateLabel, docType) {
  const base = buildSafeBaseName(pdfUrl, dateLabel, docType);
  return {
    pdf: path.join(process.cwd(), 'public', 'docs', 'officiel', `${base}.pdf`),
    md: path.join(process.cwd(), 'public', 'docs', 'conseils', `${base}.md`) // même dossier que votre code actuel
  };
}

async function ensureSearchablePdf(srcOfficialPath) {
  const base = path.basename(srcOfficialPath);
  const dst = path.join(CONSEIL_DIR, base);

  // Cache
  try { await fs.access(dst); return dst; } catch { }

  // Heuristique préalable (taille/page + texte/page)
  const fontsUrl = resolveStandardFontDataUrl?.();
  const stats = await collectPdfStats(srcOfficialPath, fontsUrl);

  // Si l'heuristique dit "pas d'OCR", retournez l'original
  if (!shouldOCR(stats)) return srcOfficialPath;

  // Sinon OCR sélectif (ne pas forcer sur pages déjà textuelles)
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ocrmd-'));
  const tmpOut = path.join(tmp, base);

  const [cmd, ...pre] = pythonLauncher();
  const args = [
    ...pre, '-m', 'ocrmypdf',
    '-l', 'fra+eng',
    '--skip-text',                 // CONSERVER les pages déjà textuelles
    '--rotate-pages', '--deskew',
    '--optimize', '1',
    '--invalidate-digital-signatures',
    srcOfficialPath, tmpOut
  ];

  try {
    console.log('  OCRmyPDF', srcOfficialPath, '->', dst);
    const { stderr } = await execFileP(cmd, args, { windowsHide: true });
    if (stderr?.trim()) console.warn(stderr.trim());
    await fs.copyFile(tmpOut, dst);
    console.log('  ✅ OCRmyPDF', srcOfficialPath, '->', dst);

    // Sanity check: si l’OCR apporte moins de texte que l’original, garder l’original
    try {
      console.log('  MarkItDown', srcOfficialPath, '->', dst);
      const mdOrig = await extractWithMarkitdown(srcOfficialPath);
      console.log('  ✅ MarkItDown', srcOfficialPath, '->', dst);
      const mdOCR = await extractWithMarkitdown(dst);
      console.log('  ✅ MarkItDown', dst, '->', dst);
      if (mdOCR.replace(/\s+/g, '').length < mdOrig.replace(/\s+/g, '').length) {
        console.log('  ❌ MarkItDown', dst, '->', dst, 'apporte moins de texte que', srcOfficialPath);
        return srcOfficialPath;
      }
    } catch { }
    console.log('  ✅ MarkItDown', dst, '->', dst);
    return dst;
  } catch (e) {
    console.error('  ❌ ocrmypdf a échoué :', e?.stderr?.toString?.() || e?.message || e);
    return srcOfficialPath;
  } finally {
    try { await fs.rm(tmp, { recursive: true, force: true }); } catch { }
  }
}

async function pdfToMarkdown(pdfPath, u8, opts = {}) {
  const absIn = path.resolve(pdfPath);
  const mdPath = absIn.replace(/\.pdf$/i, '.md');

  if (mdCache[mdPath]) return mdCache[mdPath];

  let mdText = '';

  if (!USE_MARKITDOWN) {
    // convertPdfToMarkdown attend des octets, pas un chemin
    const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(await fs.readFile(absIn));
    const out = await convertPdfToMarkdown(bytes, opts);
    mdText = typeof out === 'string' ? out
      : (typeof out?.markdown === 'string' ? out.markdown : '');
    if (!mdText) return { error: 'convertPdfToMarkdown: markdown vide' };
  } else {
    // exécution MarkItDown via le lanceur Python
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'markitdown-'));
    const outPath = path.join(tmpDir, path.basename(mdPath));
    const launcher = process.platform === 'win32' ? 'py' : (getConfig('python', 'python3'));

    try {
      console.log('  MarkItDown', absIn, '->', outPath);
      const { stderr } = await execFileP(
        launcher,
        ['-m', 'markitdown', absIn, '-o', outPath],
        { windowsHide: true }
      );
      console.log('  ✅ MarkItDown', absIn, '->', outPath);
      if (stderr) console.warn(stderr.trim());
      mdText = await fs.readFile(outPath, 'utf8');
    } catch (e) {
      const msg = e?.stderr?.toString?.().trim() || e?.message || String(e);
      console.error('  ❌ markitdown a échoué :', msg);
      return { error: msg };
    } finally {
      // nettoyage best-effort
      try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { }
    }
  }

  // cache + persistance à côté du PDF
  mdCache[mdPath] = mdText;

  return mdText;
}

// ---------- Configuration ----------
if (!getConfig('openai_api_key')) {
  console.error('Erreur : OPENAI_API_KEY manquant (.env ou variable d’environnement).');
  process.exit(1);
}
const client = createOpenAIClient();

const OCR_ENABLED = getConfig('ocr_enabled', '1') !== '0';
const LOW_SIM = Number.parseFloat(getConfig('low_sim', '0.55'));
const HIGH_SIM = Number.parseFloat(getConfig('high_sim', '0.82'));

// ---------- Caches en mémoire ----------
const pdfCache = new Map();           // key: `pdfText-<path>` -> string
const mdCache = Object.create(null); // key: md absolute path   -> string

// ---------- CLI ----------
function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const [k, vRaw] = a.includes('=') ? a.split('=') : [a, true];
    const key = k.replace(/^--?/, '').toLowerCase().replace(/-/g, '_');
    out[key] = vRaw === true ? true : vRaw;
  }
  return out;
}
const args = parseArgs(process.argv);

// ---------- HTTP utils ----------
function absUrl(base, href) {
  try { return new URL(href, base).toString(); }
  catch { return `${base.replace(/\/+$/, '')}/${href.replace(/^\/+/, '')}`; }
}

/**
 * Télécharge une ressource binaire en gérant les redirections.
 * Retourne un Uint8Array "pur" (pas de Buffer).
 */
async function fetchBytes(url, {
  maxRedirects = 5,
  timeoutMs = 30000,
  headers = {
    'User-Agent': 'Audit-ODJ/1.0',
    'Accept': 'application/pdf,*/*;q=0.8',
    'Accept-Language': 'fr,en;q=0.9',
    'Referer': url
  }
} = {}) {
  const visited = new Set();
  return await new Promise((resolve, reject) => {
    function go(u, left) {
      if (left < 0) return reject(new Error('Too many redirects'));
      const lib = u.startsWith('https:') ? https : http;
      const req = lib.get(u, { headers, timeout: timeoutMs }, (res) => {
        // Redirection
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, u).toString();
          if (visited.has(next)) { res.resume(); return reject(new Error('Redirect loop')); }
          visited.add(next);
          res.resume();
          return go(next, left - 1);
        }
        // Erreur HTTP
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        // OK
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const out = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength); // pur
          resolve(out);
        });
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => { req.destroy(new Error('Timeout')); });
    }
    go(url, maxRedirects);
  });
}

// ---------- Archivage PDF ----------
function makeArchiveBaseName(fromUrl) {
  let origName = 'document.pdf';
  try {
    const u = new URL(fromUrl);
    const baseName = path.basename(u.pathname) || origName;
    if (/modules\.php$/i.test(baseName)) {
      const lid = u.searchParams.get('lid') || '';
      const nameParam = u.searchParams.get('name') || '';
      if (nameParam && lid) origName = `${nameParam}-${lid}.pdf`;
      else if (nameParam) origName = `${nameParam}.pdf`;
      else if (lid) origName = `document-${lid}.pdf`;
      else origName = 'document.pdf';
    } else {
      origName = baseName;
    }
  } catch { /* ignore */ }
  return origName;
}

function safeFileName(s) {
  return s.normalize('NFKD')
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function mapDocType(docType) {
  const m = { odj: 'convocation-odj', pv: 'proces-verbal', delib: 'deliberations', deliberation: 'deliberations' };
  return m[(docType || '').toLowerCase()] || 'document';
}

/**
 * Écrit les bytes dans public/docs/officiel, sinon fallback tmp, sinon /tmp.
 * Retourne le chemin final ou lève en cas d’échec total.
 */
async function savePdfArchive(bytesUint8, url, dateLabel = '', docType = '') {
  const typeLabel = mapDocType(docType);
  const datePart = dateLabel ? String(dateLabel).replace(/[^0-9A-Za-z-_]/g, '') : String(Date.now());
  const baseName = makeArchiveBaseName(url);
  const rawName = `mairie-corte_${typeLabel}_${datePart}_${baseName}`;
  const fileName = safeFileName(rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`);

  const primaryDir = path.join(process.cwd(), 'public', 'docs', 'officiel');
  const fallbackDir = path.join(process.cwd(), 'tmp', 'officiel');
  const systemDir = path.join(os.tmpdir(), 'audit-odj-officiel');

  const tryWrite = async (dir) => {
    try {
      await fs.mkdir(dir, { recursive: true });
      const outPath = path.join(dir, fileName);
      await fs.writeFile(outPath, Buffer.from(bytesUint8));
      return outPath;
    } catch (err) {
      return { error: String(err?.message || err) };
    }
  };

  const p1 = await tryWrite(primaryDir);
  if (typeof p1 === 'string') { console.log(`  📁 Archive PDF : ${path.relative(process.cwd(), p1)}`); return p1; }
  console.warn(`  ⚠ Impossible d’écrire dans ${primaryDir}: ${p1.error}`);

  const p2 = await tryWrite(fallbackDir);
  if (typeof p2 === 'string') { console.log(`  📁 Archive PDF (fallback): ${path.relative(process.cwd(), p2)}`); return p2; }
  console.warn(`  ⚠ Impossible d’écrire dans ${fallbackDir}: ${p2.error}`);

  const p3 = await tryWrite(systemDir);
  if (typeof p3 === 'string') { console.log(`  📁 Archive PDF (/tmp): ${p3}`); return p3; }

  console.error('  ❌ Archivage PDF impossible sur tous les emplacements', { primary: p1.error, fallback: p2.error, system: p3.error });
  throw new Error('All archive locations failed');
}

/**
 * Retourne un chemin local d’archive pour un PDF distant.
 * Télécharge et archive si absent.
 */
async function getArchivedPdfPath(pdfUrl, dateLabel = '', docType = '') {
  const typeLabel = mapDocType(docType);
  const datePart = dateLabel ? String(dateLabel).replace(/[^0-9A-Za-z-_]/g, '') : String(Date.now());
  const rawName = `mairie-corte_${typeLabel}_${datePart}_${makeArchiveBaseName(pdfUrl)}`;
  const safeName = safeFileName(rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`);
  const expected = path.join(process.cwd(), 'public', 'docs', 'officiel', safeName);

  try {
    await fs.access(expected);
    return expected;
  } catch {
    const bytes = await fetchBytes(pdfUrl);
    return await savePdfArchive(bytes, pdfUrl, dateLabel, docType);
  }
}

// ---------- Extraction markdown mise en cache ----------


async function getCachedPdfText(pdfPath, dateLabel, docType) {
  const cacheKey = `pdfText-${pdfPath}`;
  if (pdfCache.has(cacheKey)) return pdfCache.get(cacheKey);

  console.log(`  📄 Extraction texte PDF : ${dateLabel} (${docType})`);

  let fileBuf;
  try {
    fileBuf = await fs.readFile(pdfPath); // Buffer
  } catch (error) {
    console.error(`  ❌ Lecture PDF ${pdfPath} : ${error.message}`);
    return { error: error.message };
  }

  const u8 = new Uint8Array(fileBuf);
  const call = async (withOcr) => {
    const opts = {
      ocrImages: withOcr,
      aiRefiner: async (markdown, context) => {
        const { totalPages, ocrPages } = context || {};
        console.log(`    🤖 Affinage IA (OCR: ${ocrPages?.length || 0}/${totalPages || 0})`);
        try {
          const res = await client.chat.completions.create({
            model: CANON_MODEL,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: `Nettoie un texte OCR de PDF. Retourne strictement {"text":"..."} sans ajout.` },
              { role: 'user', content: `Nettoie :\n${markdown}` }
            ]
          });
          const content = res.choices?.[0]?.message?.content || '{}';
          const parsed = JSON.parse(content);
          console.log(`    ✅ Affinage IA : ${parsed.text?.substring(0, 50) || '...'}`);
          if (typeof parsed.text === 'string' && parsed.text.trim()) return parsed.text;
        } catch (e) {
          console.warn('    ⚠ Affinage IA ignoré :', e?.message || e);
        }
        return markdown;
      }
    };

    const out = await pdfToMarkdown(pdfPath, u8, opts);

    // Certaines implémentations renvoient une string, d'autres { markdown, ... }
    const markdown = typeof out === 'string'
      ? out
      : (typeof out?.markdown === 'string' ? out.markdown : '');

    if (!markdown) throw new Error('pdfToMarkdown returned empty markdown');
    return markdown;
  };

  try {
    const md = await call("auto");
    pdfCache.set(cacheKey, md);
    return md;
  } catch (e) {
    console.error('  ❌ pdfToMarkdown a échoué :', e?.message || e);
    return { error: String(e?.message || e) };
  }
}

async function getCachedMarkdown(pdfUrl, dateLabel, docType) {
  const officialPdfPath = await getArchivedPdfPath(pdfUrl, dateLabel, docType);
  const chosenPdfPath = await ensureSearchablePdf(officialPdfPath);

  // Chemins attendus sans toucher au réseau
  const { pdf: expectedPdfPath, md: mdFilePath } = expectedPathsForDoc(pdfUrl, dateLabel, docType);

  // 1) cache mémoire
  if (mdCache[mdFilePath]) return mdCache[mdFilePath];

  // 2) fichier MD déjà présent → short-circuit total
  try {
    const cachedMd = await fs.readFile(mdFilePath, 'utf8');
    mdCache[mdFilePath] = cachedMd;
    return cachedMd;
  } catch { } // pas de MD, on continue

  // 3) sinon seulement maintenant on s’assure du PDF (download/ocr éventuel)
  const pdfPath = await getArchivedPdfPath(pdfUrl, dateLabel, docType); // utilise votre logique existante
  const markdownContent = await getCachedPdfText(pdfPath, dateLabel, docType);
  if (markdownContent?.error) return { error: markdownContent.error };

  // 4) on écrit le MD pour les prochains runs
  await fs.mkdir(path.dirname(mdFilePath), { recursive: true });
  await fs.writeFile(mdFilePath, markdownContent, 'utf8');
  mdCache[mdFilePath] = markdownContent;
  return markdownContent;
}


// ---------- Données ----------
const BASE = 'https://www.mairie-corte.fr/';
const ODJ = [
  { date: '2025-10-28', href: 'modules.php?name=Downloads&d_op=getit&lid=1910' },
  //  { date:'2025-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1912' },
  //  { date:'2025-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1913' },
  //  { date:'2025-03-18', href:'modules.php?name=Downloads&d_op=getit&lid=1914' },
  //  { date:'2024-12-23', href:'modules.php?name=Downloads&d_op=getit&lid=1915' },
  //  { date:'2024-12-16', href:'modules.php?name=Downloads&d_op=getit&lid=1916' },
  //  { date:'2024-12-09', href:'modules.php?name=Downloads&d_op=getit&lid=1917' },
  //  { date:'2024-10-28', href:'modules.php?name=Downloads&d_op=getit&lid=1772' },
  //  { date:'2024-09-23', href:'modules.php?name=Downloads&d_op=getit&lid=1751' },
  //  { date:'2024-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1753' },
  //  { date:'2024-04-22', href:'modules.php?name=Downloads&d_op=getit&lid=1717' },
  //  { date:'2024-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1718' },
  //  { date:'2024-03-25', href:'modules.php?name=Downloads&d_op=getit&lid=1719' },
  //  { date:'2024-02-12', href:'modules.php?name=Downloads&d_op=getit&lid=1642' },
  //  { date:'2023-11-20', href:'modules.php?name=Downloads&d_op=getit&lid=1615' },
  //  { date:'2023-10-30', href:'modules.php?name=Downloads&d_op=getit&lid=1592' },
  //  { date:'2023-07-24', href:'modules.php?name=Downloads&d_op=getit&lid=1596' },
  //  { date:'2023-04-11', href:'modules.php?name=Downloads&d_op=getit&lid=1597' },
  //  { date:'2023-03-20', href:'modules.php?name=Downloads&d_op=getit&lid=1600' },
  //  { date:'2023-02-13', href:'modules.php?name=Downloads&d_op=getit&lid=1599' },
];
const PV = [
  //  { date:'2025-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1911' },
  //  { date:'2025-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1920' },
  //  { date:'2024-12-23', href:'modules.php?name=Downloads&d_op=getit&lid=1923' },
  //  { date:'2024-12-16', href:'modules.php?name=Downloads&d_op=getit&lid=1924' },
  //  { date:'2024-12-09', href:'modules.php?name=Downloads&d_op=getit&lid=1918' },
  //  { date:'2024-10-28', href:'modules.php?name=Downloads&d_op=getit&lid=1928' },
  //  { date:'2024-09-23', href:'modules.php?name=Downloads&d_op=getit&lid=1771' },
  //  { date:'2024-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1752' },
  //  { date:'2024-04-22', href:'modules.php?name=Downloads&d_op=getit&lid=1714' },
  //  { date:'2024-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1713' },
  //  { date:'2024-03-25', href:'modules.php?name=Downloads&d_op=getit&lid=1715' },
  //  { date:'2024-02-13', href:'modules.php?name=Downloads&d_op=getit&lid=1712' },
  //  { date:'2023-11-20', href:'modules.php?name=Downloads&d_op=getit&lid=1716' },
  //  { date:'2023-10-30', href:'modules.php?name=Downloads&d_op=getit&lid=1617' },
  //  { date:'2023-07-24', href:'modules.php?name=Downloads&d_op=getit&lid=1604' },
  //  { date:'2023-04-11', href:'modules.php?name=Downloads&d_op=getit&lid=1594' },
  //  { date:'2023-03-20', href:'modules.php?name=Downloads&d_op=getit&lid=1593' },
  //  { date:'2023-02-13', href:'modules.php?name=Downloads&d_op=getit&lid=1598' },
];
const DELIB_LISTES = [
  { date: '2025-10-28', href: 'modules.php?name=Downloads&d_op=getit&lid=1909' },
  //  { date:'2025-07-01', href:'modules.php?name=Downloads&d_op=getit&lid=1919' },
  //  { date:'2025-04-08', href:'modules.php?name=Downloads&d_op=getit&lid=1921' },
  //  { date:'2025-03-18', href:'modules.php?name=Downloads&d_op=getit&lid=1925' },
];

// ---------- Helpers ----------
function clean(s = '') { return s.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim(); }
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.map(c => mdEscape(c)).join(' | ')} |`).join('\n');
  return `${head}\n${body}\n`;
}
function sstr(x) { return (typeof x === 'string') ? x : String(x ?? ''); }
function mdEscape(s = '') { return sstr(s).replace(/\|/g, '\\|'); }


// ---------- LLM: canonisation ----------


import crypto from 'node:crypto';

const CANON_CACHE_DIR = getConfig('canon_cache_dir') ||
  path.join(process.cwd(), 'public', 'docs', 'conseils', 'cache', 'canon');

const CANON_PROMPT_VERSION = getConfig('canon_prompt_version', 'v1'); // incrémentez si vous changez le prompt few-shot
const CANON_CACHE_TTL_SEC = Number(getConfig('canon_cache_ttl_sec', 0)); // 0 = pas d’expiration

// Mémoire (process) pour accélérer les re-calls instantanés
const memCache = new Map();

/** Normalise le texte pour le hash (réduit le bruit OCR sans perdre le sens). */
function normTextForHash(s = '') {
  return String(s)
    .replace(/\r/g, '\n')
    .replace(/\u00AD/g, '')      // soft hyphen
    .replace(/[ \t]+\n/g, '\n')  // espaces en fin de ligne
    .replace(/\n{3,}/g, '\n\n')  // sauts excessifs
    .trim();
}

function sha256hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/** Construit une clé stable pour le cache. */
function buildKey({ text, kind, model, promptVersion = CANON_PROMPT_VERSION }) {
  const payload = JSON.stringify({
    kind: String(kind || '').toUpperCase(),
    model: String(model || ''),
    promptVersion,
    text: normTextForHash(text || '')
  });
  return sha256hex(payload);
}

function keyToPath(key, hint = {}) {
  // Sous-dossiers par type pour lisibilité
  const kind = String(hint.kind || '').toUpperCase();
  const date = String(hint.date || '').replace(/[^0-9\-]/g, '') || 'nodate';
  const dir = path.join(CANON_CACHE_DIR, kind);
  const name = `${date}_${key}.json`;
  return { dir, file: path.join(dir, name) };
}

/** Lit le disque si présent et valide (TTL et hash). */
async function readCache(key, hint = {}) {
  const { file } = keyToPath(key, hint);
  try {
    const raw = await fs.readFile(file, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj || obj.key !== key) return null;

    if (CANON_CACHE_TTL_SEC > 0) {
      const age = (Date.now() - (obj.meta?.ts || 0)) / 1000;
      if (age > CANON_CACHE_TTL_SEC) return null;
    }
    return obj;
  } catch { return null; }
}

/** Écriture atomique. */
async function writeCache(key, hint = {}, valueObj) {
  const { dir, file } = keyToPath(key, hint);
  await fs.mkdir(dir, { recursive: true });
  const tmp = file + '.tmp';
  const payload = JSON.stringify(valueObj, null, 2);
  await fs.writeFile(tmp, payload, 'utf8');
  await fs.rename(tmp, file);
}

/**
 * Wrapper cache pour la canonisation.
 * - `llmCanonFn` : fonction qui appelle le LLM et retourne {items:[...]}.
 * - `text` : contenu markdown brut
 * - `kind` : "ODJ" | "PV" | "DELIB"
 * - `opts` : { model, date, sourceUrl, promptVersion }
 */
export async function canonizeItemsCached(llmCanonFn, text, kind, opts = {}) {
  const model = opts.model || getConfig('canon_model', 'gpt-5-thinking');
  const promptVersion = opts.promptVersion || CANON_PROMPT_VERSION;

  const key = buildKey({ text, kind, model, promptVersion });
  const memHit = memCache.get(key);
  if (memHit) return memHit.value;

  const disk = await readCache(key, { kind, date: opts.date });
  if (disk?.value) {
    memCache.set(key, { value: disk.value });
    return disk.value;
  }

  // Cache miss → appel LLM
  const value = await llmCanonFn(text, kind, { model });

  // Sauvegarde
  const record = {
    key,
    meta: {
      kind: String(kind).toUpperCase(),
      model,
      promptVersion,
      date: opts.date || null,
      sourceUrl: opts.sourceUrl || null,
      ts: Date.now()
    },
    value // typiquement { items: [...] }
  };
  try { await writeCache(key, { kind, date: opts.date }, record); } catch { }

  memCache.set(key, { value });
  return value;
}


async function canonizeItemsLLM(rawText, kind, { model }) {
  if (typeof rawText !== 'string') {
    console.warn(`  ⚠ ${kind}: entrée non textuelle, canonisation sautée`);
    return [];
  }
  const cleanText = clean(rawText);
  const chars = cleanText.replace(/\s+/g, '').length;

  if (chars < 50) {
    console.log(`  ⚠ Texte insuffisant pour ${kind}: ${chars} chars`);
    return [];
  }

  console.log(`  🤖 Canonisation ${kind} (${chars} chars) via ${CANON_MODEL}…`);

  const schema = {
    type: "json_schema",
    json_schema: {
      name: "CanonItems",
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                order: { type: "integer" },
                raw: { type: "string" },
                title: { type: "string" },
                topic: { type: "string" },
                action: { type: "string" },
                domain: { type: "string" },
                keywords: { type: "array", items: { type: "string" } }
              },
              // >>> TOUS les champs listés dans 'properties' doivent être requis
              required: ["order", "raw", "title", "topic", "action", "domain", "keywords"],
              additionalProperties: false
            }
          }
        },
        required: ["items"],
        additionalProperties: false
      },
      strict: true
    }
  };


  try {
    console.log('  🤖 Canonisation', kind, 'via', CANON_MODEL, '…');
    const resp = await client.chat.completions.create({
      model: CANON_MODEL,
      response_format: schema,
      messages: [
        {
          role: 'system', content:
            PROMPT_CANON_SYSTEM_FR_OPHELIA + "\n" +
            `Vous extrayez les items d'un ODJ, PV ou liste de délibérations d’un conseil municipal français.
TÂCHE :
1) Identifier tous les points
2) Pour chaque point, fournir :
   - order (1..N)
   - raw
   - title
   - topic
   - action
   - domain
   - keywords (3 à 8)
CONTRAINTES :
- Conserver l’ordre
- Numéroter si absent
- JSON strict selon le schéma` },// 2) Few-shot #1
        {
          role: 'user', content: `
[INPUT]
25-10/081
LE CONSEIL,
Ouï l’exposé de son Maire,
Après en avoir délibéré,
A l’unanimité des membres présents et représentés,
ADOPTE la proposition de son Maire,
DÉCIDE:
ARTICLE 1 — Attribution d’une subvention de 5 000 € à l’association X…
[/INPUT]`.trim()
        },
        {
          role: 'assistant', content: JSON.stringify({
            items: [{
              order: 1,
              raw: "25-10/081\nLE CONSEIL… DÉCIDE:\nARTICLE 1 — Attribution d’une subvention de 5 000 € à l’association X…",
              title: "25-10/081 — Subvention association X (5 000 €)",
              topic: "Attribution d’une subvention à l’association X",
              action: "délibération",
              domain: "culture",
              keywords: ["unanimité", "subvention", "5 000 €", "ARTICLE 1"]
            }]
          })
        },

        // 2) Few-shot #2
        {
          role: 'user', content: `
[INPUT]
1. Approbation du PV du 12/09/2025
2. DM n°2 du budget principal 2025
3. Marché d’éclairage public — Avenant n°1
[/INPUT]`.trim()
        },
        {
          role: 'assistant', content: JSON.stringify({
            items: [
              {
                order: 1, raw: "1. Approbation du PV du 12/09/2025",
                title: "Approbation du PV du 12/09/2025",
                topic: "Approbation du procès-verbal",
                action: "approbation", domain: "finances", keywords: ["PV", "12/09/2025"]
              },
              {
                order: 2, raw: "2. DM n°2 du budget principal 2025",
                title: "DM n°2 — Budget principal 2025",
                topic: "Décision modificative du budget 2025",
                action: "budget", domain: "finances", keywords: ["DM n°2", "budget 2025"]
              },
              {
                order: 3, raw: "3. Marché d’éclairage public — Avenant n°1",
                title: "Avenant n°1 — Marché d’éclairage public",
                topic: "Avenant au marché d’éclairage public",
                action: "avenant", domain: "marchés publics",
                keywords: ["marché", "éclairage public", "avenant n°1"]
              }
            ]
          })
        },
        { role: 'user', content: cleanText.slice(0, 15000) }
      ]
    });

    const content = resp.choices?.[0]?.message?.content || '{"items":[]}';
    console.log('  ✅ Canonisation', kind, 'via', CANON_MODEL, '…');
    let out;
    try { out = JSON.parse(content); }
    catch { out = { items: [] }; }

    const items = Array.isArray(out.items)
      ? out.items.map((it, i) => ({
        order: Number.isInteger(it.order) ? it.order : (i + 1),
        title: clean(it.title || ''),
        topic: clean(it.topic || ''),
        action: clean(it.action || ''),
        domain: clean(it.domain || ''),
        raw: clean(it.raw || ''),
        keywords: Array.isArray(it.keywords) ? it.keywords.slice(0, 8).map(clean) : []
      }))
      : [];

    console.log(`  ✅ ${items.length} items extraits`);
    if (items.length) console.log(`     Ex: "${items[0].title.slice(0, 50)}..."`);
    return items;
  } catch (e) {
    console.error(`  ❌ Erreur canonisation ${kind}:`, e.message);
    return [];
  }
}

// ---------- Embeddings ----------
const BATCH_SIZE = Number(getConfig('embed_batch_size', 64));
const MAX_RETRY = Number(getConfig('embed_max_retry', 5));
const BASE_DELAY = Number(getConfig('embed_base_delay_ms', 400));
const CACHE_DIR = getConfig('embed_cache_dir') ||
  path.join(process.cwd(), 'public', 'docs', 'conseil', 'cache', 'emb');

// --- utils
function norm(s = '') {
  return String(s)
    .replace(/\r/g, '\n')
    .replace(/\u00AD/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
function keyFor(text, model = EMBED_MODEL) {
  return `${model}__${sha256hex(JSON.stringify({ model, text: norm(text) }))}`;
}


// --- appel embeddings avec retry backoff
async function embedBatchSerial(inputs, model = EMBED_MODEL) {
  let attempt = 0;
  for (; ;) {
    try {
      const res = await client.embeddings.create({ model, input: inputs });
      return res.data.map(d => d.embedding);
    } catch (e) {
      attempt++;
      if (attempt >= MAX_RETRY) throw e;
      const code = e?.status || e?.code || '';
      const delay = BASE_DELAY * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
      // 429/5xx → backoff
      await new Promise(r => setTimeout(r, delay));
      if (getConfig('debug_audit') === '1') {
        console.warn(`[embed-batch retry ${attempt}] code=${code} wait=${delay}ms`);
      }
    }
  }
}

// --- API: embeddings en série avec cache, ordre conservé
async function embedManySerialized(arr, opts = {}) {
  const model = opts.model || EMBED_MODEL;
  const N = arr.length;
  if (!N) return [];

  // 1) pré-remplir depuis cache
  const out = new Array(N);
  const toDoIdx = [];
  const toDoTxt = [];

  for (let i = 0; i < N; i++) {
    const t = String(arr[i] ?? '');
    const key = keyFor(t, model);
    const hit = await readCache(key);
    if (hit && Array.isArray(hit.embedding)) {
      out[i] = hit.embedding;
    } else {
      toDoIdx.push(i);
      toDoTxt.push(t);
    }
  }

  // 2) lots sérialisés (pas de Promise.all), ordre déterministe
  for (let off = 0; off < toDoTxt.length; off += BATCH_SIZE) {
    const batchTxt = toDoTxt.slice(off, off + BATCH_SIZE);
    const batchIdx = toDoIdx.slice(off, off + BATCH_SIZE);

    const embs = await embedBatchSerial(batchTxt, model); // un seul appel réseau
    // mapping + cache
    for (let k = 0; k < embs.length; k++) {
      const i = batchIdx[k];
      out[i] = embs[k];
      const key = keyFor(arr[i], model);
      // écriture non bloquante
      writeCache(key, { model, embedding: embs[k] }).catch(() => { });
    }
  }

  // 3) sécurité: tout doit être rempli
  for (let i = 0; i < N; i++) {
    if (!Array.isArray(out[i])) {
      // fallback: vecteur zéro de longueur 1536/3072 selon modèle. On évite de crasher.
      const dim = (model.includes('small') ? 1536 : 3072);
      out[i] = Array(dim).fill(0);
    }
  }
  return out;
}

// ---------- Affectation hongroise (max sim) ----------
function hungarianMaxSim(simMatrix) {
  const n = simMatrix.length, m = simMatrix[0]?.length || 0;
  if (n === 0 || m === 0) return [];
  const N = Math.max(n, m);
  const cost = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => 1 - (simMatrix[i]?.[j] ?? 0))
  );
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (Number.isNaN(cost[i][j])) cost[i][j] = 1;

  const u = Array(N).fill(0), v = Array(N).fill(0), p = Array(N).fill(-1), way = Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(N).fill(Infinity);
    const used = Array(N).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let j1 = 0, delta = Infinity;
      for (let j = 1; j < N; j++) if (!used[j]) {
        const cur = cost[i0][j] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j < N; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== -1);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const assign = Array(n).fill(-1);
  for (let j = 1; j < N; j++) {
    const i = p[j];
    if (i >= 0 && i < n && j < m) assign[i] = j;
  }
  return assign;
}

// ---------- LLM: jugement des paires ----------
async function judgePairs(date, pairs) {
  if (!pairs.length) return [];
  console.log(`  ⚖️  Jugement de ${pairs.length} paires ambiguës via ${JUDGE_MODEL}…`);

  const schema = {
    type: "json_schema",
    json_schema: {
      name: "AgendaActsJudgement",
      schema: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                idx: { type: "integer" },
                status: { type: "string", enum: ["CORRESPONDANCE", "ORDRE_MODIFIE", "LIBELLE_DIVERGENT", "PERIMETRE_MODIFIE"] },
                rationale: { type: "string" }
              },
              required: ["idx", "status", "rationale"],
              additionalProperties: false
            }
          }
        },
        required: ["results"],
        additionalProperties: false
      },
      strict: true
    }
  };

  const input = pairs.map((p, i) => ({
    idx: i,
    odj_order: p.odj.order,
    act_order: p.act.order,
    odj_title: p.odj.title,
    act_title: p.act.title,
    odj_meta: { topic: p.odj.topic, action: p.odj.action, domain: p.odj.domain, keywords: p.odj.keywords },
    act_meta: { topic: p.act.topic, action: p.act.action, domain: p.act.domain, keywords: p.act.keywords }
  }));

  try {
    console.log('  🤖 Jugement de', pairs.length, 'paires via', JUDGE_MODEL, '…');
    const resp = await client.chat.completions.create({
      model: JUDGE_MODEL,
      response_format: schema,
      messages: [
        {
          role: 'system', content:
            PROMPT_JUDGE_SYSTEM_FR_OPHELIA + "\n" +
            `Vous comparez des points ODJ vs Actes (PV/Délibérations).
STATUTS :
- CORRESPONDANCE : même sujet, ordre identique
- ORDRE_MODIFIE   : même sujet, ordre différent
- LIBELLE_DIVERGENT : libellé différent, fond similaire
- PERIMETRE_MODIFIE : périmètre réellement étendu ou réduit
Retour JSON conforme au schéma.` },
        { role: 'user', content: `Séance du ${date}\n\n${JSON.stringify(input, null, 2)}` }
      ]
    });
    const content = resp.choices?.[0]?.message?.content || '{"results":[]}';
    const out = JSON.parse(content);
    console.log('  ✅ Jugement terminé');
    return out.results || [];
  } catch (e) {
    console.error('  ❌ Erreur jugement :', e.message);
    return [];
  }
}

// ---------- Pipeline par date ----------
async function processDate(date) {
  console.log(`\n${'='.repeat(60)}\n  Séance du ${date}\n${'='.repeat(60)}`);

  const odjX = ODJ.find(x => x.date === date);
  const pvX = PV.find(x => x.date === date);
  const dlX = DELIB_LISTES.find(x => x.date === date);

  const res = { date, sources: {}, findings: [] };
  if (!odjX) { console.log(`  ⚠ Pas d’ODJ pour ${date}`); return res; }

  const odjUrl = absUrl(BASE, odjX.href);
  const odjText = await getCachedMarkdown(odjUrl, date, 'odj');
  res.sources.odj = { url: odjUrl, ok: (typeof odjText === 'string') && odjText.replace(/\s+/g, '').length >= 50 };
  res.sources.searchable_odj = { local: path.join(CONSEIL_DIR, path.basename(await getArchivedPdfPath(odjUrl, date, 'odj'))) };
  const odjItems = await canonizeItemsCached(canonizeItemsLLM, odjText, 'ODJ');

  let actUrl = null, actKind = null, actText = '', actItems = [];

  if (dlX) {
    console.log('\n  📋 Traitement DÉLIBÉRATIONS…');
    actUrl = absUrl(BASE, dlX.href);
    actText = await getCachedMarkdown(actUrl, date, 'delib');
    actKind = 'DELIB';
    actItems = await canonizeItemsCached(canonizeItemsLLM, actText, 'DELIB');
  }
  if ((!actItems.length) && pvX) {
    console.log('\n  📋 Traitement PROCÈS-VERBAL…');
    actUrl = absUrl(BASE, pvX.href);
    actText = await getCachedMarkdown(actUrl, date, 'pv');
    actKind = 'PV';
    actItems = await canonizeItemsCached(canonizeItemsLLM, actText, 'PV');
  }
  if (actUrl) res.sources[actKind.toLowerCase()] = { url: actUrl, ok: (typeof actText === 'string') && actText.replace(/\s+/g, '').length >= 50 };

  if (!odjItems.length || !actItems.length) {
    const msg = !odjItems.length ? 'ODJ vide' : 'Actes vides';
    console.log(`\n  ❌ ${msg} — comparaison impossible`);
    res.findings.push({ against: actKind || 'AUCUN', rows: [], note: `Sources insuffisantes (${msg})` });
    return res;
  }

  console.log(`\n  🔍 COMPARAISON : ${odjItems.length} ODJ ↔ ${actItems.length} ${actKind}`);

  const canonText = it => [it.title, it.topic, it.action, it.domain, (it.keywords || []).join(' ')].filter(Boolean).join(' | ');
  const O = odjItems.map(canonText);
  const A = actItems.map(canonText);
  // Embeddings en SÉRIE, par lots, avec cache disque
  const [eO, eA] = [
    await embedManySerialized(O, { model: EMBED_MODEL }),
    await embedManySerialized(A, { model: EMBED_MODEL })
  ];
  console.log(`  ✅ ${eO.length} embeddings ODJ générés`);
  console.log(`  ✅ ${eA.length} embeddings Actes générés`);

  const M = O.map((_, i) => A.map((__, j) => cosine(eO[i], eA[j])));
  const assign = hungarianMaxSim(M);
  console.log(`  ✅ ${assign.length} affectations maximales`);

  const rows = [];
  const usedJ = new Set();
  const toJudge = [];

  assign.forEach((j, i) => {
    if (j === -1) {
      rows.push({ status: 'ABSENT_DANS_ACTES', odj_order: odjItems[i].order, act_order: '', similarity: '', odj_title: odjItems[i].title, act_title: '' });
      return;
    }
    usedJ.add(j);
    const sim = +M[i][j].toFixed(3);
    const match = { odj: odjItems[i], act: actItems[j], sim };

    if (sim < LOW_SIM) {
      rows.push({ status: 'ABSENT_DANS_ACTES', odj_order: match.odj.order, act_order: '', similarity: sim, odj_title: match.odj.title, act_title: '' });
      return;
    }
    if (sim >= HIGH_SIM) {
      const samePos = (match.odj.order === match.act.order);
      rows.push({
        status: samePos ? 'CORRESPONDANCE' : 'ORDRE_MODIFIE',
        odj_order: match.odj.order,
        act_order: match.act.order,
        similarity: sim,
        odj_title: match.odj.title,
        act_title: match.act.title
      });
      return;
    }
    toJudge.push({ i, j, odj: match.odj, act: match.act, sim });
  });

  for (let j = 0; j < actItems.length; j++) {
    if (!usedJ.has(j)) {
      rows.push({ status: 'AJOUT_HORS_ODJ', odj_order: '', act_order: actItems[j].order, similarity: '', odj_title: '', act_title: actItems[j].title });
    }
  }

  if (toJudge.length) {
    const judged = await judgePairs(date, toJudge.map(x => ({ odj: x.odj, act: x.act })));
    for (const j of judged) {
      const src = toJudge[j.idx];
      rows.push({
        status: j.status || 'LIBELLE_DIVERGENT',
        odj_order: src.odj.order,
        act_order: src.act.order,
        similarity: src.sim,
        odj_title: src.odj.title,
        act_title: src.act.title,
        rationale: j.rationale || ''
      });
    }
  }

  const summary = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log(`\n  ✅ ${rows.length} lignes`);
  console.log(`     - Correspondances : ${summary.CORRESPONDANCE || 0}`);
  console.log(`     - Ordre modifié   : ${summary.ORDRE_MODIFIE || 0}`);
  console.log(`     - Libellé divergent : ${summary.LIBELLE_DIVERGENT || 0}`);
  console.log(`     - Périmètre modifié : ${summary.PERIMETRE_MODIFIE || 0}`);
  console.log(`     - Absents         : ${summary.ABSENT_DANS_ACTES || 0}`);
  console.log(`     - Ajouts          : ${summary.AJOUT_HORS_ODJ || 0}`);

  res.findings.push({ against: actKind || 'ACTES', rows });
  res.actKind = actKind || 'ACTES';
  res.odjItems = odjItems || [];
  res.actItems = actItems || [];
  return res;
}


async function extractEntitiesFromMarkdown(markdown, sourcePath) {
  const schema = {
    type: "json_schema",
    json_schema: {
      name: "OpheliaKB",
      schema: {
        type: "object",
        properties: {
          people: {
            type: "array", items: {
              type: "object", properties: {
                name: { type: "string" }, role: { type: "string" }, org: { type: "string" },
                aliases: { type: "array", items: { type: "string" } },
                summary: { type: "string" }, sources: { type: "array", items: { type: "string" } }
              }, required: ["name", "role", "org", "aliases", "summary", "sources"], additionalProperties: false
            }
          },
          orgs: {
            type: "array", items: {
              type: "object", properties: {
                name: { type: "string" }, type: { type: "string" },
                summary: { type: "string" }, aliases: { type: "array", items: { type: "string" } },
                sources: { type: "array", items: { type: "string" } }
              }, required: ["name", "type", "summary", "aliases", "sources"], additionalProperties: false
            }
          },
          places: {
            type: "array", items: {
              type: "object", properties: {
                name: { type: "string" }, kind: { type: "string" }, address: { type: "string" },
                summary: { type: "string" }, aliases: { type: "array", items: { type: "string" } },
                sources: { type: "array", items: { type: "string" } }
              }, required: ["name", "kind", "address", "summary", "aliases", "sources"], additionalProperties: false
            }
          },
          projects: {
            type: "array", items: {
              type: "object", properties: {
                name: { type: "string" }, owner: { type: "string" }, status: { type: "string" },
                budget_eur: { type: "number" }, summary: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                sources: { type: "array", items: { type: "string" } }
              }, required: ["name", "owner", "status", "budget_eur", "summary", "tags", "sources"], additionalProperties: false
            }
          },
          acts: {
            type: "array", items: {
              type: "object", properties: {
                date: { type: "string" }, title: { type: "string" }, domain: { type: "string" },
                action: { type: "string" }, amount_eur: { type: "number" },
                summary: { type: "string" }, source: { type: "string" }
              }, required: ["date", "title", "domain", "action", "amount_eur", "summary", "source"], additionalProperties: false
            }
          }
        },
        required: ["people", "orgs", "places", "projects", "acts"],
        additionalProperties: false
      },
      strict: true
    }
  };

  const chunks = chunkText(markdown, 14000);
  const acc = { people: [], orgs: [], places: [], projects: [], acts: [] };

  for (const ch of chunks) {
    console.log('  🤖 Extraction d\'entités', sourcePath, 'via', CANON_MODEL, '…');
    const resp = await client.chat.completions.create({
      model: CANON_MODEL,
      response_format: schema,
      messages: [
        { role: 'system', content: PROMPT_KB_SYSTEM_FR_OPHELIA },
        { role: 'user', content: `Source: ${sourcePath}\n\n${ch}` }
      ]
    });
    const pkt = JSON.parse(resp.choices[0].message.content);
    for (const k of Object.keys(acc)) acc[k].push(...(pkt[k] || []));
    console.log('  ✅ Extraction d\'entités', sourcePath, 'via', CANON_MODEL, '…');
  }

  // garantir la présence de la source
  for (const arr of Object.values(acc)) {
    for (const it of arr) {
      if (Array.isArray(it.sources) && it.sources.length === 0) it.sources = [sourcePath];
      if (typeof it.source === 'string' && !it.source) it.source = sourcePath;
    }
  }
  return acc;
}

function mergeKB(kbList) {
  const out = { people: new Map(), orgs: new Map(), places: new Map(), projects: new Map(), acts: [] };
  const upsert = (map, key, obj, mergeFn) => {
    const k = normKey(key);
    if (!map.has(k)) { map.set(k, JSON.parse(JSON.stringify(obj))); return; }
    const prev = map.get(k);
    map.set(k, mergeFn(prev, obj));
  };

  for (const kb of kbList) {
    for (const p of kb.people) {
      const key = p.name || (p.aliases?.[0] || '');
      upsert(out.people, key, p, (a, b) => ({
        name: a.name.length >= b.name.length ? a.name : b.name,
        role: a.role || b.role, org: a.org || b.org,
        aliases: Array.from(new Set([...(a.aliases || []), ...(b.aliases || [])])),
        summary: (a.summary || '').length >= (b.summary || '').length ? a.summary : b.summary,
        sources: Array.from(new Set([...(a.sources || []), ...(b.sources || [])]))
      }));
    }
    for (const o of kb.orgs) {
      upsert(out.orgs, o.name, o, (a, b) => ({
        name: a.name, type: a.type || b.type,
        aliases: Array.from(new Set([...(a.aliases || []), ...(b.aliases || [])])),
        summary: (a.summary || '').length >= (b.summary || '').length ? a.summary : b.summary,
        sources: Array.from(new Set([...(a.sources || []), ...(b.sources || [])]))
      }));
    }
    for (const pl of kb.places) {
      upsert(out.places, pl.name, pl, (a, b) => ({
        name: a.name, kind: a.kind || b.kind, address: a.address || b.address,
        aliases: Array.from(new Set([...(a.aliases || []), ...(b.aliases || [])])),
        summary: (a.summary || '').length >= (b.summary || '').length ? a.summary : b.summary,
        sources: Array.from(new Set([...(a.sources || []), ...(b.sources || [])]))
      }));
    }
    for (const pr of kb.projects) {
      upsert(out.projects, pr.name, pr, (a, b) => ({
        name: a.name, owner: a.owner || b.owner, status: a.status || b.status,
        budget_eur: Number.isFinite(a.budget_eur) ? a.budget_eur : b.budget_eur,
        summary: (a.summary || '').length >= (b.summary || '').length ? a.summary : b.summary,
        tags: Array.from(new Set([...(a.tags || []), ...(b.tags || [])])),
        sources: Array.from(new Set([...(a.sources || []), ...(b.sources || [])]))
      }));
    }
    out.acts.push(...(kb.acts || []));
  }

  return {
    people: Array.from(out.people.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    orgs: Array.from(out.orgs.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    places: Array.from(out.places.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    projects: Array.from(out.projects.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    acts: out.acts
  };
}

async function generateNarrativeForSession({ date, sources, odjItems, actItems, compareRows }) {
  const payload = {
    date,
    sources,
    counts: {
      odj: odjItems.length,
      acts: actItems.length,
      correspondance: compareRows.filter(r => r.status === 'CORRESPONDANCE').length,
      ordre_mod: compareRows.filter(r => r.status === 'ORDRE_MODIFIE').length,
      libelle_div: compareRows.filter(r => r.status === 'LIBELLE_DIVERGENT').length,
      perimetre_mod: compareRows.filter(r => r.status === 'PERIMETRE_MODIFIE').length,
      absents: compareRows.filter(r => r.status === 'ABSENT_DANS_ACTES').length,
      ajouts: compareRows.filter(r => r.status === 'AJOUT_HORS_ODJ').length,
    }
  };

  console.log('  🤖 Narrative', date, 'via', JUDGE_MODEL, '…');
  const resp = await client.chat.completions.create({
    model: JUDGE_MODEL, // ou un modèle texte “raisonnable”
    temperature: 0.1,
    messages: [
      { role: 'system', content: PROMPT_NARRATIVE_SYSTEM_FR_OPHELIA },
      { role: 'user', content: JSON.stringify(payload) }
    ]
  });
  console.log('  ✅ Narrative', date, 'via', JUDGE_MODEL, '…');
  return (resp.choices?.[0]?.message?.content || '').trim();
}

function fmtItemLine(it) {
  const a = it.action ? `_${it.action}_` : '';
  const d = it.domain ? `• _${it.domain}_` : '';
  const t = it.title || (it.raw || '').slice(0, 120);
  return `- [#${it.order ?? ''}] ${t} ${a} ${d}`.replace(/\s+/g, ' ').trim();
}
function topN(rows, status, n = 5) {
  return rows.filter(r => r.status === status).slice(0, n);
}

function buildSessionMarkdown(R, narrativeText = '') {
  const date = R.date;
  const srcs = [];
  if (R.sources?.odj) srcs.push(`[ODJ](${R.sources.odj.url})`);
  if (R.sources?.delib) srcs.push(`[Délibérations](${R.sources.delib.url})`);
  if (R.sources?.pv) srcs.push(`[PV](${R.sources.pv.url})`);
  const srcLine = srcs.join(' · ') || '—';

  const rows = (R.findings?.[0]?.rows) || [];
  const summary = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  const odjList = (R.odjItems || []).map(fmtItemLine).join('\n') || '_Aucun point détecté._';
  const actList = (R.actItems || []).map(fmtItemLine).join('\n') || '_Aucune délibération détectée._';

  const absents = topN(rows, 'ABSENT_DANS_ACTES').map(r => `- ODJ #${r.odj_order}: ${r.odj_title}`).join('\n');
  const ajouts = topN(rows, 'AJOUT_HORS_ODJ').map(r => `- Acte #${r.act_order}: ${r.act_title}`).join('\n');
  const ordreMod = topN(rows, 'ORDRE_MODIFIE').map(r => `- ODJ #${r.odj_order} ↔ Acte #${r.act_order}: ${r.odj_title}`).join('\n');
  const perimMod = topN(rows, 'PERIMETRE_MODIFIE').map(r => `- ${r.odj_title} ↔ ${r.act_title}`).join('\n');

  const table = mdTable(
    ['Statut', '#ODJ', '#Acte', 'Similarité', 'Libellé ODJ', 'Libellé Acte'],
    rows.map(r => [
      r.status, String(r.odj_order || ''), String(r.act_order || ''),
      String(r.similarity || ''), r.odj_title || '', r.act_title || ''
    ])
  );

  return [
    `# Conseil municipal — Corte — ${date}

**Sources** : ${srcLine}

## Ordre du jour — synthèse
${odjList}

## Délibérations — synthèse
${actList}

## Analyse ODJ ↔ ${R.actKind || 'Actes'}
**Correspondance**: ${summary.CORRESPONDANCE || 0} · **Ordre modifié**: ${summary.ORDRE_MODIFIE || 0} · **Libellé divergent**: ${summary.LIBELLE_DIVERGENT || 0} · **Périmètre modifié**: ${summary.PERIMETRE_MODIFIE || 0} · **Absents**: ${summary.ABSENT_DANS_ACTES || 0} · **Ajouts**: ${summary.AJOUT_HORS_ODJ || 0}

### Points à signaler
${absents || '- RAS'}
${ajouts ? '\n' + ajouts : ''}
${ordreMod ? '\n' + ordreMod : ''}
${perimMod ? '\n' + perimMod : ''}

### Détails
${table}

## Résumé pour Ophélia
${narrativeText || '_Résumé non disponible._'}

> Méthode : canonicalisation ${CANON_MODEL}, embeddings ${EMBED_MODEL}, affectation hongroise, jugement ${JUDGE_MODEL}.`
  ].join('\n\n');
}


async function buildOpheliaKnowledgeBase() {
  await fs.mkdir(CONSEIL_DIR, { recursive: true });
  const entries = await fs.readdir(CONSEILS_MD_DIR).catch(() => []);
  const mdFiles = entries.filter(f => f.toLowerCase().endsWith('.md'));
  const kbs = [];

  for (const f of mdFiles) {
    const p = path.join(CONSEILS_MD_DIR, f);
    const md = await fs.readFile(p, 'utf8').catch(() => '');
    if (md.trim().length < 50) continue;
    const kb = await extractEntitiesFromMarkdown(md, p);
    kbs.push(kb);
  }

  const merged = mergeKB(kbs);

  const OPHELIA_KB_MD = path.join(CONSEIL_DIR, 'ophelia_knowledge.md');
  const OPHELIA_KB_JSON = path.join(CONSEIL_DIR, 'ophelia_knowledge.json');

  let out = `# Base de connaissance — Ophélia\n\nSource: ODJ, PV, délibérations (OCR → Markdown).\n`;

  const esc = s => String(s).replaceAll('|', '\\|');
  const table = (hdr, rows) => `\n| ${hdr.join(' | ')} |\n| ${hdr.map(() => '---').join(' | ')} |\n` + rows.map(r => `| ${r.map(esc).join(' | ')} |`).join('\n') + '\n';

  out += table(['Nom', 'Rôle', 'Organisation', 'Alias', 'Source'],
    merged.people.map(x => [x.name, x.role, x.org, (x.aliases || []).join(', '), (x.sources || [])[0] || '']));
  out += table(['Organisation', 'Type', 'Alias', 'Source'],
    merged.orgs.map(x => [x.name, x.type, (x.aliases || []).join(', '), (x.sources || [])[0] || '']));
  out += table(['Lieu', 'Type', 'Adresse', 'Source'],
    merged.places.map(x => [x.name, x.kind, x.address, (x.sources || [])[0] || '']));
  out += table(['Projet', 'Porteur', 'Statut', 'Budget (€)', 'Tags', 'Source'],
    merged.projects.map(x => [x.name, x.owner, x.status, String(x.budget_eur || ''), (x.tags || []).join(', '), (x.sources || [])[0] || '']));

  await fs.writeFile(OPHELIA_KB_MD, out, 'utf8');
  await fs.writeFile(OPHELIA_KB_JSON, JSON.stringify(merged, null, 2), 'utf8');

  return merged;
}


async function generateNarrativeForSessionKb(R, kb) {
  const schema = {
    type: "json_schema", json_schema: {
      name: "AuditNarrative",
      schema: {
        type: "object", properties: {
          contexte: { type: "string" },
          finalite: { type: "string" },
          synthese: { type: "string" },
          points_sensibles: { type: "array", items: { type: "string" } },
          recommandations: { type: "array", items: { type: "string" } }
        }, required: ["contexte", "finalite", "synthese", "points_sensibles", "recommandations"], additionalProperties: false
      },
      strict: true
    }
  };

  const stats = (rows) => {
    const s = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
    return `correspondances:${s.CORRESPONDANCE || 0}, ordre_modifié:${s.ORDRE_MODIFIE || 0}, libellé_divergent:${s.LIBELLE_DIVERGENT || 0}, périmètre_modifié:${s.PERIMETRE_MODIFIE || 0}, absents:${s.ABSENT_DANS_ACTES || 0}, ajouts:${s.AJOUT_HORS_ODJ || 0}`;
  };

  const payload = {
    date: R.date,
    sources: R.sources,
    resume: (R.findings || []).map(b => ({ against: b.against, stats: stats(b.rows || []) })),
    kb_hint: {
      people: kb.people.slice(0, 20).map(x => ({ name: x.name, role: x.role, org: x.org })),
      projects: kb.projects.slice(0, 20).map(x => ({ name: x.name, owner: x.owner, status: x.status }))
    }
  };

  console.log('  🤖 Narrative', R.date, 'via', JUDGE_MODEL, '…');
  const resp = await client.chat.completions.create({
    model: JUDGE_MODEL,
    response_format: schema,
    messages: [
      { role: 'system', content: PROMPT_NARRATIVE_SYSTEM_FR_OPHELIA },
      { role: 'user', content: JSON.stringify(payload) }
    ]
  });
  console.log('  ✅ Narrative', R.date, 'via', JUDGE_MODEL, '…');
  return JSON.parse(resp.choices[0].message.content);
}


// ---------- Main ----------
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Audit ODJ ↔ Actes — Commune de Corte                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let dates = Array.from(new Set([
  ...ODJ.map(x => x.date),
  ...PV.map(x => x.date),
  ...DELIB_LISTES.map(x => x.date),
])).sort();

if (args.dates) {
  const only = new Set(String(args.dates).split(',').map(s => s.trim()));
  dates = dates.filter(d => only.has(d));
}
dates.reverse(); // plus récentes d’abord

console.log(`Traitement de ${dates.length} dates…`);

const reports = [];
for (const d of dates) {
  try {
    console.log(`Traitement de ${d}…`);
    const R = await processDate(d);
    console.log(`✓ ${d}: ${R.findings?.[0]?.rows?.length || 0} lignes`);
    reports.push(R);
  } catch (e) {
    console.error(`✗ Erreur ${d}:`, e.message || e);
    reports.push({ date: d, error: String(e) });
  }
}

const kb = await buildOpheliaKnowledgeBase(); // <-- construire la base après génération des .md

let md = `# Audit ODJ ↔ Actes (IA, précision maximale) — Commune de Corte\n\n`;
md += `Méthode : canonicalisation ${CANON_MODEL}, embeddings ${EMBED_MODEL}, affectation hongroise, jugement ${JUDGE_MODEL}.\n\n`;

const csvHeaders = ['date', 'contre', 'status', 'odj_order', 'act_order', 'similarity', 'odj_title', 'act_title', 'odj_url', 'act_url'];
const csv = [csvHeaders.join(',')];
const json = [];

for (const R of reports) {
  md += `## Séance ${R.date}\n`;
  if (R.error) { md += `Erreur: ${R.error}\n\n`; continue; }
  const src = [];
  if (R.sources?.odj) src.push(`[ODJ](${R.sources.odj.url})`);
  if (R.sources?.delib) src.push(`[Délibérations](${R.sources.delib.url})`);
  if (R.sources?.pv) src.push(`[PV](${R.sources.pv.url})`);
  md += `Sources: ${src.join(' · ') || '—'}\n\n`;

  for (const bloc of (R.findings || [])) {
    const rows = bloc.rows || [];
    const summary = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    md += `### ODJ → ${bloc.against}\n`;
    md += `**Correspondance**: ${summary.CORRESPONDANCE || 0} · **Ordre modifié**: ${summary.ORDRE_MODIFIE || 0} · **Libellé divergent**: ${summary.LIBELLE_DIVERGENT || 0} · **Périmètre modifié**: ${summary.PERIMETRE_MODIFIE || 0} · **Absents**: ${summary.ABSENT_DANS_ACTES || 0} · **Ajouts**: ${summary.AJOUT_HORS_ODJ || 0}\n\n`;
    md += mdTable(['Statut', '#ODJ', '#Acte', 'Similarité', 'Libellé ODJ', 'Libellé Acte'],
      rows.map(r => [
        r.status,
        String(r.odj_order || ''),
        String(r.act_order || ''),
        String(r.similarity || ''),
        r.odj_title || '',
        r.act_title || ''
      ])
    );
    for (const r of rows) {
      csv.push([
        R.date, bloc.against, r.status,
        r.odj_order || '', r.act_order || '',
        r.similarity || '',
        `"${(r.odj_title || '').replace(/"/g, '""')}"`,
        `"${(r.act_title || '').replace(/"/g, '""')}"`,
        R.sources?.odj?.url || '',
        (bloc.against === 'PV' ? R.sources?.pv?.url : R.sources?.delib?.url) || ''
      ].join(','));
    }
    json.push({ date: R.date, against: bloc.against, rows, sources: R.sources });
  }
  md += '\n';

  for (const bloc of (R.findings || [])) {
    const rows = bloc.rows || [];
    const summary = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    md += `### ODJ → ${bloc.against}\n`;
    md += `**Correspondance**: ${summary.CORRESPONDANCE || 0} · **Ordre modifié**: ${summary.ORDRE_MODIFIE || 0} · **Libellé divergent**: ${summary.LIBELLE_DIVERGENT || 0} · **Périmètre modifié**: ${summary.PERIMETRE_MODIFIE || 0} · **Absents**: ${summary.ABSENT_DANS_ACTES || 0} · **Ajouts**: ${summary.AJOUT_HORS_ODJ || 0}\n\n`;
    md += mdTable(['Statut', '#ODJ', '#Acte', 'Similarité', 'Libellé ODJ', 'Libellé Acte'],
      rows.map(r => [
        r.status, String(r.odj_order || ''), String(r.act_order || ''), String(r.similarity || ''),
        r.odj_title || '', r.act_title || ''
      ])
    );

    for (const r of rows) {
      csv.push([
        R.date, bloc.against, r.status,
        r.odj_order || '', r.act_order || '',
        r.similarity || '',
        `"${(r.odj_title || '').replace(/"/g, '""')}"`,
        `"${(r.act_title || '').replace(/"/g, '""')}"`,
        R.sources?.odj?.url || '',
        (bloc.against === 'PV' ? R.sources?.pv?.url : R.sources?.delib?.url) || ''
      ].join(','));
    }
    json.push({ date: R.date, against: bloc.against, rows, sources: R.sources });
  }

  // --- AJOUT: encadré IA par séance ---
  try {
    console.log(`  🤖 Narrative ${R.date} via ${JUDGE_MODEL}…`);
    const note = await generateNarrativeForSessionKb(R, kb);
    console.log(`  ✅ Narrative ${R.date} via ${JUDGE_MODEL}…`);
    md += `\n#### Contexte\n${note.contexte}\n\n`;
    md += `**Finalité.** ${note.finalite}\n\n`;
    md += `**Synthèse.** ${note.synthese}\n\n`;
    if ((note.points_sensibles || []).length) {
      md += `**Points sensibles.**\n` + note.points_sensibles.map(x => `- ${x}`).join('\n') + '\n\n';
    }
    if ((note.recommandations || []).length) {
      md += `**Recommandations.**\n` + note.recommandations.map(x => `- ${x}`).join('\n') + '\n\n';
    }
  } catch (e) {
    console.warn('Narrative IA indisponible:', e?.message || e);
  }

  md += '\n';
}

const SESSIONS_DIR = path.join(process.cwd(), 'public', 'docs', 'conseils');

await fs.mkdir(SESSIONS_DIR, { recursive: true });

for (const R of reports) {
  try {
    const rows = (R.findings?.[0]?.rows) || [];
    console.log(`  🤖 Narrative ${R.date} via ${JUDGE_MODEL}…`);
    const narrative = await generateNarrativeForSession({
      date: R.date,
      sources: R.sources || {},
      odjItems: R.odjItems || [],
      actItems: R.actItems || [],
      compareRows: rows
    });
    console.log(`  ✅ Narrative ${R.date} via ${JUDGE_MODEL}…`);
    const md = buildSessionMarkdown(R, narrative);
    const outPath = path.join(SESSIONS_DIR, `corte-${R.date}.md`);
    await fs.writeFile(outPath, md, 'utf8');
    console.log(`✓ Note de séance écrite: ${path.relative(process.cwd(), outPath)}`);
  } catch (e) {
    console.error(`✗ Note de séance ${R.date}:`, e.message || e);
  }
}


// Sorties


await fs.writeFile('rapport-odj-acts-ai.md', md, 'utf8');
await fs.writeFile('rapport-odj-acts-ai.csv', csv.join('\n'), 'utf8');
await fs.writeFile('rapport-odj-acts-ai.json', JSON.stringify(json, null, 2), 'utf8');

console.log('\n✓ Généré : rapport-odj-acts-ai.md, .csv, .json');
