import test from "node:test";
import assert from "node:assert/strict";
import {
  createAcquisitionCohort,
  processAcquisitionClaims,
  measureCohortGovernanceMetrics,
} from "../../../packages/cop-host/src/entities/OleOleAcquisitionExperiment.js";

test("Issue #57 Phase D: Olé Olé bounded acquisition experiment and usurpation risk control", () => {
  // 1. Cohort of 3 civic/territorial entities discovered in Corte
  const seedIdentities = [
    {
      provider: "twitter",
      provider_subject_id: "tw-corte-001",
      external_handle: "@ghjuvan_corte",
      display_name: "Ghjuvan Camellu",
      preferred_slug: "ghjuvan-corte",
      initial_traces: [
        {
          content: "Participation à la réunion municipale de Corte sur le tri des déchets.",
          source_provider: "twitter",
        },
      ],
    },
    {
      provider: "bluesky",
      provider_subject_id: "bsky-corte-002",
      external_handle: "anna-maria.bsky.social",
      display_name: "Anna Maria",
      preferred_slug: "anna-maria-corte",
    },
    {
      provider: "civic_registry",
      provider_subject_id: "civic-corte-003",
      external_handle: "asso-patrimoniu",
      display_name: "Associu Patrimoniu Curtinese",
      preferred_slug: "asso-patrimoniu-corte",
    },
  ];

  const cohort = createAcquisitionCohort(seedIdentities, { maxCohortSize: 5 });
  assert.equal(cohort.twins.length, 3);
  assert.equal(cohort.twins[0].hydration_depth, "shallow");
  assert.equal(cohort.twins[1].hydration_depth, "stub");

  // 2. Usurpation attempt: Malicious actor tries to claim Ghjuvan's twin with bogus provider credentials
  const usurpationAttempt = {
    instance_id: cohort.twins[0].instance_id,
    principal_id: "00000000-0000-0000-9999-badactor6666",
    provider: "twitter",
    provider_subject_id: "tw-wrong-attacker-id",
    verification_method: "fake_token",
  };

  const claimResults1 = processAcquisitionClaims(cohort, [usurpationAttempt]);
  assert.equal(claimResults1.successful_claims, 0);
  assert.equal(claimResults1.rejected_usurpations, 1);
  assert.equal(cohort.twins[0].status, "provisional"); // Status untouched!

  // 3. Legitimate claim: Ghjuvan verifies his identity via authenticated OAuth
  const legitimateClaim = {
    instance_id: cohort.twins[0].instance_id,
    principal_id: "00000000-0000-0000-0000-ghjuvan11111",
    provider: "twitter",
    provider_subject_id: "tw-corte-001",
    verification_method: "oauth_attestation",
  };

  const claimResults2 = processAcquisitionClaims(cohort, [legitimateClaim]);
  assert.equal(claimResults2.successful_claims, 1);
  assert.equal(claimResults2.rejected_usurpations, 0);
  assert.equal(cohort.twins[0].status, "claimed");
  assert.equal(cohort.twins[0].principal_id, legitimateClaim.principal_id);

  // 4. Measure governance metrics
  const metrics = measureCohortGovernanceMetrics(cohort);
  assert.equal(metrics.total_twins, 3);
  assert.equal(metrics.claimed_twins, 1);
  assert.equal(metrics.provisional_twins, 2);
  assert.equal(metrics.risk_assessment.usurpation_surface, 2);
  assert.equal(metrics.risk_assessment.bounded, true);
  assert.ok(metrics.conversion_rate > 0.3);
});
