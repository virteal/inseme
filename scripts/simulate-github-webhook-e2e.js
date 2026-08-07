#!/usr/bin/env node
/**
 * Local E2E simulation of GitHub webhook → COP store → activity feed (#29).
 * No network. No secrets printed.
 */

import { createHmac } from "node:crypto";
import {
  evaluateGithubIngress,
  GITHUB_EVENT_SUBSCRIPTIONS,
} from "../packages/cop-core/src/github-ingress.js";
import { createCopEventEnvelope } from "../packages/cop-core/src/cop-event-envelope.js";
import { createMemoryCopEventStore } from "../packages/cop-core/src/cop-event-spool.js";
import { createMemoryArtifactStore } from "../packages/cop-core/src/cop-event-artifacts.js";
import { createCopEventPersistPipeline } from "../packages/cop-core/src/cop-event-persist.js";
import { buildActivityFeed } from "../packages/cop-core/src/github-activity-feed.js";

const SECRET = "local-sim-secret";
const allowlist = ["JeanHuguesRobert/JeanHuguesRobert", "JeanHuguesRobert/inseme"];
const store = createMemoryCopEventStore();
const pipeline = createCopEventPersistPipeline({
  store,
  artifacts: createMemoryArtifactStore(),
  artifact_threshold_bytes: 50,
});

const samples = [
  {
    event: "ping",
    payload: { zen: "Design for failure.", hook_id: 1 },
  },
  {
    event: "push",
    payload: {
      ref: "refs/heads/main",
      commits: [{ id: "abc" }, { id: "def" }],
      head_commit: { id: "def" },
      repository: { full_name: "JeanHuguesRobert/inseme" },
      sender: { login: "alice" },
    },
  },
  {
    event: "pull_request",
    payload: {
      action: "opened",
      number: 10,
      pull_request: { title: "feat", merged: false },
      repository: { full_name: "JeanHuguesRobert/inseme" },
      sender: { login: "alice" },
    },
  },
  {
    event: "workflow_run",
    payload: {
      action: "completed",
      workflow: { name: "CI" },
      workflow_run: { conclusion: "success", name: "CI" },
      repository: { full_name: "JeanHuguesRobert/inseme" },
      sender: { login: "github-actions[bot]" },
    },
  },
];

let n = 0;
for (const sample of samples) {
  const body = JSON.stringify(sample.payload);
  const headers = {
    "x-github-delivery": `sim-${++n}`,
    "x-github-event": sample.event,
    "x-hub-signature-256": "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex"),
  };
  const decision = evaluateGithubIngress({
    headers,
    payload: sample.payload,
    rawBody: body,
    webhookSecret: SECRET,
    allowlist,
    options: {
      instanceId: "jhn-personal",
      repoRoles: { "JeanHuguesRobert/inseme": "work" },
    },
  });
  if (!decision.ok) {
    console.error("FAIL", sample.event, decision);
    process.exit(1);
  }
  for (const partial of decision.events) {
    store.append(createCopEventEnvelope(partial));
  }
  // also exercise persist pipeline
  await pipeline.persistGithubDelivery({
    delivery: decision.delivery,
    payload: sample.payload,
    rawBody: body + (sample.event === "push" ? "x".repeat(80) : ""),
    mapOptions: { instanceId: "jhn-personal" },
  });
}

const feed = buildActivityFeed(store, { viewer_clearance: "restricted", limit: 20 });
console.log(
  JSON.stringify(
    {
      ok: true,
      schema: "cop.github-webhook-e2e-sim.v1",
      subscriptions: GITHUB_EVENT_SUBSCRIPTIONS.length,
      store_events: store.stats().events,
      feed_count: feed.count,
      feed_kinds: [...new Set(feed.items.map((i) => i.activity_kind))],
      sample_summaries: feed.items.slice(0, 5).map((i) => i.summary),
    },
    null,
    2
  )
);
