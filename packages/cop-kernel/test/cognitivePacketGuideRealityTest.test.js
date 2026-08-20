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

test("Cognitive Packet Reality Round Trip Case 002 Guide: stimulus - visitor query -> research hop -> solved -> returned to visitor Ithaca -> assimilated", async () => {
  const bus = new COPBus({ name: "guide-reality-test-bus" });
  const publishedEvents = [];
  bus.subscribeAll((event) => {
    publishedEvents.push(event);
  });

  const registry = new CapabilityRegistry();
  registry.register("corpus-research", {
    providers: ["librarian-agent-01", "guide-fallback-node"],
    metadata: { description: "Can search Cogentia corpus and extract citable evidence" },
  });

  // 1. Visitor Stimulus enters via Guide gateway
  const visitorStimulus = {
    case_id: "case-002-guide-query-doctrine",
    pattern: "guide",
    origin: "guide://public.fractavolta.com/chat/session-visitor-987",
    started_at: new Date().toISOString(),
    query:
      "What is the Anti-Capture Doctrine in Cogentia and why does the corpus forbid proprietary agent memory silos?",
    visitor_id: "visitor-session-987",
  };

  // 2. Cognitive Packet departure with explicit Ithaca target
  const packet = asCognitivePacket({
    kind: "guide-query",
    envelope: {
      id: "pkt-case-002-guide-doctrine",
      intent:
        "Synthesize grounded answer to visitor question using corpus evidence from canonical sources",
      routeTo: "librarian-research-node",
      requiredCapability: "corpus-research",
      riskLevel: "read_only",
      status: "dispatched",
      ithaca: {
        description: "Visitor Web Client Session (Ithaca)",
        return_target: visitorStimulus.visitor_id,
        response_channel: "guide.visitor.stream",
        return_conditions: ["answer-synthesized", "citations-included"],
      },
      provenance: {
        origin: visitorStimulus.origin,
        emitter: "guide-gateway-probe",
        mandate: "mandate:guide:public:2026",
      },
      residue: [],
    },
    payload: { stimulus: visitorStimulus },
    bus,
    emit: true,
  });

  assert.equal(packet.envelope.id, "pkt-case-002-guide-doctrine");
  assert.equal(packet.envelope.status, "dispatched");
  assert.equal(packet.envelope.ithaca.return_target, "visitor-session-987");

  // Record Hop 0: Ingestion at Guide gateway
  recordPacketHop(packet, {
    node_id: "node:guide:gateway",
    instance_id: "guide-web-router",
    interface: "https-stream",
    route_reason: "visitor-query-received-and-packetized",
  });
  assert.equal(packet.envelope.hops.length, 1);

  // 3. Switching: Cogentia router inspects only the envelope
  const decision = await cogentiaRoutePacket(packet, {
    registry,
    forwardToBus: bus,
    source: "guide-router",
  });
  assert.equal(decision.action, "forwarded-to-handler");
  assert.equal(decision.capabilitySatisfied, true);

  // 4. Handler hop: Librarian research agent processes query and produces Yield (SOLVED)
  const semanticYield = {
    answer:
      "The Anti-Capture Doctrine establishes that the git-tracked corpus is the sole source of truth, forbidding proprietary agent memory silos to preserve sovereign portability.",
    citations: [
      "cogentia/instructions/AGENTS.shared.md#L90-L95",
      "cogentia/research/agent_local_memory_anti_capture.md",
    ],
    confidence: "high",
  };

  const operationalYield = {
    duration_ms: 55,
    tokens_in: 450,
    tokens_out: 120,
    cost_units: 1,
    handler_id: "librarian-agent-01",
  };

  await markPacketSolved(packet, {
    yieldData: {
      semantic_yield: semanticYield,
      operational_yield: operationalYield,
      produced_by: "librarian-agent-01",
    },
    handlerId: "librarian-agent-01",
    nodeId: "node:workstation:librarian",
    durationMs: 55,
    residue: ["Visitor query did not specify repo scope, defaulted to full public corpus"],
    bus,
  });

  assert.equal(packet.envelope.status, "solved");
  assert.deepEqual(packet.yield.semantic_yield, semanticYield);
  assert.equal(packet.envelope.hops.length, 2);
  assert.equal(packet.envelope.residue.length, 1);

  // 5. Return to Visitor Ithaca (RETURNED)
  await markPacketReturned(packet, {
    returnTarget: packet.envelope.ithaca.return_target,
    bus,
  });

  assert.equal(packet.envelope.status, "returned");
  assert.equal(packet.envelope.hops.length, 3);
  assert.equal(packet.envelope.hops[2].instance_id, "visitor-session-987");

  // 6. Assimilation into visitor conversation state (ASSIMILATED)
  await markPacketAssimilated(packet, {
    substrate: "visitor-conversation-history",
    changes: {
      turnsCount: 1,
      lastDeliveredYieldId: packet.envelope.id,
      citationsCount: semanticYield.citations.length,
    },
    bus,
  });

  assert.equal(packet.envelope.status, "assimilated");
  assert.ok(packet.assimilated_at);
  assert.equal(packet.assimilation.substrate, "visitor-conversation-history");

  // 7. Odyssey reconstruction
  const odyssey = reconstructOdyssey(packet, { events: publishedEvents });

  assert.equal(odyssey.packetId, "pkt-case-002-guide-doctrine");
  assert.equal(odyssey.lifecycle.status, "assimilated");
  assert.equal(odyssey.lifecycle.isSolved, true);
  assert.equal(odyssey.lifecycle.isReturned, true);
  assert.equal(odyssey.lifecycle.isAssimilated, true);
  assert.equal(odyssey.journey.hopsCount, 3);
  assert.deepEqual(odyssey.yield.semantic_yield, semanticYield);
  assert.equal(odyssey.residue.length, 1);
  assert.equal(
    odyssey.residue[0],
    "Visitor query did not specify repo scope, defaulted to full public corpus"
  );

  // Verify full sequence of emitted events
  const eventTypes = publishedEvents.map((e) => e.type);
  assert.ok(eventTypes.includes("cop.packet.created"));
  assert.ok(eventTypes.includes("cop.packet.routed"));
  assert.ok(eventTypes.includes("cop.packet.solved"));
  assert.ok(eventTypes.includes("cop.packet.returned"));
  assert.ok(eventTypes.includes("cop.packet.assimilated"));
});
