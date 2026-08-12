import { createPresenceStore } from "../lib/presence-store.js";

export default async function handler(runtime, args = {}) {
  const store = createPresenceStore(runtime?.supabase || null);
  const places = await store.listPlaces(args.query || args.q || "", args.limit || 10);
  if (!places.length) return "Aucun lieu trouvé.";
  return JSON.stringify({
    places: places.map((p) => ({
      id: p.id,
      name: p.name,
      classification: p.classification,
      lat: p.lat,
      lng: p.lng,
      sources: p.sources,
    })),
    note: "Internal place ids are canonical; OSM/Overture refs are provenance only.",
  });
}
