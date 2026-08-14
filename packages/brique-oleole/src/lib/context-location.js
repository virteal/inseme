import { CORSE_BBOX } from "./places-seed.js";

const CONTEXT_DECIMALS = 2;

function rounded(value) {
  return Number(Number(value).toFixed(CONTEXT_DECIMALS));
}

export function isCorsicaCoordinate(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= CORSE_BBOX.minLat &&
    lat <= CORSE_BBOX.maxLat &&
    lng >= CORSE_BBOX.minLng &&
    lng <= CORSE_BBOX.maxLng
  );
}

/**
 * A foreground location is deliberately coarse and memory-only. It must not
 * be used as a PresenceClaim or written to local storage.
 */
export function foregroundContextLocation(coords) {
  const lat = Number(coords?.latitude ?? coords?.lat);
  const lng = Number(coords?.longitude ?? coords?.lng);
  if (!isCorsicaCoordinate(lat, lng)) return null;
  return { kind: "foreground", lat: rounded(lat), lng: rounded(lng), precision: "~1 km" };
}

export function placeContextLocation(place) {
  if (!place || !isCorsicaCoordinate(place.lat, place.lng)) return null;
  return {
    kind: "place",
    place_ref: place.id,
    label: place.name,
    lat: Number(place.lat),
    lng: Number(place.lng),
    precision: place.precision_default || "place",
  };
}
