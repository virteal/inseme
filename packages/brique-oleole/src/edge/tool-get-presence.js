import { createPresenceStore } from "../lib/presence-store.js";

export default async function handler(runtime, args = {}) {
  const store = createPresenceStore(runtime?.supabase || null);
  const windowKey = args.window || args.when || "now";
  const data = await store.getAggregates(windowKey);
  return JSON.stringify(data);
}
