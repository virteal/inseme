import { createPresenceStore } from "../lib/presence-store.js";
import { parsePresenceUtterance } from "../lib/presence-core.js";
import { runtimeSubject } from "./runtime-subject.js";

/**
 * John write tool — requires confirm=true unless mandate already granted in runtime.
 */
export default async function handler(runtime, args = {}) {
  const store = createPresenceStore(runtime?.supabase || null);
  const subject = runtimeSubject(runtime);
  if (!subject) {
    return JSON.stringify({
      status: "identity_required",
      error: "trusted_subject_context_required",
    });
  }

  if (args.text && !args.place_ref && !args.place_name) {
    const places = await store.getPlaces();
    const parsed = parsePresenceUtterance(args.text, places);
    if (!args.confirm) {
      return JSON.stringify({
        status: "proposal",
        requires_confirmation: true,
        ...parsed,
        hint: "Relancer avec confirm=true et place_ref pour écrire.",
      });
    }
    if (!parsed.ok) return JSON.stringify(parsed);
    Object.assign(args, parsed.proposal);
  }

  if (!args.confirm && !runtime?.mandate?.oleole_write) {
    return JSON.stringify({
      status: "proposal",
      requires_confirmation: true,
      proposal: {
        place_ref: args.place_ref,
        place_name: args.place_name,
        modality: args.modality || "declared",
        precision: args.precision || "municipality",
        valid_from: args.valid_from,
        valid_until: args.valid_until,
        intent: {
          discovery: Boolean(args.discovery),
          social: Boolean(args.social),
          oleole: Boolean(args.oleole),
        },
      },
      message: "Confirmation requise avant écriture de présence (confirm=true).",
    });
  }

  const result = await store.declareClaim({
    subject_ref: subject,
    place_ref: args.place_ref,
    place_name: args.place_name,
    modality: args.modality || "declared",
    precision: args.precision || "municipality",
    visibility: "aggregate",
    valid_from: args.valid_from,
    valid_until: args.valid_until,
    discovery: args.discovery,
    social: args.social,
    oleole: args.oleole,
    source: args.source || "john_tool",
  });

  return JSON.stringify(result);
}
