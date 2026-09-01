/**
 * packages/cop-host/src/entities/OleOleAcquisitionExperiment.js
 * Bounded territorial acquisition experiment for Provisional Twins (Issue #57 Phase D).
 *
 * Implements:
 * - Controlled cohort creation with bounded cardinality.
 * - Discovery-to-Claim conversion pipeline.
 * - Risk assessment (usurpation detection, spoofed external identity rejection).
 * - Bounded resource overhead accounting.
 */

import {
  ensureProvisionalTwin,
  claimProvisionalTwin,
  hydrateTwinTraces,
  JHN_ROOT_INSTANCE_ID,
} from "./ProvisionalTwin.js";

/**
 * Creates a bounded acquisition cohort of Provisional Twins.
 */
export function createAcquisitionCohort(seedIdentities, options = {}) {
  const maxCohortSize = options.maxCohortSize || 20;
  const boundedIdentities = seedIdentities.slice(0, maxCohortSize);
  const registry = new Map();

  const provisionalTwins = [];
  for (const ext of boundedIdentities) {
    const { twin } = ensureProvisionalTwin(registry, {
      external_identity: ext,
      host_instance_id: options.host_instance_id || JHN_ROOT_INSTANCE_ID,
      canonical_slug: ext.preferred_slug,
      metadata: {
        cohort_id: options.cohort_id || "cohort-oleole-corte-2026",
        acquisition_channel: "territorial_presence",
      },
    });

    if (ext.initial_traces) {
      hydrateTwinTraces(twin, ext.initial_traces);
    }

    provisionalTwins.push(twin);
  }

  return {
    cohort_id: options.cohort_id || "cohort-oleole-corte-2026",
    max_size: maxCohortSize,
    registry,
    twins: provisionalTwins,
    created_at: new Date().toISOString(),
  };
}

/**
 * Simulates and evaluates the conversion flow from Provisional to Claimed Twin.
 */
export function processAcquisitionClaims(cohort, claimAttempts = []) {
  const results = {
    successful_claims: 0,
    rejected_usurpations: 0,
    conversions: [],
    errors: [],
  };

  for (const attempt of claimAttempts) {
    const twin = cohort.registry.get(attempt.instance_id);
    if (!twin) {
      results.errors.push({ attempt, reason: "Twin not found in cohort" });
      continue;
    }

    // Anti-usurpation check: claim proof must match claimable_by or external identity
    const expectedClaimable = `oauth:${attempt.provider}:${attempt.provider_subject_id}`;
    if (twin.claimable_by !== expectedClaimable) {
      results.rejected_usurpations++;
      results.errors.push({
        instance_id: twin.instance_id,
        reason: "Usurpation attempt: claim proof does not match bound external identity",
        attempted_by: attempt.principal_id,
      });
      continue;
    }

    try {
      claimProvisionalTwin(twin, attempt.principal_id, {
        method: attempt.verification_method || "oauth_attestation",
        verified_at: new Date().toISOString(),
      });

      results.successful_claims++;
      results.conversions.push({
        instance_id: twin.instance_id,
        principal_id: attempt.principal_id,
        canonical_slug: twin.canonical_slug,
        converted_at: twin.claimed_at,
      });
    } catch (err) {
      results.errors.push({ instance_id: twin.instance_id, reason: err.message });
    }
  }

  return results;
}

/**
 * Measures overhead and governance risk for the cohort.
 */
export function measureCohortGovernanceMetrics(cohort) {
  const total = cohort.twins.length;
  const claimed = cohort.twins.filter((t) => t.status === "claimed").length;
  const autonomous = cohort.twins.filter((t) => t.status === "autonomous").length;
  const provisional = cohort.twins.filter((t) => t.status === "provisional").length;

  const totalTraces = cohort.twins.reduce((acc, t) => acc + (t.public_traces?.length || 0), 0);
  const averageTracesPerTwin = total > 0 ? totalTraces / total : 0;

  return {
    cohort_id: cohort.cohort_id,
    total_twins: total,
    provisional_twins: provisional,
    claimed_twins: claimed,
    autonomous_twins: autonomous,
    conversion_rate: total > 0 ? claimed / total : 0,
    total_public_traces: totalTraces,
    average_traces_per_twin: averageTracesPerTwin,
    risk_assessment: {
      usurpation_surface: provisional, // Unclaimed twins requiring proof verification
      bounded: total <= cohort.max_size,
    },
  };
}
