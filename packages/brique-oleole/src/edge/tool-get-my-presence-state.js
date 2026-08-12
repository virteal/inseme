import { createPresenceStore } from "../lib/presence-store.js";
import { runtimeSubject } from "./runtime-subject.js";

export default async function handler(runtime, args = {}) {
  const store = createPresenceStore(runtime?.supabase || null);
  const subject = runtimeSubject(runtime);
  if (!subject)
    return JSON.stringify({
      status: "identity_required",
      error: "trusted_subject_context_required",
    });
  const state = await store.getMyState(subject);
  return JSON.stringify(state);
}
