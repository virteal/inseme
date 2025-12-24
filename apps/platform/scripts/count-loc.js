#!/usr/bin/env node

/**
 * Count Lines of Code in src/ directory with Velocity Metrics
 * Usage: node scripts/count-loc.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Get the project root (parent of scripts directory)
const projectRoot = path.dirname(__dirname);
const srcPath = path.join(projectRoot, "src");

console.log(colorize("========================================", "cyan"));
console.log(colorize("  Source Code Line Counter + Velocity", "cyan"));
console.log(colorize("========================================", "cyan"));
console.log("");

if (!fs.existsSync(srcPath)) {
  console.log(colorize(`Error: src/ directory not found at ${srcPath}`, "red"));
  process.exit(1);
}

console.log(colorize(`Analyzing: ${srcPath}`, "gray"));
console.log("");

/**
 * Check if the project is a git repository
 */
function isGitRepo() {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: projectRoot,
      stdio: "ignore",
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get first commit date from git
 */
function getFirstCommitDate() {
  try {
    const output = execSync('git log --reverse --format="%ai"', {
      cwd: projectRoot,
      encoding: "utf8",
    });
    const lines = output.trim().split("\n");
    if (lines.length > 0 && lines[0]) {
      return new Date(lines[0].trim());
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get total number of commits
 */
function getTotalCommits() {
  try {
    const output = execSync("git rev-list --count HEAD", {
      cwd: projectRoot,
      encoding: "utf8",
    });
    return parseInt(output.trim(), 10);
  } catch (error) {
    return null;
  }
}

/**
 * Get number of contributors
 */
function getContributors() {
  try {
    // Get all author names and use a Set for uniqueness
    const output = execSync('git log --format="%aN"', {
      cwd: projectRoot,
      encoding: "utf8",
    });
    const authors = new Set(
      output
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    );
    return authors.size;
  } catch (error) {
    return null;
  }
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

/**
 * Count lines in a file
 */
function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content.split("\n").length;
}

/**
 * Format number with thousand separators
 */
function formatNumber(num) {
  return num.toLocaleString("en-US");
}

// Get all files and filter by extension
const allFiles = getAllFiles(srcPath);
const extensionPattern = /\.(jsx?|tsx?|css|scss|less)$/;

const results = allFiles
  .filter((file) => extensionPattern.test(file))
  .map((file) => ({
    type: path.extname(file),
    file: path.basename(file),
    lines: countLines(file),
  }));

// Group by file type
const summaryMap = new Map();

results.forEach((item) => {
  if (!summaryMap.has(item.type)) {
    summaryMap.set(item.type, { files: 0, lines: 0 });
  }
  const summary = summaryMap.get(item.type);
  summary.files++;
  summary.lines += item.lines;
});

// Convert to array and sort by lines descending
const summary = Array.from(summaryMap.entries())
  .map(([type, data]) => ({
    type,
    files: data.files,
    lines: data.lines,
  }))
  .sort((a, b) => b.lines - a.lines);

// Display summary table
console.log(colorize("Summary by File Type:", "yellow"));
console.log("");

// Calculate column widths
const typeWidth = Math.max(4, ...summary.map((s) => s.type.length));
const filesWidth = Math.max(5, ...summary.map((s) => s.files.toString().length));
const linesWidth = Math.max(5, ...summary.map((s) => formatNumber(s.lines).length));

// Print header
console.log(
  "Type".padEnd(typeWidth) +
    "  " +
    "Files".padStart(filesWidth) +
    "  " +
    "Lines".padStart(linesWidth)
);

// Print rows
summary.forEach((row) => {
  console.log(
    row.type.padEnd(typeWidth) +
      "  " +
      row.files.toString().padStart(filesWidth) +
      "  " +
      formatNumber(row.lines).padStart(linesWidth)
  );
});

console.log("");

// Calculate totals
const totalFiles = summary.reduce((sum, s) => sum + s.files, 0);
const totalLines = summary.reduce((sum, s) => sum + s.lines, 0);

console.log(colorize("========================================", "cyan"));
console.log(colorize(`Total Files: ${totalFiles}`, "green"));
console.log(colorize(`Total Lines: ${formatNumber(totalLines)}`, "green"));
console.log(colorize("========================================", "cyan"));
console.log("");

// Get git metrics and display velocity
const gitAvailable = isGitRepo();
const firstCommitDate = gitAvailable ? getFirstCommitDate() : null;
const totalCommits = gitAvailable ? getTotalCommits() : null;
const contributors = gitAvailable ? getContributors() : null;

if (firstCommitDate) {
  const now = new Date();
  const daysSinceStart = Math.ceil((now - firstCommitDate) / (1000 * 60 * 60 * 24));
  const velocity = totalLines / daysSinceStart;

  console.log(colorize("Project Velocity Metrics:", "magenta"));
  console.log("");
  console.log(`First Commit:     ${firstCommitDate.toISOString().split("T")[0]}`);
  console.log(`Days Since Start: ${formatNumber(daysSinceStart)} days`);
  console.log(`Total Commits:    ${totalCommits ? formatNumber(totalCommits) : "N/A"}`);
  console.log(`Contributors:     ${contributors || "N/A"}`);
  console.log("");
  console.log(colorize(`Velocity:         ${velocity.toFixed(2)} lines/day`, "green"));

  if (totalCommits) {
    const linesPerCommit = totalLines / totalCommits;
    console.log(colorize(`Lines/Commit:     ${linesPerCommit.toFixed(2)} lines/commit`, "green"));
  }

  if (daysSinceStart > 0) {
    const commitsPerDay = totalCommits / daysSinceStart;
    console.log(colorize(`Commits/Day:      ${commitsPerDay.toFixed(2)} commits/day`, "green"));
  }

  console.log("");
  console.log(colorize("========================================", "cyan"));
  console.log("");
} else if (gitAvailable) {
  console.log(
    colorize("Warning: Could not retrieve git history even though this is a git repo", "yellow")
  );
  console.log("");
}

// Show top 10 largest files
console.log(colorize("Top 10 Largest Files:", "yellow"));
console.log("");

const top10 = results.sort((a, b) => b.lines - a.lines).slice(0, 10);

// Calculate column widths for top 10
const fileWidth = Math.max(4, ...top10.map((f) => f.file.length));
const typeWidth2 = Math.max(4, ...top10.map((f) => f.type.length));
const linesWidth2 = Math.max(5, ...top10.map((f) => formatNumber(f.lines).length));

// Print header
console.log(
  "File".padEnd(fileWidth) + "  " + "Type".padEnd(typeWidth2) + "  " + "Lines".padStart(linesWidth2)
);

// Print rows
top10.forEach((row) => {
  console.log(
    row.file.padEnd(fileWidth) +
      "  " +
      row.type.padEnd(typeWidth2) +
      "  " +
      formatNumber(row.lines).padStart(linesWidth2)
  );
});

console.log("");

// Save to file with timestamp
const now = new Date();
const timestamp = now
  .toISOString()
  .replace(/T/, "_")
  .replace(/:/g, "")
  .replace(/\..+/, "")
  .slice(0, 15);
const reportPath = path.join(projectRoot, `loc-report-${timestamp}.txt`);

// Build report content
let reportContent = `Source Code Line Count + Velocity Report
Generated: ${now.toISOString().replace("T", " ").slice(0, 19)}
Project: ${projectRoot}

SUMMARY BY FILE TYPE:
`;

// Add summary table
reportContent +=
  "Type".padEnd(typeWidth) +
  "  " +
  "Files".padStart(filesWidth) +
  "  " +
  "Lines".padStart(linesWidth) +
  "\n";

summary.forEach((row) => {
  reportContent +=
    row.type.padEnd(typeWidth) +
    "  " +
    row.files.toString().padStart(filesWidth) +
    "  " +
    formatNumber(row.lines).padStart(linesWidth) +
    "\n";
});

reportContent += `
TOTALS:
Total Files: ${totalFiles}
Total Lines: ${formatNumber(totalLines)}
`;

if (firstCommitDate) {
  const now = new Date();
  const daysSinceStart = Math.ceil((now - firstCommitDate) / (1000 * 60 * 60 * 24));
  const velocity = totalLines / daysSinceStart;

  reportContent += `
VELOCITY METRICS:
First Commit:     ${firstCommitDate.toISOString().split("T")[0]}
Days Since Start: ${formatNumber(daysSinceStart)} days
Total Commits:    ${totalCommits ? formatNumber(totalCommits) : "N/A"}
Contributors:     ${contributors || "N/A"}
Velocity:         ${velocity.toFixed(2)} lines/day
`;

  if (totalCommits) {
    const linesPerCommit = totalLines / totalCommits;
    reportContent += `Lines/Commit:     ${linesPerCommit.toFixed(2)} lines/commit\n`;
  }

  if (daysSinceStart > 0) {
    const commitsPerDay = totalCommits / daysSinceStart;
    reportContent += `Commits/Day:      ${commitsPerDay.toFixed(2)} commits/day\n`;
  }
} else if (gitAvailable) {
  reportContent += `\nWarning: Could not retrieve git history even though this is a git repo\n`;
}

reportContent += `
TOP 10 LARGEST FILES:
`;

// Add top 10 table
reportContent +=
  "File".padEnd(fileWidth) +
  "  " +
  "Type".padEnd(typeWidth2) +
  "  " +
  "Lines".padStart(linesWidth2) +
  "\n";

top10.forEach((row) => {
  reportContent +=
    row.file.padEnd(fileWidth) +
    "  " +
    row.type.padEnd(typeWidth2) +
    "  " +
    formatNumber(row.lines).padStart(linesWidth2) +
    "\n";
});

fs.writeFileSync(reportPath, reportContent, "utf8");
console.log(colorize(`Report saved to: ${reportPath}`, "gray"));
console.log("");
