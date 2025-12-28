#!/usr/bin/env node

/**
 * Check Import Paths in the entire project
 * Usage: node scripts/check-imports.js
 *
 * Scans for broken imports in .js and .jsx files across specified directories.
 * Provides suggestions if the target file exists elsewhere in the project.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root
const projectRoot = path.resolve(path.dirname(__dirname));

// CLI Flags
const SHOW_EXTENSIONS = process.argv.includes("--show-extensions");

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function colorize(text, color) {
  return `${colors[color] || ""}${text}${colors.reset}`;
}

// Regex for imports (multiline support)
const IMPORT_REGEX_MULTILINE =
  /import(?:\s+(?:.*?from\s+)?["'](.*?)[""])?|import\s+["'](.*?)["']/gs;

/**
 * Use git ls-files to get all tracked files (respects .gitignore)
 */
function getTrackedFiles() {
  try {
    const output = execSync("git ls-files", {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return output
      .trim()
      .split("\n")
      .map((f) => path.join(projectRoot, f))
      .filter((f) => f.endsWith(".js") || f.endsWith(".jsx"));
  } catch (error) {
    console.error(
      colorize(
        "Error running git ls-files. Falling back to manual crawl...",
        "red"
      )
    );
    return [];
  }
}

/**
 * Alternative: get files via glob-like patterns
 */
async function getFilesToScan() {
  // We want to scan:
  // - apps/*/src/**/*.js,jsx
  // - apps/*/scripts/**/*.js
  // - scripts/**/*.js
  // - packages/*/src/**/*.js,jsx

  const files = [];
  const trackedFiles = getTrackedFiles();

  const includePatterns = [
    /^apps\/.*\/src\/.*\.(js|jsx)$/,
    /^apps\/.*\/scripts\/.*\.js$/,
    /^scripts\/.*\.js$/,
    /^packages\/.*\/src\/.*\.(js|jsx)$/,
    /^packages\/.*\/index\.js$/, // Some packages might have index.js at root
  ];

  return trackedFiles.filter((file) => {
    const relativePath = path.relative(projectRoot, file).replace(/\\/g, "/");
    return includePatterns.some((pattern) => pattern.test(relativePath));
  });
}

// Global state
let allFilesIndex = new Map();
let nonExistentImportWarnings = [];
let extensionImportWarnings = []; // New: track imports with .js/.jsx extension
let duplicateFileNames = new Set();
let nonExistentReferencedFiles = new Set();
let importedFiles = new Set(); // Track actual resolved files that are imported
let scannedFiles = new Set(); // Track all files that were scanned for imports

/**
 * Build index of all JS/JSX files in the project
 */
async function buildFileIndex(allFiles) {
  console.log(
    colorize(`Building file index for ${allFiles.length} files...`, "cyan")
  );

  for (const filePath of allFiles) {
    scannedFiles.add(filePath);
    const basename = path.basename(filePath);
    if (!allFilesIndex.has(basename)) {
      allFilesIndex.set(basename, []);
    }
    allFilesIndex.get(basename).push(filePath);
  }

  let duplicateCount = 0;
  for (const [basename, paths] of allFilesIndex.entries()) {
    if (paths.length > 1) {
      duplicateFileNames.add(basename);
      duplicateCount++;
    }
  }

  console.log(
    colorize(
      `Indexing complete. ${duplicateCount} duplicate basenames found.`,
      "green"
    )
  );
}

function findTargetFilesFromIndex(targetFileName) {
  return allFilesIndex.get(targetFileName) || [];
}

function getRelativePath(fromPath, toPath) {
  const fromDir = path.dirname(fromPath);
  let relPath = path.relative(fromDir, toPath);
  if (!relPath.startsWith(".") && !path.isAbsolute(relPath)) {
    relPath = "./" + relPath;
  }
  return relPath.replace(/\\/g, "/");
}

async function checkPathExistence(baseResolvedPath) {
  const possiblePaths = [baseResolvedPath];
  const ext = path.extname(baseResolvedPath);

  if (ext === "" || !ext.match(/\.(js|jsx)$/i)) {
    possiblePaths.push(baseResolvedPath + ".js");
    possiblePaths.push(baseResolvedPath + ".jsx");

    try {
      const stats = await fs.stat(baseResolvedPath);
      if (stats.isDirectory()) {
        possiblePaths.push(path.join(baseResolvedPath, "index.js"));
        possiblePaths.push(path.join(baseResolvedPath, "index.jsx"));
      }
    } catch {}
  }

  for (const p of possiblePaths) {
    try {
      await fs.access(p);
      importedFiles.add(path.resolve(p)); // Track successful imports
      return true;
    } catch {}
  }
  return false;
}

async function checkImportsInFile(filePath) {
  const results = [];
  let fileContent;
  try {
    fileContent = await fs.readFile(filePath, "utf8");
  } catch {
    return [];
  }

  let match;
  IMPORT_REGEX_MULTILINE.lastIndex = 0;

  while ((match = IMPORT_REGEX_MULTILINE.exec(fileContent)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath) continue;

    const lineIndex = fileContent.substring(0, match.index).split("\n").length;
    const lineNumber = lineIndex > 0 ? lineIndex : 1;

    // Only relative or absolute imports
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) continue;

    // Ignore assets
    if (
      importPath.match(
        /\.(css|scss|less|png|svg|jpg|jpeg|gif|webp|woff2?|ttf|eot)$/i
      )
    )
      continue;

    const fileDir = path.dirname(filePath);
    let resolvedPath = path.resolve(fileDir, importPath);

    // Check for unwanted .js/.jsx extension
    if (importPath.match(/\.(js|jsx)$/i)) {
      extensionImportWarnings.push({
        file: filePath,
        line: lineNumber,
        importPath: importPath,
        suggested: importPath.replace(/\.(js|jsx)$/i, ""),
      });
    }

    let exists = await checkPathExistence(resolvedPath);
    if (exists) continue;

    const targetFileName = path.basename(importPath).split("?")[0];
    let potentialTargetFiles = [];

    if (path.extname(targetFileName) === "") {
      potentialTargetFiles.push(
        ...findTargetFilesFromIndex(targetFileName + ".js")
      );
      potentialTargetFiles.push(
        ...findTargetFilesFromIndex(targetFileName + ".jsx")
      );
    } else {
      potentialTargetFiles.push(...findTargetFilesFromIndex(targetFileName));
    }

    if (potentialTargetFiles.length === 0) {
      nonExistentImportWarnings.push({
        file: filePath,
        line: lineNumber,
        badImport: importPath,
        message: `File "${targetFileName}" not found anywhere.`,
      });
      nonExistentReferencedFiles.add(targetFileName);
    } else {
      const fixes = potentialTargetFiles.map((targetFile) => {
        const correctPath = getRelativePath(filePath, targetFile);
        return { targetFile, correctPath };
      });

      results.push({
        file: filePath,
        line: lineNumber,
        badImport: importPath,
        fixes: fixes,
      });
    }
  }
  return results;
}

async function main() {
  console.log(colorize("========================================", "cyan"));
  console.log(colorize("       Monorepo Import Checker", "cyan"));
  console.log(colorize("========================================", "cyan"));
  console.log("");

  const allFiles = await getFilesToScan();
  await buildFileIndex(allFiles);

  let allFixableImports = [];
  console.log(
    colorize(`Scanning ${allFiles.length} files for imports...`, "cyan")
  );

  for (const file of allFiles) {
    const fileResults = await checkImportsInFile(file);
    allFixableImports.push(...fileResults);
  }

  console.log("");
  console.log(colorize("--- Import Issues Summary ---", "yellow"));

  if (nonExistentImportWarnings.length > 0) {
    console.log(
      colorize("\n🚨 MAJOR ERRORS: Imports to non-existent files:\n", "red")
    );
    nonExistentImportWarnings.forEach((warning) => {
      const relPath = path.relative(projectRoot, warning.file);
      console.log(
        `${colorize(relPath, "gray")}:${colorize(warning.line, "yellow")}`
      );
      console.log(`  Import: "${colorize(warning.badImport, "red")}"`);
      console.log(`  ${warning.message}\n`);
    });
  } else {
    console.log(
      colorize("\n✅ No imports to missing files detected.", "green")
    );
  }

  // --- NEW: Extension Warnings ---
  if (extensionImportWarnings.length > 0) {
    if (SHOW_EXTENSIONS) {
      console.log(
        colorize(
          "\n⚠️ EXTENSION WARNINGS: Imports with .js or .jsx extension (not recommended):\n",
          "yellow"
        )
      );
      extensionImportWarnings.forEach((warning) => {
        const relPath = path.relative(projectRoot, warning.file);
        console.log(
          `${colorize(relPath, "gray")}:${colorize(warning.line, "yellow")}`
        );
        console.log(`  Current: "${colorize(warning.importPath, "red")}"`);
        console.log(`  Suggested: "${colorize(warning.suggested, "green")}"\n`);
      });
    } else {
      console.log(
        colorize(
          `\nℹ️  Skipped ${extensionImportWarnings.length} extension warnings. (Use --show-extensions to see them)`,
          "gray"
        )
      );
    }
  }

  if (allFixableImports.length > 0) {
    console.log(
      colorize(
        "\n⚠️ WARNINGS: Broken paths (but target exists elsewhere):\n",
        "yellow"
      )
    );
    allFixableImports.forEach((result) => {
      const relPath = path.relative(projectRoot, result.file);
      console.log(
        `${colorize(relPath, "gray")}:${colorize(result.line, "yellow")}`
      );
      console.log(`  Current: "${colorize(result.badImport, "red")}"`);
      result.fixes.forEach((fix, index) => {
        const targetRel = path.relative(projectRoot, fix.targetFile);
        console.log(`  Suggestion ${index + 1}:`);
        console.log(`    File found at: ${colorize(targetRel, "cyan")}`);
        console.log(
          `    Suggested path: "${colorize(fix.correctPath, "green")}"`
        );
      });
      console.log("");
    });
  } else {
    console.log(colorize("\n✅ No fixable import paths found.", "green"));
  }

  // --- NEW: Unused Files Detection ---
  const unusedFiles = [...scannedFiles].filter(
    (f) => !importedFiles.has(path.resolve(f))
  );
  // Filter out entry points and standalone files
  const filteredUnused = unusedFiles.filter((f) => {
    const rel = path.relative(projectRoot, f).replace(/\\/g, "/");
    return (
      !rel.includes("main.jsx") &&
      !rel.includes("index.jsx") &&
      !rel.includes("main.js") &&
      !rel.includes("/netlify/") && // Netlify files are auto-loaded by Netlify
      // Scripts directly under a "scripts" folder are entry points, but subfolders are not
      !(rel.split("/").slice(-2, -1)[0] === "scripts")
    );
  });

  if (filteredUnused.length > 0) {
    console.log(
      colorize(
        "\n🔍 UNUSED FILES: Files that are never imported (potential orphans):\n",
        "magenta"
      )
    );
    filteredUnused.forEach((file) => {
      console.log(`  - ${colorize(path.relative(projectRoot, file), "gray")}`);
    });
    console.log(
      colorize(
        `\n  Total potential orphans: ${filteredUnused.length}`,
        "magenta"
      )
    );
  }

  // --- NEW: Duplicate Basename Report ---
  if (duplicateFileNames.size > 0) {
    console.log(
      colorize(
        "\n📂 DUPLICATE BASENAMES: Different files with the same name:\n",
        "yellow"
      )
    );
    for (const name of duplicateFileNames) {
      const paths = allFilesIndex.get(name);
      console.log(
        `  ${colorize(name, "cyan")} exists in ${paths.length} locations:`
      );
      paths.forEach((p) =>
        console.log(`    - ${colorize(path.relative(projectRoot, p), "gray")}`)
      );
    }
  }

  console.log("");
  console.log(colorize("========================================", "cyan"));
  const totalIssues =
    nonExistentImportWarnings.length +
    allFixableImports.length +
    extensionImportWarnings.length;
  if (totalIssues === 0) {
    console.log(colorize("🎉 All imports are valid!", "green"));
  } else {
    console.log(colorize(`Total issues found: ${totalIssues}`, "red"));
    console.log(`  - Major errors: ${nonExistentImportWarnings.length}`);
    console.log(`  - Fixable paths: ${allFixableImports.length}`);
    console.log(`  - Extension warnings: ${extensionImportWarnings.length}`);
  }
  console.log(colorize("========================================", "cyan"));
}

main().catch((err) =>
  console.error(colorize(`Script error: ${err.message}`, "red"))
);
