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

  if (!args.confirm && !runtime?.mandate?.oleole_write) {
    return JSON.stringify({
      status: "proposal",
      requires_confirmation: true,
      proposal: {
        mode: args.mode || "manual",
        precision: args.precision || "municipality",
        paused: Boolean(args.paused),
      },
      message: "Confirmation requise pour changer le mode de présence automatique.",
    });
  }

  const result = await store.setPolicy({
    subject_ref: subject,
    mode: args.mode,
    precision: args.precision,
    paused: args.paused,
    valid_until: args.valid_until,
  });
  return JSON.stringify(result);
}
