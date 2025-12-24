import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadConfig, getConfig } from "./lib/config.js";

// Charger la configuration
await loadConfig();

const COUNCIL_ROOT_DIR = path.resolve("public", "docs", "conseils");
const OUTPUT_FILE = path.join(COUNCIL_ROOT_DIR, "conseil-consolidated.md");
const COUNCIL_MAX_CHARS = Number(getConfig("council_max_chars", 500_000));
const COUNCIL_FILE_EXT = new Set([".md", ".txt"]);

function* walkDir(dirAbs) {
  if (!fs.existsSync(dirAbs)) return;
  const stack = [dirAbs];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { /* ignore */ }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else yield full;
    }
  }
}

function inferDateFromPath(p) {
  const s = p.replace(/\\/g, "/");
  let m = s.match(/(\d{4})[-_/\.](\d{2})[-_/\.](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function canonicalizeMarkdown(md) {
  if (!md) return "";
  let out = md;
  out = out.replace(/!\[[^\]]*\]\([^)]+\)/g, "");     // images
  out = out.replace(/<[^>]+>/g, "");                  // HTML
  const FENCE_LIMIT = 500000;
  out = out.replace(/```[\s\S]*?```/g, b => (b.length > FENCE_LIMIT ? b.slice(0, FENCE_LIMIT) + "\n```" : b));
  out = out.replace(/[ \t]+/g, " ");                  // espaces
  out = out.replace(/\n{3,}/g, "\n\n");               // sauts de ligne
  return out.trim();
}

function buildCouncilConsolidated() {
  if (!fs.existsSync(COUNCIL_ROOT_DIR)) {
    console.warn(`[build-conseil] Répertoire introuvable: ${COUNCIL_ROOT_DIR}`);
    return "";
  }

  /** @type {{ rel: string, date: string|null, text: string }[]} */
  const items = [];

  for (const fileAbs of walkDir(COUNCIL_ROOT_DIR)) {
    // ignorer la cible
    if (fileAbs === OUTPUT_FILE) continue;

    const ext = path.extname(fileAbs).toLowerCase();
    if (!COUNCIL_FILE_EXT.has(ext)) continue;

    let text = "";
    try { text = fs.readFileSync(fileAbs, "utf8"); } catch { continue; }

    const cleaned = canonicalizeMarkdown(text);
    if (!cleaned) continue;

    const rel = path.relative(COUNCIL_ROOT_DIR, fileAbs);
    const date = inferDateFromPath(fileAbs);
    items.push({ rel, date, text: cleaned });
  }

  items.sort((a, b) => {
    if (a.date && b.date) { if (a.date > b.date) return -1; if (a.date < b.date) return 1; }
    else if (a.date && !b.date) return -1;
    else if (!a.date && b.date) return 1;
    return a.rel.localeCompare(b.rel);
  });

  if (items.length === 0) return "";

  const parts = [];
  const now = new Date().toISOString();
  parts.push(`<!-- generated:${now} -->`);
  parts.push(`# Contexte municipal consolidé (convocations, PV, délibérations)\n`);

  for (const it of items) {
    const title = `## Conseil — ${it.date ?? "date inconnue"} — ${it.rel}`;
    parts.push(title);
    parts.push(it.text);
    parts.push("\n---\n");
  }

  let consolidated = parts.join("\n\n").trim();

  if (consolidated.length > COUNCIL_MAX_CHARS) {
    const head = consolidated.slice(0, Math.floor(COUNCIL_MAX_CHARS * 0.55));
    const tail = consolidated.slice(-Math.floor(COUNCIL_MAX_CHARS * 0.40));
    consolidated = head + `\n\n> [Tronqué pour taille. Ajustez COUNCIL_MAX_CHARS si nécessaire.]\n\n` + tail;
  }

  const sha = crypto.createHash("sha256").update(consolidated).digest("hex").slice(0, 16);
  consolidated = `<!-- sha256:${sha} -->\n` + consolidated;

  return consolidated;
}

function main() {
  fs.mkdirSync(COUNCIL_ROOT_DIR, { recursive: true });
  const text = buildCouncilConsolidated();
  fs.writeFileSync(OUTPUT_FILE, text, "utf8");
  console.log(`[build-conseil] Écrit ${OUTPUT_FILE} (${text.length} chars)`);
}

main();
