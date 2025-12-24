/**
 * rapport-corte-total.js
 *
 * Contrôle automatisé – Commune de Corte
 * Volets : Convocations, Listes des délibérations, Procès-verbaux (PV)
 *
 * Sorties :
 *   - rapport-corte-total.txt   (texte prêt pour corps d’email à la Préfecture)
 *   - rapport-corte-total.md    (version Markdown pour wiki collaboratif)
 *   - rapport-corte-total.csv   (table exploitable)
 *   - rapport-corte-total.json  (détails techniques)
 *
 * Usage :
 *   node rapport-corte-total.js
 *
 * Dépendances : aucune (Node >= 16)
 *
 * Hypothèses et rappels :
 *   - Convocations : délai minimal 5 jours francs (≥ 3 500 hab.). Urgence possible ≥ 1 jour franc, à motiver.
 *   - Délibérations : publication de la liste « dans la semaine » suivant la séance.
 *   - PV : publication « dans la semaine » suivant la séance où il est arrêté (en pratique, la séance suivante).
 *   - La "date de publication" utilisée est l’en-tête HTTP Last-Modified du PDF final.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

// ------------------------------------------------------------
// Paramètres généraux
// ------------------------------------------------------------
const BASE = 'https://www.mairie-corte.fr/';
const USER_AGENT = 'CorteLegalReport/2.1 (+no-deps; Node.js)';
const MAX_REDIRECTS = 10;

// Règles légales
const CONVOC_REQUIRED_CLEAR_DAYS = 5; // jours francs
const LISTE_DELIB_MAX_CAL_DAYS = 7;  // « dans la semaine »
const PV_MAX_CAL_DAYS = 7;           // « dans la semaine » après séance d’arrêt

// ------------------------------------------------------------
// Données — mettez à jour ici si besoin
// ------------------------------------------------------------
const SEANCES = [
  { date: '2025-10-28' },
  { date: '2025-07-01' },
  { date: '2025-04-08' },
  { date: '2025-03-18' },
  { date: '2024-12-23' },
  { date: '2024-12-16' },
  { date: '2024-12-09' },
  { date: '2024-10-28' },
  { date: '2024-09-23' },
  { date: '2024-07-01' },
  { date: '2024-04-22' },
  { date: '2024-04-08' },
  { date: '2024-03-25' },
  { date: '2024-02-12' },
  { date: '2023-11-20' },
  { date: '2023-10-30' },
  { date: '2023-07-24' },
  { date: '2023-04-11' },
  { date: '2023-03-20' },
  { date: '2023-02-13' },
].sort((a,b)=>a.date.localeCompare(b.date));

const CONVOCATIONS = [
  { label: 'Convocation/ODJ 28/10/2025', date: '2025-10-28', href: 'modules.php?name=Downloads&d_op=getit&lid=1910' },
  { label: 'Convocation/ODJ 01/07/2025', date: '2025-07-01', href: 'modules.php?name=Downloads&d_op=getit&lid=1912' },
  { label: 'Convocation/ODJ 08/04/2025', date: '2025-04-08', href: 'modules.php?name=Downloads&d_op=getit&lid=1913' },
  { label: 'Convocation/ODJ 18/03/2025', date: '2025-03-18', href: 'modules.php?name=Downloads&d_op=getit&lid=1914' },
  { label: 'Convocation/ODJ 23/12/2024', date: '2024-12-23', href: 'modules.php?name=Downloads&d_op=getit&lid=1915' },
  { label: 'Convocation/ODJ 16/12/2024', date: '2024-12-16', href: 'modules.php?name=Downloads&d_op=getit&lid=1916' },
  { label: 'Convocation/ODJ 09/12/2024', date: '2024-12-09', href: 'modules.php?name=Downloads&d_op=getit&lid=1917' },
  { label: 'ODJ 28/10/2024',              date: '2024-10-28', href: 'modules.php?name=Downloads&d_op=getit&lid=1772' },
  { label: 'ODJ 23/09/2024',              date: '2024-09-23', href: 'modules.php?name=Downloads&d_op=getit&lid=1751' },
  { label: 'ODJ 01/07/2024',              date: '2024-07-01', href: 'modules.php?name=Downloads&d_op=getit&lid=1753' },
  { label: 'ODJ 22/04/2024',              date: '2024-04-22', href: 'modules.php?name=Downloads&d_op=getit&lid=1717' },
  { label: 'ODJ 08/04/2024',              date: '2024-04-08', href: 'modules.php?name=Downloads&d_op=getit&lid=1718' },
  { label: 'ODJ 25/03/2024',              date: '2024-03-25', href: 'modules.php?name=Downloads&d_op=getit&lid=1719' },
  { label: 'ODJ 12/02/2024',              date: '2024-02-12', href: 'modules.php?name=Downloads&d_op=getit&lid=1642' },
  { label: 'ODJ 20/11/2023',              date: '2023-11-20', href: 'modules.php?name=Downloads&d_op=getit&lid=1615' },
  { label: 'ODJ 30/10/2023',              date: '2023-10-30', href: 'modules.php?name=Downloads&d_op=getit&lid=1592' },
  { label: 'ODJ 24/07/2023',              date: '2023-07-24', href: 'modules.php?name=Downloads&d_op=getit&lid=1596' },
  { label: 'ODJ 11/04/2023',              date: '2023-04-11', href: 'modules.php?name=Downloads&d_op=getit&lid=1597' },
  { label: 'ODJ 20/03/2023',              date: '2023-03-20', href: 'modules.php?name=Downloads&d_op=getit&lid=1600' },
  { label: 'ODJ 13/02/2023',              date: '2023-02-13', href: 'modules.php?name=Downloads&d_op=getit&lid=1599' },
];

const DELIB_LISTES = [
  { label: 'Délibérations 28/10/2025', date: '2025-10-28', href: 'modules.php?name=Downloads&d_op=getit&lid=1909' },
  { label: 'Délibérations 01/07/2025', date: '2025-07-01', href: 'modules.php?name=Downloads&d_op=getit&lid=1919' },
  { label: 'Délibérations 08/04/2025', date: '2025-04-08', href: 'modules.php?name=Downloads&d_op=getit&lid=1921' },
  { label: 'Délibérations 18/03/2025', date: '2025-03-18', href: 'modules.php?name=Downloads&d_op=getit&lid=1925' },
];

const DELIB_REGISTRES = [
  { label: 'Registre 2024 T4', href: 'modules.php?name=Downloads&d_op=getit&lid=1932' },
  { label: 'Registre 2024 T3', href: 'modules.php?name=Downloads&d_op=getit&lid=1931' },
  { label: 'Registre 2024 T2', href: 'modules.php?name=Downloads&d_op=getit&lid=1930' },
  { label: 'Registre 2024 T1', href: 'modules.php?name=Downloads&d_op=getit&lid=1929' },
  { label: 'Registre 2023 T2', href: 'modules.php?name=Downloads&d_op=getit&lid=1756' },
  { label: 'Registre 2023 T1', href: 'modules.php?name=Downloads&d_op=getit&lid=1754' },
];

const PV_DOCS = [
  { label: 'PV 01/07/2025', date: '2025-07-01', href: 'modules.php?name=Downloads&d_op=getit&lid=1911' },
  { label: 'PV 08/04/2025', date: '2025-04-08', href: 'modules.php?name=Downloads&d_op=getit&lid=1920' },
  { label: 'PV 23/12/2024', date: '2024-12-23', href: 'modules.php?name=Downloads&d_op=getit&lid=1923' },
  { label: 'PV 16/12/2024', date: '2024-12-16', href: 'modules.php?name=Downloads&d_op=getit&lid=1924' },
  { label: 'PV 09/12/2024', date: '2024-12-09', href: 'modules.php?name=Downloads&d_op=getit&lid=1918' },
  { label: 'PV 28/10/2024', date: '2024-10-28', href: 'modules.php?name=Downloads&d_op=getit&lid=1928' },
  { label: 'PV 23/09/2024', date: '2024-09-23', href: 'modules.php?name=Downloads&d_op=getit&lid=1771' },
  { label: 'PV 01/07/2024', date: '2024-07-01', href: 'modules.php?name=Downloads&d_op=getit&lid=1752' },
  { label: 'PV 22/04/2024', date: '2024-04-22', href: 'modules.php?name=Downloads&d_op=getit&lid=1714' },
  { label: 'PV 08/04/2024', date: '2024-04-08', href: 'modules.php?name=Downloads&d_op=getit&lid=1713' },
  { label: 'PV 25/03/2024', date: '2024-03-25', href: 'modules.php?name=Downloads&d_op=getit&lid=1715' },
  { label: 'PV 13/02/2024', date: '2024-02-13', href: 'modules.php?name=Downloads&d_op=getit&lid=1712' },
  { label: 'PV 20/11/2023', date: '2023-11-20', href: 'modules.php?name=Downloads&d_op=getit&lid=1716' },
  { label: 'PV 30/10/2023', date: '2023-10-30', href: 'modules.php?name=Downloads&d_op=getit&lid=1617' },
  { label: 'PV 24/07/2023', date: '2023-07-24', href: 'modules.php?name=Downloads&d_op=getit&lid=1604' },
  { label: 'PV 11/04/2023', date: '2023-04-11', href: 'modules.php?name=Downloads&d_op=getit&lid=1594' },
  { label: 'PV 20/03/2023', date: '2023-03-20', href: 'modules.php?name=Downloads&d_op=getit&lid=1593' },
  { label: 'PV 13/02/2023', date: '2023-02-13', href: 'modules.php?name=Downloads&d_op=getit&lid=1598' },
];

// ------------------------------------------------------------
// HTTP utils
// ------------------------------------------------------------
function absUrl(base, href) {
  try { return new URL(href, base).toString(); }
  catch { return `${base.replace(/\/+$/, '')}/${href.replace(/^\/+/, '')}`; }
}
function requestOnce(targetUrl, method = 'HEAD', extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const options = {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method,
      headers: { 'User-Agent': USER_AGENT, 'Accept': '*/*', ...extraHeaders },
      timeout: 15000,
    };
    const req = lib.request(options, (res) => {
      res.resume();
      resolve({
        url: targetUrl,
        status: res.statusCode || 0,
        headers: Object.fromEntries(
          Object.entries(res.headers).map(([k,v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : v])
        ),
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}
async function headOrMinimalGet(url) {
  let r = await requestOnce(url, 'HEAD');
  if ([405,403,400].includes(r.status) || r.status >= 500) {
    r = await requestOnce(url, 'GET', { Range: 'bytes=0-0' });
  }
  return r;
}
function resolveLocation(currentUrl, location) {
  try { return new URL(location, currentUrl).toString(); }
  catch { return null; }
}
async function followToFinal(url, maxRedirects = MAX_REDIRECTS) {
  let current = url, hops = 0, last = null;
  while (true) {
    if (hops > maxRedirects) throw new Error('trop de redirections');
    last = await headOrMinimalGet(current);
    const loc = last.headers['location'];
    if (![301,302,303,307,308].includes(last.status) || !loc) break;
    const nextUrl = resolveLocation(current, loc);
    if (!nextUrl) throw new Error('location invalide');
    current = nextUrl; hops++;
  }
  return last;
}

// ------------------------------------------------------------
// Outils date Europe/Paris (CET/CEST sans dépendances)
// ------------------------------------------------------------
function lastSunday(year, monthIndex0) {
  const d = new Date(Date.UTC(year, monthIndex0 + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getUTCDate();
}
function parisMidnightUTC(dateIso) {
  const [y,m,d] = dateIso.split('-').map(Number);
  const dstStartUTC = Date.UTC(y, 2, lastSunday(y, 2), 1, 0, 0);
  const dstEndUTC   = Date.UTC(y, 9, lastSunday(y, 9), 1, 0, 0);
  const baseUTC = Date.UTC(y, m-1, d, 0, 0, 0);
  let offsetMin = 60;
  let midnightUTC = baseUTC - offsetMin * 60000;
  if (midnightUTC >= dstStartUTC && midnightUTC < dstEndUTC) {
    offsetMin = 120;
    midnightUTC = baseUTC - offsetMin * 60000;
  }
  return new Date(midnightUTC);
}
function parisDateISO(dateUTC) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(dateUTC);
  const get = t => parts.find(p => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function parisDateTimeISO(dateUTC) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(dateUTC);
  const get = t => parts.find(p => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
function clearDaysBetween(convISO, councilISO) {
  const start = parisMidnightUTC(convISO);
  const end   = parisMidnightUTC(councilISO);
  const diffDays = Math.round((end - start) / 86400000);
  return Math.max(0, diffDays - 1);
}
function calendarDaysFromAtoB(aISO, pubUTC) {
  const aMid = parisMidnightUTC(aISO).getTime();
  const pubLocalISO = parisDateISO(pubUTC);
  const pubMid = parisMidnightUTC(pubLocalISO).getTime();
  return Math.round((pubMid - aMid) / 86400000);
}
function findNextSeanceDate(currentDateISO) {
  const idx = SEANCES.findIndex(s => s.date > currentDateISO);
  return idx >= 0 ? SEANCES[idx].date : null;
}

// ------------------------------------------------------------
// Helpers rapport
// ------------------------------------------------------------
function toCsvCell(v) {
  const s = String(v ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}
function mdEscape(s='') {
  return String(s).replace(/\|/g, '\\|');
}
function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |\n| ${headers.map(()=> '---').join(' | ')} |\n`;
  const body = rows.map(r => `| ${r.map(c => mdEscape(c)).join(' | ')} |`).join('\n');
  return head + body + '\n';
}
function periodFromSeances() {
  const dates = SEANCES.map(s=>s.date).sort();
  return { start: dates[0], end: dates[dates.length-1] };
}
function summarizeByCategory(rows) {
  const byCat = {};
  for (const r of rows) {
    const k = r.category;
    byCat[k] ||= { total:0, CONFORME:0, NON_CONFORME:0, TARDIF:0, POSTERIEUR:0, ANTICIPEE:0, INDETERMINABLE:0 };
    byCat[k].total++;
    const v = (r.verdict||'INDETERMINABLE').toUpperCase();
    byCat[k][v] = (byCat[k][v] || 0) + 1;
  }
  return byCat;
}

// ------------------------------------------------------------
// Traitements par catégorie
// ------------------------------------------------------------
async function processConvocations() {
  const rows = [];
  for (const it of CONVOCATIONS) {
    const url = absUrl(BASE, it.href);
    try {
      const final = await followToFinal(url);
      const lmRaw = final.headers['last-modified'] || '';
      let verdict = 'INDETERMINABLE';
      let pubParisDate = '', pubParisDateTime = '', jf = null;

      if (lmRaw) {
        const pubUTC = new Date(lmRaw);
        if (!isNaN(pubUTC.getTime())) {
          pubParisDate = parisDateISO(pubUTC);
          pubParisDateTime = parisDateTimeISO(pubUTC);
          const pubMid = parisMidnightUTC(pubParisDate);
          const seanceMid = parisMidnightUTC(it.date);
          if (pubMid > seanceMid) {
            verdict = 'POSTERIEUR';
          } else {
            jf = clearDaysBetween(pubParisDate, it.date);
            verdict = jf >= CONVOC_REQUIRED_CLEAR_DAYS ? 'CONFORME' : 'NON_CONFORME';
          }
        }
      }
      rows.push({
        category: 'CONVOCATION',
        label: it.label,
        date_seance: it.date,
        url,
        last_modified: lmRaw,
        publication_paris_datetime: pubParisDateTime,
        jours_francs: jf,
        verdict
      });
    } catch (e) {
      rows.push({
        category: 'CONVOCATION',
        label: it.label,
        date_seance: it.date,
        url,
        error: e.message || String(e),
        verdict: 'INDETERMINABLE'
      });
    }
  }
  return rows.sort((a,b)=>a.date_seance.localeCompare(b.date_seance));
}

async function processDeliberations() {
  const rows = [];
  for (const it of DELIB_LISTES) {
    const url = absUrl(BASE, it.href);
    try {
      const final = await followToFinal(url);
      const lmRaw = final.headers['last-modified'] || '';
      let verdict = 'INDETERMINABLE';
      let pubParisDT = '', days = null, note='';

      if (lmRaw) {
        const pubUTC = new Date(lmRaw);
        if (!isNaN(pubUTC.getTime())) {
          pubParisDT = parisDateTimeISO(pubUTC);
          days = calendarDaysFromAtoB(it.date, pubUTC);
          if (days < 0) { verdict = 'ANTICIPEE'; note='publiée avant la séance'; }
          else { verdict = days <= LISTE_DELIB_MAX_CAL_DAYS ? 'CONFORME' : 'TARDIF'; }
        }
      }
      rows.push({
        category: 'DELIB_LISTE',
        label: it.label,
        date_seance: it.date,
        url,
        last_modified: lmRaw,
        publication_paris_datetime: pubParisDT,
        jours_calendaires_depuis_seance: days,
        verdict,
        note
      });
    } catch (e) {
      rows.push({
        category: 'DELIB_LISTE',
        label: it.label,
        date_seance: it.date,
        url,
        error: e.message || String(e),
        verdict: 'INDETERMINABLE'
      });
    }
  }
  for (const it of DELIB_REGISTRES) {
    const url = absUrl(BASE, it.href);
    try {
      const final = await followToFinal(url);
      const lmRaw = final.headers['last-modified'] || '';
      const pubUTC = lmRaw ? new Date(lmRaw) : null;
      const pubDT = pubUTC && !isNaN(pubUTC) ? parisDateTimeISO(pubUTC) : '';
      rows.push({
        category: 'DELIB_REGISTRE',
        label: it.label,
        date_seance: '',
        url,
        last_modified: lmRaw,
        publication_paris_datetime: pubDT,
        verdict: 'INDICATEUR_SEUL'
      });
    } catch (e) {
      rows.push({
        category: 'DELIB_REGISTRE',
        label: it.label,
        date_seance: '',
        url,
        error: e.message || String(e),
        verdict: 'INDICATEUR_SEUL'
      });
    }
  }
  return rows;
}

async function processPV() {
  const rows = [];
  for (const it of PV_DOCS) {
    const url = absUrl(BASE, it.href);
    try {
      const final = await followToFinal(url);
      const lmRaw = final.headers['last-modified'] || '';
      let verdict = 'INDETERMINABLE';
      let pubParisDT = '', daysAfterNext = null, nextSeance = null, note = '';

      if (lmRaw) {
        const pubUTC = new Date(lmRaw);
        if (!isNaN(pubUTC.getTime())) {
          pubParisDT = parisDateTimeISO(pubUTC);
          nextSeance = findNextSeanceDate(it.date);
          if (!nextSeance) {
            verdict = 'INDETERMINABLE';
            note = 'séance suivante inconnue';
          } else {
            daysAfterNext = calendarDaysFromAtoB(nextSeance, pubUTC);
            if (daysAfterNext < 0) { verdict = 'ANTICIPEE'; note='publiée avant séance d’arrêt'; }
            else { verdict = daysAfterNext <= PV_MAX_CAL_DAYS ? 'CONFORME' : 'TARDIF'; }
          }
        }
      }
      rows.push({
        category: 'PV',
        label: it.label,
        date_seance: it.date,
        date_seance_suivante: nextSeance || '',
        url,
        last_modified: lmRaw,
        publication_paris_datetime: pubParisDT,
        jours_calendaires_apres_seance_suivante: daysAfterNext,
        verdict,
        note
      });
    } catch (e) {
      rows.push({
        category: 'PV',
        label: it.label,
        date_seance: it.date,
        date_seance_suivante: '',
        url,
        error: e.message || String(e),
        verdict: 'INDETERMINABLE'
      });
    }
  }
  return rows.sort((a,b)=>a.date_seance.localeCompare(b.date_seance));
}

// ------------------------------------------------------------
// Exécution + génération des 4 fichiers
// ------------------------------------------------------------
(async () => {
  const gen = parisDateTimeISO(new Date());
  const period = periodFromSeances();

  const conv = await processConvocations();
  const delib = await processDeliberations();
  const pv = await processPV();

  const rows = [...conv, ...delib, ...pv];
  const synth = summarizeByCategory(rows);

  // ---------------- TXT (email) ----------------
  let txt = '';
  txt += `Objet : Commune de Corte — Délais de convocation, délibérations et PV — Rapport automatisé\n`;
  txt += `Période couverte : du ${period.start} au ${period.end}\n`;
  txt += `Généré : ${gen} (Europe/Paris)\n\n`;

  txt += `Base juridique (rappel synthétique) :\n`;
  txt += `- Convocations : 5 jours francs minimum (urgence possible ≥ 1 jour franc, à motiver).\n`;
  txt += `- Listes des délibérations : publication « dans la semaine » suivant la séance.\n`;
  txt += `- Procès-verbal : publication « dans la semaine » suivant la séance où il est arrêté (séance suivante).\n`;
  txt += `- La date de publication est estimée via l’en-tête HTTP Last-Modified des PDF finaux.\n\n`;

  txt += `Synthèse chiffrée :\n`;
  for (const [cat, s] of Object.entries(synth)) {
    txt += `- ${cat} : total=${s.total}, conforme=${s.CONFORME||0}, non_conforme=${s.NON_CONFORME||0}, tardif=${s.TARDIF||0}, postérieur=${s.POSTERIEUR||0}, anticipée=${s.ANTICIPEE||0}, indéterminable=${s.INDETERMINABLE||0}\n`;
  }
  txt += `\nDétail par dossier (publication [Europe/Paris] | métrique | verdict | URL) :\n`;
  for (const r of rows) {
    const pub = r.publication_paris_datetime || 'indéterminable';
    let metric = '';
    if (r.category === 'CONVOCATION') metric = (r.jours_francs ?? '—') + ' jf';
    else if (r.category === 'DELIB_LISTE') metric = (r.jours_calendaires_depuis_seance ?? '—') + ' j';
    else if (r.category === 'PV') metric = (r.jours_calendaires_apres_seance_suivante ?? '—') + ' j';
    else metric = '—';
    txt += `- [${r.category}] ${r.label} | ${pub} | ${metric} | ${r.verdict} | ${r.url}\n`;
    if (r.note) txt += `  note : ${r.note}\n`;
  }

  txt += `\nObservations probatoires :\n`;
  txt += `- La « date de publication » correspond à Last-Modified ; elle peut diverger d’un affichage papier ou d’un envoi.\n`;
  txt += `- Pour les PV, la contrainte court à partir de la séance d’arrêt ; ici, on suppose qu’il s’agit de la séance suivante connue.\n`;
  txt += `- Les registres/tomes sont traités comme indicateurs (hors délai « dans la semaine »).\n`;

  fs.writeFileSync('rapport-corte-total.txt', txt, 'utf8');

  // ---------------- MD (wiki) ----------------
  const mdLines = [];

  mdLines.push(`# Corte — Rapport automatisé sur la publicité des actes (convocations, délibérations, PV)`);
  mdLines.push(`**Période couverte** : ${period.start} → ${period.end}  \n**Généré** : ${gen} (Europe/Paris)`);
  mdLines.push(`\n## Rappel des règles\n`);
  mdLines.push(`- **Convocations** : 5 jours francs minimum avant la séance (urgence ≥ 1 jour franc, à motiver).`);
  mdLines.push(`- **Listes des délibérations** : publication **dans la semaine** suivant la séance.`);
  mdLines.push(`- **Procès-verbaux** : publication **dans la semaine** suivant la **séance d’arrêt** (généralement la séance suivante).`);
  mdLines.push(`- La « date de publication » est estimée via l’en-tête HTTP \`Last-Modified\` du PDF final.`);

  mdLines.push(`\n## Synthèse`);
  const synthTableRows = Object.entries(synth).map(([cat, s]) => [
    cat,
    String(s.total),
    String(s.CONFORME||0),
    String(s.NON_CONFORME||0),
    String(s.TARDIF||0),
    String(s.POSTERIEUR||0),
    String(s.ANTICIPEE||0),
    String(s.INDETERMINABLE||0),
  ]);
  mdLines.push(mdTable(
    ['Catégorie','Total','Conforme','Non conforme','Tardif','Postériorité','Anticipée','Indéterminable'],
    synthTableRows
  ));

  // Tables détaillées par catégorie
  mdLines.push(`\n## Détails`);
  const convRows = rows.filter(r=>r.category==='CONVOCATION').map(r=>[
    r.date_seance,
    r.publication_paris_datetime || '—',
    (r.jours_francs ?? '—') + ' jf',
    r.verdict,
    r.url
  ]);
  if (convRows.length) {
    mdLines.push(`\n### Convocations`);
    mdLines.push(mdTable(['Séance','Publication (Europe/Paris)','Jours francs','Verdict','Lien'], convRows));
  }

  const dlRows = rows.filter(r=>r.category==='DELIB_LISTE').map(r=>[
    r.date_seance,
    r.publication_paris_datetime || '—',
    (r.jours_calendaires_depuis_seance ?? '—') + ' j',
    r.verdict,
    r.url
  ]);
  if (dlRows.length) {
    mdLines.push(`\n### Listes des délibérations`);
    mdLines.push(mdTable(['Séance','Publication (Europe/Paris)','Jours après séance','Verdict','Lien'], dlRows));
  }

  const pvRows = rows.filter(r=>r.category==='PV').map(r=>[
    r.date_seance,
    r.date_seance_suivante || '—',
    r.publication_paris_datetime || '—',
    (r.jours_calendaires_apres_seance_suivante ?? '—') + ' j',
    r.verdict,
    r.url
  ]);
  if (pvRows.length) {
    mdLines.push(`\n### Procès-verbaux`);
    mdLines.push(mdTable(['Séance','Séance d’arrêt','Publication (Europe/Paris)','Jours après arrêt','Verdict','Lien'], pvRows));
  }

  mdLines.push(`\n## Observations`);
  mdLines.push(`- La publication web mesurée par \`Last-Modified\` peut différer de l’affichage légal papier et de l’envoi aux élus.`);
  mdLines.push(`- Pour les PV, la contrainte court à partir de la séance d’arrêt ; en l’absence d’information contraire, on prend la séance suivante connue.`);
  mdLines.push(`- Les registres (tomes) sont suivis comme indicateurs, sans incidence directe sur le délai « dans la semaine ».`);
  fs.writeFileSync('rapport-corte-total.md', mdLines.join('\n'), 'utf8');

  // ---------------- CSV ----------------
  const headers = [
    'category','label','date_seance','date_seance_suivante','publication_paris_datetime',
    'jours_francs','jours_calendaires_depuis_seance','jours_calendaires_apres_seance_suivante',
    'verdict','url','last_modified','error','note'
  ];
  const csv = [headers.map(toCsvCell).join(',')];
  for (const r of rows) {
    const row = headers.map(h => toCsvCell(r[h]));
    csv.push(row.join(','));
  }
  fs.writeFileSync('rapport-corte-total.csv', csv.join('\n'), 'utf8');

  // ---------------- JSON ----------------
  const json = {
    commune: 'Corte',
    period,
    generated_europe_paris: gen,
    legal_rules: {
      convoc_jours_francs_min: CONVOC_REQUIRED_CLEAR_DAYS,
      delib_max_jours_calendaires: LISTE_DELIB_MAX_CAL_DAYS,
      pv_max_jours_calendaires_apres_seance_arret: PV_MAX_CAL_DAYS
    },
    seances_connues: SEANCES,
    summary_by_category: synth,
    rows
  };
  fs.writeFileSync('rapport-corte-total.json', JSON.stringify(json, null, 2), 'utf8');

  console.log('Généré : rapport-corte-total.txt, rapport-corte-total.md, rapport-corte-total.csv, rapport-corte-total.json');
})();
