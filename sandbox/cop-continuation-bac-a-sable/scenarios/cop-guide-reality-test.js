/**
 * Scenario: cop-guide-reality-test (Case 002 Guide)
 *
 * Implementation of Case 002 (Guide) Reality Test for:
 *   - JeanHuguesRobert/inseme#54 (COP Reality Test)
 *   - JeanHuguesRobert/cogentia#113 (Cognitive Packets in Real Life — Case 002 Guide)
 *
 * Flow:
 *   Visitor Question enters -> Packetized with Visitor Ithaca -> Envelope Switching ->
 *   Librarian Research Hop -> Solved (Grounded Yield) -> Returned to Visitor Ithaca ->
 *   Assimilated into Visitor Session History -> Odyssey & Accounting Reconstructed.
 */

export default {
  name: "cop-guide-reality-test",
  description:
    "Executes the Case 002 (Guide) Reality Test: visitor question enters -> packetized with visitor Ithaca " +
    "-> routed to research handler -> solved (grounded answer + citations yield) -> returned to visitor Ithaca " +
    "-> assimilated into visitor session history -> Odyssey reconstructed.",

  defaultTopicId: "cop-reality-case-002",

  steps: [
    {
      name: "1-visitor-stimulus-and-packet-departure",
      description:
        "A visitor asks a question via Guide. Packetize with intent and visitor Ithaca target.",
      async run(ctx) {
        const pair = ctx.createFederatedTopicBusPair();

        ctx.guideRealityTest = {
          pair,
          topicBusVisitor: pair.topicBusA,
          topicBusLibrarian: pair.topicBusB,
          eventsObserved: [],
        };

        pair.topicBusA.subscribeAll((evt) => {
          ctx.guideRealityTest.eventsObserved.push(evt);
        });
        pair.topicBusB.subscribeAll((evt) => {
          ctx.guideRealityTest.eventsObserved.push(evt);
        });

        ctx.capabilityRegistry.register("corpus-research", {
          providers: ["librarian-agent-01", "guide-fallback-node"],
          metadata: { description: "Can search Cogentia corpus and extract citable evidence" },
        });

        const stimulus = {
          case_id: "case-002-guide-query-doctrine",
          pattern: "guide",
          origin: "guide://public.fractavolta.com/chat/session-visitor-987",
          started_at: new Date().toISOString(),
          query:
            "What is the Anti-Capture Doctrine in Cogentia and why does the corpus forbid proprietary agent memory silos?",
          visitor_id: "visitor-session-987",
        };

        const packet = ctx.asCognitivePacket({
          envelope: {
            packetKind: "guide-query",
            intent:
              "Synthesize grounded answer to visitor question using corpus evidence from canonical sources",
            routeTo: "librarian-research-node",
            requiredCapability: "corpus-research",
            riskLevel: "read_only",
            status: "dispatched",
            ithaca: {
              description: "Visitor Web Client Session (Ithaca)",
              return_target: stimulus.visitor_id,
              response_channel: "guide.visitor.stream",
              return_conditions: ["answer-synthesized", "citations-included"],
            },
            provenance: {
              origin: stimulus.origin,
              emitter: "guide-gateway-probe",
              mandate: "mandate:guide:public:2026",
            },
            residue: [],
          },
          payload: {
            stimulus,
          },
          kind: "guide-query",
          bus: pair.topicBusA,
        });

        ctx.recordPacketHop(packet, {
          node_id: "node:guide:gateway",
          instance_id: "guide-web-router",
          route_reason: "visitor-query-received-and-packetized",
          interface: "https-stream",
        });

        ctx.guideRealityTest.packet = packet;
        ctx.guideRealityTest.stimulus = stimulus;

        ctx.emit({
          type: "guide-reality-test.packet-dispatched",
          data: {
            packetId: packet.envelope.id,
            ithaca: packet.envelope.ithaca,
          },
        });

        console.log(
          `[GUIDE-REALITY-TEST] Visitor packet ${packet.envelope.id} departed toward Ithaca: ${packet.envelope.ithaca.return_target}`
        );
      },
    },

    {
      name: "2-switching-to-research-handler",
      description:
        "Cogentia router inspects only the envelope and forwards to librarian research capability.",
      async run(ctx) {
        const { packet, topicBusLibrarian } = ctx.guideRealityTest;

        const decision = await ctx.cogentiaRoutePacket(packet, {
          registry: ctx.capabilityRegistry,
          forwardToBus: topicBusLibrarian,
          source: "guide-router",
        });

        ctx.guideRealityTest.decision = decision;

        ctx.emit({
          type: "guide-reality-test.packet-routed",
          data: {
            action: decision.action,
            routeTo: packet.envelope.routeTo,
            capabilitySatisfied: decision.capabilitySatisfied,
          },
        });

        console.log(
          `[GUIDE-REALITY-TEST] Packet switched to handler: ${decision.action} (capability: ${packet.envelope.requiredCapability})`
        );
      },
    },

    {
      name: "3-research-execution-and-yield-production",
      description:
        "Librarian handler searches corpus, synthesizes grounded answer, and records Hop 1.",
      async run(ctx) {
        const { packet, topicBusLibrarian } = ctx.guideRealityTest;

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

        await ctx.markPacketSolved(packet, {
          yieldData: {
            semantic_yield: semanticYield,
            operational_yield: operationalYield,
            produced_by: "librarian-agent-01",
          },
          handlerId: "librarian-agent-01",
          nodeId: "node:workstation:librarian",
          durationMs: 55,
          residue: ["Visitor query did not specify repo scope, defaulted to full public corpus"],
          bus: topicBusLibrarian,
        });

        ctx.emit({
          type: "guide-reality-test.packet-solved",
          data: {
            packetId: packet.envelope.id,
            status: packet.envelope.status,
            yield: packet.yield,
          },
        });

        console.log(
          `[GUIDE-REALITY-TEST] Packet solved by Librarian. Status=${packet.envelope.status}. Semantic yield produced.`
        );
      },
    },

    {
      name: "4-yield-returns-to-visitor-ithaca",
      description: "Yield returns across the network to the visitor Ithaca target.",
      async run(ctx) {
        const { packet, topicBusVisitor } = ctx.guideRealityTest;

        await ctx.markPacketReturned(packet, {
          returnTarget: packet.envelope.ithaca.return_target,
          bus: topicBusVisitor,
        });

        ctx.emit({
          type: "guide-reality-test.packet-returned",
          data: {
            packetId: packet.envelope.id,
            status: packet.envelope.status,
            ithaca: packet.envelope.ithaca,
          },
        });

        console.log(
          `[GUIDE-REALITY-TEST] Yield returned to Visitor Ithaca: ${packet.envelope.ithaca.return_target}. Status=${packet.envelope.status}`
        );
      },
    },

    {
      name: "5-assimilation-into-visitor-session",
      description: "Visitor session incorporates the yield into durable conversation state.",
      async run(ctx) {
        const { packet, topicBusVisitor } = ctx.guideRealityTest;

        await ctx.markPacketAssimilated(packet, {
          substrate: "visitor-conversation-history",
          changes: {
            turnsCount: 1,
            lastDeliveredYieldId: packet.envelope.id,
            citationsCount: packet.yield.semantic_yield.citations.length,
          },
          bus: topicBusVisitor,
        });

        ctx.emit({
          type: "guide-reality-test.packet-assimilated",
          data: {
            packetId: packet.envelope.id,
            status: packet.envelope.status,
            substrate: "visitor-conversation-history",
          },
        });

        console.log(
          `[GUIDE-REALITY-TEST] Packet assimilated into visitor-conversation-history. Status=${packet.envelope.status}`
        );
      },
    },

    {
      name: "6-odyssey-reconstruction-and-accounting",
      description: "Reconstruct the complete Odyssey journey trace and verify Case 002 accounting.",
      async run(ctx) {
        const { packet, eventsObserved } = ctx.guideRealityTest;

        const odyssey = ctx.reconstructOdyssey(packet, { events: eventsObserved });

        ctx.guideRealityTest.odyssey = odyssey;

        console.log("\n=== CASE 002 (GUIDE) ODYSSEY RECONSTRUCTION ===");
        console.log(`[packetId] ${odyssey.packetId}`);
        console.log(`[intent] ${odyssey.intent}`);
        console.log(`[ithaca] ${odyssey.ithaca.description} (${odyssey.ithaca.return_target})`);
        console.log(
          `[lifecycle] ${odyssey.lifecycle.status} (Solved=${odyssey.lifecycle.isSolved}, Returned=${odyssey.lifecycle.isReturned}, Assimilated=${odyssey.lifecycle.isAssimilated})`
        );
        console.log(`[journey] Hops Count: ${odyssey.journey.hopsCount}`);
        odyssey.journey.hopsChain.forEach((h) => {
          console.log(
            `  [Hop ${h.hopIndex}] Node: ${h.node} | Instance: ${h.instance} | Reason: ${h.reason}`
          );
        });
        console.log(`[yield] Citations: ${JSON.stringify(odyssey.yield.semantic_yield.citations)}`);
        console.log(`[residue] Count: ${odyssey.residue.length}`);

        if (
          odyssey.lifecycle.isSolved &&
          odyssey.lifecycle.isReturned &&
          odyssey.lifecycle.isAssimilated &&
          odyssey.journey.hopsCount === 3
        ) {
          console.log(
            "\n[PASS] Case 002 (Guide) Reality Test SUCCESSFUL: question -> research hop -> solved -> returned -> assimilated -> Odyssey verified."
          );
        } else {
          throw new Error("Case 002 Reality Test did not satisfy all invariants.");
        }

        ctx.emit({
          type: "guide-reality-test.completed",
          data: {
            odyssey,
            eventsCount: eventsObserved.length,
          },
        });
      },
    },
  ],
};
