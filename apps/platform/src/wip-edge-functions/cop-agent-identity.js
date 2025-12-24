// File: netlify/edge-functions/cop-agent-identity.js
// Description:
//   Netlify Edge Function to expose a minimal API for COP agent identities.
//
//   GET  /cop-agent-identity
//     - list all identities (optionnel: ?status=active)
//   GET  /cop-agent-identity?agent_id=...   -> single identity
//   GET  /cop-agent-identity?agent_name=... -> single identity
//
//   POST /cop-agent-identity
//     Body JSON:
//       {
//         "action": "upsert" | "status",
//         // for "upsert":
//         "agent_id": "...",           // optional
//         "agent_name": "ophelia",
//         "agent_class": "llm",
//         "description": "...",
//         "owner_human_id": "...",
//         "owner_group_id": "...",
//         "operator_id": "...",
//         "domains": ["urbanisme", "budget"],
//         "permissions": { "write_artifacts": true },
//         "constraints": {},
//         "issued_by": "Mairie de Corte",
//         "valid_until": null,
//         "profile": { "tone": "neutral" },
//         "status": "active",
//         "metadata": { "source": "manual_admin" }
//
//       // for "status":
//       {
//         "action": "status",
//         "agent_id": "...",
//         "status": "suspended"
//       }
//

import {
  upsertAgentIdentity,
  getAgentIdentityById,
  getAgentIdentityByName,
  listAgentIdentities,
  updateAgentIdentityStatus,
} from "../../../packages/cop-kernel/src/agentIdentity.js";

export default async function handler(request, context) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  try {
    if (method === "GET") {
      return await handleGet(url);
    }
    if (method === "POST") {
      return await handlePost(request);
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "internal_error",
        detail: err && err.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleGet(url) {
  const agentId = url.searchParams.get("agent_id");
  const agentName = url.searchParams.get("agent_name");
  const status = url.searchParams.get("status");

  if (agentId) {
    const res = await getAgentIdentityById(agentId);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: res.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!res.identity) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(res.identity), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (agentName) {
    const res = await getAgentIdentityByName(agentName);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: res.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!res.identity) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(res.identity), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // liste
  const res = await listAgentIdentities({ status: status || undefined });
  if (!res.ok) {
    return new Response(JSON.stringify({ error: res.error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(res.identities), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handlePost(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const action = body.action || "upsert";

  if (action === "upsert") {
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
    } = body;

    const res = await upsertAgentIdentity({
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
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: res.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(res.identity), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "status") {
    const { agent_id, status } = body;
    if (!agent_id || !status) {
      return new Response(
        JSON.stringify({
          error: "agent_id and status are required for action=status",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const res = await updateAgentIdentityStatus(agent_id, status);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: res.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(res.identity), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown_action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
