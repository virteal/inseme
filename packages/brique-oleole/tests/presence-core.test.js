import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregatePresence,
  normalizePresenceClaim,
  parsePresenceUtterance,
  resolveTimeWindow,
} from "../src/lib/presence-core.js";
import { PLACES_SEED, searchPlaces } from "../src/lib/places-seed.js";
import {
  distanceMeters,
  evaluateAutomaticClaim,
  reducePrecisionToPlace,
  SIGNIFICANT_CHANGE_METERS,
} from "../src/lib/auto-presence.js";
import { createPresenceStore } from "../src/lib/presence-store.js";

describe("places seed", () => {
  it("uses internal place ids and multi-source provenance", () => {
    const corte = PLACES_SEED.find((p) => p.id === "place:corte");
    assert.ok(corte);
    assert.ok(corte.sources.some((s) => s.provider === "osm"));
    assert.ok(corte.sources.some((s) => s.provider === "overture"));
    assert.ok(searchPlaces("Calvi").length >= 1);
  });
});

describe("presence claims", () => {
  it("normalizes and drops GPS when precision is coarse", () => {
    const { ok, claim } = normalizePresenceClaim({
      place_name: "Corte",
      modality: "declared",
      precision: "municipality",
      lat: 42.3,
      lng: 9.1,
      discovery: true,
    });
    assert.equal(ok, true);
    assert.equal(claim.place_ref, "place:corte");
    assert.equal(claim.lat, undefined);
    assert.equal(claim.intent.discovery, true);
  });

  it("aggregates without subject exposure", () => {
    const claims = [
      {
        id: "1",
        subject_ref: "secret-a",
        place_ref: "place:corte",
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 3600_000).toISOString(),
        modality: "declared",
        precision: "municipality",
        visibility: "aggregate",
        intent: { discovery: true, social: false, oleole: true },
      },
      {
        id: "2",
        subject_ref: "secret-b",
        place_ref: "place:corte",
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 3600_000).toISOString(),
        modality: "automatic",
        precision: "municipality",
        visibility: "aggregate",
        intent: { discovery: false, social: true, oleole: false },
      },
    ];
    const agg = aggregatePresence(claims, resolveTimeWindow("now"));
    assert.equal(agg.aggregates.length, 1);
    assert.equal(agg.aggregates[0].count, 2);
    assert.equal(agg.aggregates[0].intents.oleole, 1);
    const json = JSON.stringify(agg);
    assert.equal(json.includes("secret-a"), false);
    assert.equal(json.includes("secret-b"), false);
  });
});

describe("NL parse", () => {
  it("parses current presence in Corte", () => {
    const r = parsePresenceUtterance("Je suis à Corte jusqu'à 20h");
    assert.equal(r.ok, true);
    assert.equal(r.proposal.place_ref, "place:corte");
    assert.equal(r.proposal.requires_confirmation, true);
  });

  it("parses future presence in Calvi", () => {
    const r = parsePresenceUtterance("Je serai à Calvi demain soir");
    assert.equal(r.ok, true);
    assert.equal(r.proposal.place_ref, "place:calvi");
    assert.equal(r.proposal.modality, "intended");
  });
});

describe("auto presence", () => {
  it("reduces GPS to municipality without keeping precise coords in claim", () => {
    const reduced = reducePrecisionToPlace(42.31, 9.15);
    assert.equal(reduced.place.id, "place:corte");
    const decision = evaluateAutomaticClaim(
      { coords: { latitude: 42.31, longitude: 9.15 } },
      { mode: "auto", paused: false, precision: "municipality", subject_ref: "ephemeral:t" }
    );
    assert.equal(decision.action, "publish");
    assert.equal(decision.claim.lat, undefined);
    assert.equal(decision.claim.modality, "automatic");
    assert.ok(SIGNIFICANT_CHANGE_METERS > 0);
    assert.ok(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) > 1000);
  });
});

describe("presence store memory", () => {
  it("declares and aggregates claims", async () => {
    const store = createPresenceStore(null);
    store._memory.claims.length = 0;
    const d = await store.declareClaim({
      subject_ref: "ephemeral:test",
      place_ref: "place:bastia",
      modality: "declared",
      social: true,
    });
    assert.equal(d.ok, true);
    const agg = await store.getAggregates("now");
    assert.ok(agg.aggregates.some((a) => a.place_ref === "place:bastia"));
    await store.revokeAllForSubject("ephemeral:test");
    const after = await store.getAggregates("now");
    assert.equal(
      after.aggregates.find((a) => a.place_ref === "place:bastia"),
      undefined
    );
  });
});
