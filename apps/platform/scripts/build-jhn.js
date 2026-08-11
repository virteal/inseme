#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const viteCli = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const JHN_STATIC_META = {
  title: "John — Personal conversational agent",
  description:
    "John is the personal conversational agent for Jean Hugues Noel Robert. Public reading is open; writing is governed.",
  canonicalUrl: "https://jhn.baronsmariani.org/",
};

export async function specializeJhnIndexHtml(
  indexPath = path.join(scriptDir, "..", "dist", "index.html")
) {
  const index = await readFile(indexPath, "utf8");
  const replacements = [
    ['<html lang="fr">', '<html lang="en">'],
    [
      '<title id="page-title">Consultation Citoyenne</title>',
      `<title id="page-title">${JHN_STATIC_META.title}</title>`,
    ],
    [
      "Plateforme de consultation citoyenne incluant un wiki collaboratif et un système de propositions citoyennes.",
      JHN_STATIC_META.description,
    ],
    ['content="Consultation Citoyenne"', `content="${JHN_STATIC_META.title}"`],
    [
      "Participez à la démocratie locale avec notre plateforme de consultation citoyenne.",
      JHN_STATIC_META.description,
    ],
    ['content="{{ APP_URL }}"', `content="${JHN_STATIC_META.canonicalUrl}"`],
    [
      'content="{{ APP_URL }}/images/og-image.png"',
      `content="${JHN_STATIC_META.canonicalUrl}images/og-image.png"`,
    ],
  ];

  let specialized = index;
  for (const [from, to] of replacements) {
    if (!specialized.includes(from)) {
      throw new Error(`Expected JHN index marker is missing: ${from}`);
    }
    specialized = specialized.replaceAll(from, to);
  }
  await writeFile(indexPath, specialized, "utf8");
}
async function main() {
  const child = spawn(process.execPath, [viteCli, "build"], {
    env: { ...process.env, INSEME_DEPLOYMENT_PROFILE: "jhn" },
    stdio: "inherit",
  });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (exitCode, signal) => {
      if (signal) reject(new Error(`JHN Vite build terminated by signal: ${signal}`));
      else resolve(exitCode ?? 1);
    });
  });
  if (code !== 0) process.exitCode = code;
  else await specializeJhnIndexHtml();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Unable to build JHN: ${error.message}`);
    process.exitCode = 1;
  });
}
