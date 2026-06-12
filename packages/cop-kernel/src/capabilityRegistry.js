// File: src/capabilityRegistry.js
// Description:
//   Lightweight in-memory (and stub for real) Capability Registry for COP.
//   Used by Cogentia-style routers to decide routing based on
//   envelope.requiredCapability without inspecting payload.
//
//   This is the "method-governed routing policy" layer stub.
//   A real version could be backed by agentRegistry + intents/capabilities
//   in cop_agents, or a dedicated table.
//
//   Designed to be resettable for bac-à-sable / tests so we don't accumulate
//   state across scenarios (consistent with scheduler resetForTest).

export class CapabilityRegistry {
  constructor() {
    this.capabilities = new Map(); // name -> { name, providers, metadata, registeredAt }
  }

  /**
   * Register a capability that can be required by packets.
   * @param {string} name e.g. "source-critique"
   * @param {Object} [opts]
   * @param {string[]} [opts.providers] - agent names or ids that can handle it
   * @param {Object} [opts.metadata]
   */
  register(name, { providers = [], metadata = {} } = {}) {
    if (!name || typeof name !== "string") {
      throw new Error("CapabilityRegistry.register: name (string) is required");
    }
    const entry = {
      name,
      providers: Array.isArray(providers) ? [...providers] : [],
      metadata: { ...metadata },
      registeredAt: new Date().toISOString(),
    };
    this.capabilities.set(name, entry);
    return this.get(name);
  }

  has(name) {
    return this.capabilities.has(name);
  }

  get(name) {
    return this.capabilities.get(name) || null;
  }

  getProviders(name) {
    const cap = this.get(name);
    return cap ? [...cap.providers] : [];
  }

  /**
   * Simple satisfaction check for a router.
   * For now: just "is the capability registered?"
   * Future: could take context { routeTo, riskLevel, provenance } and match providers,
   * required security level, etc.
   */
  canSatisfy(requiredCapability, context = {}) {
    if (!requiredCapability) return true; // no requirement => ok
    return this.has(requiredCapability);
  }

  list() {
    return Array.from(this.capabilities.values());
  }

  /**
   * Reset for tests / bac-à-sable hygiene.
   * Prevents state accumulation across runs (pairs with scheduler resetForTest).
   */
  resetForTest() {
    this.capabilities.clear();
    console.log("[CapabilityRegistry] Reset for test (capabilities cleared)");
  }
}

export const defaultCapabilityRegistry = new CapabilityRegistry();
