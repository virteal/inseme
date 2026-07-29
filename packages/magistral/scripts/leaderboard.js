#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MAGISTRAL_DIR = path.resolve(SCRIPT_DIR, "..");
const LOG_FILE = path.join(MAGISTRAL_DIR, ".magistral-traffic.log");

if (!fs.existsSync(LOG_FILE)) {
  console.log("No traffic logs found. Run some queries first!");
  process.exit(0);
}

const raw = fs.readFileSync(LOG_FILE, "utf-8").trim();
if (!raw) {
  console.log("Traffic log file is empty.");
  process.exit(0);
}

const entries = raw
  .split("\n")
  .map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.warn(`[Warning] Failed to parse log line ${idx + 1}: ${e.message}`);
      return null;
    }
  })
  .filter(Boolean);

const stats = {};

for (const entry of entries) {
  const key = `${entry.nodeId} (${entry.model})`;
  if (!stats[key]) {
    stats[key] = {
      nodeId: entry.nodeId,
      model: entry.model,
      requests: 0,
      successes: 0,
      failures: 0,
      totalLatency: 0,
      promptTokens: 0,
      completionTokens: 0,
    };
  }

  const s = stats[key];
  s.requests++;
  if (entry.status === 200) {
    s.successes++;
    s.totalLatency += entry.latencyMs || 0;
    s.promptTokens += entry.promptTokens || 0;
    s.completionTokens += entry.completionTokens || 0;
  } else {
    s.failures++;
  }
}

const leaderboard = Object.values(stats)
  .map((s) => {
    const avgLatency = s.successes > 0 ? Math.round(s.totalLatency / s.successes) : 0;
    const successRate = s.requests > 0 ? Math.round((s.successes / s.requests) * 100) : 0;
    const tokensPerSec =
      s.totalLatency > 0 ? Math.round(s.completionTokens / (s.totalLatency / 1000)) : 0;
    return {
      ...s,
      avgLatency,
      successRate,
      tokensPerSec,
    };
  })
  .sort((a, b) => b.requests - a.requests);

console.log("\n🏆 ========================================================= 🏆");
console.log("                 MAGISTRAL MODEL LEADERBOARD                  ");
console.log("🏆 ========================================================= 🏆\n");

const header =
  String().padEnd(30) + " | Req | Success | Avg Latency | Tokens/s | Input Tok | Output Tok";
console.log(header);
console.log("-".repeat(header.length));

for (const item of leaderboard) {
  const label = `${item.nodeId} (${item.model})`.slice(0, 30).padEnd(30);
  const reqStr = String(item.requests).padStart(3);
  const succStr = `${item.successRate}%`.padStart(7);
  const latStr = `${item.avgLatency}ms`.padStart(11);
  const tpsStr = `${item.tokensPerSec}/s`.padStart(8);
  const inStr = String(item.promptTokens).padStart(9);
  const outStr = String(item.completionTokens).padStart(10);
  console.log(`${label} | ${reqStr} | ${succStr} | ${latStr} | ${tpsStr} | ${inStr} | ${outStr}`);
}
console.log();
