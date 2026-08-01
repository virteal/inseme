// File: packages/cop-kernel/src/logicalAgentIdentity.js
// Description:
//   Helpers to manage COP LogicalAgent identities ("état civil" des handlers)
//   backed by the cop_logical_agents table.
//
//   Prérequis SQL (que vous créez déjà côté DB) :
//
//   create table public.cop_logical_agents (
//     logical_agent_id uuid primary key default gen_random_uuid(),
//
//     logical_agent_name text not null,
//     logical_agent_class text not null,
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
//   create index if not exists idx_cop_logical_agents_name
//     on public.cop_logical_agents (logical_agent_name);
//
//   create index if not exists idx_cop_logical_agents_status
//     on public.cop_logical_agents (status);
//

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let supabaseIdentity = null;

function getSupabaseIdentity() {
  if (!supabaseIdentity) {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE");
    if (!url || !key) {
      throw new Error("logicalAgentIdentity: SUPABASE_URL or SUPABASE_SERVICE_ROLE not set");
    }
    supabaseIdentity = createClient(url, key);
  }
  return supabaseIdentity;
}

/**
 * Upsert a LogicalAgent identity in cop_logical_agents.
 *
 * If logical_agent_id is provided, we upsert on logical_agent_id.
 * Otherwise we use logical_agent_name as a natural key (assuming uniqueness).
 *
 * @param {Object} params
 * @param {string} [params.logical_agent_id]
 * @param {string} params.logical_agent_name
 * @param {string} params.logical_agent_class
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
export async function upsertLogicalAgentIdentity(params) {
  const {
    logical_agent_id,
    logical_agent_name,
    logical_agent_class,
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

  if (!logical_agent_name) {
    throw new Error("upsertLogicalAgentIdentity: 'logical_agent_name' is required");
  }
  if (!logical_agent_class) {
    throw new Error("upsertLogicalAgentIdentity: 'logical_agent_class' is required");
  }

  const sb = getSupabaseIdentity();

  const row = {
    logical_agent_name,
    logical_agent_class,
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

  let query = sb.from("cop_logical_agents");

  if (logical_agent_id) {
    // upsert sur logical_agent_id
    row.logical_agent_id = logical_agent_id;
    query = query.upsert(row, { onConflict: "logical_agent_id" });
  } else {
    // upsert sur logical_agent_name (en supposant une contrainte unique côté DB si souhaitée)
    query = query.upsert(row, { onConflict: "logical_agent_name" });
  }

  const { data, error } = await query.select().maybeSingle();
  if (error) {
    return {
      identity: null,
      ok: false,
      error: "upsertLogicalAgentIdentity: " + error.message,
    };
  }

  return {
    identity: data,
    ok: true,
  };
}

/**
 * Get a single LogicalAgent identity by logical_agent_id.
 *
 * @param {string} logical_agent_id
 */
export async function getLogicalAgentIdentityById(logical_agent_id) {
  if (!logical_agent_id) {
    throw new Error("getLogicalAgentIdentityById: 'logical_agent_id' is required");
  }
  const sb = getSupabaseIdentity();
  const { data, error } = await sb
    .from("cop_logical_agents")
    .select("*")
    .eq("logical_agent_id", logical_agent_id)
    .maybeSingle();

  if (error) {
    return { identity: null, ok: false, error: error.message };
  }
  return { identity: data, ok: true };
}

/**
 * Get a single LogicalAgent identity by logical_agent_name.
 *
 * @param {string} logical_agent_name
 */
export async function getLogicalAgentIdentityByName(logical_agent_name) {
  if (!logical_agent_name) {
    throw new Error("getLogicalAgentIdentityByName: 'logical_agent_name' is required");
  }
  const sb = getSupabaseIdentity();
  const { data, error } = await sb
    .from("cop_logical_agents")
    .select("*")
    .eq("logical_agent_name", logical_agent_name)
    .maybeSingle();

  if (error) {
    return { identity: null, ok: false, error: error.message };
  }
  return { identity: data, ok: true };
}

/**
 * List LogicalAgent identities, optionally filtered by status.
 *
 * @param {Object} params
 * @param {string} [params.status] - filter by status
 * @param {number} [params.limit=100]
 */
export async function listLogicalAgentIdentities(params = {}) {
  const { status, limit = 100 } = params;
  const sb = getSupabaseIdentity();

  let query = sb
    .from("cop_logical_agents")
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
 * Update status of a LogicalAgent identity.
 *
 * @param {string} logical_agent_id
 * @param {string} status - active | suspended | revoked | expired
 */
export async function updateLogicalAgentIdentityStatus(logical_agent_id, status) {
  if (!logical_agent_id) {
    throw new Error("updateLogicalAgentIdentityStatus: 'logical_agent_id' is required");
  }
  if (!status) {
    throw new Error("updateLogicalAgentIdentityStatus: 'status' is required");
  }

  const sb = getSupabaseIdentity();
  const { data, error } = await sb
    .from("cop_logical_agents")
    .update({ status })
    .eq("logical_agent_id", logical_agent_id)
    .select()
    .maybeSingle();

  if (error) {
    return { identity: null, ok: false, error: error.message };
  }
  return { identity: data, ok: true };
}

/**
 * Minimal mandate / permission check for a LogicalAgent identity.
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
 * @param {string} [params.logical_agent_id]      - or logical_agent_id to load it
 * @param {string} [params.logical_agent_name]    - or logical_agent_name to load it
 * @param {string} [params.domain]
 * @param {string} [params.permissionKey] - e.g. 'write_artifacts'
 *
 * @returns {Promise<{allowed: boolean, reason?: string, identity?: object}>}
 */
export async function validateLogicalAgentMandate(params) {
  const { identity: givenIdentity, logical_agent_id, logical_agent_name, domain, permissionKey } = params || {};

  let identity = givenIdentity || null;

  try {
    if (!identity) {
      if (logical_agent_id) {
        const res = await getLogicalAgentIdentityById(logical_agent_id);
        if (!res.ok) {
          return { allowed: false, reason: "identity_load_error: " + res.error };
        }
        identity = res.identity;
      } else if (logical_agent_name) {
        const res = await getLogicalAgentIdentityByName(logical_agent_name);
        if (!res.ok) {
          return { allowed: false, reason: "identity_load_error: " + res.error };
        }
        identity = res.identity;
      } else {
        return {
          allowed: false,
          reason: "validateLogicalAgentMandate: no identity, logical_agent_id or logical_agent_name provided",
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
