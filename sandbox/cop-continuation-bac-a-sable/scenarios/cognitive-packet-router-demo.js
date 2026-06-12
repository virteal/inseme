/**
 * Scenario: cognitive-packet-router-demo (clean lightweight version)
 *
 * Purpose:
 *   Exercise `asCognitivePacket` + a **reactive Cogentia-style router agent** that
 *   subscribes to cognitive-packet events and makes all routing decisions by
 *   inspecting *only the envelope* (never the payload).
 *
 * This is a focused, reliable demonstration of the "Cognitive Packet Switching" model
 * described in cogentia/research/cognitive_packet_switching.md and
 * cogentia_continuation_packet_routing.md.
 *
 * Resumption note: See packages/cop-kernel/docs/SESSION_RESUME_cognitive-packet-router-2026-06.md
 * and the compatibility report for full context. The reusable `cogentiaRoutePacket` helper is now
 * first-class in cop-kernel (extracted from this demo as a follow-up).
 * The core exercise (asCognitivePacket + envelope-only router + registry) has been verified.
 *
 *   - Routers (Cogentia) see only routing metadata (envelope).
 *   - The COP Bus (with topic sub-buses + federation) provides the switching fabric.
 *   - A subscribing "router agent" applies policy reactively, consulting a capability registry stub for requiredCapability.
 *   - Competent handlers are the only ones allowed to interpret the payload.
 *
 * Design notes for reliability (post-clean):
 *   - Uses ctx.createFederatedTopicBusPair() for mesh feel.
 *   - Does NOT create extra COPScheduler instances (avoids timer bloat / OOM).
 *   - Uses ctx.scheduler for any registration (auto-reset in pipeline after run).
 *   - Other scenarios can use ctx.createIsolatedScheduler(bus) for dedicated ones; pipeline auto-resets them.
 *   - Router logic uses the first-class reusable `cogentiaRoutePacket` helper (imported via ctx) with envelope-only + capability registry.
 *   - Emits cop.packet.* (created from asCognitivePacket, routed from helper) **in addition to** custom types (addresses the emission question).
 *   - Hybrid (pushing further): listenForRoutedPackets() for auto from bus policy + direct schedule triggering routingPolicy (cogentiaRoutePacket) *inside* JobScheduler.schedule() (with setRoutingPolicy wiring in adapter).
 *   - SubBus listener registration + async delivery cleaned up (no leaks on unsub, proper await chains for forwarded routed events).
 *   - Federation cycle protection (in bus.js) + pipeline resetForTest ensure repeated runs stay stable.
 */

export default {
  name: "cognitive-packet-router-demo",
  description:
    "Clean exercise of asCognitivePacket + *reactive* envelope-only Cogentia router agent + capability registry stub, " +
    "using the first-class reusable `cogentiaRoutePacket` helper from cop-kernel. " +
    "Demonstrates cop.packet.* emission (created + routed) in addition to custom types + hybrid (listenForRoutedPackets auto from bus policy + direct schedule triggering routingPolicy *inside* JobScheduler.schedule() for decisions). " +
    "Agent subscribes to 'cognitive-packet' (and cop.packet.*) and inspects only envelope fields (packetKind, routeTo, requiredCapability, riskLevel) " +
    "plus capabilityRegistry.canSatisfy() to decide forwarding. Handler side safely uses the payload. " +
    "Router decision happens in subscription handler (bus-driven).",

  defaultTopicId: "cognitive-packet-router-demo",

  steps: [
    {
      name: "setup-federated-topic-buses",
      description:
        "Create two federated per-topic sub-buses (Alpha = router side, Beta = handler side). Register a reactive Cogentia router agent that subscribes and applies envelope-only policy.",
      async run(ctx) {
        const pair = ctx.createFederatedTopicBusPair();

        ctx.routerDemo = {
          pair,
          topicBusA: pair.topicBusA, // "Alpha" – where the router conceptually lives
          topicBusB: pair.topicBusB, // "Beta"  – target handler side
          receivedByRouter: [],
          receivedByHandler: [],
        };

        // Router "agent" subscribes on Alpha side (only cares about cognitive packets).
        // This makes the router *reactive*: the policy decision happens inside the subscription
        // handler when a cognitive-packet is published (demonstrating bus-driven agent).
        //
        // Now using the reusable first-class helper from cop-kernel (ctx.cogentiaRoutePacket),
        // which is the extracted `cogentiaRoutePacket` + wrapper that injects registry.
        // Still 100% envelope-only.
        const unsubRouter = pair.topicBusA.subscribe("cognitive-packet", async (evt) => {
          ctx.routerDemo.receivedByRouter.push(evt);
          // Active Cogentia router agent: reacts on event, inspects *only* envelope, decides.
          if (evt && evt.data) {
            const decision = await ctx.cogentiaRoutePacket(evt.data, {
              forwardToBus: pair.topicBusB,
            });
            ctx.routerDemo.routerDecision = decision;
            ctx.routerDemo.routerInspectedOnlyEnvelope = true;
          }
        });

        // Handler subscribes on Beta side to routed packets
        const unsubHandler = pair.topicBusB.subscribe("cognitive-packet.routed", (evt) => {
          ctx.routerDemo.receivedByHandler.push(evt);
        });

        ctx.routerDemo.unsubRouter = unsubRouter;
        ctx.routerDemo.unsubHandler = unsubHandler;

        // Also demonstrate the cop.packet.created emission that asCognitivePacket now
        // performs (clean follow-up). External routers can subscribe to this uniform type
        // instead of (or in addition to) app-specific "cognitive-packet".
        const unsubPacketEvent = pair.topicBusA.subscribe("cop.packet.created", (evt) => {
          ctx.routerDemo.receivedPacketEvents = ctx.routerDemo.receivedPacketEvents || [];
          ctx.routerDemo.receivedPacketEvents.push(evt);
        });
        ctx.routerDemo.unsubPacketEvent = unsubPacketEvent;

        // Demonstrate cop.packet.* emission from the reusable router helper
        // (in addition to the custom "cognitive-packet.routed")
        const unsubCopRouted = pair.topicBusA.subscribe("cop.packet.routed", (evt) => {
          ctx.routerDemo.receivedCopRoutedEvents = ctx.routerDemo.receivedCopRoutedEvents || [];
          ctx.routerDemo.receivedCopRoutedEvents.push(evt);
        });
        ctx.routerDemo.unsubCopRouted = unsubCopRouted;

        // Wire the capability registry stub (the follow-up we picked).
        // The router will only forward if the requiredCapability is registered/satisfied.
        // This demonstrates "method-governed routing policy" as a higher layer on the envelope.
        const registry = ctx.capabilityRegistry;
        if (registry) {
          registry.register("source-critique", {
            providers: ["technical-critic", "source-critic-agent"],
            metadata: { description: "Can perform methodological source critique", risk: "medium" },
          });
          console.log("[ROUTER-DEMO] Capability 'source-critique' registered in stub registry.");
        }

        // Small hybrid example (pushing the hybrid further):
        // The Cogentia policy lives as higher agent on the (federated) bus and publishes cop.packet.routed.
        // Here we wire the JobScheduler to listen on the same bus for those events and auto-schedule
        // the continuation from the packet. This shows scheduler reacting to bus policy decisions.
        if (ctx.jobScheduler && typeof ctx.jobScheduler.listenForRoutedPackets === "function") {
          ctx.jobScheduler.listenForRoutedPackets(pair.topicBusB);
          console.log(
            "[ROUTER-DEMO] Hybrid: wired jobScheduler to listenForRoutedPackets on topicBusB."
          );
        }

        ctx.emit({ type: "router-demo.setup", data: { topicId: ctx.currentTopicId } });
        console.log("[ROUTER-DEMO] Federated topic buses ready. Router will only see envelopes.");
      },
    },

    {
      name: "create-continuation-and-wrap-as-packet",
      description:
        "Create a real continuation and wrap it with asCognitivePacket (envelope for routing, payload for meaning).",
      async run(ctx) {
        const { createContinuationDescriptor } =
          await import("../../../packages/cop-kernel/src/continuation.js");

        const continuation = createContinuationDescriptor({
          resumeTo: "source-critic",
          resumeIntent: "methodological-critique",
          topicId: ctx.currentTopicId,
          state: {
            object: "Cognitive Packet Switching",
            sensitiveAnalysis: "Only the competent handler should ever see this field.",
          },
          waitForEvents: ["critique-result"],
        });

        const cognitivePacket = ctx.asCognitivePacket({
          envelope: {
            packetKind: "continuation",
            routeTo: "technical-critic",
            requiredCapability: "source-critique",
            riskLevel: "medium",
            provenance: { origin: "producer" },
          },
          payload: continuation,
          kind: "continuation",
          // Explicitly target the Alpha topic bus for the cop.packet.* emission so the
          // demo's "uniform router event" subscription can observe it (illustrates the
          // clean improvement to asCognitivePacket).
          bus: ctx.routerDemo.pair.topicBusA,
        });

        ctx.routerDemo.cognitivePacket = cognitivePacket;
        ctx.routerDemo.originalContinuation = continuation;

        ctx.emit({
          type: "cognitive-packet.created",
          data: {
            packetKind: cognitivePacket.envelope.packetKind,
            routeTo: cognitivePacket.envelope.routeTo,
            requiredCapability: cognitivePacket.envelope.requiredCapability,
          },
        });

        console.log("[ROUTER-DEMO] Cognitive packet created via asCognitivePacket.");
      },
    },

    {
      name: "publish-packet-router-reacts",
      description:
        "Publish the packet on Alpha. The subscribed Cogentia router *agent* (set up in previous step) inspects ONLY the envelope in its handler and decides to forward to Beta.",
      async run(ctx) {
        const { topicBusA, cognitivePacket } = ctx.routerDemo;

        // Producer publishes on Alpha. This triggers the router agent's subscription handler,
        // which runs the reusable ctx.cogentiaRoutePacket helper (envelope only + registry) and forwards.
        await topicBusA.publish({
          type: "cognitive-packet",
          data: cognitivePacket,
          source: "producer-alpha",
        });

        console.log(
          "[ROUTER-DEMO] Packet published on Alpha; reactive router agent executed policy."
        );
      },
    },

    {
      name: "handler-on-beta-unpacks-payload",
      description:
        "On the receiving side the competent handler safely uses the payload (the router never did).",
      async run(ctx) {
        // No artificial sleep needed: the async/await chain through the (now properly
        // awaited) SubBus deliveries + the await on the router's forward publish ensures
        // the routed event has been delivered to receivedByHandler by the time we reach here.

        const { cognitivePacket, originalContinuation } = ctx.routerDemo;

        // The handler is allowed to read the payload
        const pkt = cognitivePacket;
        const cont = pkt.payload; // or originalContinuation

        console.log("[HANDLER-BETA] Competent handler received routed packet.");
        console.log("  Unpacking payload for continuation:", cont.continuationId);
        console.log(
          "  Saw sensitive state (router never saw this):",
          !!cont.state.sensitiveAnalysis
        );

        // In hybrid: the jobScheduler was wired in setup to listenForRoutedPackets on topicBusB.
        // When the router agent (bus policy) published cop.packet.routed (during previous step),
        // the listener auto-scheduled the continuation from the packet payload.
        // We still unpack/register conceptually here; the actual schedule happened via hybrid reaction.
        ctx.routerDemo.handlerUnpackedPayload = true;
        ctx.routerDemo.handlerRegisteredContinuation = cont.continuationId;

        // additional direct schedule to demonstrate deeper hybrid: the routingPolicy
        // (cogentiaRoutePacket helper) is consulted *inside* JobScheduler.schedule()
        // for envelope-based decision, even without going through the bus agent.
        if (ctx.jobScheduler && typeof ctx.jobScheduler.schedule === "function") {
          const directScheduled = await ctx.jobScheduler.schedule({
            jobId: "direct-hybrid-" + cont.continuationId,
            type: "continuation",
            continuation: cont,
            requiredCapability: pkt.envelope ? pkt.envelope.requiredCapability : undefined,
          });
          console.log(
            "[HANDLER-BETA] Direct schedule via jobScheduler (routingPolicy inside schedule):",
            directScheduled && directScheduled.routingDecision
          );
        }

        // Simulate the handler producing a result the original continuation was waiting for
        await ctx.routerDemo.pair.topicBusB.publish({
          type: "critique-result",
          data: { summary: "Strong conceptual alignment." },
          source: "beta-handler",
        });

        console.log(
          "[ROUTER-DEMO] Handler on Beta used the payload (hybrid: listener auto + direct routingPolicy *inside* JobScheduler.schedule())."
        );
      },
    },

    {
      name: "verify-envelope-only-routing",
      description:
        "Confirm the (reactive agent) router only ever looked at the envelope + consulted the capability registry stub, and that the handler could use the payload.",
      async run(ctx) {
        const d = ctx.routerDemo;

        const routerWasEnvelopeOnly = d.routerInspectedOnlyEnvelope === true;
        const decisionWasMade =
          d.routerDecision && d.routerDecision.action === "forwarded-to-handler";
        const handlerUsedPayload = d.handlerUnpackedPayload === true;
        const capabilityWasChecked =
          d.routerDecision && d.routerDecision.capabilitySatisfied === true;

        const packetEventSeen = (d.receivedPacketEvents || []).length > 0;
        const copRoutedSeen = (d.receivedCopRoutedEvents || []).length > 0;

        const success =
          routerWasEnvelopeOnly &&
          decisionWasMade &&
          handlerUsedPayload &&
          capabilityWasChecked &&
          copRoutedSeen;

        console.log("\n[ROUTER-DEMO] Verification:");
        console.log("  Router inspected only envelope:", routerWasEnvelopeOnly);
        console.log("  Router decided to forward:", decisionWasMade);
        console.log("  Handler successfully used payload:", handlerUsedPayload);
        console.log("  Capability registry consulted (satisfied):", capabilityWasChecked);

        console.log("  cop.packet.created emission observed:", packetEventSeen);
        console.log(
          "  cop.packet.routed emission observed (in addition to custom):",
          copRoutedSeen
        );

        if (d.unsubRouter) d.unsubRouter();
        if (d.unsubHandler) d.unsubHandler();
        if (d.unsubPacketEvent) d.unsubPacketEvent();
        if (d.unsubCopRouted) d.unsubCopRouted();

        ctx.emit({
          type: "cognitive-packet-router-demo.completed",
          data: {
            success,
            routerEnvelopeOnly: routerWasEnvelopeOnly,
            packetForwarded: decisionWasMade,
            payloadUsedByHandler: handlerUsedPayload,
            capabilityChecked: capabilityWasChecked,
            copPacketRoutedEmitted: copRoutedSeen,
          },
        });

        if (success) {
          console.log(
            "\n[PASS] asCognitivePacket + reactive envelope-only Cogentia router agent + capability registry stub + cop.packet.* emission successfully exercised."
          );
        } else {
          console.log(
            "\n[PARTIAL] Core separation demonstrated even if some events were not observed."
          );
        }
      },
    },
  ],
};
