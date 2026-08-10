/* global Deno */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const ALLOWED_TYPES = new Set(["conversation.user_message", "conversation.assistant_message"]);

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bearerToken(request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

export default async function jhnCopEvents(request) {
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405);

  const capability = String(Deno.env.get("JHN_COP_CAPABILITY") || "").trim();
  if (!capability) return response({ error: "cop_ingress_unconfigured" }, 503);
  if (bearerToken(request) !== capability)
    return response({ error: "invalid_cop_capability" }, 401);

  let event;
  try {
    event = await request.json();
  } catch {
    return response({ error: "invalid_json" }, 400);
  }
  if (
    typeof event?.topic_id !== "string" ||
    event.topic_id.length === 0 ||
    event.topic_id.length > 200 ||
    !ALLOWED_TYPES.has(event.type) ||
    !event.payload ||
    typeof event.payload !== "object" ||
    Array.isArray(event.payload)
  ) {
    return response({ error: "invalid_cop_event" }, 400);
  }

  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRole = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceRole) return response({ error: "cop_store_unconfigured" }, 503);

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.rpc("cop_event_append", {
    p_topic_id: event.topic_id,
    p_event_type: "cop.event/v1",
    p_actor_id: "agent:jhn-edge",
    p_epistemic_status: "observed",
    p_origin_ref: "jhn:edge-chat",
    p_payload: { kind: event.type, ...event.payload },
    p_meta: { source: "jhn-edge", received_at: new Date().toISOString() },
    p_visibility: "restricted",
  });
  if (error) {
    console.error("JHN COP append failed", { message: error.message });
    return response({ error: "cop_append_failed" }, 502);
  }
  return response({ accepted: true, event_id: data?.event_id || null }, 201);
}

export const config = { path: "/api/jhn-cop-events" };
