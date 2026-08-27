import test from "node:test";
import assert from "node:assert/strict";
import {
  MockExternalActorSource,
  InMemoryProvisionalStore,
  ensureProvisionalTwin,
  hydrateProvisionalTwin,
} from "../src/adapters/externalActorSource.js";

test("11. An ExternalIdentity can exist without any Provisional Twin being provisioned", async () => {
  const store = new InMemoryProvisionalStore();
  const adapter = new MockExternalActorSource("x", {
    actors: {
      1001: {
        provider: "x",
        provider_subject_id: "1001",
        handle: "@actor_one",
        display_name: "Actor One",
      },
      1002: {
        provider: "x",
        provider_subject_id: "1002",
        handle: "@actor_two",
        display_name: "Actor Two",
      },
    },
    followingGraph: {
      suvranu: ["1001", "1002"],
    },
  });

  const { actors } = await adapter.enumerate("suvranu");
  assert.equal(actors.length, 2);

  // Store external identities discovered
  for (const a of actors) {
    store.saveExternalIdentity(a);
  }

  // Identities exist in store
  assert.ok(store.findExternalIdentity("x", "1001"));
  assert.ok(store.findExternalIdentity("x", "1002"));

  // But NO twins are provisioned yet!
  assert.equal(store.instances.size, 0);
  assert.equal(store.findExternalIdentity("x", "1001").twin_id, undefined);
});

test("12. Changing an external handle while keeping the same provider subject id does not create a second external actor/Twin", () => {
  const store = new InMemoryProvisionalStore();
  const hostId = "host-jhn-root-uuid";

  // First discovery of @old_handle
  const firstIdentity = {
    provider: "x",
    provider_subject_id: "998877",
    handle: "@old_handle",
    display_name: "John Doe",
  };

  const res1 = ensureProvisionalTwin(firstIdentity, hostId, {}, store);
  const twinId = res1.twin.id;
  assert.ok(twinId);
  assert.equal(res1.isNew, true);

  // Later discovery: user changed handle to @new_handle but provider_subject_id remains 998877
  const secondIdentity = {
    provider: "x",
    provider_subject_id: "998877",
    handle: "@new_handle",
    display_name: "John Doe Updated",
  };

  const res2 = ensureProvisionalTwin(secondIdentity, hostId, {}, store);
  assert.equal(res2.isNew, false);
  assert.equal(res2.twin.id, twinId); // Same twin ID!
  assert.equal(store.instances.size, 1); // Only 1 twin created
  assert.equal(res2.externalIdentity.handle, "@new_handle"); // Handle updated in place
});

test("13. Calling ensureProvisionalTwin(...) twice for the same binding is idempotent", () => {
  const store = new InMemoryProvisionalStore();
  const hostId = "host-jhn-root-uuid";
  const identity = { provider: "x", provider_subject_id: "554433", handle: "@corsica_actor" };

  const firstCall = ensureProvisionalTwin(identity, hostId, {}, store);
  assert.equal(firstCall.isNew, true);

  const secondCall = ensureProvisionalTwin(identity, hostId, {}, store);
  assert.equal(secondCall.isNew, false);
  assert.equal(firstCall.twin.id, secondCall.twin.id);
  assert.equal(firstCall.twin.slug, secondCall.twin.slug);
  assert.equal(store.instances.size, 1);
});

test("14. Two unrelated external identities remain unmerged until explicit reconciliation exists", () => {
  const store = new InMemoryProvisionalStore();
  const hostId = "host-jhn-root-uuid";

  const identityA = { provider: "x", provider_subject_id: "user_a", handle: "@actor_a" };
  const identityB = {
    provider: "bluesky",
    provider_subject_id: "user_b.bsky.social",
    handle: "@actor_b",
  };

  const resA = ensureProvisionalTwin(identityA, hostId, {}, store);
  const resB = ensureProvisionalTwin(identityB, hostId, {}, store);

  assert.notEqual(resA.twin.id, resB.twin.id);
  assert.equal(store.instances.size, 2);
  assert.equal(store.externalIdentities.size, 2);
});

test("15. Hydration depth can increase without changing deployment/promotion level", () => {
  const store = new InMemoryProvisionalStore();
  const hostId = "host-jhn-root-uuid";
  const identity = { provider: "x", provider_subject_id: "776655", handle: "@politica_corsica" };

  const { twin, externalIdentity } = ensureProvisionalTwin(identity, hostId, {}, store);
  assert.equal(twin.hydration_depth, "H1");
  assert.equal(twin.promotion_level, "L0");

  // Ingest public traces
  const sampleTraces = [
    {
      source_type: "post",
      source_native_id: "tweet-1",
      content: "Discorsu nant'à l'autunumia di a Corsica",
      published_at: "2026-08-20T10:00:00Z",
    },
  ];

  const hydratedTwin = hydrateProvisionalTwin(
    twin.id,
    externalIdentity.id,
    sampleTraces,
    [],
    store
  );
  // Hydration increased to H2
  assert.equal(hydratedTwin.hydration_depth, "H2");
  // Promotion level remains strictly L0 (still hosted, shared DB)
  assert.equal(hydratedTwin.promotion_level, "L0");
});

test("16. Imported public traces preserve source/provenance and are not exposed as first-person Twin assertions", () => {
  const store = new InMemoryProvisionalStore();
  const hostId = "host-jhn-root-uuid";
  const identity = { provider: "x", provider_subject_id: "332211", handle: "@analyst_corsica" };

  const { twin, externalIdentity } = ensureProvisionalTwin(identity, hostId, {}, store);

  const traces = [
    {
      source_type: "post",
      source_native_id: "tweet-99",
      content: "Propositions pour l'énergie solaire en Corse",
      published_at: "2026-08-25T14:00:00Z",
    },
  ];

  const derivedClaims = [
    {
      claim_type: "topic_interest",
      claim_value: { topic: "solar_energy", territory: "corsica" },
      model_id: "topic-model-v2",
      confidence: 0.92,
    },
  ];

  hydrateProvisionalTwin(twin.id, externalIdentity.id, traces, derivedClaims, store);

  // Check public trace preservation
  assert.equal(store.publicTraces.length, 1);
  assert.equal(store.publicTraces[0].source_native_id, "tweet-99");
  assert.equal(store.publicTraces[0].provenance.ingested_for_twin, twin.id);

  // Check derived claim epistemic status
  assert.equal(store.derivedClaims.length, 1);
  assert.equal(store.derivedClaims[0].model_id, "topic-model-v2");
  assert.equal(store.derivedClaims[0].confidence, 0.92);
  assert.equal(
    store.derivedClaims[0].provenance.epistemic_status,
    "derived_observation_not_belief"
  );

  // Twin has no personal first-person beliefs injected into its config or authority
  assert.equal(twin.principal_id, null);
  assert.deepEqual(twin.config, {});
});

test("17. Generic lifecycle tests run without X credentials or live external network source", () => {
  const store = new InMemoryProvisionalStore();
  const mockAdapter = new MockExternalActorSource("custom_offline", {
    actors: {
      offline_1: {
        provider: "custom_offline",
        provider_subject_id: "offline_1",
        handle: "@offline_user",
      },
    },
  });

  assert.equal(mockAdapter.providerName, "custom_offline");
  assert.ok(store);
});

test("18. Replacing one ExternalActorSource adapter with another does not require changing the Provisional Twin lifecycle model", async () => {
  const store = new InMemoryProvisionalStore();
  const hostId = "host-jhn-root-uuid";

  const xAdapter = new MockExternalActorSource("x", {
    actors: { x1: { provider: "x", provider_subject_id: "x1", handle: "@user_x" } },
  });
  const bskyAdapter = new MockExternalActorSource("bluesky", {
    actors: { b1: { provider: "bluesky", provider_subject_id: "b1", handle: "user.bsky.social" } },
  });

  const actorX = await xAdapter.resolveActor("x1");
  const actorBsky = await bskyAdapter.resolveActor("b1");

  const twinX = ensureProvisionalTwin(actorX, hostId, {}, store).twin;
  const twinBsky = ensureProvisionalTwin(actorBsky, hostId, {}, store).twin;

  assert.equal(twinX.lifecycle_state, "provisional");
  assert.equal(twinBsky.lifecycle_state, "provisional");
  assert.equal(twinX.host_instance_id, hostId);
  assert.equal(twinBsky.host_instance_id, hostId);
});
