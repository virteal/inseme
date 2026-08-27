// packages/cop-host/src/adapters/externalActorSource.js
// Generic ExternalActorSource adapter interface, mock provider,
// and lazy Provisional Twin provisioning & hydration logic.

/**
 * Base Abstract Adapter for external public actor sources (X/Twitter, Mastodon, Bluesky, RSS, etc.)
 */
export class ExternalActorSource {
  constructor(providerName) {
    if (!providerName) throw new Error("ExternalActorSource requires a providerName");
    this.providerName = providerName;
  }

  /**
   * Enumerate external identities starting from a seed actor.
   * @param {string} seed
   * @param {string|null} cursor
   * @returns {Promise<{ actors: Array<object>, nextCursor: string|null }>}
   */
  async enumerate(_seed, _cursor = null) {
    throw new Error("ExternalActorSource.enumerate must be implemented by subclass");
  }

  /**
   * Resolve an actor's current profile from their stable provider subject ID.
   * @param {string} providerSubjectId
   * @returns {Promise<object>}
   */
  async resolveActor(_providerSubjectId) {
    throw new Error("ExternalActorSource.resolveActor must be implemented by subclass");
  }

  /**
   * Fetch recent public traces (posts, citations, interactions).
   * @param {string} providerSubjectId
   * @param {object} options - { since, cursor, limit }
   * @returns {Promise<{ traces: Array<object>, nextCursor: string|null }>}
   */
  async fetchRecentTraces(_providerSubjectId, _options = {}) {
    throw new Error("ExternalActorSource.fetchRecentTraces must be implemented by subclass");
  }

  /**
   * Refresh cached actor profile metadata.
   * @param {string} providerSubjectId
   * @returns {Promise<object>}
   */
  async refreshActor(providerSubjectId) {
    return this.resolveActor(providerSubjectId);
  }
}

/**
 * In-memory / Mock Adapter for testing and local fixtures (Tweesic @suvranu pattern simulation)
 */
export class MockExternalActorSource extends ExternalActorSource {
  constructor(providerName = "x", mockData = {}) {
    super(providerName);
    this.actors = new Map(Object.entries(mockData.actors || {}));
    this.followingGraph = new Map(Object.entries(mockData.followingGraph || {}));
    this.traces = new Map(Object.entries(mockData.traces || {}));
  }

  addActor(actor) {
    this.actors.set(actor.provider_subject_id, actor);
  }

  addTraces(providerSubjectId, traceList) {
    this.traces.set(providerSubjectId, traceList);
  }

  async enumerate(seed, cursor = null) {
    const followedIds = this.followingGraph.get(seed) || [];
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const pageSize = 10;
    const slice = followedIds.slice(startIndex, startIndex + pageSize);
    const actors = slice.map((id) => this.actors.get(id)).filter(Boolean);
    const nextCursor =
      startIndex + pageSize < followedIds.length ? String(startIndex + pageSize) : null;
    return { actors, nextCursor };
  }

  async resolveActor(providerSubjectId) {
    const actor = this.actors.get(providerSubjectId);
    if (!actor) {
      throw new Error(`Actor not found for provider_subject_id: ${providerSubjectId}`);
    }
    return { ...actor };
  }

  async fetchRecentTraces(providerSubjectId, options = {}) {
    const allTraces = this.traces.get(providerSubjectId) || [];
    let filtered = allTraces;
    if (options.since) {
      filtered = filtered.filter((t) => new Date(t.published_at) > new Date(options.since));
    }
    return { traces: filtered, nextCursor: null };
  }
}

/**
 * In-memory Store Helper for Provisional Twins & External Identities.
 * Mimics Postgres/Supabase tables for deterministic, zero-network unit tests.
 */
export class InMemoryProvisionalStore {
  constructor() {
    this.instances = new Map();
    this.externalIdentities = new Map(); // key: `${provider}:${provider_subject_id}`
    this.publicTraces = [];
    this.derivedClaims = [];
  }

  findExternalIdentity(provider, providerSubjectId) {
    const key = `${provider}:${providerSubjectId}`;
    return this.externalIdentities.get(key) || null;
  }

  saveExternalIdentity(record) {
    const key = `${record.provider}:${record.provider_subject_id}`;
    const existing = this.externalIdentities.get(key) || {};
    const updated = {
      id: existing.id || `ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...existing,
      ...record,
      updated_at: new Date().toISOString(),
    };
    if (!existing.created_at) updated.created_at = new Date().toISOString();
    this.externalIdentities.set(key, updated);
    return updated;
  }

  getInstance(id) {
    return this.instances.get(id) || null;
  }

  saveInstance(inst) {
    const existing = this.instances.get(inst.id) || {};
    const updated = {
      ...existing,
      ...inst,
      updated_at: new Date().toISOString(),
    };
    if (!existing.created_at) updated.created_at = new Date().toISOString();
    this.instances.set(inst.id, updated);
    return updated;
  }

  addPublicTrace(trace) {
    const record = {
      id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...trace,
      ingested_at: new Date().toISOString(),
    };
    this.publicTraces.push(record);
    return record;
  }

  addDerivedClaim(claim) {
    const record = {
      id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...claim,
      created_at: new Date().toISOString(),
    };
    this.derivedClaims.push(record);
    return record;
  }
}

/**
 * Lazily and idempotently provisions a minimal Provisional Twin for an external identity.
 *
 * Invariants:
 * 1. Discovery != Provisioning (an ExternalIdentity can exist without a Twin).
 * 2. Idempotent: Calling twice returns the exact same Twin.
 * 3. Immutable Semantic Identity: Twin ID remains unchanged through hydration and promotion.
 * 4. principal_id = null (No mandate or authority inferred).
 *
 * @param {object} externalIdentity - { provider, provider_subject_id, handle, display_name, ... }
 * @param {string} hostInstanceId - Parent host providing capacity & config defaults
 * @param {object} policy - { relevanceScore, autoHydrate, ... }
 * @param {InMemoryProvisionalStore} store
 * @returns {object} { twin: object, externalIdentity: object, isNew: boolean }
 */
export function ensureProvisionalTwin(externalIdentity, hostInstanceId, policy = {}, store) {
  if (!externalIdentity?.provider || !externalIdentity?.provider_subject_id) {
    throw new Error(
      "ensureProvisionalTwin requires valid externalIdentity with provider and provider_subject_id"
    );
  }

  let extRecord = store.findExternalIdentity(
    externalIdentity.provider,
    externalIdentity.provider_subject_id
  );
  if (!extRecord) {
    extRecord = store.saveExternalIdentity(externalIdentity);
  } else {
    // Update mutable observations (e.g. updated handle, display_name)
    extRecord = store.saveExternalIdentity({
      ...extRecord,
      ...externalIdentity,
    });
  }

  // 1. Return existing Twin if already bound
  if (extRecord.twin_id) {
    const existingTwin = store.getInstance(extRecord.twin_id);
    if (existingTwin) {
      return { twin: existingTwin, externalIdentity: extRecord, isNew: false };
    }
  }

  // 2. Provision new minimal Provisional Twin
  const twinId = `twin-prov-${externalIdentity.provider}-${externalIdentity.provider_subject_id}`;
  const newTwin = store.saveInstance({
    id: twinId,
    slug: `provisional-${externalIdentity.provider}-${(externalIdentity.handle || externalIdentity.provider_subject_id).replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase()}`,
    name:
      externalIdentity.display_name ||
      externalIdentity.handle ||
      `Provisional Actor (${externalIdentity.provider_subject_id})`,
    host_instance_id: hostInstanceId,
    principal_id: null, // Strictly null for provisional twins
    subject_ref: `subject:${externalIdentity.provider}:${externalIdentity.provider_subject_id}`,
    lifecycle_state: "provisional",
    hydration_depth: "H1",
    promotion_level: "L0",
    provenance: {
      source_provider: externalIdentity.provider,
      provider_subject_id: externalIdentity.provider_subject_id,
      provisioned_at: new Date().toISOString(),
      policy: policy.name || "default_on_demand",
    },
    config: {},
  });

  // Bind external identity to the new Twin
  extRecord.twin_id = twinId;
  store.saveExternalIdentity(extRecord);

  return { twin: newTwin, externalIdentity: extRecord, isNew: true };
}

/**
 * Incrementally hydrates a Provisional Twin with source traces and derived claims.
 *
 * Invariant:
 * - Public traces are source evidence.
 * - Derived claims carry explicit model_id, confidence, and provenance.
 * - Imported traces are NOT converted into first-person beliefs.
 *
 * @param {string} twinId
 * @param {string} externalIdentityId
 * @param {Array<object>} rawTraces - Array of { source_type, source_native_id, content, published_at }
 * @param {Array<object>} claims - Array of { claim_type, claim_value, model_id, confidence }
 * @param {InMemoryProvisionalStore} store
 */
export function hydrateProvisionalTwin(
  twinId,
  externalIdentityId,
  rawTraces = [],
  claims = [],
  store
) {
  const twin = store.getInstance(twinId);
  if (!twin) throw new Error(`Twin ${twinId} not found`);

  // Ingest traces
  for (const trace of rawTraces) {
    store.addPublicTrace({
      external_identity_id: externalIdentityId,
      source_type: trace.source_type || "post",
      source_native_id: trace.source_native_id,
      content: trace.content,
      raw_payload: trace.raw_payload || {},
      published_at: trace.published_at,
      provenance: {
        ingested_for_twin: twinId,
        source: "external_actor_source",
      },
    });
  }

  // Ingest derived claims (interpretations with explicit confidence)
  for (const claim of claims) {
    store.addDerivedClaim({
      external_identity_id: externalIdentityId,
      claim_type: claim.claim_type,
      claim_value: claim.claim_value,
      model_id: claim.model_id || "heuristic-extractor-v1",
      confidence: claim.confidence ?? 0.8,
      source_trace_ids: claim.source_trace_ids || [],
      provenance: {
        for_twin: twinId,
        epistemic_status: "derived_observation_not_belief",
      },
    });
  }

  // Upgrade hydration depth to H2 if traces were added
  if (rawTraces.length > 0 && twin.hydration_depth === "H1") {
    twin.hydration_depth = "H2";
    store.saveInstance(twin);
  }

  return twin;
}
