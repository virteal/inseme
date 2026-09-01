import test from "node:test";
import assert from "node:assert/strict";
import {
  createSqlitePacketStore,
  createPostgresPacketStore,
  createGithubPacketStore,
  createArchivePacketStore,
  transferPacket,
  archivePacket,
  restorePacket,
  assimilateToIthaca,
} from "../../../packages/cop-core/dist/packet-store.js";
import { resumePacket, computeContentHash } from "../../../packages/cop-core/dist/closure.js";

test("Phase 4 reality test: Git/GitHub promotion preserves packet identity and multi-placement indexability", async () => {
  const sqlStore = createPostgresPacketStore("supabase:ndiysuhzmztatpxbkezn");
  const githubStore = createGithubPacketStore("github:JeanHuguesRobert/inseme", { branch: "main" });

  const packet = {
    packet_id: "pkt-promoted-governance-001",
    mandate_id: "mandate:civic:corte",
    created_at: new Date().toISOString(),
    hops: [
      {
        hop_index: 0,
        node_id: "node:fracta:main",
        instance_id: "agent:jhn",
        timestamp: new Date().toISOString(),
      },
    ],
    payload: { title: "Charte de Transparence Civique", status: "ratified" },
  };

  // 1. Save in SQL
  await sqlStore.savePacket(packet);

  // 2. Promote to GitHub
  const {
    packet: promotedPacket,
    sourcePlacement,
    targetPlacement,
  } = await transferPacket(packet.packet_id, sqlStore, githubStore, { setTargetPrimary: true });

  // Assertions
  assert.equal(promotedPacket.packet_id, packet.packet_id);
  assert.equal(promotedPacket.placements.length, 2);
  assert.equal(targetPlacement.store_kind, "github");
  assert.match(targetPlacement.locator, /github:\/\/JeanHuguesRobert\/inseme\/main\/packets\//);

  // Both placements retrieve identical packet
  const fromSql = await sqlStore.getPacket(packet.packet_id);
  const fromGithub = await githubStore.getPacket(packet.packet_id);

  assert.equal(fromSql.packet_id, fromGithub.packet_id);
  assert.equal(fromSql.payload.title, fromGithub.payload.title);
});

test("Phase 5 & 6 reality test: Offline Odyssey from SQLite -> Postgres -> Node B -> Ithaca assimilation -> Cold Archive -> Restore", async () => {
  // --- Nœud A (Hors-ligne / SQLite) ---
  const nodeASqlite = createSqlitePacketStore("sqlite:node-a:offline");
  const cloudPostgres = createPostgresPacketStore("supabase:ndiysuhzmztatpxbkezn");
  const coldArchive = createArchivePacketStore("s3:cop-cold-archive");

  const doc = "Constitution de Corse de 1755 rédigée par Pasquale Paoli.";
  const docHash = computeContentHash(doc);

  const initialPacket = {
    packet_id: "pkt-odyssey-ulysse-2026",
    mandate_id: "mandate:research:ithaca",
    created_at: new Date().toISOString(),
    hops: [
      {
        hop_index: 0,
        node_id: "node:laptop:corsica-field",
        instance_id: "agent:jhn",
        interface: "sqlite-offline",
        route_reason: "field-research-departure",
        timestamp: new Date().toISOString(),
      },
    ],
    payload: { topic: "constitution_1755", mandate: "analyze_democratic_invariants" },
    closure: {
      closure_kind: "materializable",
      admissible_handlers: ["agent:jhn", "agent:ophelia"],
      referenced_dependencies: [
        {
          dependency_id: "dep:source:paoli_1755",
          kind: "document",
          locator: "store://historical/paoli_1755.txt",
          hash: docHash,
        },
      ],
    },
    lineage: {
      downstream_packet_ids: ["pkt-odyssey-downstream-step-1"],
      spawn_reason: "offline-exploration",
    },
    status: "dispatched",
  };

  // Node A saves locally offline
  await nodeASqlite.savePacket(initialPacket);

  // --- Reconnexion : Transfert vers le cloud PostgreSQL / Supabase ---
  const { packet: cloudPacket } = await transferPacket(
    initialPacket.packet_id,
    nodeASqlite,
    cloudPostgres,
    { setTargetPrimary: true }
  );
  assert.equal(cloudPacket.packet_id, initialPacket.packet_id);

  // Node A shuts down / deletes local cache
  await nodeASqlite.deletePacket(initialPacket.packet_id);

  // --- Nœud B (Serveur distant / reprise sans mémoire locale de A) ---
  const fetchedOnNodeB = await cloudPostgres.getPacket(initialPacket.packet_id);
  assert.ok(fetchedOnNodeB);

  const nodeBResolver = {
    async resolve(dep) {
      if (dep.locator === "store://historical/paoli_1755.txt") {
        return { content: doc, rawString: doc };
      }
      throw new Error("Missing");
    },
  };

  const resumedOnNodeB = await resumePacket(fetchedOnNodeB, nodeBResolver, async (pkt, closure) => {
    assert.equal(closure.is_closed, true);
    const dep = closure.resolved_dependencies.get("dep:source:paoli_1755");

    return {
      yield: {
        invariants: [
          "Souveraineté populaire",
          "Séparation des pouvoirs",
          "Droit de vote des femmes chefs de famille",
        ],
        source: dep.content,
      },
      newHop: {
        node_id: "node:fracta:cloud",
        instance_id: "agent:ophelia",
        interface: "postgres-cloud",
        route_reason: "analysis-synthesized-on-node-b",
      },
    };
  });

  await cloudPostgres.savePacket(resumedOnNodeB);

  // --- Retour à Ithaque & Assimilation ---
  const assimilated = await assimilateToIthaca(initialPacket.packet_id, cloudPostgres, {
    corpus_name: "Corpus Cogentia / Inseme",
    mandant: "twin:jhn",
  });

  assert.equal(assimilated.status, "assimilated");
  assert.ok(assimilated.ithaca.return_conditions.includes("yield_assimilated"));
  assert.equal(assimilated.yield.operational_yield.assimilated_by, "twin:jhn");

  // --- Phase 6 : Archivage à froid & Restauration de postérité ---
  const { archivedPacket, archivePlacement } = await archivePacket(
    initialPacket.packet_id,
    cloudPostgres,
    coldArchive
  );

  assert.equal(archivePlacement.store_kind, "object_storage");
  assert.equal(await cloudPostgres.hasPacket(initialPacket.packet_id), false);
  assert.equal(await coldArchive.hasPacket(initialPacket.packet_id), true);

  // Restauration depuis l'archive vers un nouveau magasin opérationnel
  const activeRestoreStore = createPostgresPacketStore("supabase:restored-operational");
  const { restoredPacket } = await restorePacket(
    initialPacket.packet_id,
    coldArchive,
    activeRestoreStore
  );

  assert.equal(restoredPacket.packet_id, initialPacket.packet_id);
  assert.equal(restoredPacket.status, "assimilated");
  assert.equal(restoredPacket.hops.length, 2);
  assert.equal(restoredPacket.yield.semantic_yield.invariants.length, 3);
});
