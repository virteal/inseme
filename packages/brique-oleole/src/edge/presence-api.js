/* eslint-env deno */
/**
 * Olé Olé Presence / Place HTTP API.
 * Shared by map UI and (via tools) John.
 * Accepts `lang` / `locale` (query, body, or Accept-Language) for FR/EN UX.
 *
 * Routes under /api/oleole/*
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPresenceStore } from "../lib/presence-store.js";
import { parsePresenceUtterance, resolveTimeWindow } from "../lib/presence-core.js";
import { PLACES_SEED } from "../lib/places-seed.js";
import { createTranslator, normalizeLocale } from "../i18n/i18n.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Oleole-Locale, Accept-Language",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

function getSupabase() {
  const url =
    globalThis.Deno?.env.get("SUPABASE_URL") || globalThis.Deno?.env.get("VITE_SUPABASE_URL");
  // This edge function owns all access to individual claims. Never fall back
  // to an anon/publishable key: the service role remains server-side only.
  const key = globalThis.Deno?.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

async function resolveActor(req, supabase) {
  const authorization = req.headers.get("Authorization") || "";
  if (authorization.startsWith("Bearer ")) {
    if (!supabase) return { error: "identity_service_unavailable", status: 503 };
    const { data, error } = await supabase.auth.getUser(authorization.slice(7));
    if (error || !data.user) return { error: "invalid_session", status: 401 };
    return { subject_ref: `subject:auth:${data.user.id}`, kind: "authenticated", headers: {} };
  }

  const secret = globalThis.Deno?.env.get("OLEOLE_SESSION_SECRET");
  if (!secret) return { error: "identity_service_unavailable", status: 503 };

  const cookieName = "oleole_participant";
  const current = cookieValue(req.headers.get("Cookie"), cookieName);
  const participantId = await verifiedParticipantId(current, secret);
  if (participantId) {
    return {
      subject_ref: `subject:participant:${participantId}`,
      kind: "pseudonymous",
      headers: {},
    };
  }

  const id = crypto.randomUUID();
  const token = await signParticipantId(id, secret);
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return {
    subject_ref: `subject:participant:${id}`,
    kind: "pseudonymous",
    headers: {
      "Set-Cookie": `${cookieName}=${token}; Path=/api/oleole; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`,
    },
  };
}

function cookieValue(header, name) {
  return (header || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function signParticipantId(id, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id))
  );
  return `${id}.${base64url(signature)}`;
}

async function verifiedParticipantId(token, secret) {
  const [id, signature] = String(token || "").split(".");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !signature) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlBytes(signature),
      new TextEncoder().encode(id)
    );
    return valid ? id : null;
  } catch {
    return null;
  }
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64urlBytes(value) {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function ownState(state) {
  return { policy: state.policy, active_claims: state.active_claims.map(withoutSubject) };
}

function withoutSubject(claim) {
  const { subject_ref: _subjectRef, ...safe } = claim;
  return safe;
}

function localeFrom(req, body = {}, url) {
  const q = url?.searchParams?.get("lang") || url?.searchParams?.get("locale");
  const header = req.headers.get("X-Oleole-Locale") || req.headers.get("Accept-Language");
  return normalizeLocale(body.lang || body.locale || q || header);
}

function pathTail(url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("oleole");
  return i >= 0 ? parts.slice(i + 1) : parts.slice(-1);
}

export default async (req, _context) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  const url = new URL(req.url);
  const supabase = getSupabase();
  const store = createPresenceStore(supabase);
  const tail = pathTail(url);
  const head = tail[0] || "";
  const sub = tail[1] || "";

  try {
    if (req.method === "GET" && (head === "places" || head === "")) {
      if (head === "" || head === "health") {
        return json({
          ok: true,
          service: "oleole",
          agent: "john",
          places_seed: PLACES_SEED.length,
          locales: ["fr", "en"],
        });
      }
      const places = await store.listPlaces(url.searchParams.get("q"), 100);
      return json({
        places,
        provenance: "oleole_places|seed",
        disclaimer: "open data + internal ids",
      });
    }

    if (req.method === "GET" && head === "presence" && sub === "me") {
      const actor = await resolveActor(req, supabase);
      if (actor.error) return json({ error: actor.error }, actor.status);
      const state = await store.getMyState(actor.subject_ref);
      return new Response(JSON.stringify(ownState(state)), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...actor.headers,
        },
      });
    }

    if (req.method === "GET" && head === "presence") {
      const locale = localeFrom(req, {}, url);
      const windowKey = url.searchParams.get("window") || "now";
      const aggregates = await store.getAggregates(windowKey, locale);
      return json(aggregates);
    }

    if (req.method === "POST" && head === "presence" && sub === "revoke") {
      const body = await req.json().catch(() => ({}));
      const actor = await resolveActor(req, supabase);
      if (actor.error) return json({ error: actor.error }, actor.status);
      if (body.all) {
        await store.revokeAllForSubject(actor.subject_ref);
        return new Response(JSON.stringify({ ok: true, revoked: "all" }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...actor.headers,
          },
        });
      }
      if (!body.claim_id) return json({ ok: false, errors: ["claim_id_required"] }, 400);
      const result = await store.revokeClaim(body.claim_id, actor.subject_ref);
      return new Response(
        JSON.stringify(result.ok ? { ...result, claim: withoutSubject(result.claim) } : result),
        {
          status: result.ok ? 200 : 404,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...actor.headers,
          },
        }
      );
    }

    if (req.method === "POST" && head === "presence") {
      const body = await req.json().catch(() => ({}));
      const actor = await resolveActor(req, supabase);
      if (actor.error) return json({ error: actor.error }, actor.status);
      const { subject_ref: _subjectRef, ...claimInput } = body;
      const result = await store.declareClaim({ ...claimInput, subject_ref: actor.subject_ref });
      const safe = result.ok ? { ...result, claim: withoutSubject(result.claim) } : result;
      return new Response(JSON.stringify(safe), {
        status: result.ok ? 201 : 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...actor.headers,
        },
      });
    }

    if (req.method === "GET" && head === "policy") {
      const actor = await resolveActor(req, supabase);
      if (actor.error) return json({ error: actor.error }, actor.status);
      const policy = await store.getPolicy(actor.subject_ref);
      return new Response(JSON.stringify({ policy: withoutSubject(policy) }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...actor.headers,
        },
      });
    }

    if (req.method === "POST" && head === "policy") {
      const body = await req.json().catch(() => ({}));
      const actor = await resolveActor(req, supabase);
      if (actor.error) return json({ error: actor.error }, actor.status);
      const { subject_ref: _subjectRef, ...policyInput } = body;
      const result = await store.setPolicy({ ...policyInput, subject_ref: actor.subject_ref });
      return new Response(JSON.stringify({ ...result, policy: withoutSubject(result.policy) }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...actor.headers,
        },
      });
    }

    if (req.method === "POST" && head === "parse") {
      const body = await req.json().catch(() => ({}));
      const locale = localeFrom(req, body, url);
      const places = await store.getPlaces();
      const parsed = parsePresenceUtterance(
        body.text || body.message || "",
        places,
        new Date(),
        locale
      );
      return json(parsed);
    }

    if (req.method === "POST" && head === "chat") {
      const body = await req.json().catch(() => ({}));
      const actor = await resolveActor(req, supabase);
      if (actor.error) return json({ error: actor.error }, actor.status);
      const locale = localeFrom(req, body, url);
      const message = String(body.message || body.text || "").trim();
      const places = await store.getPlaces();
      const windowKey = body.window || body.context?.window || "now";
      const aggregates = await store.getAggregates(windowKey, locale);
      const reply = await johnTurn({
        message,
        subject: actor.subject_ref,
        places,
        aggregates,
        store,
        windowKey,
        locale,
      });
      if (reply.claim) reply.claim = withoutSubject(reply.claim);
      return new Response(JSON.stringify(reply), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...actor.headers,
        },
      });
    }

    return json({ error: "not_found", path: tail }, 404);
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
};

/**
 * Deterministic John service turn — FR + EN intent detection and replies.
 */
async function johnTurn({ message, subject, places, aggregates, store, windowKey, locale }) {
  const t = createTranslator(locale);
  const lower = message.toLowerCase();

  // Confirmation of a prior proposal (FR + EN)
  if (/^(confirm(e|er)?|oui|ok|yes|yep)\b/.test(lower) && message.includes("place:")) {
    const placeId = message.match(/place:[a-z0-9-]+/i)?.[0];
    if (placeId) {
      const result = await store.declareClaim({
        subject_ref: subject,
        place_ref: placeId,
        modality: /demain|futur|intended|tomorrow|future/.test(lower) ? "intended" : "declared",
        source: "john_confirmed",
        visibility: "aggregate",
      });
      return {
        role: "john",
        service: "oleole",
        locale: normalizeLocale(locale),
        message: result.ok
          ? t("john.api.confirmed", { place: placeId })
          : t("john.api.failed", { errors: (result.errors || []).join(", ") }),
        claim: result.claim || null,
        map: { window: windowKey, focus_place: placeId },
      };
    }
  }

  // Where is it lively?
  if (
    /où ça bouge|ou ca bouge|où ca bouge|bouge ce soir|animé|anime|where.?s lively|whats happening|what's happening|where is it busy|lively tonight|buzz/.test(
      lower
    )
  ) {
    const top = aggregates.aggregates.slice(0, 5);
    const windowLabel =
      aggregates.window?.label ||
      resolveTimeWindow(windowKey, new Date(), locale).label ||
      windowKey;
    if (top.length === 0) {
      return {
        role: "john",
        service: "oleole",
        locale: normalizeLocale(locale),
        message: t("john.api.emptyWindow", { window: windowLabel }),
        map: { window: windowKey },
        aggregates,
      };
    }
    const lines = top.map((a) => {
      let line = t("john.api.aggLine", { place: a.place_name, count: a.count });
      if (a.intents.social || a.intents.oleole || a.intents.discovery) {
        const list = [
          a.intents.discovery ? t("map.intent.discovery") : null,
          a.intents.social ? t("map.intent.social") : null,
          a.intents.oleole ? t("map.intent.oleole") : null,
        ]
          .filter(Boolean)
          .join(", ");
        line += t("john.api.aggIntents", { list });
      }
      return line;
    });
    return {
      role: "john",
      service: "oleole",
      locale: normalizeLocale(locale),
      message: t("john.api.aggHeader", { window: windowLabel, lines: lines.join("\n") }),
      map: { window: windowKey, focus_place: top[0]?.place_ref },
      aggregates,
    };
  }

  // Presence declaration NL (FR + EN)
  if (
    /je (suis|serai|vais)|présence|declare|déclar|i am |i'm |im |i will be|i'll be|presence/.test(
      lower
    )
  ) {
    const parsed = parsePresenceUtterance(message, places, new Date(), locale);
    if (parsed.ok) {
      return {
        role: "john",
        service: "oleole",
        locale: normalizeLocale(locale),
        message:
          parsed.message +
          t("john.api.confirmHint", {
            place: parsed.proposal.place_ref,
            future: parsed.proposal.modality === "intended" ? t("john.api.confirmFuture") : "",
          }),
        proposal: parsed.proposal,
        requires_confirmation: true,
        map: { window: windowKey, focus_place: parsed.proposal.place_ref },
      };
    }
    return {
      role: "john",
      service: "oleole",
      locale: normalizeLocale(locale),
      message: parsed.message,
      proposal: parsed.proposal,
      requires_confirmation: true,
    };
  }

  // Quiet / discovery
  if (
    /calme|tranquille|découvr|decouvr|intéressant|interessant|quoi faire|quiet|calm|discover|interesting|something to do/.test(
      lower
    )
  ) {
    const quiet = places
      .filter((p) => p.classification === "municipality")
      .filter((p) => !aggregates.aggregates.some((a) => a.place_ref === p.id && a.count > 3))
      .slice(0, 5);
    return {
      role: "john",
      service: "oleole",
      locale: normalizeLocale(locale),
      message: t("john.api.quiet", {
        lines: quiet.map((p) => `• ${p.name}`).join("\n"),
      }),
      map: { window: windowKey, focus_place: quiet[0]?.id },
    };
  }

  // Default help
  return {
    role: "john",
    service: "oleole",
    locale: normalizeLocale(locale),
    message: t("john.api.help"),
    map: { window: windowKey },
    aggregates: {
      count: aggregates.aggregates.length,
      disclaimerKey: aggregates.disclaimerKey,
      disclaimer: aggregates.disclaimer,
    },
  };
}
