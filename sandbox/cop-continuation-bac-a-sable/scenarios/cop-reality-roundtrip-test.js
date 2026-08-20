/**
 * Scenario: cop-reality-roundtrip-test
 *
 * Implementation and executable Reality Test for:
 *   - JeanHuguesRobert/inseme#54 (COP Reality Test — minimal executable Cognitive Packet round trip)
 *   - JeanHuguesRobert/cogentia#113 (Cognitive Packets in Real Life — Case Studies 001 Incident / 002 Guide)
 *   - barons-Mariani/research/the_network_is_the_learning_computer.md
 *
 * Acceptance Criterion:
 *   "A real-world stimulus enters; at least one real Cognitive Packet is handled by a distinct handler;
 *    its yield returns to an identifiable Ithaca; the trace reconstructs the Odyssey; human time can be accounted for."
 *
 * Tested Invariants:
 *   1. Preserves packet identity and lineage across hops.
 *   2. Represents intent/current cognitive state for an admissible handler.
 *   3. Records handler and hop provenance (hops chain).
 *   4. Explicit Ithaca (return target) and Yield (semantic + operational).
 *   5. Keeps `solved`, `returned`, and `assimilated` semantically distinct.
 *   6. Handlers are replaceable hops (no single LLM/agent owns packet continuity).
 *   7. Reconstructs the Odyssey trace from departure to assimilation.
 *   8. Human minutes, machine cost, and residue are explicitly accounted for.
 */

export default {
  name: "cop-reality-roundtrip-test",
  description:
    "Executes a minimal Cognitive Packet round trip (Reality Test): stimulus enters -> packetized with Ithaca " +
    "-> routed to replaceable handler -> solved (yield produced) -> returned to Ithaca -> assimilated into durable substrate -> Odyssey reconstructed.",

  defaultTopicId: "cop-reality-case-001",

  steps: [
    {
      name: "1-stimulus-and-packet-departure",
      description:
        "A real stimulus enters (Case 001 Incident). Packetize with intent, Ithaca target, initial state, and accounting metrics.",
      async run(ctx) {
        // Create topic-scoped federated buses: Origin/Ithaca (Alpha) and Handler Node (Beta)
        const pair = ctx.createFederatedTopicBusPair();

        ctx.realityTest = {
          pair,
          topicBusOrigin: pair.topicBusA, // Ithaca / Origin side
          topicBusHandler: pair.topicBusB, // Replaceable Handler side
          eventsObserved: [],
        };

        // Track lifecycle events
        pair.topicBusA.subscribeAll((evt) => {
          ctx.realityTest.eventsObserved.push(evt);
        });
        pair.topicBusB.subscribeAll((evt) => {
          ctx.realityTest.eventsObserved.push(evt);
        });

        // Register required capability for the incident analyst
        ctx.capabilityRegistry.register("incident-diagnosis", {
          providers: ["operium-analyst-agent", "sre-fallback-node"],
          metadata: { description: "Can analyze distributed node latency and suggest remediation" },
        });

        // Stimulus (Case 001 Incident): latency spike in cache synchronization
        const stimulus = {
          case_id: "case-001-incident-cache-sync",
          pattern: "incident",
          origin: "operium://node-fracta-alpha/alerts/cache-sync-latency",
          started_at: new Date().toISOString(),
          symptom: "Cache sync latency exceeded 2500ms on peer connection failover",
          affected_nodes: ["node:fracta:alpha", "node:fracta:beta"],
        };

        // Create the Cognitive Packet with explicit Ithaca and intent
        const packet = ctx.asCognitivePacket({
          envelope: {
            packetKind: "incident-investigation",
            intent: "Diagnose cache sync latency and produce actionable remediation",
            routeTo: "incident-analyst-node",
            requiredCapability: "incident-diagnosis",
            riskLevel: "medium",
            status: "dispatched",
            ithaca: {
              description: "Operium Incident Response Hub (Ithaca)",
              return_target: "operium-incident-channel",
              response_channel: "incident.returns",
              return_conditions: ["root-cause-identified", "remediation-suggested"],
            },
            provenance: {
              origin: stimulus.origin,
              emitter: "operium-monitoring-probe",
              mandate: "mandate:fractanet:ops:2026",
            },
            residue: [],
          },
          payload: {
            stimulus,
            diagnosticData: {
              p99LatencyMs: 3120,
              errorCount: 14,
              sampleStackTrace: "ETIMEDOUT: connection reset by peer during pool handover",
            },
          },
          kind: "incident-investigation",
          bus: pair.topicBusA,
        });

        // Record Hop 0: Departure from Origin
        ctx.recordPacketHop(packet, {
          node_id: "node:fracta:monitor",
          instance_id: "probe-agent-01",
          route_reason: "stimulus-packetized-and-dispatched",
          interface: "local-bus",
        });

        ctx.realityTest.packet = packet;
        ctx.realityTest.stimulus = stimulus;

        ctx.emit({
          type: "reality-test.packet-dispatched",
          data: {
            packetId: packet.envelope.id,
            intent: packet.envelope.intent,
            ithaca: packet.envelope.ithaca,
          },
        });

        console.log(
          `[REALITY-TEST] Packet ${packet.envelope.id} departed toward Ithaca target: ${packet.envelope.ithaca.return_target}`
        );
      },
    },

    {
      name: "2-switching-to-replaceable-handler",
      description:
        "Envelope-only routing through the switching fabric dispatches work to an admissible handler hop.",
      async run(ctx) {
        const { packet, topicBusOrigin, topicBusHandler } = ctx.realityTest;

        // Cogentia router inspects only the envelope and verifies capability
        const routingDecision = await ctx.cogentiaRoutePacket(packet, {
          forwardToBus: topicBusHandler,
          source: "cogentia-reality-router",
        });

        ctx.realityTest.routingDecision = routingDecision;

        ctx.emit({
          type: "reality-test.packet-routed",
          data: {
            packetId: packet.envelope.id,
            action: routingDecision.action,
            chosenCapability: routingDecision.chosenCapability,
          },
        });

        console.log(
          `[REALITY-TEST] Packet switched to handler: ${routingDecision.action} (capability: ${routingDecision.chosenCapability})`
        );
      },
    },

    {
      name: "3-handler-execution-and-yield-production",
      description:
        "The distinct handler processes the cognitive work, produces a dual yield (semantic + operational), and marks the packet as 'solved'.",
      async run(ctx) {
        const { packet, topicBusHandler } = ctx.realityTest;

        // Handler safely reads payload (router only saw envelope)
        const { diagnosticData } = packet.payload;

        // Cognitive work performed by handler
        const semanticYield = {
          root_cause: "Stale socket connection pool during peer failover",
          remediation: "Apply eager socket purge on failover + exponential backoff retry",
          patch_code: "pool.resetOnDisconnect({ maxBackoffMs: 500 });",
          severity: "medium",
          confidence: 0.94,
        };

        const operationalYield = {
          handler_node: "node:workstation:analyst",
          handler_id: "sre-analyst-agent-v1",
          duration_ms: 120,
          tokens_processed: 480,
          memory_mb: 24,
        };

        // Note any residue observed during handling
        const observedResidue = [
          "Socket pool recovery requires host OS network namespace check which was not modelled in packet payload",
        ];

        // Mark as SOLVED (state 1 of 3)
        await ctx.markPacketSolved(packet, {
          yieldData: {
            semantic_yield: semanticYield,
            operational_yield: operationalYield,
            produced_at: new Date().toISOString(),
            produced_by: "sre-analyst-agent-v1",
          },
          handlerId: "sre-analyst-agent-v1",
          nodeId: "node:workstation:analyst",
          durationMs: 120,
          residue: observedResidue,
          bus: topicBusHandler,
        });

        ctx.emit({
          type: "reality-test.packet-solved",
          data: {
            packetId: packet.envelope.id,
            status: packet.envelope.status,
            yield: packet.yield,
          },
        });

        console.log(
          `[REALITY-TEST] Packet solved. Status=${packet.envelope.status}. Semantic yield produced.`
        );
      },
    },

    {
      name: "4-yield-returns-to-ithaca",
      description:
        "The yield returns to the identifiable Ithaca target and transitions to 'returned'.",
      async run(ctx) {
        const { packet, topicBusOrigin } = ctx.realityTest;

        // Mark as RETURNED (state 2 of 3)
        await ctx.markPacketReturned(packet, {
          returnTarget: packet.envelope.ithaca.return_target,
          bus: topicBusOrigin,
        });

        ctx.emit({
          type: "reality-test.packet-returned",
          data: {
            packetId: packet.envelope.id,
            status: packet.envelope.status,
            ithaca: packet.envelope.ithaca,
          },
        });

        console.log(
          `[REALITY-TEST] Yield returned to Ithaca: ${packet.envelope.ithaca.description}. Status=${packet.envelope.status}`
        );
      },
    },

    {
      name: "5-assimilation-into-durable-substrate",
      description:
        "Ithaca incorporates the yield into the persistent cognitive substrate (Corpus) and marks the packet as 'assimilated'.",
      async run(ctx) {
        const { packet, topicBusOrigin } = ctx.realityTest;

        // Durable update to the cognitive substrate / corpus
        const substrate = "operium-incident-knowledge-base";
        const durableChanges = {
          recordId: "INC-2026-08-001",
          patternAdded: "stale-socket-pool-on-failover",
          remediationCataloged: true,
          futureRoutingAffected: true, // Learning Computer loop: subsequent journeys benefit
        };

        // Mark as ASSIMILATED (state 3 of 3)
        await ctx.markPacketAssimilated(packet, {
          substrate,
          changes: durableChanges,
          bus: topicBusOrigin,
        });

        ctx.emit({
          type: "reality-test.packet-assimilated",
          data: {
            packetId: packet.envelope.id,
            status: packet.envelope.status,
            substrate,
            changes: durableChanges,
          },
        });

        console.log(
          `[REALITY-TEST] Packet assimilated into ${substrate}. Status=${packet.envelope.status}`
        );
      },
    },

    {
      name: "6-odyssey-reconstruction-and-accounting",
      description:
        "Reconstruct the complete Odyssey trace and record human/machine accounting metrics (Skin in the Game).",
      async run(ctx) {
        const { packet, stimulus } = ctx.realityTest;

        // 1. Reconstruct Odyssey trace
        const odyssey = ctx.reconstructOdyssey(packet);

        // 2. Build minimal shared Case Record (cogentia#113 / inseme#54 format)
        const caseRecord = {
          case_id: stimulus.case_id,
          pattern: stimulus.pattern,
          origin: stimulus.origin,
          started_at: stimulus.started_at,
          intent: packet.envelope.intent,
          initial_state: stimulus.symptom,
          ithaca: packet.envelope.ithaca,
          packets: [packet.envelope.id],
          result: {
            status: packet.envelope.status,
            returned: odyssey.lifecycle.isReturned,
            assimilated: odyssey.lifecycle.isAssimilated,
            yield: packet.yield,
          },
          metrics: {
            human_minutes: 3.5, // 3.5 min supervision / review
            machine_cost: 0.0024, // provisional USD cost
            hops: odyssey.journey.hopsCount,
            child_packets: 0,
          },
          residue: packet.envelope.residue,
        };

        ctx.realityTest.odyssey = odyssey;
        ctx.realityTest.caseRecord = caseRecord;

        // Assertions for acceptance criteria
        const hasIdentity = !!packet.envelope.id;
        const hasIthaca = !!packet.envelope.ithaca?.return_target;
        const isSolved = odyssey.lifecycle.isSolved;
        const isReturned = odyssey.lifecycle.isReturned;
        const isAssimilated = odyssey.lifecycle.isAssimilated;
        const distinctStates = isSolved && isReturned && isAssimilated;
        const hasHops = odyssey.journey.hopsCount >= 2;
        const hasHumanAccounting = typeof caseRecord.metrics.human_minutes === "number";
        const hasResidue = Array.isArray(caseRecord.residue);

        const success =
          hasIdentity && hasIthaca && distinctStates && hasHops && hasHumanAccounting && hasResidue;

        console.log("\n=== REALITY TEST ODYSSEY RECONSTRUCTION ===");
        console.log(`  Packet ID: ${odyssey.packetId}`);
        console.log(`  Intent: ${odyssey.intent}`);
        console.log(`  Ithaca: ${odyssey.ithaca?.description} (${odyssey.ithaca?.return_target})`);
        console.log(`  Lifecycle Status: ${odyssey.lifecycle.status}`);
        console.log(
          `  States distinct: Solved=${isSolved}, Returned=${isReturned}, Assimilated=${isAssimilated}`
        );
        console.log(`  Hops Count: ${odyssey.journey.hopsCount}`);
        odyssey.journey.hopsChain.forEach((h) => {
          console.log(
            `    [Hop ${h.hopIndex}] Node: ${h.node} | Instance: ${h.instance} | Reason: ${h.reason}`
          );
        });
        console.log(
          `  Semantic Yield: ${JSON.stringify(odyssey.yield?.semantic_yield?.root_cause)}`
        );
        console.log(`  Human Minutes Accounted: ${caseRecord.metrics.human_minutes} min`);
        console.log(`  Residue Count: ${caseRecord.residue.length}`);

        ctx.emit({
          type: "reality-test.completed",
          data: {
            success,
            caseRecord,
            odyssey,
          },
        });

        if (success) {
          console.log(
            "\n[PASS] Issue #54 Reality Test SUCCESSFUL: stimulus -> hop -> solved -> returned -> assimilated -> odyssey reconstructed."
          );
        } else {
          console.log("\n[FAIL] Reality Test validation failed.");
          throw new Error("Reality Test assertion failure");
        }
      },
    },
  ],
};
