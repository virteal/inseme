// File: netlify/edge-functions/cop-events.js

import { createClient } from "@supabase/supabase-js";
import { validateCopEvent } from "../../packages/cop-kernel/src/validation.js";
import { logCopDebug } from "../../packages/cop-kernel/src/debugLog.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.warn(
    "[cop-events] SUPABASE_URL or SUPABASE_SERVICE_ROLE not set; this function will fail at runtime."
  );
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;

export default async (request, context) => {
  if (request.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is allowed");
  }

  if (!supabase) {
    return jsonError(
      500,
      "SUPABASE_NOT_CONFIGURED",
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE not configured",
      null
    );
  }

  let ev;
  try {
    ev = await request.json();
  } catch (err) {
    return jsonError(400, "INVALID_JSON", "Request body is not valid JSON", {
      detail: String(err && err.message),
    });
  }

  await logCopDebug({
    correlationId: ev.correlation_id || null,
    eventId: ev.event_id || null,
    location: "cop-events",
    stage: "received",
    direction: "in",
    metadata: { ev },
  });

  try {
    validateCopEvent(ev);
  } catch (err) {
    await logCopDebug({
      correlationId: ev.correlation_id || null,
      eventId: ev.event_id || null,
      location: "cop-events",
      stage: "validation_error",
      direction: "internal",
      metadata: { error: String(err && err.message) },
    });

    return jsonError(400, "INVALID_COP_EVENT", "COP_EVENT validation failed", {
      detail: String(err && err.message),
    });
  }

  const row = {
    cop_version: ev.cop_version,
    event_id: ev.event_id,
    correlation_id: ev.correlation_id || null,
    from_addr: ev.from,
    channel: ev.channel,
    event_type: ev.event_type,
    payload: ev.payload || {},
    metadata: ev.metadata || null,
  };

  const { error } = await supabase.from("cop_events").insert(row);

  if (error) {
    await logCopDebug({
      correlationId: ev.correlation_id || null,
      eventId: ev.event_id || null,
      location: "cop-events",
      stage: "db_insert_error",
      direction: "internal",
      metadata: { error: error.message },
    });

    return jsonError(500, "DB_INSERT_FAILED", "Failed to insert COP_EVENT into cop_events", {
      detail: error.message,
    });
  }

  await logCopDebug({
    correlationId: ev.correlation_id || null,
    eventId: ev.event_id || null,
    location: "cop-events",
    stage: "stored",
    direction: "internal",
    metadata: { channel: ev.channel, event_type: ev.event_type },
  });

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

function jsonError(status, code, message, details) {
  const body = {
    status: "error",
    error: {
      code,
      message,
      details: details || null,
    },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
