/**
 * replay.js
 *
 * Permet de rejouer une trace d'exécution précédente.
 * Utile pour l'inspection et le debugging de la causalité.
 */

import { readFile } from "fs/promises";

export async function replayTrace(traceFilePath) {
  try {
    const content = await readFile(traceFilePath, "utf8");
    const lines = content.trim().split("\n");

    console.log(`\n=== REPLAY DE LA TRACE : ${traceFilePath} ===\n`);

    lines.forEach((line, index) => {
      try {
        const event = JSON.parse(line);
        console.log(`${index + 1}. [${event.time || event.timestamp}] ${event.type}`);
        if (event.data) console.log("   ", JSON.stringify(event.data));
      } catch {
        console.log(`${index + 1}. ${line}`);
      }
    });

    console.log(`\n${lines.length} événements rejoués.`);
  } catch (err) {
    console.error("Impossible de rejouer la trace :", err.message);
  }
}
