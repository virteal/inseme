/**
 * packages/cop-host/src/entities/ProvisionalTwin.js
 * Core domain logic for Provisional Twins, progressive promotion, and external identity bindings.
 *
 * Implements Issue #57 (Phases A, B, C):
 * - Discovery vs Twin provisioning separation.
 * - Idempotent provisioning from ExternalIdentity.
 * - Claiming lifecycle preserving semantic instance_id.
 * - Promotion from hosted to autonomous.
 * - Provenance-preserving trace hydration.
 */

import crypto from "node:crypto";

export const JHN_ROOT_INSTANCE_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Creates or retrieves a Provisional Twin idempotently from an external identity.
 */
export function ensureProvisionalTwin(registry, input) {
  const { external_identity, host_instance_id = JHN_ROOT_INSTANCE_ID, metadata = {} } = input;

  if (!external_identity?.provider || !external_identity?.provider_subject_id) {
    throw new Error("ExternalIdentity requires provider and provider_subject_id");
  }

  // 1. Check existing twin bound to this external identity
  for (const twin of registry.values()) {
    const match = twin.external_identities?.find(
      (ext) =>
        ext.provider === external_identity.provider &&
        ext.provider_subject_id === external_identity.provider_subject_id
    );
    if (match) {
      // Update handle or profile metadata if handle changed, preserving twin identity
      if (
        external_identity.external_handle &&
        match.external_handle !== external_identity.external_handle
      ) {
        match.external_handle = external_identity.external_handle;
      }
      return { twin, created: false };
    }
  }

  // 2. Provision new Provisional Twin
  const instance_id = input.instance_id || crypto.randomUUID();
  const slug =
    input.canonical_slug ||
    `${external_identity.provider}-${external_identity.external_handle || external_identity.provider_subject_id}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");

  const newTwin = {
    instance_id,
    canonical_slug: slug,
    display_name: external_identity.display_name || external_identity.external_handle || slug,
    status: "provisional",
    host_instance_id,
    principal_id: null, // Null until claimed
    claimable_by:
      input.claimable_by ||
      `oauth:${external_identity.provider}:${external_identity.provider_subject_id}`,
    claimed_at: null,
    hydration_depth: "stub",
    external_identities: [
      {
        provider: external_identity.provider,
        provider_subject_id: external_identity.provider_subject_id,
        external_handle: external_identity.external_handle || null,
        display_name: external_identity.display_name || null,
        profile_url: external_identity.profile_url || null,
        discovered_at: new Date().toISOString(),
      },
    ],
    public_traces: [],
    metadata: {
      ...metadata,
      provisioned_at: new Date().toISOString(),
    },
  };

  registry.set(instance_id, newTwin);
  return { twin: newTwin, created: true };
}

/**
 * Claims a Provisional Twin, binding a real human Principal.
 * Preserves the semantic instance_id and canonical slug.
 */
export function claimProvisionalTwin(twin, principal_id, claimEvidence = {}) {
  if (!principal_id) throw new Error("principal_id required to claim twin");
  if (twin.status !== "provisional") {
    throw new Error(`Cannot claim twin with status '${twin.status}' (expected 'provisional')`);
  }

  twin.status = "claimed";
  twin.principal_id = principal_id;
  twin.claimed_at = new Date().toISOString();
  twin.metadata.claim_evidence = {
    ...claimEvidence,
    claimed_at: twin.claimed_at,
  };

  return twin;
}

/**
 * Promotes a claimed twin to autonomous status with independent or reparented host chain.
 */
export function promoteTwinToAutonomous(twin, promotionOptions = {}) {
  if (twin.status !== "claimed" && twin.status !== "provisional") {
    throw new Error(`Cannot promote twin with status '${twin.status}'`);
  }

  twin.status = "autonomous";
  if (promotionOptions.reparent_host_instance_id !== undefined) {
    twin.host_instance_id = promotionOptions.reparent_host_instance_id;
  }
  twin.metadata.promoted_at = new Date().toISOString();
  twin.metadata.storage_isolation = promotionOptions.storage_isolation || "dedicated";

  return twin;
}

/**
 * Hydrates a Twin from public traces without confusing observations with first-person beliefs.
 */
export function hydrateTwinTraces(twin, traces = []) {
  const normalized = traces.map((t) => ({
    trace_id: t.trace_id || crypto.randomUUID(),
    source_provider: t.source_provider || "external",
    source_id: t.source_id || null,
    content: t.content,
    captured_at: t.captured_at || new Date().toISOString(),
    epistemic_status: "observed_public_trace", // Invariant: traces are observations, NOT first-person Twin assertions
  }));

  twin.public_traces.push(...normalized);

  // Upgrade depth
  if (twin.public_traces.length >= 10) {
    twin.hydration_depth = "deep";
  } else if (twin.public_traces.length > 0) {
    twin.hydration_depth = "shallow";
  }

  return twin;
}
