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

function getLocalTailwindBin() {
  const localBin = path.join(root, "node_modules", ".bin");
  const possibleBins = [
    path.join(localBin, "tailwindcss"),
    path.join(localBin, "tailwindcss.cmd"),
    path.join(localBin, "tailwindcss.exe"),
  ];
  for (const b of possibleBins) {
    try {
      if (fs.existsSync(b)) return b;
    } catch (e) {}
  }
  return null;
}

try {
  console.log("Running Tailwind CLI (Windows-safe) to generate dump...");
  let tailwindBin = getLocalTailwindBin();

  if (tailwindBin) {
    const args = ["-i", tmpInput, "-o", outDump, ...contentArgs, "--minify"];
    console.log("Executing local tailwind binary:", tailwindBin, args.join(" "));
    const r = spawnSync(tailwindBin, args, { stdio: "inherit" });
    if (r.error || r.status !== 0) {
      throw new Error("tailwind binary failed to run: " + (r.error?.message || r.status));
    }
  } else {
    // Try running via npx first
    let r = spawnSync(
      "npx",
      ["tailwindcss", "-i", tmpInput, "-o", outDump, ...contentArgs, "--minify"],
      {
        stdio: "inherit",
        shell: false,
      }
    );
    if (r.error || r.status !== 0) {
      console.warn("npx tailwindcss failed; attempting to install tailwind locally and retry...");
      // Attempt a local install (dev dependency) and retry
      const install = spawnSync("npm", ["install", "-D", "tailwindcss@4.1.17"], {
        stdio: "inherit",
        shell: false,
      });
      if (install.error || install.status !== 0) {
        throw new Error(
          "Failed to install tailwind locally; please run npm install -D tailwindcss@4.1.17 manually: " +
            (install.error?.message || install.status)
        );
      }
      tailwindBin = getLocalTailwindBin();
      if (tailwindBin) {
        const args = ["-i", tmpInput, "-o", outDump, ...contentArgs, "--minify"];
        const run2 = spawnSync(tailwindBin, args, { stdio: "inherit" });
        if (run2.error || run2.status !== 0) {
          throw new Error(
            "tailwind binary still failed after local install: " +
              (run2.error?.message || run2.status)
          );
        }
      } else {
        // As a last attempt retry npx one more time
        r = spawnSync(
          "npx",
          ["tailwindcss", "-i", tmpInput, "-o", outDump, ...contentArgs, "--minify"],
          { stdio: "inherit" }
        );
        if (r.error || r.status !== 0) {
          throw new Error(
            "npx tailwindcss failed to run even after installing tailwind: " +
              (r.error?.message || r.status)
          );
        }
      }
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
