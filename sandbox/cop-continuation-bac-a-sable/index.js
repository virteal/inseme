#!/usr/bin/env node
/**
 * COP Continuation Bac-à-Sable
 *
 * CLI unique, automatisable et testable.
 * Inspiré du style de pipeline Cogentia : étapes claires, sorties structurées,
 * forte traçabilité, exécution locale et reproductible.
 *
 * Usage:
 *   node index.js run <scenario>
 *   node index.js list
 *   node index.js replay <trace-file>
 */

import { runScenario } from "./src/pipeline.js";
import { listScenarios } from "./src/scenario-loader.js";
import { replayTrace } from "./src/replay.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, "scenarios");

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case "run": {
      const scenarioName = args[0];
      if (!scenarioName) {
        console.error("Usage: node index.js run <scenario-name>");
        process.exit(1);
      }
      await runScenario(scenarioName, { scenariosDir: SCENARIOS_DIR });
      break;
    }

    case "list": {
      const scenarios = await listScenarios(SCENARIOS_DIR);
      console.log("Scénarios disponibles :");
      scenarios.forEach((name) => console.log(`  - ${name}`));
      break;
    }

    case "replay": {
      const traceFile = args[0];
      if (!traceFile) {
        console.error("Usage: node index.js replay <trace-file.jsonl>");
        process.exit(1);
      }
      await replayTrace(traceFile);
      break;
    }

    default:
      console.log(`
COP Continuation Bac-à-Sable (style pipeline Cogentia)

Commandes :
  run <scenario>     Exécute un scénario de test de continuations
  list               Liste les scénarios disponibles
  replay <fichier>   Rejoue une trace d'exécution pour inspection

Exemples :
  node index.js run research-review
  node index.js run federation-demo     # Fractanet bus + sub-buses + federation test
  node index.js list
      `);
  }
}

main().catch((err) => {
  console.error("Erreur fatale dans le bac à sable :", err);
  process.exit(1);
});
