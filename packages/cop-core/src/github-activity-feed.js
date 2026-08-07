/**
 * Private reconstructible activity feed projection from COP events (Inseme #29).
 * Not FractaLog; not a GitHub notification mirror.
 */

import { projectEventForViewer } from "./cop-event-artifacts.js";

/**
 * Build feed items from append-only events (memory store or array).
 *
 * @param {object[]| { replay: Function, listTopic?: Function }} source
 * @param {object} [opts]
 * @param {string} [opts.viewer_clearance=restricted]
 * @param {number} [opts.limit=50]
 * @param {string[]} [opts.kinds] filter activity_kind
 * @param {string} [opts.repository]
 */
export function buildActivityFeed(source, opts = {}) {
  const events = Array.isArray(source)
    ? source
    : typeof source.replay === "function"
      ? source.replay()
      : [];

  const clearance = opts.viewer_clearance || "restricted";
  const limit = opts.limit ?? 50;
  const kinds = opts.kinds || null;
  const repoFilter = opts.repository || null;

  const items = [];
  // newest first
  const ordered = [...events].sort((a, b) => {
    const ta = a.time?.recorded_at || a.meta?.mapped_at || "";
    const tb = b.time?.recorded_at || b.meta?.mapped_at || "";
    return tb.localeCompare(ta);
  });

  for (const event of ordered) {
    const projected = projectEventForViewer(event, {
      viewer_clearance: clearance,
    });
    if (!projected.visibility_allowed && clearance !== "sealed") {
      // still show existence line for restricted viewers when they have restricted clearance
    }

    const payload = projected.payload || event.payload || {};
    const kind = payload.activity_kind || "observation";
    if (kinds && !kinds.includes(kind)) continue;
    if (repoFilter && payload.repository !== repoFilter) continue;

    const item = {
      schema: "cop.activity-feed.item.v1",
      event_id: event.event_id || event.id,
      delivery_id: event.meta?.delivery_id || null,
      origin_ref: event.origin_ref,
      topic_id: event.topic?.id || event.topic_id,
      topic_seq: event.topic?.seq || event.topic_seq,
      recorded_at: event.time?.recorded_at || event.meta?.mapped_at,
      activity_kind: kind,
      summary: payload.summary || projected.payload?.summary || "(redacted)",
      repository: payload.repository || null,
      repository_role: payload.repository_role || null,
      github_event: payload.github_event || null,
      action: payload.action || null,
      epistemic_status: event.epistemic_status,
      attribution: payload.attribution || {
        legal_actor_resolved: false,
      },
      payload_redacted: Boolean(projected.payload_redacted),
      correlation: payload.details?.correlation || null,
    };

    items.push(item);
    if (items.length >= limit) break;
  }

  // Group consecutive same correlation (PR/issue threads)
  const grouped = groupByCorrelation(items);

  return {
    schema: "cop.activity-feed.v1",
    generated_at: new Date().toISOString(),
    viewer_clearance: clearance,
    count: grouped.length,
    items: grouped,
    notes: [
      "GitHub login is not legal Principal without explicit mandate mapping (#30).",
      "This feed is a rebuildable projection over append-only COP events.",
      "Not a FractaLog replacement.",
    ],
  };
}

function groupByCorrelation(items) {
  const out = [];
  let current = null;
  for (const item of items) {
    if (item.correlation && current && current.correlation === item.correlation) {
      current.related.push(item);
      current.summary = `${item.summary} (+${current.related.length} related)`;
      continue;
    }
    current = { ...item, related: [] };
    out.push(current);
  }
  return out;
}

/**
 * Human-readable one-liner for UI/logs (no secrets).
 */
export function formatActivityLine(item) {
  const kind = item.activity_kind || "observation";
  const repo = item.repository || "—";
  return `[${kind}] ${item.summary} (${repo})`;
}
