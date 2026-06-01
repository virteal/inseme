/**
 * scenario-loader.js
 *
 * Charge les scénarios depuis le dossier scenarios/.
 * Chaque scénario est un module ESM qui exporte { name, steps }.
 * Style Cogentia : déclaration claire des étapes du pipeline.
 */

import { readdir } from "fs/promises";
import { join, extname } from "path";

/**
 * Liste tous les scénarios disponibles.
 */
export async function listScenarios(scenariosDir) {
  try {
    const files = await readdir(scenariosDir);
    return files.filter((f) => extname(f) === ".js").map((f) => f.replace(/\.js$/, ""));
  } catch {
    return [];
  }
}

/**
 * Charge un scénario par son nom.
 */
export async function loadScenario(name, scenariosDir) {
  const filePath = join(scenariosDir, `${name}.js`);
  try {
    const mod = await import(`file://${filePath}`);
    return mod.default || mod;
  } catch (err) {
    console.error(`Impossible de charger le scénario ${name}:`, err.message);
    return null;
  }
}
