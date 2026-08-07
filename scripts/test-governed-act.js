#!/usr/bin/env node

import assert from "node:assert/strict";
import { recordGovernedAct, jhnDelegateToHandler } from "../packages/cop-core/src/governed-act.js";
import { createMemoryCopEventStore } from "../packages/cop-core/src/cop-event-spool.js";
import { createJhnDelegatingAgent } from "../apps/platform/mcp/cop/jhnDelegatingAgent.js";

console.log("==========================================================================");
console.log("    GOVERNED ACT + JHN DELEGATION (#33 P0/P1/P3)");
console.log("==========================================================================");

console.log("\n[Test 1] CapabilityInvocation → Act → Trace → Imputation...");
const store = createMemoryCopEventStore();
const chain = recordGovernedAct(store, {
  principal_ref: "principal:jhn",
  mandate_ref: "mandate:MND-JHN-LOCAL-v1",
  logical_agent_ref: "agent:jhn",
  handler_instance_ref: "handler:stub-coder@test",
  capability: "coding.assist",
  invocation_input: { task: "lint" },
  effect: { summary: "lint clean" },
  outcome: "ok",
});
assert.equal(chain.ok, true);
assert.equal(chain.events.length, 4);
const kinds = chain.events.map((e) => e.payload.kind);
assert.deepEqual(kinds, ["CapabilityInvocation", "Act", "Trace", "Imputation"]);
assert.equal(chain.receipt.schema, "cop.governed-act.receipt.v1");
assert.equal(chain.events[3].payload.responsibility, "logical_agent_under_mandate");
console.log("  ✓ four-event chain + receipt");

console.log("\n[Test 2] jhnDelegateToHandler...");
const store2 = createMemoryCopEventStore();
const del = await jhnDelegateToHandler({
  store: store2,
  handler: {
    id: "handler:echo@test",
    async invoke(input) {
      return { text: `echo:${input.message}` };
    },
  },
  identity: {
    principal_ref: "principal:jhn",
    mandate_ref: "mandate:MND-JHN-LOCAL-v1",
    logical_agent_ref: "agent:jhn",
  },
  capability: "reasoning.assist",
  input: { message: "hello" },
});
assert.equal(del.ok, true);
assert.equal(del.receipt.handler_instance_ref, "handler:echo@test");
console.log("  ✓ delegate records handler separately from John");

console.log("\n[Test 3] JHN conversational identity + delegation...");
const store3 = createMemoryCopEventStore();
const agent = createJhnDelegatingAgent({
  store: store3,
  identity: {
    principal_ref: "principal:jhn",
    mandate_ref: "mandate:MND-JHN-LOCAL-v1",
    logical_agent_ref: "agent:jhn",
  },
  handler: {
    id: "handler:coder@test",
    capability: "coding.assist",
    async invoke() {
      return { text: "handler-note" };
    },
  },
  reasoner: {
    async respond({ message, handlerAssist }) {
      return {
        text: handlerAssist
          ? `John: I used help for "${message}" → ${handlerAssist}`
          : `John: ${message}`,
        responseId: "r1",
      };
    },
  },
  shouldDelegate: ({ message }) => /implement/i.test(message),
});

const plain = await agent.turn({ message: "hello there", conversationId: "c1" });
assert.equal(plain.conversational_identity, "John");
assert.equal(plain.governed_act, null);
assert.ok(plain.text.startsWith("John:"));

const coded = await agent.turn({
  message: "please implement a fix",
  conversationId: "c1",
});
assert.equal(coded.conversational_identity, "John");
assert.ok(coded.governed_act);
assert.equal(coded.handler_instance_ref, "handler:coder@test");
assert.ok(coded.text.includes("handler-note"));
// Handler failure must not destroy store
assert.ok(store3.stats().events >= 4);
console.log("  ✓ John remains identity; handler is metadata");

console.log("\n==========================================================================");
console.log("✓ ALL #33 GOVERNED ACT / JHN TESTS PASSED");
console.log("==========================================================================");
