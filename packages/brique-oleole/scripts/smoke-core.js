/**
 * Step-1 smoke: Presence/Place core without network.
 * Usage: node packages/brique-oleole/scripts/smoke-core.js
 */
import { createPresenceStore } from "../src/lib/presence-store.js";
import { parsePresenceUtterance } from "../src/lib/presence-core.js";

const store = createPresenceStore(null);
store._memory.claims.length = 0;

const p1 = parsePresenceUtterance("Je suis à Corte jusqu'à 20h", undefined, new Date(), "fr");
console.log("NL Corte FR:", p1.ok, p1.proposal?.place_ref);
if (!p1.ok || p1.proposal?.place_ref !== "place:corte") {
  console.error("FAIL: NL Corte");
  process.exit(1);
}

const p2 = parsePresenceUtterance("Je serai à Calvi demain soir", undefined, new Date(), "fr");
console.log("NL Calvi future FR:", p2.ok, p2.proposal?.modality, p2.proposal?.place_ref);
if (!p2.ok || p2.proposal?.modality !== "intended") {
  console.error("FAIL: NL Calvi");
  process.exit(1);
}

const p3 = parsePresenceUtterance("I am in Bastia until 9pm", undefined, new Date(), "en");
console.log("NL Bastia EN:", p3.ok, p3.proposal?.place_ref, p3.message.slice(0, 40));
if (!p3.ok || p3.proposal?.place_ref !== "place:bastia") {
  console.error("FAIL: NL Bastia EN");
  process.exit(1);
}

const d = await store.declareClaim({
  subject_ref: "ephemeral:smoke",
  place_ref: "place:corte",
  modality: "declared",
  social: true,
  oleole: true,
});
console.log("declare:", d.ok, d.claim?.place_ref);
if (!d.ok) {
  console.error("FAIL: declare");
  process.exit(1);
}

const agg = await store.getAggregates("now");
const corte = agg.aggregates.find((a) => a.place_ref === "place:corte");
console.log("aggregate Corte count:", corte?.count, "oleole intent:", corte?.intents?.oleole);
if (!corte || corte.count < 1) {
  console.error("FAIL: aggregate");
  process.exit(1);
}
if (JSON.stringify(agg).includes("ephemeral:smoke")) {
  console.error("FAIL: subject leaked in aggregate");
  process.exit(1);
}

const places = await store.listPlaces("Calvi");
console.log("search Calvi:", places.map((p) => p.id).join(", "));
if (!places.some((p) => p.id === "place:calvi")) {
  console.error("FAIL: search");
  process.exit(1);
}

await store.revokeAllForSubject("ephemeral:smoke");
const after = await store.getAggregates("now");
console.log("after revoke count:", after.aggregates.length);
if (after.aggregates.some((a) => a.place_ref === "place:corte")) {
  console.error("FAIL: revoke");
  process.exit(1);
}

console.log("SMOKE_CORE_OK");
