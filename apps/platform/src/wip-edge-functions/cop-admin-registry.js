// File: netlify/edge-functions/cop-admin-registry.js
// Description:
//   Edge Function d’admin COP.
//   - GET /cop-admin-registry?resource=nodes
//       → liste des cop_nodes
//   - GET /cop-admin-registry?resource=agents
//       → liste des cop_agents
//   - GET /cop-admin-registry?resource=trace&correlation_id=<uuid>
//       → lignes de cop_debug_logs associées à ce correlation_id, triées chronologiquement.
//
//   À protéger plus tard (auth/IP/etc.) : c’est un endpoint d’admin.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.warn(
    "[cop-admin-registry] SUPABASE_URL or SUPABASE_SERVICE_ROLE not set; this function will fail at runtime."
  );
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;

export default async (request, context) => {
  if (request.method !== "GET") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only GET is allowed");
  }

  if (!supabase) {
    return jsonError(
      500,
      "SUPABASE_NOT_CONFIGURED",
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE not configured",
      null
    );
  }

  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") || "nodes";

  try {
    if (resource === "nodes") {
      return await listNodes();
    }

    if (resource === "agents") {
      return await listAgents();
    }

    if (resource === "trace") {
      const correlationId = url.searchParams.get("correlation_id");
      if (!correlationId) {
        return jsonError(
          400,
          "MISSING_CORRELATION_ID",
          "Query parameter 'correlation_id' is required for resource=trace",
          null
        );
      }
      return await listTrace(correlationId);
    }

    return jsonError(
      400,
      "INVALID_RESOURCE",
      "Unsupported resource; use 'nodes', 'agents' or 'trace'",
      { resource }
    );
  } catch (err) {
    return jsonError(500, "ADMIN_REGISTRY_ERROR", "Unhandled error in cop-admin-registry", {
      detail: String(err && err.message),
    });
  }
};

async function listNodes() {
  const { data, error } = await supabase
    .from("cop_nodes")
    .select("network_id, node_id, base_url, cop_path, events_path, stream_path, metadata")
    .order("network_id", { ascending: true })
    .order("node_id", { ascending: true });

  if (error) {
    return jsonError(500, "DB_QUERY_FAILED", "Failed to query cop_nodes", {
      detail: error.message,
    });
  }

  return jsonOk({
    resource: "nodes",
    count: data.length,
    items: data,
  });
}

async function listAgents() {
  const { data, error } = await supabase
    .from("cop_agents")
    .select("network_id, node_id, instance_id, agent_name, handler_type, active, intents, metadata")
    .order("network_id", { ascending: true })
    .order("node_id", { ascending: true })
    .order("instance_id", { ascending: true })
    .order("agent_name", { ascending: true });

  if (error) {
    return jsonError(500, "DB_QUERY_FAILED", "Failed to query cop_agents", {
      detail: error.message,
    });
  }

  return jsonOk({
    resource: "agents",
    count: data.length,
    items: data,
  });
}

// NOUVEAU : trace par correlation_id
async function listTrace(correlationId) {
  const { data, error } = await supabase
    .from("cop_debug_logs")
    .select(
      "id, correlation_id, message_id, event_id, location, stage, direction, data, created_at"
    )
    .eq("correlation_id", correlationId)
    .order("id", { ascending: true });

  if (error) {
    return jsonError(500, "DB_QUERY_FAILED", "Failed to query cop_debug_logs", {
      detail: error.message,
    });
  }

  return jsonOk({
    resource: "trace",
    correlation_id: correlationId,
    count: data.length,
    items: data,
  });
}

function jsonOk(payload) {
  return new Response(JSON.stringify({ status: "ok", ...payload }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

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
