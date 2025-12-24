// File: packages/cop-kernel/src/agentIdentity.js
// Description:
//   Helpers to manage COP agent identities ("état civil" des agents)
//   backed by the cop_agent_identities table.
//
//   Prérequis SQL (que vous créez déjà côté DB) :
//
//   create table public.cop_agent_identities (
//     agent_id uuid primary key default gen_random_uuid(),
//
//     agent_name text not null,
//     agent_class text not null,
//     description text,
//
//     owner_human_id uuid,
//     owner_group_id uuid,
//     operator_id uuid,
//
//     domains jsonb not null default '[]',
//     permissions jsonb not null default '{}',
//     constraints jsonb not null default '{}',
//     issued_by text,
//     valid_until timestamptz,
//
//     profile jsonb not null default '{}',
//
//     status text not null default 'active',
//
//     metadata jsonb not null default '{}',
//
//     created_at timestamptz not null default now(),
//     updated_at timestamptz not null default now()
//   );
//
//   create index if not exists idx_cop_agent_identities_name
//     on public.cop_agent_identities (agent_name);
//
//   create index if not exists idx_cop_agent_identities_status
//     on public.cop_agent_identities (status);
//

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let supabaseIdentity = null;

function getSupabaseIdentity() {
  if (!supabaseIdentity) {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE");
    if (!url || !key) {
      throw new Error("agentIdentity: SUPABASE_URL or SUPABASE_SERVICE_ROLE not set");
    }
    supabaseIdentity = createClient(url, key);
  }
  return supabaseIdentity;
}

/**
 * Upsert an agent identity in cop_agent_identities.
 *
 * If agent_id is provided, we upsert on agent_id.
 * Otherwise we use agent_name as a natural key (assuming uniqueness).
 *
 * @param {Object} params
 * @param {string} [params.agent_id]
 * @param {string} params.agent_name
 * @param {string} params.agent_class
 * @param {string} [params.description]
 *
 * @param {string} [params.owner_human_id]
 * @param {string} [params.owner_group_id]
 * @param {string} [params.operator_id]
 *
 * @param {Array}  [params.domains]
 * @param {Object} [params.permissions]
 * @param {Object} [params.constraints]
 * @param {string} [params.issued_by]
 * @param {string} [params.valid_until] // ISO timestamptz
 *
 * @param {Object} [params.profile]
 * @param {string} [params.status]      // active | suspended | revoked | expired
 * @param {Object} [params.metadata]
 *
 * @returns {Promise<{identity: object|null, ok: boolean, error?: string}>}
 */
export async function upsertAgentIdentity(params) {
  const {
    agent_id,
    agent_name,
    agent_class,
    description,

    owner_human_id,
    owner_group_id,
    operator_id,

    domains,
    permissions,
    constraints,
    issued_by,
    valid_until,

    profile,
    status,
    metadata,
  } = params || {};

  if (!agent_name) {
    throw new Error("upsertAgentIdentity: 'agent_name' is required");
  }
  if (!agent_class) {
    throw new Error("upsertAgentIdentity: 'agent_class' is required");
  }

  const sb = getSupabaseIdentity();

  const row = {
    agent_name,
    agent_class,
    description: description ?? null,
    owner_human_id: owner_human_id ?? null,
    owner_group_id: owner_group_id ?? null,
    operator_id: operator_id ?? null,
    domains: Array.isArray(domains) ? domains : undefined,
    permissions: permissions ?? undefined,
    constraints: constraints ?? undefined,
    issued_by: issued_by ?? null,
    valid_until: valid_until ?? null,
    profile: profile ?? undefined,
    status: status ?? undefined,
    metadata: metadata ?? undefined,
  };

  // Nettoyage: on retire les undefined pour ne pas écraser inutilement
  Object.keys(row).forEach((k) => {
    if (row[k] === undefined) {
      delete row[k];
    }
  });

  let query = sb.from("cop_agent_identities");

  if (agent_id) {
    // upsert sur agent_id
    row.agent_id = agent_id;
    query = query.upsert(row, { onConflict: "agent_id" });
  } else {
    // upsert sur agent_name (en supposant une contrainte unique côté DB si souhaitée)
    query = query.upsert(row, { onConflict: "agent_name" });
  }

  const { data, error } = await query.select().maybeSingle();
  if (error) {
    return {
      identity: null,
      ok: false,
      error: "upsertAgentIdentity: " + error.message,
    };
  }

  return {
    identity: data,
    ok: true,
  };
}

/**
 * Get a single agent identity by agent_id.
 *
 * @param {string} agent_id
 */
export async function getAgentIdentityById(agent_id) {
  if (!agent_id) {
    throw new Error("getAgentIdentityById: 'agent_id' is required");
  }
  const sb = getSupabaseIdentity();
  const { data, error } = await sb
    .from("cop_agent_identities")
    .select("*")
    .eq("agent_id", agent_id)
    .maybeSingle();

  if (error) {
    return { identity: null, ok: false, error: error.message };
  }
  return { identity: data, ok: true };
}

/**
 * Get a single agent identity by agent_name.
 *
 * @param {string} agent_name
 */
export async function getAgentIdentityByName(agent_name) {
  if (!agent_name) {
    throw new Error("getAgentIdentityByName: 'agent_name' is required");
  }
  const sb = getSupabaseIdentity();
  const { data, error } = await sb
    .from("cop_agent_identities")
    .select("*")
    .eq("agent_name", agent_name)
    .maybeSingle();

  if (error) {
    return { identity: null, ok: false, error: error.message };
  }
  return { identity: data, ok: true };
}

/**
 * List agent identities, optionally filtered by status.
 *
 * @param {Object} params
 * @param {string} [params.status] - filter by status
 * @param {number} [params.limit=100]
 */
export async function listAgentIdentities(params = {}) {
  const { status, limit = 100 } = params;
  const sb = getSupabaseIdentity();

  let query = sb
    .from("cop_agent_identities")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return { identities: [], ok: false, error: error.message };
  }
  return { identities: data || [], ok: true };
}

/**
 * Update status of an agent identity.
 *
 * @param {string} agent_id
 * @param {string} status - active | suspended | revoked | expired
 */
export async function updateAgentIdentityStatus(agent_id, status) {
  if (!agent_id) {
    throw new Error("updateAgentIdentityStatus: 'agent_id' is required");
  }
  if (!status) {
    throw new Error("updateAgentIdentityStatus: 'status' is required");
  }

  const sb = getSupabaseIdentity();
  const { data, error } = await sb
    .from("cop_agent_identities")
    .update({ status })
    .eq("agent_id", agent_id)
    .select()
    .maybeSingle();

  if (error) {
    return { identity: null, ok: false, error: error.message };
  }
  return { identity: data, ok: true };
}

/**
 * Minimal mandate / permission check for an agent identity.
 *
 * Very simple for now:
 *  - identity must exist
 *  - status must be 'active'
 *  - valid_until must be null or in the future
 *  - if domain is provided, it must be in domains[]
 *  - if permissionKey is provided, permissions[permissionKey] must be truthy
 *
 * @param {Object} params
 * @param {object} [params.identity]      - optional, if already loaded
 * @param {string} [params.agent_id]      - or agent_id to load it
 * @param {string} [params.agent_name]    - or agent_name to load it
 * @param {string} [params.domain]
 * @param {string} [params.permissionKey] - e.g. 'write_artifacts'
 *
 * @returns {Promise<{allowed: boolean, reason?: string, identity?: object}>}
 */
export async function validateAgentMandate(params) {
  const { identity: givenIdentity, agent_id, agent_name, domain, permissionKey } = params || {};

  let identity = givenIdentity || null;

  try {
    if (!identity) {
      if (agent_id) {
        const res = await getAgentIdentityById(agent_id);
        if (!res.ok) {
          return { allowed: false, reason: "identity_load_error: " + res.error };
        }
        identity = res.identity;
      } else if (agent_name) {
        const res = await getAgentIdentityByName(agent_name);
        if (!res.ok) {
          return { allowed: false, reason: "identity_load_error: " + res.error };
        }
        identity = res.identity;
      } else {
        return {
          allowed: false,
          reason: "validateAgentMandate: no identity, agent_id or agent_name provided",
        };
      }
    }

    if (!identity) {
      return { allowed: false, reason: "identity_not_found" };
    }

    if (identity.status !== "active") {
      return { allowed: false, reason: "identity_not_active" };
    }

    if (identity.valid_until) {
      const now = new Date();
      const vu = new Date(identity.valid_until);
      if (vu.getTime() < now.getTime()) {
        return { allowed: false, reason: "mandate_expired" };
      }
    }

    if (domain) {
      const domains = Array.isArray(identity.domains) ? identity.domains : [];
      if (!domains.includes(domain)) {
        return { allowed: false, reason: "domain_not_authorized" };
      }
    }

    if (permissionKey) {
      const perms =
        identity.permissions && typeof identity.permissions === "object"
          ? identity.permissions
          : {};
      if (!perms[permissionKey]) {
        return { allowed: false, reason: "permission_denied:" + permissionKey };
      }
    }

    return { allowed: true, identity };
  } catch (err) {
    return {
      allowed: false,
      reason: "validate_error: " + (err && err.message),
    };
  }
}
