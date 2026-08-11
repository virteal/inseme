import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { specializeJhnIndexHtml } from "./build-jhn.js";

test("JHN build specializes static metadata without changing shared source HTML", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "inseme-jhn-meta-"));
  const indexPath = path.join(tempDir, "index.html");
  const fixture = `<!doctype html><html lang="fr"><head>
    <title id="page-title">Consultation Citoyenne</title>
    <meta name="description" content="Plateforme de consultation citoyenne incluant un wiki collaboratif et un système de propositions citoyennes.">
    <meta property="og:title" content="Consultation Citoyenne">
    <meta property="og:description" content="Participez à la démocratie locale avec notre plateforme de consultation citoyenne.">
    <meta property="og:url" content="{{ APP_URL }}">
    <meta property="og:image" content="{{ APP_URL }}/images/og-image.png">
    <meta name="twitter:image" content="{{ APP_URL }}/images/og-image.png">
  </head></html>`;
  try {
    await writeFile(indexPath, fixture, "utf8");
    await specializeJhnIndexHtml(indexPath);
    const specialized = await readFile(indexPath, "utf8");
    assert.match(specialized, /<html lang="en">/);
    assert.match(specialized, /John — Personal conversational agent/);
    assert.match(specialized, /https:\/\/jhn\.baronsmariani\.org\//);
    assert.doesNotMatch(specialized, /Consultation Citoyenne/);
    assert.doesNotMatch(specialized, /\{\{ APP_URL \}\}/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
