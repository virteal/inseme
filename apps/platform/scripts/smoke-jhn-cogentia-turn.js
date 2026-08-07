#!/usr/bin/env node
/**
 * Dogfood: Principal → John → Cogentia MCP (JHN token) → COP memory trace.
 *
 * Usage (from apps/platform or monorepo with inseme/.env):
 *   node scripts/smoke-jhn-cogentia-turn.js
 *   node scripts/smoke-jhn-cogentia-turn.js --message "What is a cognitive packet?"
 *   node scripts/smoke-jhn-cogentia-turn.js --subagent elf-1
 *
 * Requires COGENTIA_MCP_JHN_TOKEN (inseme/.env SoT / vault).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJhnCogentiaTurn, createMemoryCopStore } from "../mcp/cop/jhnCogentiaTurn.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split(/\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      const k = line.slice(0, i).trim();
      let v = line
        .slice(i + 1)
        .trim()
        .replace(/\r$/, "");
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(path.resolve(__dirname, "../../../.env"));
loadEnvFile(path.resolve(__dirname, "../../.env"));

const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
}

const message =
  flag("--message") || "What is a Cognitive Packet in Cogentia? Answer with corpus citations.";
const subagentId = flag("--subagent") || null;
const conversationId = flag("--conversation") || "john-dogfood";

if (!process.env.COGENTIA_MCP_JHN_TOKEN) {
  console.error("Missing COGENTIA_MCP_JHN_TOKEN (set in inseme/.env / vault).");
  process.exit(2);
}

const store = createMemoryCopStore();
const agent = createJhnCogentiaTurn({
  store,
  identity: {
    principal_ref: "principal:jhn",
    mandate_ref: process.env.AGENT_JHN_WHATSAPP_MANDATE_ID || "mandate:jhn:dogfood",
    logical_agent_ref: "agent:jhn",
  },
});

const result = await agent.turn({ message, conversationId, subagentId });

const outDir = path.resolve(__dirname, "../instances/jhn-cop-local");
mkdirSync(outDir, { recursive: true });
const tracePath = path.join(outDir, `cogentia-turn-${Date.now()}.json`);
const report = {
  ok: result.cogentia.evidence_ok === true && result.conversational_identity === "John",
  at: new Date().toISOString(),
  conversational_identity: result.conversational_identity,
  cogentia: result.cogentia,
  citation_count: result.citations?.length || 0,
  citations: result.citations?.slice(0, 8) || [],
  topic_id: result.topic_id,
  cop_events: store.events.map((e) => ({
    seq: e.seq,
    kind: e.payload?.kind,
    actor_ref: e.actor_ref,
    visibility: e.visibility,
    auth: e.payload?.auth,
    citation_count: e.payload?.citation_count,
  })),
  reply_preview: result.text.slice(0, 500),
};

writeFileSync(tracePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(result.text);
console.log("\n---");
console.log(
  JSON.stringify(
    {
      ok: report.ok,
      conversational_identity: report.conversational_identity,
      cogentia_auth: report.cogentia.auth,
      allowMutate: report.cogentia.allowMutate,
      citations: report.citation_count,
      cop_event_kinds: report.cop_events.map((e) => e.kind),
      trace: path.relative(process.cwd(), tracePath).replace(/\\/g, "/"),
    },
    null,
    2
  )
);

process.exit(report.ok ? 0 : 1);
