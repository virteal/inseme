import test from "node:test";
import assert from "node:assert/strict";
import {
  computeContentHash,
  materializePacketClosure,
  resumePacket,
} from "../../../packages/cop-core/dist/closure.js";

test("Process-boundary reality test: packet resumes across process boundary using ONLY declared closure", async () => {
  // --- PROCESS A: CREATES PACKET WITH REFERENCED DEPENDENCY ---
  const docContent =
    "Corte est la capitale historique et culturelle de la Corse, siège de l'Université de Corse Pasquale Paoli.";
  const docHash = computeContentHash(docContent);

  const initialPacket = {
    packet_id: "pkt-process-boundary-test-42",
    created_at: new Date().toISOString(),
    hops: [
      {
        hop_index: 0,
        node_id: "node:fracta:origin",
        instance_id: "agent:jhn",
        interface: "mcp",
        route_reason: "initial-question-packetized",
        timestamp: new Date().toISOString(),
      },
    ],
    payload: { question: "Quelle est la capitale historique de la Corse et son université ?" },
    closure: {
      closure_kind: "materializable",
      admissible_handlers: ["agent:jhn", "agent:ophelia"],
      required_environment: { cop_version: "1.1" },
      referenced_dependencies: [
        {
          dependency_id: "dep:doc:corte_history",
          kind: "document",
          locator: "store://docs/corte_history.txt",
          hash: docHash,
        },
      ],
    },
    status: "dispatched",
  };

  // Process A serializes to transport format (simulating exit of Process A)
  const wireFormat = JSON.stringify(initialPacket);

  // --- PROCESS B: COLD RESTART / ZERO IN-MEMORY STATE ---
  // Process B deserializes ONLY the wire packet without any shared variable
  const receivedPacket = JSON.parse(wireFormat);

  // External store mock simulating storage backend
  const externalStore = new Map([["store://docs/corte_history.txt", docContent]]);

  const resolver = {
    async resolve(dep) {
      const content = externalStore.get(dep.locator);
      return { content, rawString: content };
    },
  };

  // Resuming handler in Process B
  const resumed = await resumePacket(receivedPacket, resolver, async (pkt, closure) => {
    assert.equal(closure.is_closed, true);
    const resolvedDep = closure.resolved_dependencies.get("dep:doc:corte_history");
    assert.ok(resolvedDep);
    assert.equal(resolvedDep.verified, true);
    assert.equal(resolvedDep.content, docContent);

    // Compute yield purely from packet payload + materialized closure
    const summary = `D'après la référence vérifiée : ${resolvedDep.content}`;
    return {
      yield: summary,
      newHop: {
        node_id: "node:workstation:destination",
        instance_id: "agent:ophelia",
        interface: "cop-worker",
        route_reason: "answer-synthesized-from-closure",
      },
    };
  });

  // Verify resulting packet
  assert.equal(resumed.status, "solved");
  assert.equal(resumed.hops.length, 2);
  assert.equal(resumed.hops[1].node_id, "node:workstation:destination");
  assert.equal(resumed.hops[1].instance_id, "agent:ophelia");
  assert.match(resumed.yield.semantic_yield, /Pasquale Paoli/);
});

test("Process-boundary fails closed if a referenced dependency was tampered", async () => {
  const legitDoc = "Contenu officiel authentique";
  const legitHash = computeContentHash(legitDoc);

  const packet = {
    packet_id: "pkt-tampered-007",
    created_at: new Date().toISOString(),
    hops: [
      {
        hop_index: 0,
        node_id: "node:origin",
        instance_id: "jhn",
        timestamp: new Date().toISOString(),
      },
    ],
    payload: { task: "secure-audit" },
    closure: {
      closure_kind: "materializable",
      referenced_dependencies: [
        {
          dependency_id: "dep:tampered",
          kind: "document",
          locator: "store://docs/tampered.txt",
          hash: legitHash,
        },
      ],
    },
  };

  const maliciousStore = {
    async resolve() {
      return { content: "Contenu altéré / malveillant" };
    },
  };

  await assert.rejects(
    () =>
      resumePacket(packet, maliciousStore, async () => ({
        yield: "ok",
        newHop: { node_id: "n", instance_id: "i" },
      })),
    /closure incomplete.*tampered/
  );
});
