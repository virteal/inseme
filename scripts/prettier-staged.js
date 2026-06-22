#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const files = process.argv.slice(2);
let preserved = 0;
const eligible = [];

for (const input of files) {
  const file = path.resolve(input);
  const source = await fs.readFile(file, "utf8");

  // Cogentia owns the exact representation of generated sections. Formatting
  // the surrounding Markdown would also rewrite those sections and create drift.
  if (path.extname(file).toLowerCase() === ".md" && /<!--\s*BEGIN_AUTO:/.test(source)) {
    preserved++;
    console.log(
      `prettier-staged: preserve Cogentia document ${path.relative(process.cwd(), file)}`
    );
    continue;
  }

  eligible.push(file);
}

if (eligible.length) {
  const executable = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prettier.cmd" : "prettier"
  );
  const result = spawnSync(executable, ["--write", ...eligible], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`prettier-staged: eligible=${eligible.length}, preserved=${preserved}`);
