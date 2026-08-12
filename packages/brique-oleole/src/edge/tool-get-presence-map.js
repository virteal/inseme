import { createPresenceStore } from "../lib/presence-store.js";

export default async function handler(runtime, args = {}) {
  const store = createPresenceStore(runtime?.supabase || null);
  const windowKey = args.window || args.when || "now";
  const data = await store.getAggregates(windowKey);
  // GeoJSON FeatureCollection for map consumers
  const features = data.aggregates
    .filter((a) => a.lat != null && a.lng != null)
    .map((a) => ({
      type: "Feature",
      properties: {
        place_ref: a.place_ref,
        place_name: a.place_name,
        count: a.count,
        intents: a.intents,
        modalities: a.modalities,
        coverage: a.coverage,
        label: a.label,
      },
      geometry: { type: "Point", coordinates: [a.lng, a.lat] },
    }));
  return JSON.stringify({
    type: "FeatureCollection",
    features,
    window: data.window,
    disclaimer: data.disclaimer,
  });
}
