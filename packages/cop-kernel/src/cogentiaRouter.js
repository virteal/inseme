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
//   This is the "method-governed routing policy" layer as a higher handler on the bus.
//   Hybrid approach (preferred): primary policy lives here (bus handlers using the helper
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
//   For reactive handler style (subscribe and auto-apply):
//     const unsub = bus.subscribe('cognitive-packet', async (evt) => {
//       await cogentiaRoutePacket(evt.data, { registry, forwardToBus });
//     });

import { defaultCapabilityRegistry } from "./capabilityRegistry.js";
import { recordPacketHop } from "./Cop-kerneltasks.js";

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
  // In production router handlers you may want to pass a logger or suppress.
  console.log("[COGENTIA-ROUTER] Envelope-only inspection:");
  console.log(`  packetKind=${packetKind}`);
  console.log(`  routeTo=${routeTo}`);
  console.log(`  requiredCapability=${requiredCapability}`);
  console.log(`  riskLevel=${riskLevel}`);
  // (In a real handler you might suppress these or use a passed logger.)

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
      // or handlers can uniformly subscribe to cop.packet.* events.
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
 * Convenience factory for a simple reactive Cogentia router "handler".
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
  source = "cogentia-router-handler",
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

/**
 * Resilient Multi-Regime Packet Router.
 *
 * Implements:
 * 1. Direct Next-Hop Optimization (uses envelope.routeTo or preferred provider when healthy).
 * 2. Automatic Fallback to alternative registered capability providers if direct hop fails/unreachable.
 * 3. Fallback to Attractor Pool (cop.packet.attractor_search) if no direct provider is available.
 * 4. Store & Forward Spooling if completely partitioned/offline.
 *
 * @param {Object} pkt - The Cognitive Packet
 * @param {Object} [opts]
 * @param {Object} [opts.registry] - CapabilityRegistry instance
 * @param {Object} [opts.forwardToBus] - Bus to emit routing events to
 * @param {Function} [opts.probeNode] - async (nodeId) => boolean
 * @param {Array} [opts.spoolQueue] - Array to collect spooled packets if offline
 * @param {string} [opts.source='cogentia-resilient-router']
 * @returns {Promise<Object>} routingResult
 */
export async function routePacketResiliently(
  pkt,
  {
    registry = defaultCapabilityRegistry,
    forwardToBus = null,
    probeNode = null,
    spoolQueue = null,
    isAdmissible = null,
    source = "cogentia-resilient-router",
  } = {}
) {
  if (!pkt || !pkt.envelope) {
    throw new Error("routePacketResiliently: invalid packet");
  }

  const { envelope } = pkt;
  const { routeTo, requiredCapability } = envelope;

  async function safeProbe(nodeId) {
    if (!probeNode) return true;
    try {
      return Boolean(await probeNode(nodeId));
    } catch {
      return false;
    }
  }

  async function safeAdmissible(nodeId) {
    // Check packet closure admissible_handlers if specified
    const admissibleHandlers =
      pkt.closure?.admissible_handlers ||
      pkt.envelope?.closure?.admissible_handlers ||
      pkt.envelope?.admissible_handlers;

    if (Array.isArray(admissibleHandlers) && admissibleHandlers.length > 0) {
      if (!admissibleHandlers.includes(nodeId)) {
        return false;
      }
    }

    // Check optional custom isAdmissible predicate
    if (typeof isAdmissible === "function") {
      try {
        return Boolean(await isAdmissible(nodeId, pkt));
      } catch {
        return false;
      }
    }

    return true;
  }

  // 1. Direct Next-Hop Optimization
  if (routeTo) {
    const isPreferredAdmissible = await safeAdmissible(routeTo);
    const isPreferredReachable = isPreferredAdmissible && (await safeProbe(routeTo));
    if (isPreferredReachable) {
      recordPacketHop(pkt, {
        node_id: routeTo,
        route_reason: `direct-hop-optimization:${routeTo}`,
      });
      if (forwardToBus && typeof forwardToBus.publish === "function") {
        await forwardToBus.publish({
          type: "cop.packet.routed",
          source,
          data: { packet: pkt, method: "direct_hop", targetNode: routeTo },
        });
      }
      return {
        status: "routed_direct",
        targetNode: routeTo,
        capabilitySatisfied: true,
      };
    }

    // Direct preferred hop failed / unreachable or inadmissible -> Record fallback hop
    recordPacketHop(pkt, {
      node_id: "router",
      route_reason: !isPreferredAdmissible
        ? `fallback:preferred-node-inadmissible:${routeTo}`
        : `fallback:preferred-node-unreachable:${routeTo}`,
    });
  }

  // 2. Alternative Provider Fallback
  // Invariant (Inseme #54): provider reachable != provider admissible != provider authorized
  if (requiredCapability && registry) {
    const providers = registry.getProviders(requiredCapability);
    for (const altNode of providers) {
      if (altNode !== routeTo) {
        const isAltAdmissible = await safeAdmissible(altNode);
        if (!isAltAdmissible) continue; // Inadmissible node MUST NOT be chosen merely because it is reachable!

        const isAltReachable = await safeProbe(altNode);
        if (isAltReachable) {
          recordPacketHop(pkt, {
            node_id: altNode,
            route_reason: `fallback-provider-matched:${requiredCapability}->${altNode}`,
          });
          if (forwardToBus && typeof forwardToBus.publish === "function") {
            await forwardToBus.publish({
              type: "cop.packet.routed",
              source,
              data: { packet: pkt, method: "fallback_provider", targetNode: altNode },
            });
          }
          return {
            status: "routed_fallback",
            targetNode: altNode,
            capabilitySatisfied: true,
            chosenCapability: requiredCapability,
          };
        }
      }
    }
  }

  // 3. Attractor Pool Broadcast
  if (forwardToBus && typeof forwardToBus.publish === "function") {
    recordPacketHop(pkt, {
      node_id: "attractor-pool",
      route_reason: `broadcast-to-attractor-pool:${requiredCapability || "general"}`,
    });
    await forwardToBus.publish({
      type: "cop.packet.attractor_search",
      source,
      data: {
        packetId: envelope.id,
        packet: pkt,
        requiredCapability,
        riskLevel: envelope.riskLevel || "read_only",
        intent: envelope.intent,
      },
    });
    return {
      status: "attractor_pool_broadcast",
      capabilitySatisfied: registry ? registry.canSatisfy(requiredCapability) : true,
    };
  }

  // 4. Store & Forward Spooling (Offline / Network Partition)
  if (Array.isArray(spoolQueue)) {
    recordPacketHop(pkt, {
      node_id: "local-spool",
      route_reason: "store-and-forward-spooled:no-active-attractor",
    });
    spoolQueue.push(pkt);
    return {
      status: "spooled_store_and_forward",
      capabilitySatisfied: false,
      spooledAt: new Date().toISOString(),
    };
  }

  return {
    status: "unroutable",
    capabilitySatisfied: false,
    reason: "no-reachable-provider-or-attractor",
  };
}

export default {
  cogentiaRoutePacket,
  createCogentiaRouterAgent,
  routePacketResiliently,
};
