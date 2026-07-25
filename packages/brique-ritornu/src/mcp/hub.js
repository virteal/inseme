/**
 * Inseme federated MCP hub — maximize visible / actionable tool surface.
 *
 * Surfaces:
 *   - Cogentia.js daemon (corpus search, packs, issues, CLI, index, ops…)
 *   - Ritornu (personal publication retrofit under mandate)
 *   - Hub meta tools (cockpit, catalog)
 *
 * Single entry for ChatGPT / Claude / Grok / Cursor hosts.
 */

import {
  BRIQUE_ID,
  BRIQUE_STATUS,
  NON_NEGOTIABLE_BOUNDARIES,
  SCHEMA_VERSIONS,
} from "../constants.js";
import {
  PROTOCOL_VERSION,
  SERVER_VERSION as RITORNU_MCP_VERSION,
  SUPPORTED_PROTOCOLS,
  TOOLS as RITORNU_TOOLS,
  createMcpCore as createRitornuCore,
  jsonRpcError,
  jsonRpcResult,
  mcpToolResult,
} from "./core.js";
import { COGENTIA_TOOLS, createCogentiaProxy } from "./cogentia-proxy.js";

export const HUB_SERVER_NAME = "inseme-mcp";
export const HUB_SERVER_VERSION = "0.3.0";

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ fetchImpl?: typeof fetch, store?: object, cogentia?: object }} [options]
 */
export function createHubMcp(env = process.env, options = {}) {
  const surface = String(env.INSEME_MCP_SURFACE || "full").toLowerCase();
  // full | cogentia | ritornu
  const includeCogentia = surface === "full" || surface === "cogentia";
  const includeRitornu = surface === "full" || surface === "ritornu";

  const ritornu = includeRitornu
    ? createRitornuCore(env, {
        fetchImpl: options.fetchImpl,
        store: options.store,
      })
    : null;

  let cogentia = null;
  if (includeCogentia) {
    cogentia = options.cogentia || null;
    if (!cogentia) {
      try {
        cogentia = createCogentiaProxy(env);
      } catch (error) {
        cogentia = createBrokenCogentiaProxy(error.message);
      }
    }
  }

  const hubMetaTools = [
    {
      name: "inseme_cockpit",
      description:
        "Federated session bootstrap: Ritornu mandate snapshot + Cogentia views/status when available. Call first on a new host session.",
      inputSchema: {
        type: "object",
        properties: {
          include_remote: {
            type: "boolean",
            description: "Forward to cogentia_views_snapshot include_remote",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "inseme_list_surfaces",
      description:
        "List MCP tool surfaces and counts (cogentia / ritornu / hub) so agents know what is visible and actionable.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ];

  function listTools() {
    const tools = [...hubMetaTools];
    if (cogentia) tools.push(...cogentia.listTools());
    if (ritornu) {
      for (const t of RITORNU_TOOLS) {
        tools.push({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        });
      }
    }
    return tools;
  }

  function initialize(params = {}) {
    const requested = String(params.protocolVersion || "");
    const toolCount = listTools().length;
    return {
      protocolVersion: SUPPORTED_PROTOCOLS.has(requested) ? requested : PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: HUB_SERVER_NAME, version: HUB_SERVER_VERSION },
      instructions:
        `Inseme federated MCP (${toolCount} tools). ` +
        "Start with inseme_cockpit or cogentia_views_snapshot for situational awareness. " +
        "Use cogentia_search / cogentia_context_pack for corpus work; cogentia_get_lines to cite. " +
        "Use ritornu_* only under human mandate for personal publication retrofit (never auto-Git). " +
        "Side-effecting Cogentia ops require COGENTIA_MCP_ALLOW_OPS=1. " +
        "Daemon: COGENTIA_DAEMON_URL (default http://127.0.0.1:8790).",
    };
  }

  async function callTool(name, args = {}) {
    if (name === "inseme_cockpit") {
      return runCockpit(args);
    }
    if (name === "inseme_list_surfaces") {
      return {
        ok: true,
        server: HUB_SERVER_NAME,
        version: HUB_SERVER_VERSION,
        surface,
        surfaces: {
          hub: { tools: hubMetaTools.map((t) => t.name) },
          cogentia: {
            enabled: Boolean(cogentia),
            tool_count: cogentia ? cogentia.toolCount() : 0,
            catalog_size: COGENTIA_TOOLS.length,
            daemon: cogentia?.daemonUrl?.origin || null,
            allow_ops: cogentia?.allowOps ?? false,
          },
          ritornu: {
            enabled: Boolean(ritornu),
            brique_id: BRIQUE_ID,
            brique_status: BRIQUE_STATUS,
            tool_count: includeRitornu ? RITORNU_TOOLS.length : 0,
            mcp_version: RITORNU_MCP_VERSION,
            schema_versions: SCHEMA_VERSIONS,
            boundaries: [...NON_NEGOTIABLE_BOUNDARIES],
          },
        },
        total_tools: listTools().length,
      };
    }

    if (cogentia?.hasTool(name)) {
      return cogentia.callTool(name, args);
    }
    if (ritornu) {
      const ritornuNames = new Set(RITORNU_TOOLS.map((t) => t.name));
      if (ritornuNames.has(name)) {
        return ritornu.callTool(name, args);
      }
    }
    throw new Error(`Unknown tool: ${name}`);
  }

  async function runCockpit(args = {}) {
    const out = {
      ok: true,
      server: HUB_SERVER_NAME,
      version: HUB_SERVER_VERSION,
      surface,
      generated_at: new Date().toISOString(),
      ritornu: null,
      cogentia: null,
      next_steps: [],
    };

    if (ritornu) {
      try {
        out.ritornu = await ritornu.callTool("ritornu_health", {});
        out.next_steps.push(
          "For personal publication retrofit: ritornu_prepare_substack or ritornu_normalize_provided under mandate."
        );
      } catch (error) {
        out.ritornu = { ok: false, error: error.message };
      }
    }

    if (cogentia) {
      try {
        out.cogentia = {
          health: await cogentia.healthProbe(),
          views: await cogentia.callTool("cogentia_views_snapshot", {
            limit: 12,
            include_remote: args.include_remote === true,
          }),
        };
        out.next_steps.push(
          "For corpus work: cogentia_search → cogentia_context_pack → cogentia_get_lines (cite source_id / ref)."
        );
      } catch (error) {
        out.cogentia = {
          ok: false,
          error: error.message,
          hint: "Start cogentia.js daemon if corpus tools should be actionable.",
        };
        out.next_steps.push(
          "Start Cogentia daemon to unlock corpus tools (search, packs, issues, CLI)."
        );
      }
    }

    out.next_steps.push("Call inseme_list_surfaces for the full tool catalog by domain.");
    return out;
  }

  async function handleJsonRpc(message) {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return jsonRpcError(message?.id ?? null, -32600, "Invalid Request");
    }
    if (message.id === undefined) {
      return null;
    }
    try {
      if (message.method === "initialize") {
        return jsonRpcResult(message.id, initialize(message.params || {}));
      }
      if (message.method === "ping") {
        return jsonRpcResult(message.id, {});
      }
      if (message.method === "tools/list") {
        return jsonRpcResult(message.id, { tools: listTools() });
      }
      if (message.method === "tools/call") {
        const name = String(message.params?.name || "");
        const args = message.params?.arguments || {};
        const data = await callTool(name, args);
        return jsonRpcResult(message.id, mcpToolResult(data));
      }
      if (message.method === "resources/list") {
        return jsonRpcResult(message.id, { resources: [] });
      }
      if (message.method === "prompts/list") {
        return jsonRpcResult(message.id, { prompts: [] });
      }
      return jsonRpcError(message.id, -32601, "Method not found");
    } catch (error) {
      return jsonRpcResult(message.id, {
        content: [{ type: "text", text: error?.message || String(error) }],
        isError: true,
      });
    }
  }

  return {
    serverName: HUB_SERVER_NAME,
    serverVersion: HUB_SERVER_VERSION,
    listTools,
    callTool,
    handleJsonRpc,
    initialize,
    ritornu,
    cogentia,
  };
}

function createBrokenCogentiaProxy(message) {
  return {
    daemonUrl: { origin: "invalid" },
    allowOps: false,
    listTools: () =>
      COGENTIA_TOOLS.filter((t) => t.risk === "read").map((t) => ({
        name: t.name,
        description: `${t.description} [daemon config error: ${message}]`,
        inputSchema: t.inputSchema,
      })),
    callTool: async () => {
      throw new Error(`Cogentia proxy misconfigured: ${message}`);
    },
    hasTool: (name) => COGENTIA_TOOLS.some((t) => t.name === name),
    healthProbe: async () => ({ ok: false, error: message }),
    toolCount: () => COGENTIA_TOOLS.filter((t) => t.risk === "read").length,
  };
}
