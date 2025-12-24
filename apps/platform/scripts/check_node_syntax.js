import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const walk = (dir, out) => {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === "build") continue;
      walk(full, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!full.endsWith(".js")) continue;
    out.push(full);
  }
};

const candidateDirs = ["scripts", "mcp", "packages", "datasets", "src/netlify/edge-functions"].map(
  (p) => path.join(projectRoot, p)
);
const files = [];
for (const dir of candidateDirs) walk(dir, files);

const excluded = [
  path.join(projectRoot, "scripts", "check_node_syntax.js"),
  path.join(projectRoot, "src", path.sep),
  path.join(projectRoot, "public", path.sep),
  path.join(projectRoot, "netlify", path.sep),
  path.join(projectRoot, "src", "netlify", path.sep),
];
const shouldExclude = (file) =>
  excluded.some((e) => (e.endsWith(path.sep) ? file.startsWith(e) : file === e));

const targets = files.filter((f) => !shouldExclude(f));
if (targets.length === 0) {
  console.log("No files to check.");
  process.exit(0);
}

let failures = 0;
for (const file of targets) {
  const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (res.status !== 0) {
    failures++;
    const stderr = (res.stderr || "").trim();
    const stdout = (res.stdout || "").trim();
    if (stdout) process.stdout.write(stdout + "\n");
    if (stderr) process.stderr.write(stderr + "\n");
    console.error(`Syntax check failed: ${file}`);
  }
}

if (failures > 0) {
  console.error(`Syntax check failed for ${failures} file(s).`);
  process.exit(1);
}

console.log(`Syntax OK: ${targets.length} file(s).`);
