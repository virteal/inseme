import assert from "node:assert/strict";
import test from "node:test";

import { asCognitivePacket, reconstructOdyssey } from "../src/Cop-kerneltasks.js";

import { routePacketResiliently } from "../src/cogentiaRouter.js";
import { CapabilityRegistry } from "../src/capabilityRegistry.js";
import { COPBus } from "../src/bus.js";

test("Resilient Routing 1: Direct Next-Hop Optimization when target node is healthy", async () => {
  const bus = new COPBus({ name: "direct-hop-bus" });
  const publishedEvents = [];
  bus.subscribeAll((event) => publishedEvents.push(event));

  const packet = asCognitivePacket({
    kind: "security-audit",
    envelope: {
      id: "pkt-direct-001",
      intent: "Audit TLS certificate",
      routeTo: "node:primary-auditor",
      requiredCapability: "tls-audit",
      status: "dispatched",
      ithaca: { return_target: "operator-session" },
    },
    bus,
  });

  const result = await routePacketResiliently(packet, {
    forwardToBus: bus,
    probeNode: async (nodeId) => nodeId === "node:primary-auditor",
  });

  assert.equal(result.status, "routed_direct");
  assert.equal(result.targetNode, "node:primary-auditor");
  assert.equal(packet.envelope.hops.length, 1);
  assert.equal(packet.envelope.hops[0].node_id, "node:primary-auditor");

  const routeEvent = publishedEvents.find((e) => e.type === "cop.packet.routed");
  assert.ok(routeEvent);
  assert.equal(routeEvent.data.method, "direct_hop");
});

test("Resilient Routing 2: Alternative Provider Fallback when preferred node is offline", async () => {
  const bus = new COPBus({ name: "fallback-bus" });
  const publishedEvents = [];
  bus.subscribeAll((event) => publishedEvents.push(event));

  const registry = new CapabilityRegistry();
  registry.register("postgres-audit", {
    providers: ["node:primary-db-auditor", "node:secondary-db-auditor"],
  });

  const packet = asCognitivePacket({
    kind: "db-audit",
    envelope: {
      id: "pkt-fallback-002",
      intent: "Audit database indexes and migrations",
      routeTo: "node:primary-db-auditor",
      requiredCapability: "postgres-audit",
      status: "dispatched",
      ithaca: { return_target: "operator-session" },
    },
    bus,
  });

  // Primary is offline (false), Secondary is online (true)
  const probeNode = async (nodeId) => {
    if (nodeId === "node:primary-db-auditor") return false;
    if (nodeId === "node:secondary-db-auditor") return true;
    return false;
  };

  const result = await routePacketResiliently(packet, {
    registry,
    forwardToBus: bus,
    probeNode,
  });

  assert.equal(result.status, "routed_fallback");
  assert.equal(result.targetNode, "node:secondary-db-auditor");
  assert.equal(packet.envelope.hops.length, 2);
  assert.equal(
    packet.envelope.hops[0].route_reason,
    "fallback:preferred-node-unreachable:node:primary-db-auditor"
  );
  assert.equal(packet.envelope.hops[1].node_id, "node:secondary-db-auditor");

  const routeEvent = publishedEvents.find((e) => e.type === "cop.packet.routed");
  assert.ok(routeEvent);
  assert.equal(routeEvent.data.method, "fallback_provider");
});

test("Resilient Routing 3: Dynamic Attractor Pool Broadcast when all direct providers are offline", async () => {
  const bus = new COPBus({ name: "attractor-pool-bus" });
  const publishedEvents = [];
  bus.subscribeAll((event) => publishedEvents.push(event));

  const registry = new CapabilityRegistry();
  registry.register("gpu-inference", {
    providers: ["node:gpu-alpha", "node:gpu-beta"],
  });

  const packet = asCognitivePacket({
    kind: "deep-reasoning",
    envelope: {
      id: "pkt-attractor-003",
      intent: "Run 70B parameter reasoning model",
      routeTo: "node:gpu-alpha",
      requiredCapability: "gpu-inference",
      status: "dispatched",
      ithaca: { return_target: "operator-session" },
    },
    bus,
  });

  // All known nodes offline
  const probeNode = async () => false;

  const result = await routePacketResiliently(packet, {
    registry,
    forwardToBus: bus,
    probeNode,
  });

  assert.equal(result.status, "attractor_pool_broadcast");

  const attractorEvent = publishedEvents.find((e) => e.type === "cop.packet.attractor_search");
  assert.ok(attractorEvent, "Must broadcast cop.packet.attractor_search");
  assert.equal(attractorEvent.data.packetId, "pkt-attractor-003");
  assert.equal(attractorEvent.data.requiredCapability, "gpu-inference");
});

test("Resilient Routing 4: Store and Forward Spooling under total network partition", async () => {
  const spoolQueue = [];

  const packet = asCognitivePacket({
    kind: "offline-work",
    envelope: {
      id: "pkt-spool-004",
      intent: "Collect local diagnostic telemetry",
      routeTo: "node:remote-aggregator",
      status: "dispatched",
      ithaca: { return_target: "local-client" },
    },
  });

  // Offline: probe fails, no bus
  const result = await routePacketResiliently(packet, {
    probeNode: async () => false,
    spoolQueue,
  });

  assert.equal(result.status, "spooled_store_and_forward");
  assert.equal(spoolQueue.length, 1);
  assert.equal(spoolQueue[0].envelope.id, "pkt-spool-004");
  assert.equal(packet.envelope.hops[1].node_id, "local-spool");
});

test("Resilient Routing 5: Exception handling when network probe throws (e.g. ECONNREFUSED)", async () => {
  const bus = new COPBus({ name: "exception-bus" });
  const registry = new CapabilityRegistry();
  registry.register("backup-capability", {
    providers: ["node:working-backup"],
  });

  const packet = asCognitivePacket({
    kind: "fault-tolerant-work",
    envelope: {
      id: "pkt-exception-005",
      intent: "Test router survival under socket crash",
      routeTo: "node:crashing-node",
      requiredCapability: "backup-capability",
      status: "dispatched",
      ithaca: { return_target: "client" },
    },
    bus,
  });

  // Probe throws unhandled socket crash on crashing node, succeeds on backup
  const probeNode = async (nodeId) => {
    if (nodeId === "node:crashing-node") {
      throw new Error("ECONNREFUSED: Connection forcibly refused by target machine");
    }
    if (nodeId === "node:working-backup") {
      return true;
    }
    return false;
  };

  const result = await routePacketResiliently(packet, {
    registry,
    forwardToBus: bus,
    probeNode,
  });

  assert.equal(result.status, "routed_fallback");
  assert.equal(result.targetNode, "node:working-backup");
  assert.equal(packet.envelope.hops.length, 2);
  assert.ok(packet.envelope.hops[0].route_reason.includes("node:crashing-node"));
  assert.equal(packet.envelope.hops[1].node_id, "node:working-backup");
});

test("Resilient Routing 6 (Inseme #54): Provider reachable != provider admissible (Anti-Escalation)", async () => {
  const spoolQueue = [];
  const registry = new CapabilityRegistry();
  // Two nodes declare the same capability 'sensitive.read'
  registry.register("sensitive.read", {
    providers: ["node:secure-enclave", "node:public-cloud"],
  });

  // Packet restricts admissible handlers to only 'node:secure-enclave'
  const packet = asCognitivePacket({
    kind: "sensitive-query",
    envelope: {
      id: "pkt-sensitive-006",
      intent: "Read encrypted civic voting records",
      routeTo: "node:secure-enclave",
      requiredCapability: "sensitive.read",
      status: "dispatched",
      ithaca: { return_target: "governance-chamber" },
      closure: {
        admissible_handlers: ["node:secure-enclave"], // node:public-cloud is NOT admissible!
      },
    },
  });

  // Scenario:
  // - node:secure-enclave is OFFLINE (reachable = false, admissible = true)
  // - node:public-cloud is ONLINE (reachable = true, admissible = false)
  const probeNode = async (nodeId) => {
    if (nodeId === "node:secure-enclave") return false;
    if (nodeId === "node:public-cloud") return true;
    return false;
  };

  const result = await routePacketResiliently(packet, {
    registry,
    probeNode,
    spoolQueue,
  });

  // MUST NOT route to public-cloud merely because it is reachable!
  assert.notEqual(result.targetNode, "node:public-cloud");
  assert.equal(result.status, "spooled_store_and_forward");
  assert.equal(spoolQueue.length, 1);
  assert.equal(spoolQueue[0].envelope.id, "pkt-sensitive-006");
});
