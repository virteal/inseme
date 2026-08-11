import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const configPath = fileURLToPath(new URL("./lib/config.js", import.meta.url));

function functionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must remain exported`);
  const nextExport = source.indexOf("\nexport ", start + 1);
  return source.slice(start, nextExport === -1 ? undefined : nextExport);
}

test("loadConfig remains read-only", async () => {
  const source = await readFile(configPath, "utf8");
  const body = functionBody(source, "loadConfig");

  assert.doesNotMatch(body, /repairNullSecretsIfSuspect\s*\(/);
  assert.doesNotMatch(body, /uploadToVault\s*\(/);
  assert.doesNotMatch(body, /\.upsert\s*\(/);
  assert.doesNotMatch(body, /\.update\s*\(/);
});

test("explicit promotion retains metadata repair responsibility", async () => {
  const source = await readFile(configPath, "utf8");
  const body = functionBody(source, "pushEnvSecretsToVault");

  assert.match(body, /repairNullSecretsIfSuspect\s*\(/);
  assert.match(body, /uploadToVault\s*\(/);
});
