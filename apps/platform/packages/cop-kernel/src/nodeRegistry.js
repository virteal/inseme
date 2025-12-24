// File: packages/cop-kernel/src/nodeRegistry.js
// Description: Distributed CopNode registry (self-registration + resolveNode) backed by Supabase (cop_nodes table).

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let supabase = null;
let localNodeInfo = null;
const resolveCache = new Map();

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

export function getLocalNodeConfig() {
  return {
    networkId: getEnv("COP_NETWORK_ID"),
    nodeId: getEnv("COP_NODE_ID"),
    baseUrl: getEnv("COP_BASE_URL"),

    copPath: getEnv("COP_COP_PATH") || "/cop",
    eventsPath: getEnv("COP_EVENTS_PATH") || "/cop-events",
    streamPath: getEnv("COP_STREAM_PATH") || "/cop-stream",

    metadata: {},
  };
}

/**
 * Ensure the current node is registered in cop_nodes.
 * Returns the canonical node info as stored in DB.
 */
export async function ensureLocalNodeRegistered() {
  if (localNodeInfo) return localNodeInfo;

  const cfg = getLocalNodeConfig();
  const sb = getSupabase();

  if (!cfg.networkId || !cfg.nodeId || !cfg.baseUrl) {
    throw new Error(
      "ensureLocalNodeRegistered: COP_NETWORK_ID, COP_NODE_ID or COP_BASE_URL not set"
    );
  }

  const payload = {
    network_id: cfg.networkId,
    node_id: cfg.nodeId,
    base_url: cfg.baseUrl,
    cop_path: cfg.copPath,
    events_path: cfg.eventsPath,
    stream_path: cfg.streamPath,
    metadata: cfg.metadata,
  };

  const { data, error } = await sb
    .from("cop_nodes")
    .upsert(payload, { onConflict: "network_id,node_id" })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error("ensureLocalNodeRegistered DB error: " + error.message);
  }

  localNodeInfo = {
    networkId: data.network_id,
    nodeId: data.node_id,
    baseUrl: data.base_url,
    copPath: data.cop_path,
    eventsPath: data.events_path,
    streamPath: data.stream_path,
    metadata: data.metadata || {},
  };

  const key = makeKey(localNodeInfo.networkId, localNodeInfo.nodeId);
  resolveCache.set(key, localNodeInfo);

  return localNodeInfo;
}

function makeKey(networkId, nodeId) {
  return networkId + ":" + nodeId;
}

/**
 * Resolve a (networkId,nodeId) pair to node info using cop_nodes.
 * Uses local cache and Supabase.
 */
export async function resolveNode(networkId, nodeId) {
  const local = getLocalNodeConfig();
  if (networkId === local.networkId && nodeId === local.nodeId) {
    return ensureLocalNodeRegistered();
  }

  const key = makeKey(networkId, nodeId);
  if (resolveCache.has(key)) return resolveCache.get(key);

  const sb = getSupabase();
  const { data, error } = await sb
    .from("cop_nodes")
    .select("*")
    .eq("network_id", networkId)
    .eq("node_id", nodeId)
    .maybeSingle();

  if (error) {
    throw new Error("resolveNode DB error: " + error.message);
  }
  if (!data) {
    throw new Error("resolveNode: unknown CopNode: " + networkId + "/" + nodeId);
  }

  const nodeInfo = {
    networkId: data.network_id,
    nodeId: data.node_id,
    baseUrl: data.base_url,
    copPath: data.cop_path,
    eventsPath: data.events_path,
    streamPath: data.stream_path,
    metadata: data.metadata || {},
  };

  resolveCache.set(key, nodeInfo);
  return nodeInfo;
}
