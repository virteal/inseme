import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureProvisionalTwin,
  claimProvisionalTwin,
  promoteTwinToAutonomous,
  hydrateTwinTraces,
  JHN_ROOT_INSTANCE_ID,
} from "../../../packages/cop-host/src/entities/ProvisionalTwin.js";

test("Issue #57 Phase C: Provisional Twin lifecycle, idempotency, claiming and promotion", () => {
  const registry = new Map();

  // 1. Initial provisioning from Twitter external identity
  const extSuvranu = {
    provider: "twitter",
    provider_subject_id: "tw-12345678",
    external_handle: "@suvranu_old",
    display_name: "Suvranu",
  };

  const { twin: twin1, created: created1 } = ensureProvisionalTwin(registry, {
    external_identity: extSuvranu,
    host_instance_id: JHN_ROOT_INSTANCE_ID,
  });

  assert.equal(created1, true);
  assert.equal(twin1.status, "provisional");
  assert.equal(twin1.principal_id, null);
  assert.equal(twin1.host_instance_id, JHN_ROOT_INSTANCE_ID);
  assert.equal(twin1.hydration_depth, "stub");

  // 2. Idempotency test: second call with same external identity returns existing twin
  const { twin: twin2, created: created2 } = ensureProvisionalTwin(registry, {
    external_identity: extSuvranu,
  });
  assert.equal(created2, false);
  assert.equal(twin2.instance_id, twin1.instance_id);

  // 3. Handle change test: handle changes from @suvranu_old to @suvranu
  const extSuvranuUpdated = {
    ...extSuvranu,
    external_handle: "@suvranu",
  };
  const { twin: twinUpdated, created: createdUpdated } = ensureProvisionalTwin(registry, {
    external_identity: extSuvranuUpdated,
  });
  assert.equal(createdUpdated, false);
  assert.equal(twinUpdated.instance_id, twin1.instance_id);
  assert.equal(twinUpdated.external_identities[0].external_handle, "@suvranu");

  // 4. Hydration test: traces are stored as observations without altering first-person identity
  hydrateTwinTraces(twin1, [
    {
      content: "La Corse doit développer son autonomie énergétique.",
      source_provider: "twitter",
      source_id: "tweet-01",
    },
    {
      content: "Discussion intéressante sur la décentralisation.",
      source_provider: "twitter",
      source_id: "tweet-02",
    },
  ]);
  assert.equal(twin1.hydration_depth, "shallow");
  assert.equal(twin1.public_traces.length, 2);
  assert.equal(twin1.public_traces[0].epistemic_status, "observed_public_trace");

  // 5. Claiming test: verified human Principal claims the twin
  const humanPrincipalId = "00000000-0000-0000-0000-111122223333";
  const claimedTwin = claimProvisionalTwin(twin1, humanPrincipalId, {
    method: "oauth_challenge",
    provider: "twitter",
  });

  assert.equal(claimedTwin.status, "claimed");
  assert.equal(claimedTwin.principal_id, humanPrincipalId);
  assert.equal(claimedTwin.instance_id, twin1.instance_id); // Semantic ID unchanged!
  assert.equal(claimedTwin.canonical_slug, twin1.canonical_slug); // Slug unchanged!

  // 6. Progressive promotion test: claimed twin becomes autonomous with dedicated storage
  const autonomousTwin = promoteTwinToAutonomous(claimedTwin, {
    storage_isolation: "dedicated_postgres",
    reparent_host_instance_id: null, // Fully independent root
  });

  assert.equal(autonomousTwin.status, "autonomous");
  assert.equal(autonomousTwin.host_instance_id, null);
  assert.equal(autonomousTwin.metadata.storage_isolation, "dedicated_postgres");
  assert.equal(autonomousTwin.instance_id, twin1.instance_id);
});
