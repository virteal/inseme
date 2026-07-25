/**
 * Cogentia.js daemon proxy — maximizes the visible / actionable tool surface
 * for MCP hosts (Claude, ChatGPT, Grok, Cursor…).
 *
 * Talks HTTP to the Cogentia Context Gateway (default http://127.0.0.1:8790),
 * the same surface cogentia.js exposes. Read tools are always advertised;
 * mutating ops require COGENTIA_MCP_ALLOW_OPS=1 (or full view + admin token).
 */

export const COGENTIA_PROTOCOL_NOTE =
  "Backed by cogentia.js daemon (COGENTIA_DAEMON_URL). Prefer cogentia_views_snapshot or inseme_cockpit first.";

/**
 * @typedef {object} CogentiaToolDef
 * @property {string} name
 * @property {string} description
 * @property {object} inputSchema
 * @property {"read"|"write"} risk
 * @property {"GET"|"POST"} method
 * @property {string} path
 * @property {(args: object) => object|null} [query]
 * @property {(args: object) => object|null} [body]
 */

/** @type {CogentiaToolDef[]} */
export const COGENTIA_TOOLS = [
  // —— Session / cockpit ——
  {
    name: "cogentia_views_snapshot",
    description:
      "Session bootstrap / agent cockpit: corpus health, alive continuations, open issues summary, Views Store URLs. Prefer first. Implementation: cogentia.js /api/views/snapshot.",
    risk: "read",
    method: "GET",
    path: "/api/views/snapshot",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 40 },
        include_remote: { type: "boolean" },
        no_store_probe: { type: "boolean" },
      },
      additionalProperties: false,
    },
    query: (a) => ({
      limit: a.limit,
      include_remote: a.include_remote === true ? "1" : undefined,
      no_store_probe: a.no_store_probe === true ? "1" : undefined,
    }),
  },
  {
    name: "cogentia_status",
    description: "Lightweight daemon status (cogentia.js /api/status).",
    risk: "read",
    method: "GET",
    path: "/api/status",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_state",
    description: "Corpus workspace state snapshot (cogentia.js /api/state).",
    risk: "read",
    method: "GET",
    path: "/api/state",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_repos",
    description: "List registered corpus repositories and their state (/api/repos).",
    risk: "read",
    method: "GET",
    path: "/api/repos",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_agent_health",
    description: "Cogentia agent gateway / AI router health (/api/agent/health).",
    risk: "read",
    method: "GET",
    path: "/api/agent/health",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_plugins",
    description: "List daemon plugins and their HTTP routes (/api/plugins).",
    risk: "read",
    method: "GET",
    path: "/api/plugins",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },

  // —— Retrieval / context (primary actionable surface) ——
  {
    name: "cogentia_health",
    description: "Context gateway + index health (/api/context/health).",
    risk: "read",
    method: "GET",
    path: "/api/context/health",
    inputSchema: {
      type: "object",
      properties: { quick: { type: "boolean" } },
      additionalProperties: false,
    },
    query: (a) => ({ quick: a.quick === false ? "0" : "1" }),
  },
  {
    name: "cogentia_search",
    description:
      "Explore the Cogentia corpus with short, citable search results (/api/context/search).",
    risk: "read",
    method: "GET",
    path: "/api/context/search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        repo: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        mode: { type: "string", enum: ["keyword", "hybrid", "semantic"] },
        include_text: { type: "boolean" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    query: (a) => ({
      q: a.query,
      repo: a.repo,
      limit: a.limit,
      mode: a.mode,
      include_text: a.include_text === true ? "1" : undefined,
    }),
  },
  {
    name: "cogentia_context_pack",
    description:
      "Build a deterministic, budgeted context pack for a broad corpus question (/api/context/pack).",
    risk: "read",
    method: "GET",
    path: "/api/context/pack",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        repo: { type: "string" },
        budget: { type: "integer", minimum: 256, maximum: 50000 },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        format: { type: "string", enum: ["json", "markdown"] },
        mode: { type: "string", enum: ["keyword", "hybrid", "semantic"] },
      },
      required: ["query"],
      additionalProperties: false,
    },
    query: (a) => ({
      q: a.query,
      repo: a.repo,
      budget: a.budget,
      limit: a.limit,
      format: a.format || "json",
      mode: a.mode,
    }),
  },
  {
    name: "cogentia_context_pack_batch",
    description:
      "Batch context packs for several queries in one call (/api/context/pack-batch). Max 12 queries.",
    risk: "read",
    method: "POST",
    path: "/api/context/pack-batch",
    inputSchema: {
      type: "object",
      properties: {
        queries: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 12,
        },
        repo: { type: "string" },
        budget: { type: "integer", minimum: 256, maximum: 50000 },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        mode: { type: "string", enum: ["keyword", "hybrid", "semantic"] },
      },
      required: ["queries"],
      additionalProperties: false,
    },
    body: (a) => ({
      queries: a.queries,
      repo: a.repo,
      budget: a.budget,
      limit: a.limit,
      mode: a.mode || "hybrid",
    }),
  },
  {
    name: "cogentia_get_doc",
    description:
      "Retrieve metadata / allowed view of a corpus document by ref (/api/context/doc). ref form: repo:path.",
    risk: "read",
    method: "GET",
    path: "/api/context/doc",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", minLength: 1, description: "Document reference repo:path" },
      },
      required: ["ref"],
      additionalProperties: false,
    },
    query: (a) => ({ ref: a.ref }),
  },
  {
    name: "cogentia_get_lines",
    description:
      "Retrieve a bounded, citable line interval from an allowed corpus document (/api/context/lines).",
    risk: "read",
    method: "GET",
    path: "/api/context/lines",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", minLength: 1 },
        start: { type: "integer", minimum: 1 },
        end: { type: "integer", minimum: 1 },
      },
      required: ["ref", "start", "end"],
      additionalProperties: false,
    },
    query: (a) => ({ ref: a.ref, start: a.start, end: a.end }),
  },
  {
    name: "cogentia_explain",
    description: "Explain deterministic retrieval signals for a result_id (/api/context/explain).",
    risk: "read",
    method: "GET",
    path: "/api/context/explain",
    inputSchema: {
      type: "object",
      properties: { result_id: { type: "string", minLength: 1 } },
      required: ["result_id"],
      additionalProperties: false,
    },
    query: (a) => ({ result_id: a.result_id }),
  },
  {
    name: "cogentia_guide_resolve",
    description:
      "S7 navigation: resolve a concept query via alias lookup + attractor similarity (/api/context/guide-resolve).",
    risk: "read",
    method: "GET",
    path: "/api/context/guide-resolve",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1 } },
      required: ["query"],
      additionalProperties: false,
    },
    query: (a) => ({ q: a.query }),
  },

  // —— Index ——
  {
    name: "cogentia_index_status",
    description: "Embedding / search index status (/api/index/status).",
    risk: "read",
    method: "GET",
    path: "/api/index/status",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_index_search",
    description:
      "Raw index search (/api/index/search). Prefer cogentia_search for citable context results.",
    risk: "read",
    method: "GET",
    path: "/api/index/search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        repo: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    query: (a) => ({ q: a.query, repo: a.repo, limit: a.limit }),
  },

  // —— Issues / continuations ——
  {
    name: "cogentia_issue_graph",
    description: "Read-only graph of issues and target documents (/api/issues/graph).",
    risk: "read",
    method: "GET",
    path: "/api/issues/graph",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"] },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    query: (a) => ({
      repo: a.repo || "all",
      state: a.state || "open",
      limit: a.limit || 25,
    }),
  },
  {
    name: "cogentia_issues_list",
    description: "List issues for a registered repository (alias of issue graph).",
    risk: "read",
    method: "GET",
    path: "/api/issues/graph",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"] },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    query: (a) => ({
      repo: a.repo || "all",
      state: a.state || "open",
      limit: a.limit || 25,
    }),
  },
  {
    name: "cogentia_continuation_list",
    description: "List continuation decision packets (/api/cli/continuation/list).",
    risk: "read",
    method: "GET",
    path: "/api/cli/continuation/list",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "alive",
            "hibernating",
            "closed",
            "active",
            "resolved",
            "cancelled",
            "dormant",
            "all",
          ],
        },
      },
      additionalProperties: false,
    },
    query: (a) => ({ status: a.status }),
  },
  {
    name: "cogentia_continuation_inspect",
    description: "Inspect one continuation packet (/api/cli/continuation/inspect).",
    risk: "read",
    method: "GET",
    path: "/api/cli/continuation/inspect",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 1, description: "Continuation id or key" },
        ref: { type: "string", description: "Alternate ref if supported by daemon" },
      },
      additionalProperties: false,
    },
    query: (a) => ({ id: a.id, ref: a.ref }),
  },

  // —— CLI-visible corpus ops (read) ——
  {
    name: "cogentia_cli_status",
    description: "Unified CLI status view (/api/cli/status).",
    risk: "read",
    method: "GET",
    path: "/api/cli/status",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_cli_state",
    description: "Unified CLI state view (/api/cli/state).",
    risk: "read",
    method: "GET",
    path: "/api/cli/state",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_grep",
    description: "Corpus grep via daemon CLI (/api/cli/grep).",
    risk: "read",
    method: "GET",
    path: "/api/cli/grep",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        repo: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 200 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    query: (a) => ({ q: a.query, query: a.query, repo: a.repo, limit: a.limit }),
  },
  {
    name: "cogentia_docs_summary",
    description: "Documentation inventory summary (/api/cli/docs/summary).",
    risk: "read",
    method: "GET",
    path: "/api/cli/docs/summary",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_docs_query",
    description: "Query documentation catalog (/api/cli/docs/query).",
    risk: "read",
    method: "GET",
    path: "/api/cli/docs/query",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        repo: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    query: (a) => ({ q: a.query, query: a.query, repo: a.repo }),
  },
  {
    name: "cogentia_docs_search",
    description: "Search documentation (/api/cli/docs/search).",
    risk: "read",
    method: "GET",
    path: "/api/cli/docs/search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        repo: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    query: (a) => ({ q: a.query, query: a.query, repo: a.repo, limit: a.limit }),
  },
  {
    name: "cogentia_docs_gaps",
    description: "Documentation gaps report (/api/cli/docs/gaps).",
    risk: "read",
    method: "GET",
    path: "/api/cli/docs/gaps",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_docs_inspect",
    description: "Inspect a documentation entry (/api/cli/docs/inspect).",
    risk: "read",
    method: "GET",
    path: "/api/cli/docs/inspect",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", minLength: 1 },
        path: { type: "string" },
      },
      additionalProperties: false,
    },
    query: (a) => ({ ref: a.ref, path: a.path }),
  },
  {
    name: "cogentia_docs_snippet",
    description: "Fetch a documentation snippet (/api/cli/docs/snippet).",
    risk: "read",
    method: "GET",
    path: "/api/cli/docs/snippet",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", minLength: 1 },
        start: { type: "integer", minimum: 1 },
        end: { type: "integer", minimum: 1 },
      },
      required: ["ref"],
      additionalProperties: false,
    },
    query: (a) => ({ ref: a.ref, start: a.start, end: a.end }),
  },
  {
    name: "cogentia_concepts_list",
    description: "List corpus concepts (/api/cli/concepts/list).",
    risk: "read",
    method: "GET",
    path: "/api/cli/concepts/list",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 500 },
        prefix: { type: "string" },
      },
      additionalProperties: false,
    },
    query: (a) => ({ limit: a.limit, prefix: a.prefix }),
  },
  {
    name: "cogentia_concepts_check",
    description: "Check concept registration / consistency (/api/cli/concepts/check).",
    risk: "read",
    method: "GET",
    path: "/api/cli/concepts/check",
    inputSchema: {
      type: "object",
      properties: {
        concept: { type: "string", minLength: 1 },
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    query: (a) => ({ concept: a.concept, q: a.query || a.concept }),
  },
  {
    name: "cogentia_git_verify",
    description: "Git ahead/behind and dirty state across registered repos (/api/git/verify).",
    risk: "read",
    method: "GET",
    path: "/api/git/verify",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },

  // —— Ops (write / side-effect) — gated ——
  {
    name: "cogentia_index_rebuild",
    description:
      "Rebuild the corpus search index (/api/index/rebuild). Side-effecting. Requires COGENTIA_MCP_ALLOW_OPS=1.",
    risk: "write",
    method: "POST",
    path: "/api/index/rebuild",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    body: () => ({}),
  },
  {
    name: "cogentia_index_update",
    description:
      "Incremental index update (/api/index/update). Side-effecting. Requires COGENTIA_MCP_ALLOW_OPS=1.",
    risk: "write",
    method: "POST",
    path: "/api/index/update",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    body: () => ({}),
  },
  {
    name: "cogentia_emit_static",
    description:
      "Generate/verify llms.txt static projection (/api/ops/emit-static). Side-effecting. Requires COGENTIA_MCP_ALLOW_OPS=1.",
    risk: "write",
    method: "GET",
    path: "/api/ops/emit-static",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_publish_registry",
    description:
      "Publish/verify registry.json (/api/ops/publish-registry). Side-effecting. Requires COGENTIA_MCP_ALLOW_OPS=1.",
    risk: "write",
    method: "GET",
    path: "/api/ops/publish-registry",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
  {
    name: "cogentia_nav_benchmark",
    description:
      "Run navigation benchmark suite (/api/ops/nav-benchmark). May be expensive. Requires COGENTIA_MCP_ALLOW_OPS=1.",
    risk: "write",
    method: "GET",
    path: "/api/ops/nav-benchmark",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    query: () => ({}),
  },
];

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createCogentiaProxy(env = process.env) {
  const daemonUrl = validateDaemonUrl(env.COGENTIA_DAEMON_URL || "http://127.0.0.1:8790");
  const requestTimeoutMs = boundedInteger(env.COGENTIA_MCP_TIMEOUT_MS, 20000, 1000, 180000);
  const requestedView = String(env.COGENTIA_MCP_VIEW || "public").toLowerCase();
  const adminToken = String(env.COGENTIA_ADMIN_TOKEN || "");
  const view = requestedView === "full" && adminToken ? "full" : "public";
  const allowOps =
    env.COGENTIA_MCP_ALLOW_OPS === "1" || env.COGENTIA_MCP_ALLOW_OPS === "true" || view === "full";

  const byName = new Map(COGENTIA_TOOLS.map((t) => [t.name, t]));

  function listTools() {
    return COGENTIA_TOOLS.filter((t) => t.risk === "read" || allowOps).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  async function callTool(name, args = {}) {
    const def = byName.get(name);
    if (!def) throw new Error(`Unknown Cogentia tool: ${name}`);
    if (def.risk === "write" && !allowOps) {
      throw new Error(
        `Tool ${name} is side-effecting. Set COGENTIA_MCP_ALLOW_OPS=1 (or full view + admin token) to enable.`
      );
    }

    if (def.method === "POST") {
      const body = def.body ? def.body(args) : args;
      return daemonPost(def.path, body);
    }
    const query = def.query ? def.query(args) : {};
    return daemonGet(def.path, query);
  }

  async function daemonGet(route, params = {}) {
    const url = new URL(route, daemonUrl);
    url.searchParams.set("view", view);
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    return daemonFetch(url, { method: "GET" });
  }

  async function daemonPost(route, body = {}) {
    const url = new URL(route, daemonUrl);
    url.searchParams.set("view", view);
    return daemonFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function daemonFetch(url, init) {
    const headers = {
      Accept: "application/json, text/markdown, text/plain",
      ...(init.headers || {}),
    };
    if (view === "full") {
      headers.Authorization = `Bearer ${adminToken}`;
    } else {
      headers["X-Cogentia-Entry"] = "public";
    }

    let response;
    try {
      response = await fetch(url, {
        ...init,
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      throw new Error(
        `Cogentia daemon unavailable at ${daemonUrl.origin}${url.pathname}: ${error.message}. Start with: node cogentia/scripts/cogentia.js daemon (or your usual Fracta service).`
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      const detail =
        typeof body === "object" && body
          ? body.message || body.error || JSON.stringify(body)
          : body;
      throw new Error(`Cogentia daemon HTTP ${response.status}: ${detail || "request failed"}`);
    }
    return body;
  }

  async function healthProbe() {
    try {
      const status = await daemonGet("/api/status", {});
      return { ok: true, daemon_url: daemonUrl.origin, view, allow_ops: allowOps, status };
    } catch (error) {
      return {
        ok: false,
        daemon_url: daemonUrl.origin,
        view,
        allow_ops: allowOps,
        error: error.message,
      };
    }
  }

  return {
    daemonUrl,
    view,
    allowOps,
    listTools,
    callTool,
    hasTool: (name) => byName.has(name),
    healthProbe,
    toolCount: () => listTools().length,
  };
}

function validateDaemonUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid COGENTIA_DAEMON_URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("COGENTIA_DAEMON_URL must be http or https");
  }
  return url;
}

function boundedInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
