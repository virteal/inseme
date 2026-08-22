/**
 * Cogentia MCP projection for the Inseme hub.
 *
 * The tool/resource/prompt/skill catalog is owned by Cogentia
 * (`scripts/lib/cogentia-mcp-core.js`). This module is a thin wrapper so the
 * hub does not maintain a parallel COGENTIA_TOOLS table.
 *
 * Requires a sibling (or COGENTIA_REPO_ROOT) Cogentia checkout.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  TOOLS as COGENTIA_CORE_TOOLS,
  MUTATE_TOOLS,
  PRIVATE_READ_TOOLS,
} from "../../../../../cogentia/scripts/lib/cogentia-mcp-core.js";
import {
  createRegistryAwareMcpCore,
  REGISTRY_TOOLS,
} from "../../../../../cogentia/scripts/lib/cogentia-mcp-registries.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const COGENTIA_PROTOCOL_NOTE =
  "Catalog owned by Cogentia MCP core. Prefer cogentia_views_snapshot or inseme_cockpit first.";

/** Methods the hub should forward to Cogentia (not merged with Ritornu). */
export const COGENTIA_FORWARDED_METHODS = new Set([
  "server/discover",
  "resources/list",
  "resources/read",
  "resources/directory/read",
  "prompts/list",
  "prompts/get",
  "completion/complete",
  "skills/list",
  "skills/get",
]);

/**
 * Hub-facing catalog derived from Cogentia (not a second source of truth).
 * `risk` is a coarse Inseme filter: write/private tools stay off anonymous lists.
 */
export const COGENTIA_TOOLS = [
  ...COGENTIA_CORE_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    risk: MUTATE_TOOLS.has(tool.name) || PRIVATE_READ_TOOLS.has(tool.name) ? "write" : "read",
  })),
  ...REGISTRY_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    risk: "read",
  })),
];

export function defaultCogentiaRepoRoot(env = process.env) {
  const fromEnv = String(env.COGENTIA_REPO_ROOT || env.COGENTIA_HOME || "").trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(MODULE_DIR, "../../../../../cogentia");
}

export function cogentiaCoreExists(env = process.env) {
  const root = defaultCogentiaRepoRoot(env);
  return fs.existsSync(path.join(root, "scripts", "lib", "cogentia-mcp-core.js"));
}

function withCogentiaEnv(env = process.env) {
  const next = { ...env };
  if (!String(next.COGENTIA_REPO_ROOT || "").trim() && !String(next.COGENTIA_HOME || "").trim()) {
    next.COGENTIA_REPO_ROOT = defaultCogentiaRepoRoot(env);
  }
  const allowOps = String(next.COGENTIA_MCP_ALLOW_OPS || "").trim();
  if (allowOps && !String(next.COGENTIA_MCP_ALLOW_MUTATE || "").trim()) {
    next.COGENTIA_MCP_ALLOW_MUTATE = allowOps;
  }
  return next;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createCogentiaProxy(env = process.env) {
  const mapped = withCogentiaEnv(env);
  const core = createRegistryAwareMcpCore(mapped);

  function listTools() {
    return (core.tools || []).concat(REGISTRY_TOOLS).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations || {
        readOnlyHint: !MUTATE_TOOLS.has(tool.name),
        destructiveHint: MUTATE_TOOLS.has(tool.name),
        openWorldHint: false,
      },
    }));
  }

  const knownNames = new Set([
    ...(core.allTools || []).map((t) => t.name),
    ...REGISTRY_TOOLS.map((t) => t.name),
  ]);

  async function callTool(name, args = {}) {
    return core.callTool(name, args);
  }

  async function healthProbe() {
    try {
      const status = await core.callTool("cogentia_status", {});
      return {
        ok: true,
        daemon_url: core.daemonUrl?.origin || String(core.daemonUrl || ""),
        view: core.view,
        allow_ops: Boolean(core.allowMutate),
        catalog: "cogentia-mcp-core",
        status,
      };
    } catch (error) {
      return {
        ok: false,
        daemon_url: core.daemonUrl?.origin || String(core.daemonUrl || ""),
        view: core.view,
        allow_ops: Boolean(core.allowMutate),
        catalog: "cogentia-mcp-core",
        error: error.message,
      };
    }
  }

  return {
    daemonUrl: core.daemonUrl,
    view: core.view,
    allowOps: Boolean(core.allowMutate),
    catalog: "cogentia-mcp-core",
    core,
    listTools,
    callTool,
    hasTool: (name) => knownNames.has(name),
    healthProbe,
    toolCount: () => listTools().length,
    handleJsonRpc: (message, transport) => core.handleJsonRpc(message, transport),
    initialize: (params) => core.initialize(params),
    coreHref: pathToFileURL(
      path.join(defaultCogentiaRepoRoot(mapped), "scripts", "lib", "cogentia-mcp-core.js")
    ).href,
  };
}
