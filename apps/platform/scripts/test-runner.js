#!/usr/bin/env node

import { glob } from "glob";
import { readFileSync } from "fs";
import { spawn } from "child_process";
import { resolve } from "path";

async function runTests() {
  const args = process.argv.slice(2);
  let isQuiet = false;
  let testFiles = [];

  const quietIndex = args.indexOf("--quiet");
  if (quietIndex > -1) {
    isQuiet = true;
    args.splice(quietIndex, 1);
  }

  if (args.length === 0) {
    // If no arguments, run all tests (Node.js and Deno)
    testFiles = await glob("**/*.test.js", { ignore: "node_modules/**" });
  } else {
    for (const arg of args) {
      if (arg.includes("*")) {
        // It's a glob pattern
        const files = await glob(arg, { ignore: "node_modules/**" });
        testFiles.push(...files);
      } else {
        // It's a specific file
        testFiles.push(arg);
      }
    }
  }

  let totalPassed = 0;
  let totalFailed = 0;
  let totalFiles = 0;

  for (const file of testFiles) {
    const filePath = resolve(process.cwd(), file);
    const fileContent = readFileSync(filePath, "utf8");

    let result;
    if (fileContent.includes("https://deno.land/std") || fileContent.includes("jsr:")) {
      result = await spawnDenoTest(filePath, isQuiet);
    } else {
      result = await spawnNodeTest(filePath, isQuiet);
    }

    totalPassed += result.passed;
    totalFailed += result.failed;
    totalFiles++;

    if (result.error) {
      console.error(`Error in ${file}: ${result.error}`);
    }
  }

  console.log("\n--- Overall Test Summary ---");
  console.log(`Total Passed: ${totalPassed}`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log(`Total Files Processed: ${totalFiles}`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

function spawnDenoTest(filePath, isQuiet) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const stdioOption = isQuiet ? ["inherit", "ignore", "ignore"] : ["inherit", "pipe", "pipe"];
    const denoArgs = ["test", filePath];
    if (isQuiet) {
      denoArgs.push("--quiet");
    }
    const child = spawn("deno", denoArgs, { stdio: stdioOption });

    if (!isQuiet) {
      child.stdout.on("data", (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
    }

    child.on("close", (code) => {
      const result = { passed: 0, failed: 0, error: null };
      const summaryMatch = stdout.match(/\| (\d+) passed \| (\d+) failed/);

      if (summaryMatch) {
        result.passed = parseInt(summaryMatch[1], 10);
        result.failed = parseInt(summaryMatch[2], 10);
      } else if (code !== 0) {
        // If no summary but non-zero exit code, it's a failure
        result.failed = 1;
      }

      if (code !== 0 && result.failed === 0) {
        result.error = `Deno test failed for ${filePath} with code ${code}`;
      }
      resolve(result);
    });

    child.on("error", (err) => {
      resolve({ passed: 0, failed: 1, error: `Failed to start Deno process: ${err.message}` });
    });
  });
}

function spawnNodeTest(filePath, isQuiet) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const stdioOption = isQuiet ? ["inherit", "ignore", "ignore"] : ["inherit", "pipe", "pipe"];
    const nodeArgs = ["--test", filePath];
    if (isQuiet) {
      nodeArgs.push("--test-reporter=dot");
    }
    const child = spawn("node", nodeArgs, { stdio: stdioOption });

    if (!isQuiet) {
      child.stdout.on("data", (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
    }

    child.on("close", (code) => {
      const result = { passed: 0, failed: 0, error: null };
      const passedMatch = stdout.match(/ℹ pass (\d+)/);
      const failedMatch = stdout.match(/ℹ fail (\d+)/);

      if (passedMatch) {
        result.passed = parseInt(passedMatch[1], 10);
      }
      if (failedMatch) {
        result.failed = parseInt(failedMatch[1], 10);
      }

      if (code !== 0 && result.failed === 0) {
        result.failed = 1; // Mark as failed if process exits with non-zero but no explicit failures found
        result.error = `Node.js test failed for ${filePath} with code ${code}`;
      }
      resolve(result);
    });

    child.on("error", (err) => {
      resolve({ passed: 0, failed: 1, error: `Failed to start Node.js process: ${err.message}` });
    });
  });
}

runTests().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
