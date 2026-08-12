import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTranslator, detectLocale, normalizeLocale, translate } from "../src/i18n/i18n.js";
import { messages, LOCALES } from "../src/i18n/messages.js";
import { parsePresenceUtterance } from "../src/lib/presence-core.js";

describe("i18n dual UX", () => {
  it("exposes fr and en with matching keys", () => {
    assert.deepEqual([...LOCALES].sort(), ["en", "fr"]);
    const frKeys = Object.keys(messages.fr).sort();
    const enKeys = Object.keys(messages.en).sort();
    assert.deepEqual(frKeys, enKeys);
  });

  it("translates and interpolates", () => {
    assert.equal(translate("en", "time.now"), "Now");
    assert.equal(translate("fr", "time.now"), "Maintenant");
    assert.match(createTranslator("en")("map.presenceCount", { count: 3 }), /3/);
  });

  it("detects locale from query and browser", () => {
    assert.equal(detectLocale({ search: "?lang=en" }), "en");
    assert.equal(detectLocale({ search: "?locale=fr" }), "fr");
    assert.equal(detectLocale({ navigatorLang: "en-US" }), "en");
    assert.equal(normalizeLocale("EN-gb"), "en");
  });

  it("parses English presence utterances", () => {
    const r = parsePresenceUtterance("I am in Corte until 8pm", undefined, new Date(), "en");
    assert.equal(r.ok, true);
    assert.equal(r.proposal.place_ref, "place:corte");
    assert.match(r.message, /Proposal|Confirm/i);

    const r2 = parsePresenceUtterance(
      "I'll be in Calvi tomorrow evening",
      undefined,
      new Date(),
      "en"
    );
    assert.equal(r2.ok, true);
    assert.equal(r2.proposal.modality, "intended");
  });
});
