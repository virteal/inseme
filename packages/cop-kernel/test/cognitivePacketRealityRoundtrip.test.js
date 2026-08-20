import assert from "node:assert/strict";
import test from "node:test";

import {
  asCognitivePacket,
  recordPacketHop,
  markPacketSolved,
  markPacketReturned,
  markPacketAssimilated,
  reconstructOdyssey,
} from "../src/Cop-kerneltasks.js";

import { cogentiaRoutePacket } from "../src/cogentiaRouter.js";
import { CapabilityRegistry } from "../src/capabilityRegistry.js";
import { COPBus } from "../src/bus.js";

test("Cognitive Packet Reality Round Trip (Issue #54): stimulus -> hop -> solved -> returned -> assimilated", async () => {
  const bus = new COPBus({ name: "reality-test-bus" });
  const publishedEvents = [];
  bus.subscribeAll((event) => {
    publishedEvents.push(event);
  });

  const registry = new CapabilityRegistry();
  registry.register("incident-diagnosis", {
    providers: ["diagnostic-node-01"],
    metadata: { description: "Diagnose incident symptoms" },
  });

  // 1. Packet departure with explicit Ithaca target and intent
  const stimulus = {
    caseId: "case-001-reality-test",
    symptom: "Elevated connection drop rate during failover",
  };

  const packet = asCognitivePacket({
    kind: "incident",
    envelope: {
      id: "pkt-case-001-test",
      intent: "Investigate connection drop rate and suggest remedy",
      routeTo: "diagnostic-node",
      requiredCapability: "incident-diagnosis",
      riskLevel: "low",
      status: "dispatched",
      ithaca: {
        description: "Operium Incident Corpus (Ithaca)",
        return_target: "operium-incident-channel",
        return_conditions: ["root-cause-identified"],
      },
      residue: [],
    },
    payload: { stimulus },
    bus,
    emit: true,
  });

  assert.equal(packet.envelope.id, "pkt-case-001-test");
  assert.equal(packet.envelope.status, "dispatched");
  assert.equal(packet.envelope.ithaca.return_target, "operium-incident-channel");

  // Record Hop 0: departure
  recordPacketHop(packet, {
    node_id: "node:monitor:origin",
    instance_id: "probe-01",
    route_reason: "packet-departure",
  });
  assert.equal(packet.envelope.hops.length, 1);

  // 2. Switching: Cogentia router inspects only envelope
  const decision = await cogentiaRoutePacket(packet, {
    registry,
    forwardToBus: bus,
    source: "test-router",
  });
  assert.equal(decision.action, "forwarded-to-handler");
  assert.equal(decision.capabilitySatisfied, true);

  // 3. Handler hop: processes cognitive work and produces Yield (SOLVED)
  const semanticYield = {
    root_cause: "TCP socket linger timeout misconfiguration",
    remedy: "Set SO_LINGER to 0 on abrupt resets",
  };
  const operationalYield = {
    duration_ms: 45,
    tokens: 310,
  };

  await markPacketSolved(packet, {
    yieldData: {
      semantic_yield: semanticYield,
      operational_yield: operationalYield,
      produced_by: "diagnostic-node-01",
    },
    handlerId: "diagnostic-node-01",
    nodeId: "node:diagnostics:worker",
    durationMs: 45,
    residue: ["Kernel socket metrics were approximated"],
    bus,
  });

  assert.equal(packet.envelope.status, "solved");
  assert.deepEqual(packet.yield.semantic_yield, semanticYield);
  assert.equal(packet.envelope.hops.length, 2);
  assert.equal(packet.envelope.residue.length, 1);

  // 4. Return to Ithaca (RETURNED)
  await markPacketReturned(packet, {
    returnTarget: packet.envelope.ithaca.return_target,
    bus,
  });

  assert.equal(packet.envelope.status, "returned");
  assert.equal(packet.envelope.hops.length, 3);

  // 5. Assimilation into durable cognitive substrate (ASSIMILATED)
  await markPacketAssimilated(packet, {
    substrate: "incident-corpus",
    changes: { ruleAdded: "so-linger-zero-on-reset" },
    bus,
  });

  assert.equal(packet.envelope.status, "assimilated");
  assert.ok(packet.assimilated_at);
  assert.equal(packet.assimilation.substrate, "incident-corpus");

  // 6. Odyssey reconstruction
  const odyssey = reconstructOdyssey(packet, { events: publishedEvents });

  assert.equal(odyssey.packetId, "pkt-case-001-test");
  assert.equal(odyssey.lifecycle.status, "assimilated");
  assert.equal(odyssey.lifecycle.isSolved, true);
  assert.equal(odyssey.lifecycle.isReturned, true);
  assert.equal(odyssey.lifecycle.isAssimilated, true);
  assert.equal(odyssey.journey.hopsCount, 3);
  assert.deepEqual(odyssey.yield.semantic_yield, semanticYield);
  assert.equal(odyssey.residue.length, 1);

  // Verify lifecycle events emitted on bus
  const eventTypes = publishedEvents.map((e) => e.type);
  assert.ok(eventTypes.includes("cop.packet.created"));
  assert.ok(eventTypes.includes("cop.packet.routed"));
  assert.ok(eventTypes.includes("cop.packet.solved"));
  assert.ok(eventTypes.includes("cop.packet.returned"));
  assert.ok(eventTypes.includes("cop.packet.assimilated"));
});
