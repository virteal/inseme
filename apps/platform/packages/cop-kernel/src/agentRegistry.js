// File: packages/cop-kernel/src/agentRegistry.js
// Description: Distributed COP agent registry (resolveAgent + registerAgent) backed by Supabase (cop_agents table).

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let supabase = null;
const agentCache = new Map();

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

function makeKey(networkId, nodeId, instanceId, agentName) {
  return networkId + ":" + nodeId + ":" + instanceId + ":" + agentName;
}

/**
 * Resolve an agent by (networkId,nodeId,instanceId,agentName).
 * Returns null if not found or inactive.
 */
export async function resolveAgent(networkId, nodeId, instanceId, agentName) {
  const key = makeKey(networkId, nodeId, instanceId, agentName);
  if (agentCache.has(key)) return agentCache.get(key);

  const sb = getSupabase();
  const { data, error } = await sb
    .from("cop_agents")
    .select("*")
    .eq("network_id", networkId)
    .eq("node_id", nodeId)
    .eq("instance_id", instanceId)
    .eq("agent_name", agentName)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error("resolveAgent DB error: " + error.message);
  }
  if (!data) return null;

  const agent = {
    networkId: data.network_id,
    nodeId: data.node_id,
    instanceId: data.instance_id,
    agentName: data.agent_name,
    handlerType: data.handler_type,
    handlerPath: data.handler_path,
    intents: data.intents || [],
    active: data.active,
    metadata: data.metadata || {},
  };

  agentCache.set(key, agent);
  return agent;
}

/**
 * Register or update an agent definition in cop_agents.
 * Returns the canonical agent object as stored in DB and cached.
 */
export async function registerAgent(def) {
  const sb = getSupabase();

  const payload = {
    network_id: def.networkId,
    node_id: def.nodeId,
    instance_id: def.instanceId,
    agent_name: def.agentName,
    handler_type: def.handlerType || "runtime",
    handler_path: def.handlerPath || null,
    intents: def.intents || [],
    active: def.active !== false,
    metadata: def.metadata || {},
  };

  const { data, error } = await sb
    .from("cop_agents")
    .upsert(payload, {
      onConflict: "network_id,node_id,instance_id,agent_name",
    })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error("registerAgent DB error: " + error.message);
  }

  const agent = {
    networkId: data.network_id,
    nodeId: data.node_id,
    instanceId: data.instance_id,
    agentName: data.agent_name,
    handlerType: data.handler_type,
    handlerPath: data.handler_path,
    intents: data.intents || [],
    active: data.active,
    metadata: data.metadata || {},
  };

  const key = makeKey(agent.networkId, agent.nodeId, agent.instanceId, agent.agentName);
  agentCache.set(key, agent);

  return agent;
}
