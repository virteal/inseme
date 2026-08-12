/**
 * Bootstrap Place set for Corsica MVP.
 * Internal id is place:... — never use OSM/Overture as sole canonical id.
 */

export const CORSE_BBOX = {
  minLat: 41.3,
  maxLat: 43.05,
  minLng: 8.5,
  maxLng: 9.6,
};

/** Default map center: Corte */
export const DEFAULT_MAP_CENTER = [42.3094, 9.149];
export const DEFAULT_MAP_ZOOM = 9;

/**
 * @typedef {object} PlaceSeed
 * @property {string} id
 * @property {string} name
 * @property {string} [name_co]
 * @property {number} lat
 * @property {number} lng
 * @property {string} classification
 * @property {string} status
 * @property {string} precision_default
 * @property {{ provider: string, ref: string }[]} sources
 */

/** @type {PlaceSeed[]} */
export const PLACES_SEED = [
  {
    id: "place:corte",
    name: "Corte",
    name_co: "Corti",
    lat: 42.3094,
    lng: 9.149,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [
      { provider: "osm", ref: "relation/119336" },
      { provider: "overture", ref: "locality:corte-corsica" },
    ],
  },
  {
    id: "place:ajaccio",
    name: "Ajaccio",
    name_co: "Aiacciu",
    lat: 41.9192,
    lng: 8.7386,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [
      { provider: "osm", ref: "relation/119317" },
      { provider: "overture", ref: "locality:ajaccio-corsica" },
    ],
  },
  {
    id: "place:bastia",
    name: "Bastia",
    lat: 42.6973,
    lng: 9.4509,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [
      { provider: "osm", ref: "relation/119320" },
      { provider: "overture", ref: "locality:bastia-corsica" },
    ],
  },
  {
    id: "place:calvi",
    name: "Calvi",
    lat: 42.5667,
    lng: 8.7572,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [
      { provider: "osm", ref: "relation/119328" },
      { provider: "overture", ref: "locality:calvi-corsica" },
    ],
  },
  {
    id: "place:porto-vecchio",
    name: "Porto-Vecchio",
    name_co: "Portivechju",
    lat: 41.591,
    lng: 9.2795,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [
      { provider: "osm", ref: "relation/119374" },
      { provider: "overture", ref: "locality:porto-vecchio-corsica" },
    ],
  },
  {
    id: "place:bonifacio",
    name: "Bonifacio",
    name_co: "Bunifaziu",
    lat: 41.3874,
    lng: 9.1594,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [
      { provider: "osm", ref: "relation/119324" },
      { provider: "overture", ref: "locality:bonifacio-corsica" },
    ],
  },
  {
    id: "place:propriano",
    name: "Propriano",
    name_co: "Prupià",
    lat: 41.6753,
    lng: 8.9047,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [{ provider: "osm", ref: "relation/119376" }],
  },
  {
    id: "place:sartene",
    name: "Sartène",
    name_co: "Sartè",
    lat: 41.621,
    lng: 8.973,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [{ provider: "osm", ref: "relation/119382" }],
  },
  {
    id: "place:ile-rousse",
    name: "L'Île-Rousse",
    name_co: "Isula Rossa",
    lat: 42.635,
    lng: 8.937,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [{ provider: "osm", ref: "relation/119350" }],
  },
  {
    id: "place:ghisonaccia",
    name: "Ghisonaccia",
    lat: 42.016,
    lng: 9.405,
    classification: "municipality",
    status: "open",
    precision_default: "municipality",
    sources: [{ provider: "osm", ref: "relation/119346" }],
  },
  {
    id: "place:corte-citadelle",
    name: "Citadelle de Corte",
    lat: 42.3065,
    lng: 9.1505,
    classification: "poi",
    status: "open",
    precision_default: "poi",
    sources: [
      { provider: "osm", ref: "way/123456789" },
      { provider: "overture", ref: "poi:citadelle-corte" },
    ],
  },
  {
    id: "place:ajaccio-port",
    name: "Port d'Ajaccio",
    lat: 41.9215,
    lng: 8.7405,
    classification: "poi",
    status: "open",
    precision_default: "poi",
    sources: [{ provider: "osm", ref: "way/ajaccio-port" }],
  },
  {
    id: "place:bastia-vieux-port",
    name: "Vieux Port de Bastia",
    lat: 42.6978,
    lng: 9.4518,
    classification: "poi",
    status: "open",
    precision_default: "poi",
    sources: [{ provider: "osm", ref: "way/bastia-vieux-port" }],
  },
  {
    id: "place:calvi-citadelle",
    name: "Citadelle de Calvi",
    lat: 42.5678,
    lng: 8.756,
    classification: "poi",
    status: "open",
    precision_default: "poi",
    sources: [{ provider: "osm", ref: "way/calvi-citadelle" }],
  },
];

export function findPlaceByName(query, places = PLACES_SEED) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  if (!q) return null;
  return (
    places.find((p) => p.name.toLowerCase() === q) ||
    places.find((p) => p.name_co && p.name_co.toLowerCase() === q) ||
    places.find((p) => p.id === q || p.id === `place:${q}`) ||
    places.find((p) => p.name.toLowerCase().includes(q)) ||
    places.find((p) => p.name_co && p.name_co.toLowerCase().includes(q)) ||
    null
  );
}

export function searchPlaces(query, places = PLACES_SEED, limit = 10) {
  if (!query) return places.slice(0, limit);
  const q = String(query).trim().toLowerCase();
  return places
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.name_co && p.name_co.toLowerCase().includes(q)) ||
        p.classification.toLowerCase().includes(q) ||
        p.id.includes(q)
    )
    .slice(0, limit);
}
