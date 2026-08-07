/**
 * Cogentia MCP client for Agent JHN (and subagents under JHN).
 *
 * Attests with COGENTIA_MCP_JHN_TOKEN so Fracta may enable mutate tools
 * (continuation emit/resolve, issues_sync) under Phase 5 rules.
 * Skills never substitute for this token.
 *
 * Env (workstation SoT → vault key):
 *   COGENTIA_MCP_URL          → cogentia_mcp_url
 *   COGENTIA_MCP_JHN_TOKEN    → cogentia_mcp_jhn_token  (secret)
 *   COGENTIA_MCP_JHN_MUTATE   → cogentia_mcp_jhn_mutate (flag)
 */

/* global process */

function envGet(name) {
  try {
    return globalThis.process?.env?.[name];
  } catch {
    return undefined;
  }
}

function requireText(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} is required`);
  }
  return value.trim();
}

/**
 * @param {object} [options]
 * @param {string} [options.url]
 * @param {string} [options.token]
 * @param {string} [options.actor]  default agent:jhn
 * @param {string} [options.mandate_ref]
 * @param {string} [options.principal_ref]
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createCogentiaMcpClient(options = {}) {
  const url = String(
    options.url || envGet("COGENTIA_MCP_URL") || "https://cogentia.fractavolta.com/mcp"
  ).trim();
  const token = String(options.token || envGet("COGENTIA_MCP_JHN_TOKEN") || "").trim();
  const defaultActor = String(options.actor || "agent:jhn").trim();
  const mandate_ref = String(
    options.mandate_ref ||
      envGet("AGENT_JHN_WHATSAPP_MANDATE_ID") ||
      envGet("COGENTIA_MCP_JHN_MANDATE") ||
      "mandate:jhn:mcp"
  ).trim();
  const principal_ref = String(options.principal_ref || "principal:jhn").trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl is required");
  }

  let nextId = 1;

  function headersFor(actor) {
    const h = {
      "content-type": "application/json",
      accept: "application/json",
      "x-cogentia-actor": actor,
      "x-cogentia-mandate": mandate_ref,
      "x-cogentia-principal": principal_ref,
      "x-cogentia-logical-agent": actor,
    };
    if (token) {
      h.authorization = `Bearer ${token}`;
      h["x-cogentia-jhn-token"] = token;
    }
    return h;
  }

  function metaFor(actor, extra = {}) {
    const meta = {
      "cogentia.actor": actor,
      "cogentia.mandate_ref": mandate_ref,
      "cogentia.principal_ref": principal_ref,
      "cogentia.logical_agent_ref": actor,
      ...extra,
    };
    if (token) meta["cogentia.jhn_token"] = token;
    return meta;
  }

  /**
   * @param {string} method
   * @param {object} [params]
   * @param {{ actor?: string, subagentId?: string, headers?: object }} [callOpts]
   */
  async function rpc(method, params = {}, callOpts = {}) {
    const actor = callOpts.subagentId
      ? `agent:jhn.subagent:${callOpts.subagentId}`
      : callOpts.actor || defaultActor;
    const body = {
      jsonrpc: "2.0",
      id: nextId++,
      method,
      params: {
        ...params,
        _meta: {
          ...(params._meta && typeof params._meta === "object" ? params._meta : {}),
          ...metaFor(actor, callOpts.meta || {}),
        },
      },
    };
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { ...headersFor(actor), ...(callOpts.headers || {}) },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Cogentia MCP non-JSON HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    if (!response.ok) {
      throw new Error(`Cogentia MCP HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    if (parsed.error) {
      throw new Error(
        `Cogentia MCP RPC error ${parsed.error.code}: ${parsed.error.message || "unknown"}`
      );
    }
    return parsed.result;
  }

  /**
   * Call a Cogentia tool; returns packet envelope (structuredContent) when present.
   * @param {string} name
   * @param {object} [args]
   * @param {{ subagentId?: string, actor?: string, traceparent?: string }} [opts]
   */
  async function callTool(name, args = {}, opts = {}) {
    requireText(name, "name");
    const meta = {};
    if (opts.traceparent) meta.traceparent = opts.traceparent;
    const result = await rpc("tools/call", { name, arguments: args, _meta: meta }, opts);
    if (result?.structuredContent) return result.structuredContent;
    if (result?.content?.[0]?.text) {
      try {
        return JSON.parse(result.content[0].text);
      } catch {
        return { ok: !result.isError, raw: result.content[0].text, isError: result.isError };
      }
    }
    return result;
  }

  async function listTools(opts = {}) {
    const result = await rpc("tools/list", {}, opts);
    return {
      tools: result?.tools || [],
      auth: result?._cogentia?.auth || null,
      allowMutate: result?._cogentia?.allowMutate === true,
      cogentia: result?._cogentia || null,
    };
  }

  async function initialize(opts = {}) {
    return rpc(
      "initialize",
      {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "inseme-agent-jhn", version: "1" },
      },
      opts
    );
  }

  /** Convenience: corpus evidence via MCP tools. */
  async function search(query, args = {}, opts = {}) {
    return callTool("cogentia_search", { query, ...args }, opts);
  }

  async function contextPack(query, args = {}, opts = {}) {
    return callTool("cogentia_context_pack", { query, ...args }, opts);
  }

  async function continuationList(status = "alive", opts = {}) {
    return callTool("cogentia_continuation_list", { status }, opts);
  }

  async function continuationResolve(id, decision, reason = "", opts = {}) {
    return callTool("cogentia_continuation_resolve", { id, decision, reason }, opts);
  }

  async function continuationEmit(question, args = {}, opts = {}) {
    return callTool("cogentia_continuation_emit", { question, ...args }, opts);
  }

  return {
    url,
    hasToken: Boolean(token),
    defaultActor,
    mandate_ref,
    principal_ref,
    rpc,
    callTool,
    listTools,
    initialize,
    search,
    contextPack,
    continuationList,
    continuationResolve,
    continuationEmit,
    /** Create a client bound to a subagent id under JHN. */
    forSubagent(subagentId) {
      return createCogentiaMcpClient({
        ...options,
        actor: `agent:jhn.subagent:${subagentId}`,
      });
    },
  };
}

/**
 * Load client from process env (after vault/dotenv load).
 * Returns null if no token and options.required !== true.
 */
export function loadCogentiaMcpClientFromEnv(options = {}) {
  const token = String(envGet("COGENTIA_MCP_JHN_TOKEN") || "").trim();
  if (!token && options.required !== true) return null;
  return createCogentiaMcpClient(options);
}
