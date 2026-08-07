#!/usr/bin/env node
/**
 * Agent-side U-gate verifier for Inseme #33.
 * Runs automated P1–P6 checks. Does not perform Principal chat login (P7).
 *
 * Usage: node scripts/verify-jhn-u-gate.mjs
 * Exit 0 if all agent checks pass; 1 otherwise.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platform = path.join(root, "apps", "platform");

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim().replace(/\r$/, "");
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnv(path.join(root, ".env"));
loadEnv(path.join(platform, ".env"));

function run(label, cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    timeout: 180_000,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  return {
    label,
    ok: r.status === 0,
    status: r.status,
    tail: out.slice(-800),
  };
}

const checks = [];

// P1 live site
checks.push(
  run("P1 smoke-jhn-live", process.execPath, ["scripts/smoke-jhn-live.mjs"], root)
);

// P4 governed act
const governed = path.join(root, "scripts", "test-governed-act.js");
if (existsSync(governed)) {
  checks.push(run("P4 test-governed-act", process.execPath, [governed], root));
} else {
  checks.push({ label: "P4 test-governed-act", ok: false, status: -1, tail: "missing script" });
}

// P5 unit cogentia client + turn
checks.push(
  run(
    "P5 cogentiaMcpClient.test",
    process.execPath,
    ["mcp/test/cogentiaMcpClient.test.js"],
    platform
  )
);
checks.push(
  run(
    "P5 jhnCogentiaTurn.test",
    process.execPath,
    ["mcp/test/jhnCogentiaTurn.test.js"],
    platform
  )
);

// P3 dogfood (needs token)
if (process.env.COGENTIA_MCP_JHN_TOKEN) {
  checks.push(
    run(
      "P3 smoke-jhn-cogentia-turn",
      process.execPath,
      [
        "scripts/smoke-jhn-cogentia-turn.js",
        "--message",
        "What is a Cognitive Packet?",
        "--conversation",
        "u-gate-verify",
      ],
      platform
    )
  );
} else {
  checks.push({
    label: "P3 smoke-jhn-cogentia-turn",
    ok: false,
    status: -1,
    tail: "COGENTIA_MCP_JHN_TOKEN not set — vault/env required",
  });
}

// P6 anon MCP read-only (no token)
try {
  const res = await fetch("https://cogentia.fractavolta.com/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }),
  });
  const json = await res.json();
  const tools = json.result?.tools || [];
  const names = tools.map((t) => t.name);
  const mutate = ["cogentia_continuation_emit", "cogentia_continuation_resolve", "cogentia_issues_sync"];
  const hidden = mutate.every((n) => !names.includes(n));
  const auth = json.result?._cogentia?.auth;
  checks.push({
    label: "P6 anon MCP read-only",
    ok: hidden && (auth === "none" || auth == null) && names.length >= 20,
    status: hidden ? 0 : 1,
    tail: JSON.stringify({
      tool_count: names.length,
      auth: auth || "none",
      mutate_hidden: hidden,
    }),
  });
} catch (e) {
  checks.push({
    label: "P6 anon MCP read-only",
    ok: false,
    status: -1,
    tail: e.message,
  });
}

const allOk = checks.every((c) => c.ok);
const report = {
  ok: allOk,
  issue: "JeanHuguesRobert/inseme#33",
  at: new Date().toISOString(),
  principal_required: ["P7 chat login on https://jhn.baronsmariani.org/john"],
  checks: checks.map((c) => ({
    label: c.label,
    ok: c.ok,
    status: c.status,
    evidence: c.ok ? "pass" : c.tail?.slice?.(0, 400) || c.tail,
  })),
};

console.log(JSON.stringify(report, null, 2));
process.exit(allOk ? 0 : 1);
