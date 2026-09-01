import test from "node:test";
import assert from "node:assert/strict";
import {
  asCognitivePacket,
  recordPacketHop,
  markPacketSolved,
  markPacketReturned,
  markPacketAssimilated,
  reconstructOdyssey,
} from "../../../packages/cop-kernel/src/Cop-kerneltasks.js";
import {
  createSqlitePacketStore,
  createPostgresPacketStore,
  transferPacket,
} from "../../../packages/cop-core/dist/packet-store.js";
import { resumePacket, computeContentHash } from "../../../packages/cop-core/dist/closure.js";

/**
 * Issue #54 Reality Test:
 * - Stimulus enters (Incident Case 001).
 * - Real Cognitive Packet created with declared Ithaca and bounded budget.
 * - Distinct handler executes the hop with accountable time & spend.
 * - Yield returns to Ithaca.
 * - Distinguishes `solved`, `returned`, and `assimilated`.
 * - Full Odyssey reconstructible from hops and trace events.
 */
test("Issue #54 Reality Test: minimal executable Cognitive Packet round trip (Incident Case 001)", async () => {
  const localStore = createSqlitePacketStore("sqlite:node-incident:local");
  const centralStore = createPostgresPacketStore("supabase:incident-bridge");

  const incidentReport = "ALERTE: Rupture de service DNS sur zone corse pertitellu.fr.";
  const incidentHash = computeContentHash(incidentReport);

  // 1. Stimulus enters -> Root Cognitive Packet initialized
  const packet = asCognitivePacket({
    kind: "incident-mitigation",
    envelope: {
      id: "pkt-incident-2026-001",
      intent: "Diagnose and mitigate DNS outage",
      mandate_id: "mandate:sysadmin:emergency",
      status: "dispatched",
      ithaca: {
        description: "Operations Center / NOC Corte",
        return_target: "noc-incident-responder",
        return_conditions: ["dns_records_restored", "yield_assimilated"],
      },
      closure: {
        closure_kind: "materializable",
        admissible_handlers: ["handler:dns-surgeon@edge", "handler:ophelia@fracta"],
        referenced_dependencies: [
          {
            dependency_id: "dep:incident:report_001",
            kind: "document",
            locator: "store://incidents/report_001.txt",
            hash: incidentHash,
          },
        ],
      },
    },
  });

  assert.equal(packet.envelope.status, "dispatched");
  assert.equal(packet.envelope.ithaca.return_target, "noc-incident-responder");

  // Save in local operational store
  await localStore.savePacket(packet.envelope);

  // 2. Transfer to Edge Node where handler executes
  const { packet: edgePacket } = await transferPacket(
    packet.envelope.id,
    localStore,
    centralStore,
    { setTargetPrimary: true }
  );

  // 3. Distinct Handler executes the hop
  const resolver = {
    async resolve(dep) {
      if (dep.locator === "store://incidents/report_001.txt") {
        return { content: incidentReport, rawString: incidentReport };
      }
      throw new Error("Missing");
    },
  };

  const startTime = Date.now();
  const resumed = await resumePacket(edgePacket, resolver, async (pkt, closure) => {
    assert.equal(closure.is_closed, true);

    const executionDurationMs = Date.now() - startTime;

    return {
      yield: {
        diagnosis: "NS glue record missing on TLD registry",
        mitigation: "Re-injected glue NS1/NS2 at registrar via Operium template",
        latency_ms: executionDurationMs,
      },
      newHop: {
        node_id: "node:edge:corsica",
        instance_id: "handler:dns-surgeon@edge",
        interface: "dns-control-api",
        route_reason: "emergency-glue-record-remediation",
      },
    };
  });

  // At this stage, mark packet solved
  await markPacketSolved(packet, {
    nodeId: "node:edge:corsica",
    handlerId: "handler:dns-surgeon@edge",
    yieldData: resumed.yield,
    durationMs: 42,
    spending: {
      capability: "dns.diagnostics",
      cost_usd: 0.0015,
      tokens: 165,
    },
  });

  assert.equal(packet.envelope.status, "solved");
  assert.ok(packet.yield.semantic_yield.diagnosis);

  // 4. Return to Ithaca -> Status transitions from "solved" to "returned"
  await markPacketReturned(packet, {
    returnTarget: "noc-incident-responder",
  });
  assert.equal(packet.envelope.status, "returned");

  // 5. Assimilation in Ithaca -> Status transitions to "assimilated"
  await markPacketAssimilated(packet, {
    substrate: "NOC Incident Postmortem Archive",
    changes: { incident_resolved: true, action: "glue_remediation" },
  });

  assert.equal(packet.envelope.status, "assimilated");
  assert.equal(packet.envelope.ithaca.return_conditions.length, 2);

  // 6. Trace & Odyssey Reconstruction
  const odyssey = reconstructOdyssey(packet);
  assert.ok(odyssey);
  assert.equal(odyssey.lifecycle.isSolved, true);
  assert.equal(odyssey.lifecycle.isReturned, true);
  assert.equal(odyssey.lifecycle.isAssimilated, true);
  assert.equal(odyssey.journey.hopsCount >= 1, true);
});
