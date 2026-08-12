/**
 * Client-side automatic Presence contribution helpers.
 * Preferred flow: OS location → significant change → precision reduction → PresenceClaim.
 * Not continuous server-side GPS logging.
 */

import { normalizePresenceClaim, normalizePresencePolicy } from "./presence-core.js";
import { findPlaceByName, PLACES_SEED } from "./places-seed.js";

const STORAGE_POLICY = "oleole.presence_policy";
const STORAGE_SUBJECT = "oleole.subject_ref";
const STORAGE_LAST = "oleole.last_auto_claim";

/** Minimum meters between automatic claims (significant change). */
export const SIGNIFICANT_CHANGE_METERS = 800;

/** Minimum minutes between automatic claims. */
export const MIN_INTERVAL_MINUTES = 15;

export function getOrCreateSubjectRef() {
  if (typeof localStorage === "undefined") return "ephemeral:anonymous";
  let ref = localStorage.getItem(STORAGE_SUBJECT);
  if (!ref) {
    ref = `ephemeral:${cryptoRandomId()}`;
    localStorage.setItem(STORAGE_SUBJECT, ref);
  }
  return ref;
}

export function loadPresencePolicy() {
  if (typeof localStorage === "undefined") {
    return normalizePresencePolicy({ mode: "manual" });
  }
  try {
    const raw = localStorage.getItem(STORAGE_POLICY);
    if (!raw)
      return normalizePresencePolicy({ mode: "manual", subject_ref: getOrCreateSubjectRef() });
    return normalizePresencePolicy({
      ...JSON.parse(raw),
      subject_ref: getOrCreateSubjectRef(),
    });
  } catch {
    return normalizePresencePolicy({ mode: "manual", subject_ref: getOrCreateSubjectRef() });
  }
}

export function savePresencePolicy(policy) {
  const normalized = normalizePresencePolicy({
    ...policy,
    subject_ref: policy.subject_ref || getOrCreateSubjectRef(),
  });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_POLICY, JSON.stringify(normalized));
  }
  return normalized;
}

export function pausePresencePolicy() {
  return savePresencePolicy({ ...loadPresencePolicy(), mode: "off", paused: true });
}

/**
 * Haversine distance in meters.
 */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Map a GPS fix to nearest seeded municipality/place (precision reduction).
 */
export function reducePrecisionToPlace(lat, lng, places = PLACES_SEED, precision = "municipality") {
  const candidates =
    precision === "poi"
      ? places
      : places.filter((p) => p.classification === "municipality" || p.classification === "area");

  let best = null;
  let bestD = Infinity;
  for (const p of candidates) {
    const d = distanceMeters({ lat, lng }, { lat: p.lat, lng: p.lng });
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  // Cap: if farther than ~40km from any place, refuse auto claim
  if (!best || bestD > 40_000) return null;
  return { place: best, distance_m: Math.round(bestD) };
}

/**
 * Decide whether an automatic claim should be emitted for a new fix.
 * Returns null if no publish; otherwise a normalized claim payload (without precise GPS).
 */
export function evaluateAutomaticClaim(
  position,
  policy = loadPresencePolicy(),
  places = PLACES_SEED
) {
  if (!policy || policy.mode !== "auto" || policy.paused) {
    return { action: "none", reason: "mode_not_auto" };
  }

  const { latitude: lat, longitude: lng } = position.coords || position;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { action: "none", reason: "invalid_position" };
  }

  const last = loadLastAutoMeta();
  const now = Date.now();
  if (last?.at && now - last.at < MIN_INTERVAL_MINUTES * 60_000) {
    return { action: "none", reason: "interval" };
  }
  if (last?.lat != null && last?.lng != null) {
    const moved = distanceMeters({ lat, lng }, { lat: last.lat, lng: last.lng });
    if (moved < SIGNIFICANT_CHANGE_METERS) {
      return { action: "none", reason: "no_significant_change", moved_m: Math.round(moved) };
    }
  }

  const reduced = reducePrecisionToPlace(lat, lng, places, policy.precision || "municipality");
  if (!reduced) return { action: "none", reason: "outside_coverage" };

  // Assisted mode would propose; auto publishes semantic claim without raw GPS
  const { claim, ok, errors } = normalizePresenceClaim(
    {
      subject_ref: policy.subject_ref,
      place_ref: reduced.place.id,
      modality: "automatic",
      precision:
        policy.precision === "precise" ? "municipality" : policy.precision || "municipality",
      visibility: "aggregate",
      source: "automatic_client",
      valid_from: new Date().toISOString(),
      valid_until: new Date(Date.now() + 3 * 3600_000).toISOString(),
    },
    places
  );

  if (!ok) return { action: "none", reason: "normalize_failed", errors };

  return {
    action: "publish",
    claim,
    meta: { lat, lng, place: reduced.place, distance_m: reduced.distance_m },
  };
}

export function rememberAutoClaimMeta(meta) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    STORAGE_LAST,
    JSON.stringify({ at: Date.now(), lat: meta.lat, lng: meta.lng, place_ref: meta.place?.id })
  );
}

function loadLastAutoMeta() {
  if (typeof localStorage === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_LAST) || "null");
  } catch {
    return null;
  }
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

export { findPlaceByName };
