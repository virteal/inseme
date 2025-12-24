import fs from "fs";
import { execSync, spawnSync } from "child_process";
import path from "path";

const root = path.resolve(process.cwd());
const tmpInput = path.join(root, "tmp-tailwind-input.css");
const outDump = path.join(root, "tailwind-dump.txt");

// Create a minimal input file for Tailwind
const inputContent = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
fs.writeFileSync(tmpInput, inputContent, "utf8");

const contentPatterns = [
  path.join(root, "index.html"),
  path.join(root, "src", "**", "*.{js,jsx,ts,tsx}"),
];
const contentArgs = contentPatterns.flatMap((p) => ["--content", p]);

try {
  console.log("Running Tailwind CLI (Windows-safe) to generate dump...");
  const localBin = path.join(root, "node_modules", ".bin");
  const possibleBins = [
    path.join(localBin, "tailwindcss"),
    path.join(localBin, "tailwindcss.cmd"),
    path.join(localBin, "tailwindcss.exe"),
  ];
  let tailwindBin = null;
  for (const b of possibleBins) {
    try {
      if (fs.existsSync(b)) {
        tailwindBin = b;
        break;
      }
    } catch (e) {}
  }

  if (tailwindBin) {
    const args = ["-i", tmpInput, "-o", outDump, ...contentArgs, "--minify"];
    console.log("Executing:", tailwindBin, args.join(" "));
    const r = spawnSync(tailwindBin, args, { stdio: "inherit" });
    if (r.error || r.status !== 0) {
      throw new Error("tailwind binary failed to run: " + (r.error?.message || r.status));
    }
  } else {
    const r = spawnSync(
      "npx",
      ["tailwindcss", "-i", tmpInput, "-o", outDump, ...contentArgs, "--minify"],
      {
        stdio: "inherit",
        shell: false,
      }
    );
    if (r.error || r.status !== 0) {
      throw new Error("npx tailwindcss failed to run: " + (r.error?.message || r.status));
    }
  }

  console.log("tailwind-dump.txt generated at", outDump);
  // optionally run extractor to refresh JSON
  try {
    console.log("Parsing dump to extract classes...");
    execSync("node scripts/extract-classes.js --tailwind", { stdio: "inherit" });
    console.log("Tailwind classes updated in tailwind-classes.json");
  } catch (e) {
    console.warn(
      "Could not run extract-classes.js --tailwind automatically. You can run it manually: node scripts/extract-classes.js --tailwind"
    );
  }
} catch (err) {
  console.error(
    "Failed to generate tailwind dump. Ensure tailwindcss is installed and available via npx. Error:",
    err.message
  );
  process.exit(1);
} finally {
  try {
    fs.unlinkSync(tmpInput);
  } catch (e) {}
}
