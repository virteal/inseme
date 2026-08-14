import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { foregroundContextLocation, placeContextLocation } from "../src/lib/context-location.js";
import { PLACES_SEED } from "../src/lib/places-seed.js";

describe("territorial context location", () => {
  it("rounds a foreground coordinate and keeps it distinct from a claim", () => {
    const location = foregroundContextLocation({ latitude: 42.30941, longitude: 9.14908 });
    assert.deepEqual(location, { kind: "foreground", lat: 42.31, lng: 9.15, precision: "~1 km" });
    assert.equal("subject_ref" in location, false);
    assert.equal("place_ref" in location, false);
  });

  it("rejects locations outside Corsica and accepts public place centres", () => {
    assert.equal(foregroundContextLocation({ latitude: 48.8566, longitude: 2.3522 }), null);
    const corte = placeContextLocation(PLACES_SEED.find((place) => place.id === "place:corte"));
    assert.equal(corte.place_ref, "place:corte");
    assert.equal(corte.kind, "place");
  });
});
