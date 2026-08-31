import test from "node:test";
import assert from "node:assert/strict";
import {
  createSqlitePacketStore,
  createPostgresPacketStore,
  transferPacket,
} from "../../../packages/cop-core/dist/packet-store.js";
import { resumePacket, computeContentHash } from "../../../packages/cop-core/dist/closure.js";

test("SQLite -> PostgreSQL mobility reality test: same packet moves across stores and resumes on destination node", async () => {
  // 1. Initialize SQLite store on Node A and PostgreSQL store on Node B
  const sqliteNodeA = createSqlitePacketStore("sqlite:node-a:local");
  const postgresNodeB = createPostgresPacketStore("supabase:ndiysuhzmztatpxbkezn");

  const doc = "Délibération municipale n°2025-07-01 portant aménagement urbain à Corte.";
  const docHash = computeContentHash(doc);

  // 2. Node A creates and saves the packet in its local SQLite store
  const originalPacket = {
    packet_id: "pkt-mobility-reality-test-101",
    created_at: new Date().toISOString(),
    hops: [
      {
        hop_index: 0,
        node_id: "node:local:workstation",
        instance_id: "agent:jhn",
        interface: "sqlite-local",
        route_reason: "work-initiated-locally",
        timestamp: new Date().toISOString(),
      },
    ],
    payload: { action: "analyze_deliberation", doc_id: "delib-2025-07-01" },
    closure: {
      closure_kind: "materializable",
      admissible_handlers: ["agent:jhn", "agent:ophelia"],
      referenced_dependencies: [
        {
          dependency_id: "dep:acte:delib_2025_07_01",
          kind: "document",
          locator: "store://actes/delib_2025_07_01.txt",
          hash: docHash,
        },
      ],
    },
    status: "dispatched",
  };

  const initialPlacement = await sqliteNodeA.savePacket(originalPacket);
  assert.equal(initialPlacement.store_kind, "sqlite");
  assert.equal(initialPlacement.is_primary, true);

  // 3. Mobility transfer: packet travels from SQLite (Node A) to PostgreSQL (Node B)
  const {
    packet: transferredPacket,
    sourcePlacement,
    targetPlacement,
  } = await transferPacket(originalPacket.packet_id, sqliteNodeA, postgresNodeB, {
    setTargetPrimary: true,
  });

  // Assert identity and placement manifest
  assert.equal(transferredPacket.packet_id, originalPacket.packet_id);
  assert.equal(transferredPacket.placements.length, 2);
  assert.equal(targetPlacement.store_kind, "postgres");
  assert.equal(targetPlacement.is_primary, true);

  // Node A can delete or keep its cached copy
  await sqliteNodeA.deletePacket(originalPacket.packet_id);
  assert.equal(await sqliteNodeA.hasPacket(originalPacket.packet_id), false);

  // 4. Node B fetches ONLY from PostgreSQL store without access to Node A
  const packetOnNodeB = await postgresNodeB.getPacket(originalPacket.packet_id);
  assert.ok(packetOnNodeB);
  assert.equal(packetOnNodeB.packet_id, originalPacket.packet_id);

  // Node B resolver
  const nodeBResolver = {
    async resolve(dep) {
      if (dep.locator === "store://actes/delib_2025_07_01.txt") {
        return { content: doc, rawString: doc };
      }
      throw new Error("Not found");
    },
  };

  // Node B resumes execution
  const resumedOnNodeB = await resumePacket(packetOnNodeB, nodeBResolver, async (pkt, closure) => {
    assert.equal(closure.is_closed, true);
    const dep = closure.resolved_dependencies.get("dep:acte:delib_2025_07_01");
    assert.ok(dep.verified);

    return {
      yield: {
        summary: "Analyse validée sur nœud B distant",
        source_doc: dep.content,
      },
      newHop: {
        node_id: "node:cloud:fracta",
        instance_id: "agent:ophelia",
        interface: "postgres-cop",
        route_reason: "resumed-from-postgres-placement",
      },
    };
  });

  // Save resumed state back to PostgreSQL on Node B
  await postgresNodeB.savePacket(resumedOnNodeB);

  // 5. Final assertions
  const finalPacket = await postgresNodeB.getPacket(originalPacket.packet_id);
  assert.equal(finalPacket.status, "solved");
  assert.equal(finalPacket.hops.length, 2);
  assert.equal(finalPacket.hops[1].node_id, "node:cloud:fracta");
  assert.equal(finalPacket.hops[1].instance_id, "agent:ophelia");
  assert.match(finalPacket.yield.semantic_yield.summary, /nœud B/);
});
