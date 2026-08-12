/**
 * Presence store adapter: Supabase when tables exist, in-memory fallback for demo/dev.
 * Keeps map UI and John tools on the same semantic layer.
 */

import {
  aggregatePresence,
  filterActiveClaimsForSubject,
  normalizePresenceClaim,
  normalizePresencePolicy,
  resolveTimeWindow,
} from "./presence-core.js";
import { PLACES_SEED, searchPlaces } from "./places-seed.js";
import { createTranslator } from "../i18n/i18n.js";

/** Process-local fallback (edge isolate / node test). */
const memory = {
  claims: [],
  policies: new Map(),
  places: [...PLACES_SEED],
};

export function createPresenceStore(supabase = null) {
  return {
    async listPlaces(query, limit = 50) {
      if (supabase) {
        try {
          let q = supabase.from("oleole_places").select("*").eq("status", "open").limit(limit);
          if (query) q = q.ilike("name", `%${query}%`);
          const { data, error } = await q;
          if (!error && data?.length) {
            return data.map(rowToPlace);
          }
        } catch {
          /* fall through */
        }
      }
      return searchPlaces(query || "", memory.places, limit);
    },

    async getPlaces() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("oleole_places")
            .select("*")
            .eq("status", "open")
            .limit(500);
          if (!error && data?.length) return data.map(rowToPlace);
        } catch {
          /* fall through */
        }
      }
      return memory.places;
    },

    async listClaims({ includeRevoked = false } = {}) {
      if (supabase) {
        try {
          let q = supabase.from("oleole_presence_claims").select("*, oleole_presence_intents(*)");
          if (!includeRevoked) q = q.is("revoked_at", null);
          const { data, error } = await q.limit(2000);
          if (!error && data) return data.map(rowToClaim);
        } catch {
          /* fall through */
        }
      }
      return includeRevoked ? [...memory.claims] : memory.claims.filter((c) => !c.revoked_at);
    },

    async declareClaim(input) {
      const places = await this.getPlaces();
      const { ok, errors, claim } = normalizePresenceClaim(input, places);
      if (!ok) return { ok: false, errors };

      if (supabase) {
        try {
          const row = claimToRow(claim);
          const { data, error } = await supabase
            .from("oleole_presence_claims")
            .insert(row)
            .select()
            .single();
          if (!error && data) {
            await supabase.from("oleole_presence_intents").upsert({
              claim_id: data.id,
              discovery: claim.intent.discovery,
              social: claim.intent.social,
              oleole: claim.intent.oleole,
              visibility: "aggregate",
              valid_until: claim.valid_until,
            });
            return {
              ok: true,
              claim: rowToClaim({ ...data, oleole_presence_intents: [claim.intent] }),
            };
          }
        } catch {
          /* fall through to memory */
        }
      }

      memory.claims.push(claim);
      return { ok: true, claim, storage: "memory" };
    },

    async revokeClaim(claimId, subjectRef) {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("oleole_presence_claims")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", claimId)
            .eq("subject_ref", subjectRef)
            .select()
            .maybeSingle();
          if (!error && data) return { ok: true, claim: rowToClaim(data) };
        } catch {
          /* fall through */
        }
      }
      const c = memory.claims.find((x) => x.id === claimId && x.subject_ref === subjectRef);
      if (!c) return { ok: false, errors: ["not_found"] };
      c.revoked_at = new Date().toISOString();
      return { ok: true, claim: c };
    },

    async revokeAllForSubject(subjectRef) {
      const now = new Date().toISOString();
      if (supabase) {
        try {
          await supabase
            .from("oleole_presence_claims")
            .update({ revoked_at: now })
            .eq("subject_ref", subjectRef)
            .is("revoked_at", null);
        } catch {
          /* ignore */
        }
      }
      for (const c of memory.claims) {
        if (c.subject_ref === subjectRef && !c.revoked_at) c.revoked_at = now;
      }
      return { ok: true };
    },

    async getAggregates(windowKey = "now", locale = "fr") {
      const places = await this.getPlaces();
      const claims = await this.listClaims();
      const window = resolveTimeWindow(windowKey, new Date(), locale);
      const agg = aggregatePresence(claims, window, places);
      const t = createTranslator(locale);
      agg.disclaimer = t(agg.disclaimerKey || "disclaimer.banner");
      if (agg.window?.labelKey) agg.window.label = t(agg.window.labelKey);
      return agg;
    },

    async getMyState(subjectRef) {
      const claims = await this.listClaims();
      const active = filterActiveClaimsForSubject(claims, subjectRef);
      const policy = await this.getPolicy(subjectRef);
      return { subject_ref: subjectRef, policy, active_claims: active };
    },

    async getPolicy(subjectRef) {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("oleole_presence_policies")
            .select("*")
            .eq("subject_ref", subjectRef)
            .maybeSingle();
          if (!error && data) return normalizePresencePolicy(data);
        } catch {
          /* fall through */
        }
      }
      return (
        memory.policies.get(subjectRef) ||
        normalizePresencePolicy({ subject_ref: subjectRef, mode: "manual" })
      );
    },

    async setPolicy(input) {
      const policy = normalizePresencePolicy(input);
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("oleole_presence_policies")
            .upsert({
              subject_ref: policy.subject_ref,
              mode: policy.mode,
              precision: policy.precision,
              valid_until: policy.valid_until,
              paused: policy.paused,
              updated_at: policy.updated_at,
            })
            .select()
            .single();
          if (!error && data) return { ok: true, policy: normalizePresencePolicy(data) };
        } catch {
          /* fall through */
        }
      }
      memory.policies.set(policy.subject_ref, policy);
      if (policy.mode === "off" || policy.paused) {
        await this.revokeAllForSubject(policy.subject_ref);
      }
      return { ok: true, policy, storage: "memory" };
    },

    /** Test helper */
    _memory: memory,
  };
}

function rowToPlace(row) {
  return {
    id: row.id,
    name: row.name,
    name_co: row.name_co || undefined,
    lat: Number(row.lat),
    lng: Number(row.lng),
    classification: row.classification,
    status: row.status,
    precision_default: row.precision_default || "municipality",
    sources: row.sources || [],
  };
}

function rowToClaim(row) {
  const intentRow = Array.isArray(row.oleole_presence_intents)
    ? row.oleole_presence_intents[0]
    : row.oleole_presence_intents || row.intent || {};
  return {
    id: row.id,
    subject_ref: row.subject_ref,
    place_ref: row.place_ref,
    place_name: row.place_name,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    modality: row.modality,
    precision: row.precision,
    visibility: row.visibility,
    source: row.source,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    intent: {
      discovery: Boolean(intentRow?.discovery),
      social: Boolean(intentRow?.social),
      oleole: Boolean(intentRow?.oleole),
    },
    service: "oleole",
  };
}

function claimToRow(claim) {
  return {
    id: claim.id,
    subject_ref: claim.subject_ref,
    place_ref: claim.place_ref,
    place_name: claim.place_name,
    valid_from: claim.valid_from,
    valid_until: claim.valid_until,
    modality: claim.modality,
    precision: claim.precision,
    visibility: claim.visibility,
    source: claim.source,
    created_at: claim.created_at,
    revoked_at: claim.revoked_at,
    service: "oleole",
  };
}
