// File: packages/cop-kernel/src/handlerRegistry.js
// Description: Distributed COP handler registry (resolveHandler + registerHandler) backed by Supabase (cop_handlers table).

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let supabase = null;
const handlerCache = new Map();

function getSupabase() {
  if (!supabase) {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE");
    if (!url || !key) {
      throw new Error("getSupabase: SUPABASE_URL or SUPABASE_SERVICE_ROLE not set");
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

function makeKey(networkId, nodeId, instanceId, handlerName) {
  return networkId + ":" + nodeId + ":" + instanceId + ":" + handlerName;
}

/**
 * Resolve a handler by (networkId,nodeId,instanceId,handlerName).
 * Returns null if not found or inactive.
 */
export async function resolveHandler(networkId, nodeId, instanceId, handlerName) {
  const key = makeKey(networkId, nodeId, instanceId, handlerName);
  if (handlerCache.has(key)) return handlerCache.get(key);

  const sb = getSupabase();
  const { data, error } = await sb
    .from("cop_handlers")
    .select("*")
    .eq("network_id", networkId)
    .eq("node_id", nodeId)
    .eq("instance_id", instanceId)
    .eq("handler_name", handlerName)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error("resolveHandler DB error: " + error.message);
  }
  if (!data) return null;

  const handler = {
    networkId: data.network_id,
    nodeId: data.node_id,
    instanceId: data.instance_id,
    handlerName: data.handler_name,
    handlerType: data.handler_type,
    handlerPath: data.handler_path,
    intents: data.intents || [],
    active: data.active,
    metadata: data.metadata || {},
  };

  handlerCache.set(key, handler);
  return handler;
}

/**
 * Register or update a handler definition in cop_handlers.
 * Returns the canonical handler object as stored in DB and cached.
 */
export async function registerHandler(def) {
  const sb = getSupabase();

  const payload = {
    network_id: def.networkId,
    node_id: def.nodeId,
    instance_id: def.instanceId,
    handler_name: def.handlerName,
    handler_type: def.handlerType || "runtime",
    handler_path: def.handlerPath || null,
    intents: def.intents || [],
    active: def.active !== false,
    metadata: def.metadata || {},
  };

  const { data, error } = await sb
    .from("cop_handlers")
    .upsert(payload, {
      onConflict: "network_id,node_id,instance_id,handler_name",
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error("registerHandler DB error: " + error.message);
  }

  const handler = {
    networkId: data.network_id,
    nodeId: data.node_id,
    instanceId: data.instance_id,
    handlerName: data.handler_name,
    handlerType: data.handler_type,
    handlerPath: data.handler_path,
    intents: data.intents || [],
    active: data.active,
    metadata: data.metadata || {},
  };

  const key = makeKey(handler.networkId, handler.nodeId, handler.instanceId, handler.handlerName);
  handlerCache.set(key, handler);

  return handler;
}
