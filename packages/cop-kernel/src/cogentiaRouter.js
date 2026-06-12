// File: src/cogentiaRouter.js
// Description:
//   Reusable "Cogentia router" helpers for envelope-only routing of cognitive packets.
//   This extracts the policy logic that was inline in the bac-à-sable demo
//   into a first-class, importable helper (as suggested in the SESSION_RESUME
//   parking lot and follow-ups).
//
//   Core contract (envelope-only):
//   - Router inspects only envelope fields (packetKind, routeTo, requiredCapability, riskLevel, ...)
//   - Uses CapabilityRegistry (or compatible) for canSatisfy(requiredCapability)
//   - Never touches .payload
//   - Forwards via provided bus if decision is made
//
//   This is the "method-governed routing policy" layer as a higher agent on the bus.
//   Hybrid approach (preferred): primary policy lives here (bus agents using the helper
//   + CapabilityRegistry), while JobScheduler can be wired to consult the same registry
//   for validation during scheduling (see COPJobScheduler constructor + schedule()).
//   The bus is the neutral switching fabric; policy decisions (cop.packet.routed) can
//   influence or be reacted to by the operational scheduler.
//
//   Usage in bac-à-sable or apps:
//     import { cogentiaRoutePacket } from '@inseme/cop-kernel';
//     const decision = await cogentiaRoutePacket(cognitivePacket, {
//       registry: ctx.capabilityRegistry,
//       forwardToBus: someTopicBus,
//     });
//
//   For reactive agent style (subscribe and auto-apply):
//     const unsub = bus.subscribe('cognitive-packet', async (evt) => {
//       await cogentiaRoutePacket(evt.data, { registry, forwardToBus });
//     });

import { defaultCapabilityRegistry } from "./capabilityRegistry.js";

/**
 * Core reusable router policy function.
 * Inspects *only* the envelope. Consults registry for capability satisfaction.
 * If decision is to forward and forwardToBus is provided, publishes the routed packet.
 *
 * @param {Object} pkt - the cognitive packet { envelope, payload, packetKind }
 * @param {Object} [opts]
 * @param {Object} [opts.registry] - CapabilityRegistry instance (defaults to defaultCapabilityRegistry)
 * @param {Object} [opts.forwardToBus] - bus to publish "cognitive-packet.routed" to
 * @param {string} [opts.source='cogentia-router'] - source for the forwarded event
 * @returns {Promise<Object>} decision { action: 'forwarded-to-handler' | 'no-match', capabilitySatisfied: boolean, chosenCapability?: string }
 */
export async function cogentiaRoutePacket(
  pkt,
  { registry = defaultCapabilityRegistry, forwardToBus, source = "cogentia-router" } = {}
) {
  const { envelope } = pkt || {};
  const { packetKind, routeTo, requiredCapability, riskLevel } = envelope || {};

  // These logs are useful for bac-à-sable / demo / debugging.
  // In production router agents you may want to pass a logger or suppress.
  console.log("[COGENTIA-ROUTER] Envelope-only inspection:");
  console.log(`  packetKind=${packetKind}`);
  console.log(`  routeTo=${routeTo}`);
  console.log(`  requiredCapability=${requiredCapability}`);
  console.log(`  riskLevel=${riskLevel}`);
  // (In a real agent you might suppress these or use a passed logger.)

  const capabilityOk = !registry || registry.canSatisfy(requiredCapability);

  if (capabilityOk && requiredCapability) {
    console.log(
      `[COGENTIA-ROUTER] Decision: forward (capability '${requiredCapability}' satisfied via registry).`
    );

    const routingDecision = {
      chosenCapability: requiredCapability,
      reason: `envelope-matched-${requiredCapability}`,
      capabilitySatisfied: true,
    };

    if (forwardToBus && typeof forwardToBus.publish === "function") {
      // App-specific routed event (back-compat with demo subscriptions etc.)
      await forwardToBus.publish({
        type: "cognitive-packet.routed",
        data: pkt,
        source,
        routingDecision,
      });

      // Canonical cop.packet.* event (in addition to / as wrapper around custom types).
      // This addresses the open question in the resume: we now emit cop.packet.*
      // alongside the custom "cognitive-packet.*" so that external Cogentia routers
      // or agents can uniformly subscribe to cop.packet.* events.
      await forwardToBus.publish({
        type: "cop.packet.routed",
        data: {
          packet: pkt,
          routingDecision,
        },
        source,
      });
    }

    const decision = {
      action: "forwarded-to-handler",
      capabilitySatisfied: true,
      chosenCapability: requiredCapability,
      reason: `envelope-matched-${requiredCapability}`,
    };
    return decision;
  }

  return { action: "no-match", capabilitySatisfied: capabilityOk };
}

/**
 * Convenience factory for a simple reactive Cogentia router "agent".
 * Returns an object with a subscribe handler you can attach to a bus.
 *
 * Example:
 *   const router = createCogentiaRouterAgent({ registry, forwardToBus });
 *   const unsub = topicBusA.subscribe('cognitive-packet', router.handler);
 *
 * The handler is async and safe to use with the improved SubBus delivery.
 */
export function createCogentiaRouterAgent({
  registry,
  forwardToBus,
  source = "cogentia-router-agent",
} = {}) {
  return {
    handler: async (evt) => {
      if (evt && evt.data) {
        await cogentiaRoutePacket(evt.data, { registry, forwardToBus, source });
      }
    },
    // You can also expose the raw policy if needed
    route: (pkt, opts) => cogentiaRoutePacket(pkt, { registry, forwardToBus, source, ...opts }),
  };
}

export default {
  cogentiaRoutePacket,
  createCogentiaRouterAgent,
};
