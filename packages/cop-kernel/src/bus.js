/**
 * bus.js
 *
 * COPBus — the core event transport for the Cognitive Orchestration Protocol.
 *
 * Design goals (aligned with the corpus influences):
 * - Actor-oriented: events as messages between autonomous agents.
 * - ARPANET / mesh / Fractanet: decentralized, routable, partition-tolerant packet-like events.
 * - RAIX: support for redundant paths and federated delivery.
 * - Genericity: usable at kernel, brique, platform, and future Inox edge levels without reinvention.
 *
 * New capabilities (this enhancement):
 * - Sub-buses: hierarchical/namespaced views (e.g. per Topic, per instance, per brique).
 * - Federation: explicit support for connecting multiple buses into a "Fractanet" mesh
 *   with interest-based forwarding and resilient delivery.
 */

export class COPBus {
  constructor(options = {}) {
    this.name = options.name || "root";
    this.listeners = new Map(); // eventType -> Set<handler>
    this.allListeners = new Set(); // catch-all
    this.eventLog = []; // local audit (can be replaced by persistent store)
    this.federatedPeers = new Set(); // other COPBus instances we forward to
    this.interests = new Set(); // event types / topics this bus is interested in (for federation)
  }

  // ── Core pub/sub (unchanged API for backward compat) ─────────────────────

  subscribe(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);
    return () => this.unsubscribe(eventType, handler);
  }

  subscribeAll(handler) {
    this.allListeners.add(handler);
    return () => this.allListeners.delete(handler);
  }

  unsubscribe(eventType, handler) {
    const set = this.listeners.get(eventType);
    if (set) set.delete(handler);
  }

  async publish(event) {
    const normalized = {
      ...event,
      publishedAt: event.publishedAt || new Date().toISOString(),
      bus: this.name,
    };

    this.eventLog.push(normalized);

    // Local delivery
    const specific = this.listeners.get(normalized.type) || new Set();
    for (const handler of specific) {
      try {
        await handler(normalized);
      } catch (err) {
        console.error(`[COPBus:${this.name}] Handler error for ${normalized.type}:`, err);
      }
    }
    for (const handler of this.allListeners) {
      try {
        await handler(normalized);
      } catch (err) {
        console.error(`[COPBus:${this.name}] Catch-all error:`, err);
      }
    }

    // Federation forwarding (if peers are registered and event matches interests)
    await this._forwardToFederation(normalized);

    return normalized;
  }

  getRecentEvents(limit = 50) {
    return this.eventLog.slice(-limit);
  }

  clear() {
    this.eventLog = [];
  }

  // ── Sub-buses (new — hierarchical scoping) ───────────────────────────────

  /**
   * Create a sub-bus (namespaced view).
   * Events published on the sub-bus are automatically tagged with the namespace.
   * Subscriptions on the sub-bus only see events for that namespace (unless you subscribe to '*').
   *
   * Example:
   *   const topicBus = bus.sub('topic:abc123');
   *   topicBus.publish({ type: 'step.completed', data: ... });
   *   // Parent bus will see 'topic:abc123/step.completed' (or you can keep original type + meta)
   */
  sub(namespace) {
    const sub = new SubBus(this, namespace);
    return sub;
  }

  /**
   * Convenience for per-Topic sub-buses (Fractanet / RAIX pattern).
   * This is the recommended way to get an isolated bus for a specific Topic.
   *
   * All events published via this sub-bus will be namespaced under `topic:${topicId}/...`
   * and the scheduler / agents can scope their subscriptions accordingly.
   */
  forTopic(topicId) {
    if (!topicId) {
      throw new Error("forTopic requires a topicId");
    }
    return this.sub(`topic:${topicId}`);
  }

  // ── Federation (Fractanet support) ───────────────────────────────────────

  /**
   * Connect this bus to another bus (or a federation connector) for cross-node delivery.
   * In a real Fractanet this would be a network transport (Inox actor, WebSocket, etc.).
   *
   * Safe against cycles (idempotent + no infinite recursion).
   */
  federate(peerBus) {
    if (!peerBus || typeof peerBus.receiveFromFederation !== "function") {
      return this;
    }

    // Avoid adding ourselves or duplicates
    if (peerBus === this || this.federatedPeers.has(peerBus)) {
      return this;
    }

    this.federatedPeers.add(peerBus);

    // Bidirectional, but only if the peer hasn't already federated us (prevents cycles)
    if (typeof peerBus.federate === "function" && !peerBus.federatedPeers.has(this)) {
      peerBus.federate(this);
    }

    return this;
  }

  /**
   * Declare interest in certain event types or topic prefixes.
   * When federated, this helps peers know what to forward (basic interest propagation).
   */
  declareInterest(pattern) {
    this.interests.add(pattern);
  }

  /**
   * Propagate an interest declaration to all federated peers (simple form of
   * subscription propagation for Fractanet-style federation).
   */
  propagateInterest(pattern) {
    this.declareInterest(pattern);
    for (const peer of this.federatedPeers) {
      if (typeof peer.declareInterest === "function") {
        try {
          peer.declareInterest(pattern);
        } catch (e) {}
      }
    }
  }

  /**
   * Internal: receive an event that came from a federated peer.
   */
  async receiveFromFederation(event) {
    // Re-publish locally so local subscribers see it
    return this.publish({ ...event, viaFederation: true });
  }

  async _forwardToFederation(event) {
    if (this.federatedPeers.size === 0) return;

    const shouldForward = this._shouldForward(event);
    if (!shouldForward) return;

    for (const peer of this.federatedPeers) {
      try {
        if (typeof peer.receiveFromFederation === "function") {
          await peer.receiveFromFederation(event);
        } else if (typeof peer.publish === "function") {
          await peer.publish(event); // simple peer bus
        }
      } catch (err) {
        console.warn(`[COPBus:${this.name}] Federation forward failed:`, err.message);
      }
    }
  }

  _shouldForward(event) {
    if (this.interests.size === 0) return true; // forward everything if no interests declared

    const type = event.type || "";

    for (const interest of this.interests) {
      if (interest === "*" || interest === type) {
        return true;
      }

      // Support namespaced interests better (Fractanet / per-topic pattern)
      // e.g. interest "topic:foo" should match "topic:foo/anything" or "topic:foo"
      if (type.startsWith(interest + "/") || type === interest) {
        return true;
      }

      // Also allow declaring interest in a namespace prefix
      if (interest.endsWith("/") && type.startsWith(interest)) {
        return true;
      }
    }
    return false;
  }
}

// ── SubBus implementation ──────────────────────────────────────────────────

class SubBus {
  constructor(parent, namespace) {
    this.parent = parent;
    this.namespace = namespace;
    // SubBus now maintains its own listeners for strong scoping
    this.listeners = new Map(); // clean eventType -> Set<handler>
    this.allListeners = new Set();
    this.interests = new Set(); // local interests for this sub-bus scope
  }

  _namespacedType(type) {
    return `${this.namespace}/${type}`;
  }

  /**
   * Subscribe to events on this sub-bus scope.
   * Handlers receive events with the original clean type (namespace stripped).
   */
  subscribe(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);

    // Register on parent with namespaced type for cross-bus delivery
    const nsType = this._namespacedType(eventType);
    this.parent.subscribe(nsType, (event) => {
      const cleanEvent = {
        ...event,
        type: eventType, // present the clean type to the subscriber
        subBus: this.namespace,
      };
      // Deliver to local scoped handlers
      const localHandlers = this.listeners.get(eventType) || new Set();
      for (const h of localHandlers) {
        try {
          h(cleanEvent);
        } catch (e) {
          console.error(e);
        }
      }
    });

    return () => this.unsubscribe(eventType, handler);
  }

  subscribeAll(handler) {
    this.allListeners.add(handler);

    this.parent.subscribeAll((event) => {
      if (event.type && event.type.startsWith(this.namespace + "/")) {
        const cleanType = event.type.replace(this.namespace + "/", "");
        const cleanEvent = {
          ...event,
          type: cleanType,
          subBus: this.namespace,
        };
        handler(cleanEvent);
      }
    });

    return () => this.allListeners.delete(handler);
  }

  unsubscribe(eventType, handler) {
    const set = this.listeners.get(eventType);
    if (set) set.delete(handler);
  }

  async publish(event) {
    const nsEvent = {
      ...event,
      type: this._namespacedType(event.type || "event"),
      subBus: this.namespace,
    };
    return this.parent.publish(nsEvent);
  }

  forTopic(topicId) {
    return this.parent.forTopic(topicId);
  }

  // Delegate federation methods to parent (so you can call them on a topic sub-bus)
  federate(peer) {
    return this.parent.federate(peer);
  }

  declareInterest(pattern) {
    // Store local interest too
    this.interests = this.interests || new Set();
    this.interests.add(pattern);
    return this.parent.declareInterest(pattern);
  }

  propagateInterest(pattern) {
    this.declareInterest(pattern);
    return this.parent.propagateInterest(pattern);
  }

  getRecentEvents(limit = 50) {
    return this.parent
      .getRecentEvents(limit)
      .filter((e) => e.type && e.type.startsWith(this.namespace + "/"));
  }

  clear() {
    this.listeners.clear();
    this.allListeners.clear();
  }
}

// Default root bus (Fractanet root)
export const defaultBus = new COPBus({ name: "fractanet-root" });

// Convenience factory for a fresh Fractanet-style bus
export function createFractanetBus(name = "fractanet") {
  return new COPBus({ name });
}
