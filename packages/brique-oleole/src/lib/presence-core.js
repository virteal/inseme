/**
 * Shared Presence / Place service semantics for map UI and John tools.
 * No individual precise locations in public aggregates by default.
 */

import { findPlaceByName, PLACES_SEED, searchPlaces } from "./places-seed.js";
import { createTranslator, DEFAULT_LOCALE, normalizeLocale } from "../i18n/i18n.js";

export const MODALITIES = Object.freeze(["declared", "intended", "automatic", "inferred"]);

export const PRECISIONS = Object.freeze(["municipality", "area", "poi", "precise"]);

export const VISIBILITIES = Object.freeze(["aggregate", "bounded", "private"]);

export const PRESENCE_MODES = Object.freeze(["off", "manual", "assisted", "auto"]);

export const TIME_WINDOWS = Object.freeze({
  now: { labelKey: "time.now", hoursAhead: 2, hoursBack: 0 },
  tonight: { labelKey: "time.tonight", hoursAhead: 12, hoursBack: 0 },
  tomorrow: { labelKey: "time.tomorrow", hoursAhead: 36, hoursBack: 12 },
});

export const INTENT_KEYS = Object.freeze(["discovery", "social", "oleole"]);

/**
 * Resolve a named time window to [from, until] ISO bounds.
 * @param {string} windowKey
 * @param {Date} [now]
 * @param {string} [locale]
 */
export function resolveTimeWindow(windowKey = "now", now = new Date(), locale = DEFAULT_LOCALE) {
  const key = TIME_WINDOWS[windowKey] ? windowKey : "now";
  const def = TIME_WINDOWS[key];
  const t = createTranslator(locale);
  const label = t(def.labelKey);
  const from = new Date(now.getTime() - def.hoursBack * 3600_000);
  const until = new Date(now.getTime() + def.hoursAhead * 3600_000);

  if (key === "tonight") {
    const evening = new Date(now);
    evening.setHours(18, 0, 0, 0);
    if (evening < now) evening.setDate(evening.getDate() + 1);
    const end = new Date(evening);
    end.setHours(23, 59, 59, 999);
    return {
      key,
      label,
      labelKey: def.labelKey,
      valid_from: now.toISOString(),
      valid_until: end.toISOString(),
    };
  }

  if (key === "tomorrow") {
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return {
      key,
      label,
      labelKey: def.labelKey,
      valid_from: start.toISOString(),
      valid_until: end.toISOString(),
    };
  }

  return {
    key,
    label,
    labelKey: def.labelKey,
    valid_from: from.toISOString(),
    valid_until: until.toISOString(),
  };
}

/**
 * Validate and normalize a PresenceClaim input.
 * Drops raw GPS when precision is coarser than precise.
 */
export function normalizePresenceClaim(input = {}, places = PLACES_SEED) {
  const errors = [];
  let place =
    (input.place_ref && places.find((p) => p.id === input.place_ref)) ||
    findPlaceByName(input.place_name || input.place || "", places);

  if (!place && input.place_ref) {
    place = { id: input.place_ref, name: input.place_ref, precision_default: "municipality" };
  }
  if (!place) errors.push("place_ref_or_name_required");

  const modality = MODALITIES.includes(input.modality) ? input.modality : "declared";
  let precision = PRECISIONS.includes(input.precision)
    ? input.precision
    : place?.precision_default || "municipality";

  // Never store raw precise coords when user selected coarser precision
  if (precision !== "precise") {
    delete input.lat;
    delete input.lng;
    delete input.coordinates;
  }

  const visibility = VISIBILITIES.includes(input.visibility) ? input.visibility : "aggregate";

  const now = new Date();
  const valid_from = input.valid_from ? new Date(input.valid_from) : now;
  let valid_until = input.valid_until
    ? new Date(input.valid_until)
    : new Date(now.getTime() + 4 * 3600_000);

  if (Number.isNaN(valid_from.getTime())) errors.push("invalid_valid_from");
  if (Number.isNaN(valid_until.getTime())) errors.push("invalid_valid_until");
  if (valid_until <= valid_from) errors.push("valid_until_must_follow_valid_from");

  const intent = {
    discovery: Boolean(input.intent?.discovery ?? input.discovery),
    social: Boolean(input.intent?.social ?? input.social),
    oleole: Boolean(input.intent?.oleole ?? input.oleole),
  };

  const claim = {
    id: input.id || cryptoRandomId(),
    subject_ref: input.subject_ref || "ephemeral:anonymous",
    place_ref: place?.id || null,
    place_name: place?.name || input.place_name || null,
    valid_from: valid_from.toISOString(),
    valid_until: valid_until.toISOString(),
    modality,
    precision,
    visibility,
    source: input.source || "manual",
    created_at: input.created_at || now.toISOString(),
    revoked_at: input.revoked_at || null,
    intent,
    service: "oleole",
  };

  // Only keep precise coords when explicitly allowed
  if (precision === "precise" && typeof input.lat === "number" && typeof input.lng === "number") {
    claim.lat = input.lat;
    claim.lng = input.lng;
  }

  return { ok: errors.length === 0, errors, claim, place };
}

/**
 * Aggregate active claims for public map (no subject exposure).
 * disclaimer/label are stable message keys; UI/API localise them.
 */
export function aggregatePresence(
  claims = [],
  window = resolveTimeWindow("now"),
  places = PLACES_SEED
) {
  const from = new Date(window.valid_from).getTime();
  const until = new Date(window.valid_until).getTime();
  const byPlace = new Map();

  for (const claim of claims) {
    if (claim.revoked_at) continue;
    if (claim.visibility === "private") continue;
    const cFrom = new Date(claim.valid_from).getTime();
    const cUntil = new Date(claim.valid_until).getTime();
    if (cUntil < from || cFrom > until) continue;

    const placeId = claim.place_ref;
    if (!placeId) continue;

    if (!byPlace.has(placeId)) {
      const place = places.find((p) => p.id === placeId);
      byPlace.set(placeId, {
        place_ref: placeId,
        place_name: place?.name || claim.place_name || placeId,
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        classification: place?.classification || "unknown",
        count: 0,
        modalities: {},
        intents: { discovery: 0, social: 0, oleole: 0 },
        coverage: "contributed",
        labelKey: "map.aggregateNote",
      });
    }

    const bucket = byPlace.get(placeId);
    bucket.count += 1;
    bucket.modalities[claim.modality] = (bucket.modalities[claim.modality] || 0) + 1;
    if (claim.intent?.discovery) bucket.intents.discovery += 1;
    if (claim.intent?.social) bucket.intents.social += 1;
    if (claim.intent?.oleole) bucket.intents.oleole += 1;
  }

  return {
    window,
    disclaimerKey: "disclaimer.banner",
    disclaimer: createTranslator(DEFAULT_LOCALE)("disclaimer.banner"),
    aggregates: [...byPlace.values()].sort((a, b) => b.count - a.count),
  };
}

export function filterActiveClaimsForSubject(claims, subjectRef, now = new Date()) {
  const t = now.getTime();
  return claims.filter(
    (c) => c.subject_ref === subjectRef && !c.revoked_at && new Date(c.valid_until).getTime() >= t
  );
}

export function normalizePresencePolicy(input = {}) {
  const mode = PRESENCE_MODES.includes(input.mode) ? input.mode : "manual";
  const precision = PRECISIONS.includes(input.precision) ? input.precision : "municipality";
  return {
    subject_ref: input.subject_ref || "ephemeral:anonymous",
    mode,
    precision,
    valid_until: input.valid_until || null,
    revocable: true,
    paused: Boolean(input.paused),
    service: "oleole",
    updated_at: new Date().toISOString(),
  };
}

/**
 * Lightweight NL → structured presence proposal (FR + EN heuristics).
 * Returns a proposal for confirmation, never auto-writes.
 * @param {string} text
 * @param {object[]} [places]
 * @param {Date} [now]
 * @param {string} [locale]
 */
export function parsePresenceUtterance(
  text,
  places = PLACES_SEED,
  now = new Date(),
  locale = DEFAULT_LOCALE
) {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "empty" };

  const t = createTranslator(locale);
  const lower = raw.toLowerCase();
  let modality = "declared";
  if (
    /serai|seras|sera|demain|plus tard|ce soir|ce week|week-end|weekend|tomorrow|tonight|later|will be|i'll be|i will be/.test(
      lower
    )
  ) {
    modality = "intended";
  }
  if (
    /suis à|suis a|je suis|maintenant|actuellement|i am in|i'm in|im in|right now|currently/.test(
      lower
    )
  ) {
    modality = modality === "intended" ? "intended" : "declared";
  }

  // Match place names inside the utterance (not the reverse filter used by searchPlaces)
  const ranked = places
    .map((p) => {
      const n = p.name.toLowerCase();
      const co = (p.name_co || "").toLowerCase();
      let score = 0;
      if (n && lower.includes(n)) score = Math.max(score, n.length);
      if (co && lower.includes(co)) score = Math.max(score, co.length);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const place = ranked[0]?.p || null;

  let valid_from = now;
  let valid_until = new Date(now.getTime() + 4 * 3600_000);

  const untilMatch =
    lower.match(/jusqu['’]?\s*[àa]?\s*(\d{1,2})\s*h/) ||
    lower.match(/until\s+(\d{1,2})\s*(?:h|am|pm|:00)?/) ||
    lower.match(/till\s+(\d{1,2})/);
  if (untilMatch) {
    valid_until = new Date(now);
    let hour = Number(untilMatch[1]);
    if (/pm/.test(lower) && hour < 12) hour += 12;
    valid_until.setHours(hour, 0, 0, 0);
    if (valid_until <= now) valid_until.setDate(valid_until.getDate() + 1);
  }

  if (/demain|tomorrow/.test(lower)) {
    valid_from = new Date(now);
    valid_from.setDate(valid_from.getDate() + 1);
    valid_from.setHours(/soir|soirée|soiree|evening|tonight/.test(lower) ? 18 : 10, 0, 0, 0);
    valid_until = new Date(valid_from);
    valid_until.setHours(23, 59, 0, 0);
    modality = "intended";
  } else if (/ce soir|soirée|soiree|tonight|this evening/.test(lower)) {
    valid_from = new Date(now);
    if (valid_from.getHours() < 18) valid_from.setHours(18, 0, 0, 0);
    valid_until = new Date(valid_from);
    valid_until.setHours(23, 59, 0, 0);
  }

  const intent = {
    discovery:
      /découvr|decouvr|quoi faire|quelque chose|calme|intéressant|interessant|discover|something to do|quiet|interesting/.test(
        lower
      ),
    social: /rencontr|monde|gens|social|amis|copain|meet people|people|friends|social/.test(lower),
    oleole: /olé olé|ole ole|rencontre perso|affectif|flirt|dating|personal encounter/.test(lower),
  };

  const proposal = {
    place_ref: place?.id || null,
    place_name: place?.name || null,
    modality,
    precision: place?.precision_default || "municipality",
    visibility: "aggregate",
    valid_from: valid_from.toISOString(),
    valid_until: valid_until.toISOString(),
    intent,
    source: "john_nl",
    requires_confirmation: true,
  };

  const modalityLabel = t(`nl.modality.${modality}`) || modality;

  return {
    ok: Boolean(place),
    needs_place: !place,
    proposal,
    utterance: raw,
    locale: normalizeLocale(locale),
    message: place
      ? t("nl.proposal", {
          modality: modalityLabel,
          place: place.name,
          from: proposal.valid_from,
          until: proposal.valid_until,
        })
      : t("nl.placeUnknown"),
  };
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export { findPlaceByName, searchPlaces, PLACES_SEED };
