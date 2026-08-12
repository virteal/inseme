/**
 * Early-proto client Presence store (localStorage).
 * Used when /api/oleole is unavailable so the public surface still demonstrates
 * declare / aggregate / revoke / John NL without a durable backend.
 */

import {
  aggregatePresence,
  parsePresenceUtterance,
  resolveTimeWindow,
  normalizePresenceClaim,
} from "./presence-core.js";
import { PLACES_SEED, searchPlaces } from "./places-seed.js";
import { createTranslator, normalizeLocale } from "../i18n/i18n.js";

const STORAGE_CLAIMS = "oleole.local_claims";

function loadClaims() {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_CLAIMS) || "[]");
  } catch {
    return [];
  }
}

function saveClaims(claims) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_CLAIMS, JSON.stringify(claims));
}

export function localListPlaces(query) {
  return searchPlaces(query || "", PLACES_SEED, 100);
}

export function localGetAggregates(windowKey = "now", locale = "fr") {
  const window = resolveTimeWindow(windowKey, new Date(), locale);
  const agg = aggregatePresence(loadClaims(), window, PLACES_SEED);
  const t = createTranslator(locale);
  agg.disclaimer = t(agg.disclaimerKey || "disclaimer.banner");
  if (agg.window?.labelKey) agg.window.label = t(agg.window.labelKey);
  agg.storage = "local";
  return agg;
}

export function localDeclareClaim(input) {
  const { ok, errors, claim } = normalizePresenceClaim(input, PLACES_SEED);
  if (!ok) return { ok: false, errors };
  const claims = loadClaims().filter((c) => c.id !== claim.id);
  claims.push(claim);
  saveClaims(claims);
  return { ok: true, claim, storage: "local" };
}

export function localRevokeAll(subjectRef) {
  const now = new Date().toISOString();
  const claims = loadClaims().map((c) =>
    c.subject_ref === subjectRef && !c.revoked_at ? { ...c, revoked_at: now } : c
  );
  saveClaims(claims);
  return { ok: true, revoked: "all", storage: "local" };
}

/**
 * Client-side John turn (mirrors edge API intent detection for early proto).
 */
export function localJohnTurn({ message, subject, windowKey = "now", locale = "fr" }) {
  const lang = normalizeLocale(locale);
  const t = createTranslator(lang);
  const lower = String(message || "").toLowerCase();
  const aggregates = localGetAggregates(windowKey, lang);
  const places = PLACES_SEED;

  if (/^(confirm(e|er)?|oui|ok|yes|yep)\b/.test(lower) && message.includes("place:")) {
    const placeId = message.match(/place:[a-z0-9-]+/i)?.[0];
    if (placeId) {
      const result = localDeclareClaim({
        subject_ref: subject,
        place_ref: placeId,
        modality: /demain|futur|intended|tomorrow|future/.test(lower) ? "intended" : "declared",
        source: "john_local_confirmed",
        visibility: "aggregate",
      });
      return {
        role: "john",
        service: "oleole",
        locale: lang,
        message: result.ok
          ? t("john.api.confirmed", { place: placeId })
          : t("john.api.failed", { errors: (result.errors || []).join(", ") }),
        claim: result.claim || null,
        map: { window: windowKey, focus_place: placeId },
        storage: "local",
      };
    }
  }

  if (
    /où ça bouge|ou ca bouge|bouge ce soir|animé|anime|where.?s lively|whats happening|what's happening|where is it busy|lively tonight|buzz/.test(
      lower
    )
  ) {
    const top = aggregates.aggregates.slice(0, 5);
    const windowLabel = aggregates.window?.label || windowKey;
    if (!top.length) {
      return {
        role: "john",
        service: "oleole",
        locale: lang,
        message: t("john.api.emptyWindow", { window: windowLabel }),
        map: { window: windowKey },
        aggregates,
        storage: "local",
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
      locale: lang,
      message: t("john.api.aggHeader", { window: windowLabel, lines: lines.join("\n") }),
      map: { window: windowKey, focus_place: top[0]?.place_ref },
      aggregates,
      storage: "local",
    };
  }

  if (
    /je (suis|serai|vais)|présence|declare|déclar|i am |i'm |im |i will be|i'll be|presence/.test(
      lower
    )
  ) {
    const parsed = parsePresenceUtterance(message, places, new Date(), lang);
    if (parsed.ok) {
      return {
        role: "john",
        service: "oleole",
        locale: lang,
        message:
          parsed.message +
          t("john.api.confirmHint", {
            place: parsed.proposal.place_ref,
            future: parsed.proposal.modality === "intended" ? t("john.api.confirmFuture") : "",
          }),
        proposal: parsed.proposal,
        requires_confirmation: true,
        map: { window: windowKey, focus_place: parsed.proposal.place_ref },
        storage: "local",
      };
    }
    return {
      role: "john",
      service: "oleole",
      locale: lang,
      message: parsed.message,
      proposal: parsed.proposal,
      requires_confirmation: true,
      storage: "local",
    };
  }

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
      locale: lang,
      message: t("john.api.quiet", { lines: quiet.map((p) => `• ${p.name}`).join("\n") }),
      map: { window: windowKey, focus_place: quiet[0]?.id },
      storage: "local",
    };
  }

  return {
    role: "john",
    service: "oleole",
    locale: lang,
    message: t("john.api.help"),
    map: { window: windowKey },
    aggregates: { count: aggregates.aggregates.length, disclaimer: aggregates.disclaimer },
    storage: "local",
  };
}
