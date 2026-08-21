import assert from "node:assert/strict";
import test from "node:test";

import {
  asCognitivePacket,
  recordPacketHop,
  markPacketPausedForJudgment,
  resumePacketFromContinuation,
  markPacketSolved,
  markPacketReturned,
  markPacketAssimilated,
  reconstructOdyssey,
} from "../src/Cop-kerneltasks.js";

import { COPBus } from "../src/bus.js";
import { CapabilityRegistry } from "../src/capabilityRegistry.js";
import { cogentiaRoutePacket } from "../src/cogentiaRouter.js";

test("Case 003 Reality Test: Code Patch & Human Judgment Barrier (#54, #80, #113)", async () => {
  const bus = new COPBus({ name: "case-003-bus" });
  const events = [];
  bus.subscribeAll((e) => events.push(e));

  const registry = new CapabilityRegistry();
  registry.register("code-refactoring", {
    providers: ["worker:ast-reasoner"],
    metadata: { description: "Analyze codebase AST and generate safe diff patches" },
  });

  // 1. Initial Stimulus: Request for concurrency fix patch
  const stimulus = {
    caseId: "case-003-patch-concurrency",
    targetFile: "src/socketPool.js",
    instruction: "Prevent race condition in socket release by wrapping in mutex",
  };

  // 2. Hop 0: Ingestion as Cognitive Packet targeting code-refactoring capability
  const packet = asCognitivePacket({
    kind: "patch",
    envelope: {
      id: "pkt-case-003-patch",
      intent: "Refactor socketPool.js to prevent concurrency race condition",
      routeTo: "worker:ast-reasoner",
      requiredCapability: "code-refactoring",
      riskLevel: "bounded",
      status: "dispatched",
      ithaca: {
        description: "Git Main Repository Pull Request Queue (Ithaca)",
        return_target: "git:repo-main:pull-requests",
        return_conditions: ["patch-validated-by-human", "tests-passing"],
      },
      residue: [],
    },
    payload: { stimulus },
    bus,
    emit: true,
  });

  assert.equal(packet.envelope.id, "pkt-case-003-patch");
  assert.equal(packet.envelope.status, "dispatched");

  // 3. Hop 1: AST Reasoner analyzes and generates Unified Diff
  recordPacketHop(packet, {
    node_id: "node:worker-ast",
    instance_id: "worker:ast-reasoner",
    route_reason: "generate-ast-diff",
  });

  const generatedDiff = [
    "--- a/src/socketPool.js",
    "+++ b/src/socketPool.js",
    "@@ -42,3 +42,5 @@ export async function releaseSocket(sock) {",
    "+  await mutex.acquire();",
    "+  try {",
    "     socket.isAvailable = true;",
    "+  } finally { mutex.release(); }",
  ].join("\n");

  packet.payload.generatedDiff = generatedDiff;

  // 4. Hop 2: Judgment Boundary Encountered (#80) - Pause for human developer approval
  const continuationId = "cont:case-003:human-review-ticket-99";
  await markPacketPausedForJudgment(packet, {
    continuationId,
    reason: "Consequential file modification requires lead developer sign-off",
    barrier: "code_mutation_boundary",
    pendingAction: {
      type: "apply_git_diff",
      targetFile: "src/socketPool.js",
      diff: generatedDiff,
    },
    nodeId: "node:governance-control",
    instanceId: "continuation-manager",
    bus,
    emit: true,
  });

  assert.equal(packet.envelope.status, "paused_for_judgment");
  assert.equal(packet.continuation.continuationId, continuationId);
  assert.equal(packet.continuation.barrier, "code_mutation_boundary");

  // Verify paused state in intermediate Odyssey trace
  const intermediateOdyssey = reconstructOdyssey(packet);
  assert.equal(intermediateOdyssey.lifecycle.isPaused, true);
  assert.equal(intermediateOdyssey.lifecycle.isSolved, false);
  assert.equal(intermediateOdyssey.lifecycle.isReturned, false);

  // 5. Hop 3: Human Lead Developer inspects ticket and approves resolution
  await resumePacketFromContinuation(packet, {
    continuationId,
    action: "approve",
    reviewer: "developer:lead-alice",
    nodeId: "node:developer-workstation",
    instanceId: "john-cli-continuation-resolver",
    bus,
    emit: true,
  });

  assert.equal(packet.envelope.status, "dispatched");
  assert.equal(packet.continuation.resolution.action, "approve");
  assert.equal(packet.continuation.resolution.reviewer, "developer:lead-alice");

  // 6. Hop 4: Apply Diff, run verification suite, and produce Solved Yield
  recordPacketHop(packet, {
    node_id: "node:ci-runner",
    instance_id: "git-patch-applier",
    route_reason: "apply-approved-diff-and-verify",
  });

  await markPacketSolved(packet, {
    yieldData: {
      semantic_yield: {
        patch_applied: true,
        targetFile: "src/socketPool.js",
        commit_sha: "commit:9b8a7c6e5d4f",
        verification_status: "all_tests_passed (131/131)",
      },
      operational_yield: {
        steps_count: 4,
        human_review_latency_ms: 1250,
      },
      produced_by: "git-patch-applier",
    },
    handlerId: "git-patch-applier",
    nodeId: "node:ci-runner",
    bus,
    emit: true,
  });

  assert.equal(packet.envelope.status, "solved");
  assert.equal(packet.yield.semantic_yield.patch_applied, true);

  // 7. Hop 5: Return Yield to Ithaca (PR Queue)
  await markPacketReturned(packet, {
    returnTarget: "git:repo-main:pull-requests",
    bus,
    emit: true,
  });

  assert.equal(packet.envelope.status, "returned");

  // 8. Hop 6: Assimilation into Main Git Substrate
  await markPacketAssimilated(packet, {
    substrate: "git:repository:main",
    changes: {
      files_modified: ["src/socketPool.js"],
      merged_commit: "commit:9b8a7c6e5d4f",
    },
    bus,
    emit: true,
  });

  assert.equal(packet.envelope.status, "assimilated");
  assert.ok(packet.assimilated_at);

  // 9. Reconstruct Final Odyssey Journey
  const finalOdyssey = reconstructOdyssey(packet);
  assert.equal(finalOdyssey.packetId, "pkt-case-003-patch");
  assert.equal(finalOdyssey.lifecycle.status, "assimilated");
  assert.equal(finalOdyssey.lifecycle.isSolved, true);
  assert.equal(finalOdyssey.lifecycle.isReturned, true);
  assert.equal(finalOdyssey.lifecycle.isAssimilated, true);
  assert.ok(finalOdyssey.journey.hopsCount >= 5);

  // Verify bus event sequence for full observability
  const eventTypes = events.map((e) => e.type);
  assert.ok(eventTypes.includes("cop.packet.created"));
  assert.ok(eventTypes.includes("cop.packet.paused"));
  assert.ok(eventTypes.includes("cop.packet.resumed"));
  assert.ok(eventTypes.includes("cop.packet.solved"));
  assert.ok(eventTypes.includes("cop.packet.returned"));
  assert.ok(eventTypes.includes("cop.packet.assimilated"));
});
