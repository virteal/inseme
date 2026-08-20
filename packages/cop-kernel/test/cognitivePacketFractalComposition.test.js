import assert from "node:assert/strict";
import test from "node:test";

import {
  asCognitivePacket,
  recordPacketHop,
  markPacketSolved,
  markPacketReturned,
  markPacketAssimilated,
  markPacketCancelled,
  markPacketFailed,
  reconstructOdyssey,
} from "../src/Cop-kerneltasks.js";

import { cogentiaRoutePacket } from "../src/cogentiaRouter.js";
import { CapabilityRegistry } from "../src/capabilityRegistry.js";
import { COPBus } from "../src/bus.js";

test("Fractal Delegation 1: Parallel Fork-Join - Parent spawns 2 child CPs, waits, and combines yields", async () => {
  const bus = new COPBus({ name: "fractal-forkjoin-bus" });
  const publishedEvents = [];
  bus.subscribeAll((event) => publishedEvents.push(event));

  const registry = new CapabilityRegistry();
  registry.register("audit-security", { providers: ["node:security:agent"] });
  registry.register("benchmark-perf", { providers: ["node:perf:agent"] });

  // 1. Parent Cognitive Packet arrives
  const parentPacket = asCognitivePacket({
    kind: "cluster-audit",
    envelope: {
      id: "pkt-parent-cluster-audit-001",
      intent: "Perform complete security and performance audit of Cluster Alpha",
      routeTo: "coordinator-node",
      requiredCapability: "cluster-coordination",
      status: "dispatched",
      ithaca: {
        description: "Operator Management Console (Root Ithaca)",
        return_target: "operator-console-session",
        response_channel: "operator.events",
        return_conditions: ["all-subaudits-completed"],
      },
      lineage: {
        downstream_packet_ids: ["pkt-child-sec-001", "pkt-child-perf-002"],
      },
      residue: [],
    },
    payload: { clusterId: "cluster-alpha" },
    bus,
  });

  recordPacketHop(parentPacket, {
    node_id: "node:operator:origin",
    instance_id: "operator-cli",
    route_reason: "parent-audit-dispatched",
  });

  // 2. Fork: Coordinator handler spawns 2 child CPs with Ithaca pointing to Parent Context
  const childSec = asCognitivePacket({
    kind: "security-subaudit",
    envelope: {
      id: "pkt-child-sec-001",
      intent: "Audit TLS certificates and RBAC policies for Cluster Alpha",
      routeTo: "security-node",
      requiredCapability: "audit-security",
      status: "dispatched",
      ithaca: {
        description: "Parent Coordinator Context (Internal Ithaca)",
        return_target: "parent-context:pkt-parent-cluster-audit-001",
        response_channel: "internal.coordinator.channel",
        return_conditions: ["security-audit-done"],
      },
      lineage: {
        upstream_packet_id: parentPacket.envelope.id,
        spawn_reason: "parallel_subaudit_fork",
      },
      residue: [],
    },
    payload: { clusterId: "cluster-alpha", checkList: ["tls", "rbac"] },
    bus,
  });

  const childPerf = asCognitivePacket({
    kind: "perf-subaudit",
    envelope: {
      id: "pkt-child-perf-002",
      intent: "Benchmark p99 latency and throughput for Cluster Alpha",
      routeTo: "perf-node",
      requiredCapability: "benchmark-perf",
      status: "dispatched",
      ithaca: {
        description: "Parent Coordinator Context (Internal Ithaca)",
        return_target: "parent-context:pkt-parent-cluster-audit-001",
        response_channel: "internal.coordinator.channel",
        return_conditions: ["perf-benchmark-done"],
      },
      lineage: {
        upstream_packet_id: parentPacket.envelope.id,
        spawn_reason: "parallel_subaudit_fork",
      },
      residue: [],
    },
    payload: { clusterId: "cluster-alpha", metric: "latency-p99" },
    bus,
  });

  recordPacketHop(childSec, {
    node_id: "node:coordinator",
    instance_id: "fork-manager",
    route_reason: "child-sec-spawned",
  });
  recordPacketHop(childPerf, {
    node_id: "node:coordinator",
    instance_id: "fork-manager",
    route_reason: "child-perf-spawned",
  });

  // 3. Route both child CPs independently
  const routeSec = await cogentiaRoutePacket(childSec, { registry, forwardToBus: bus });
  const routePerf = await cogentiaRoutePacket(childPerf, { registry, forwardToBus: bus });
  assert.equal(routeSec.capabilitySatisfied, true);
  assert.equal(routePerf.capabilitySatisfied, true);

  // 4. Handlers solve child CPs
  const secYield = { tlsValid: true, rbacGaps: 0, grade: "A" };
  await markPacketSolved(childSec, {
    yieldData: { semantic_yield: secYield, operational_yield: { duration_ms: 30, cost_units: 1 } },
    handlerId: "node:security:agent",
    bus,
  });
  await markPacketReturned(childSec, { returnTarget: childSec.envelope.ithaca.return_target, bus });

  const perfYield = { p99Ms: 18.5, throughputRps: 4500, grade: "A+" };
  await markPacketSolved(childPerf, {
    yieldData: { semantic_yield: perfYield, operational_yield: { duration_ms: 45, cost_units: 2 } },
    handlerId: "node:perf:agent",
    bus,
  });
  await markPacketReturned(childPerf, {
    returnTarget: childPerf.envelope.ithaca.return_target,
    bus,
  });

  // Verify children are returned to parent Ithaca
  assert.equal(childSec.envelope.status, "returned");
  assert.equal(childPerf.envelope.status, "returned");

  // 5. Join: Coordinator handler combines the yields of both children into the parent yield
  const combinedSemanticYield = {
    clusterId: "cluster-alpha",
    overallHealth: "EXCELLENT",
    securityAudit: childSec.yield.semantic_yield,
    perfBenchmark: childPerf.yield.semantic_yield,
    consolidatedCostUnits:
      childSec.yield.operational_yield.cost_units + childPerf.yield.operational_yield.cost_units,
  };

  await markPacketSolved(parentPacket, {
    yieldData: {
      semantic_yield: combinedSemanticYield,
      operational_yield: {
        duration_ms: 60,
        subpackets_count: 2,
        cost_units: combinedSemanticYield.consolidatedCostUnits,
      },
      produced_by: "coordinator-node",
    },
    handlerId: "coordinator-node",
    bus,
  });

  // 6. Parent returns to Root Ithaca (Operator) and is assimilated
  await markPacketReturned(parentPacket, {
    returnTarget: parentPacket.envelope.ithaca.return_target,
    bus,
  });
  await markPacketAssimilated(parentPacket, {
    substrate: "operator-audit-registry",
    changes: { clusterAlphaAudited: true, grade: "EXCELLENT" },
    bus,
  });

  // 7. Verify Odysseys of parent and children
  const parentOdyssey = reconstructOdyssey(parentPacket, { events: publishedEvents });
  const secOdyssey = reconstructOdyssey(childSec, { events: publishedEvents });
  const perfOdyssey = reconstructOdyssey(childPerf, { events: publishedEvents });

  assert.equal(parentOdyssey.lifecycle.isAssimilated, true);
  assert.equal(parentOdyssey.journey.hopsCount, 3);
  assert.deepEqual(parentOdyssey.yield.semantic_yield, combinedSemanticYield);

  assert.equal(secOdyssey.lifecycle.isReturned, true);
  assert.equal(secOdyssey.ithaca.return_target, "parent-context:pkt-parent-cluster-audit-001");

  assert.equal(perfOdyssey.lifecycle.isReturned, true);
  assert.equal(perfOdyssey.ithaca.return_target, "parent-context:pkt-parent-cluster-audit-001");
});

test("Fractal Delegation 2: Competitive Race and Cancellation - Fast solver wins, slower solver cancelled", async () => {
  const bus = new COPBus({ name: "fractal-race-bus" });
  const publishedEvents = [];
  bus.subscribeAll((event) => publishedEvents.push(event));

  // Two competing candidate CPs for the same intent
  const candidateFast = asCognitivePacket({
    kind: "speculative-solve",
    envelope: {
      id: "pkt-race-fast-001",
      intent: "Find shortest path across routing topology",
      routeTo: "heuristic-solver",
      status: "dispatched",
      ithaca: { return_target: "parent-race-context" },
      residue: [],
    },
    payload: { graphSize: 100 },
    bus,
  });

  const candidateDeep = asCognitivePacket({
    kind: "speculative-solve",
    envelope: {
      id: "pkt-race-deep-002",
      intent: "Find shortest path across routing topology",
      routeTo: "exact-sat-solver",
      status: "dispatched",
      ithaca: { return_target: "parent-race-context" },
      residue: [],
    },
    payload: { graphSize: 100 },
    bus,
  });

  // Fast solver finishes first
  await markPacketSolved(candidateFast, {
    yieldData: { semantic_yield: { pathLength: 14, hops: 4 } },
    handlerId: "heuristic-solver",
    bus,
  });
  await markPacketReturned(candidateFast, { returnTarget: "parent-race-context", bus });

  // Parent accepts fast solver and cancels the deep solver (Promise.race win)
  await markPacketCancelled(candidateDeep, {
    reason: "competitor_won_race",
    nodeId: "race-manager",
    instanceId: "race-coordinator",
    bus,
  });

  const fastOdyssey = reconstructOdyssey(candidateFast, { events: publishedEvents });
  const deepOdyssey = reconstructOdyssey(candidateDeep, { events: publishedEvents });

  assert.equal(fastOdyssey.lifecycle.isReturned, true);
  assert.equal(fastOdyssey.lifecycle.isCancelled, false);

  assert.equal(deepOdyssey.lifecycle.isCancelled, true);
  assert.equal(deepOdyssey.lifecycle.isReturned, false);
  assert.equal(deepOdyssey.cancellation.reason, "competitor_won_race");

  const cancelEvent = publishedEvents.find((e) => e.type === "cop.packet.cancelled");
  assert.ok(cancelEvent, "cop.packet.cancelled event must be emitted");
  assert.equal(cancelEvent.data.packetId, "pkt-race-deep-002");
  assert.equal(cancelEvent.data.reason, "competitor_won_race");
});

test("Fractal Delegation 3: Hierarchical Abort Cascade - Cancelling parent cancels all active children", async () => {
  const bus = new COPBus({ name: "fractal-abort-bus" });
  const publishedEvents = [];
  bus.subscribeAll((event) => publishedEvents.push(event));

  const parentPacket = asCognitivePacket({
    kind: "long-running-job",
    envelope: {
      id: "pkt-parent-job-100",
      intent: "Process distributed dataset",
      status: "dispatched",
      ithaca: { return_target: "user-session" },
      lineage: { downstream_packet_ids: ["pkt-child-worker-101", "pkt-child-worker-102"] },
      residue: [],
    },
    bus,
  });

  const child1 = asCognitivePacket({
    kind: "worker-task",
    envelope: {
      id: "pkt-child-worker-101",
      intent: "Shard 1 computation",
      status: "dispatched",
      ithaca: { return_target: parentPacket.envelope.id },
      lineage: { upstream_packet_id: parentPacket.envelope.id },
      residue: [],
    },
    bus,
  });

  const child2 = asCognitivePacket({
    kind: "worker-task",
    envelope: {
      id: "pkt-child-worker-102",
      intent: "Shard 2 computation",
      status: "dispatched",
      ithaca: { return_target: parentPacket.envelope.id },
      lineage: { upstream_packet_id: parentPacket.envelope.id },
      residue: [],
    },
    bus,
  });

  // User aborts parent job
  await markPacketCancelled(parentPacket, { reason: "user_abort_signal", bus });

  // Cascade abort to all active children
  const children = [child1, child2];
  for (const child of children) {
    if (child.envelope.status === "dispatched" || child.envelope.status === "draft") {
      await markPacketCancelled(child, {
        reason: `cascade_from_upstream:${parentPacket.envelope.id}`,
        bus,
      });
    }
  }

  assert.equal(parentPacket.envelope.status, "cancelled");
  assert.equal(child1.envelope.status, "cancelled");
  assert.equal(child2.envelope.status, "cancelled");

  const parentOdyssey = reconstructOdyssey(parentPacket);
  const child1Odyssey = reconstructOdyssey(child1);

  assert.equal(parentOdyssey.lifecycle.isCancelled, true);
  assert.equal(child1Odyssey.lifecycle.isCancelled, true);
  assert.equal(child1Odyssey.cancellation.reason, "cascade_from_upstream:pkt-parent-job-100");
});
