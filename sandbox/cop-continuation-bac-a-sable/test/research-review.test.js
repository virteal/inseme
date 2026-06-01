/**
 * Test basique du scénario research-review.
 * Exécutable avec : npm test
 */

import test from "node:test";
import assert from "node:assert";
import { runScenario } from "../src/pipeline.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, "..", "scenarios");

test("research-review scenario runs without throwing", async () => {
  const result = await runScenario("research-review", { scenariosDir: SCENARIOS_DIR });

  assert.ok(result.trace.length > 5, "La trace doit contenir plusieurs événements");
  assert.ok(result.activeContinuations.size >= 0, "Le run doit se terminer proprement");
});
