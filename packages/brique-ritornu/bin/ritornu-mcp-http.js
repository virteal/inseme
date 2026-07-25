#!/usr/bin/env node
/**
 * Ritornu MCP — HTTP transport.
 *
 * Primary endpoint: POST /mcp  (JSON-RPC body, single message or batch array)
 * Discovery:        GET  /health , GET /tools
 *
 * Useful for remote hosts (ChatGPT custom connectors, cloud agents) when the
 * process is exposed behind TLS. Optional bearer: RITORNU_MCP_TOKEN.
 *
 *   PORT=8792 node bin/ritornu-mcp-http.js
 */

import http from "node:http";
import { SERVER_NAME, SERVER_VERSION, createMcpCore, jsonRpcError } from "../src/mcp/core.js";

const core = createMcpCore(process.env);
const port = Number(process.env.PORT || process.env.RITORNU_MCP_PORT || 8792);
const host = process.env.RITORNU_MCP_HOST || "127.0.0.1";
const token = String(process.env.RITORNU_MCP_TOKEN || "").trim();
const corsOrigin = process.env.RITORNU_CORS_ORIGIN || "*";

const server = http.createServer(async (req, res) => {
  try {
    applyCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, await core.callTool("ritornu_health", {}));
    }
    if (req.method === "GET" && url.pathname === "/tools") {
      return sendJson(res, 200, { tools: core.tools });
    }
    if (req.method === "GET" && (url.pathname === "/mcp" || url.pathname === "/sse")) {
      return sendJson(res, 200, {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        transport: "http-jsonrpc",
        post: "/mcp",
        note: "Send JSON-RPC 2.0 messages via POST /mcp. SSE stream is not required for simple tool hosts.",
      });
    }
    if (req.method === "POST" && url.pathname === "/mcp") {
      if (!authorize(req)) {
        return sendJson(res, 401, { error: "unauthorized" });
      }
      const body = await readJson(req);
      if (Array.isArray(body)) {
        const results = [];
        for (const message of body) {
          const response = await core.handleJsonRpc(message);
          if (response) results.push(response);
        }
        return sendJson(res, 200, results);
      }
      const response = await core.handleJsonRpc(body);
      if (!response) {
        res.writeHead(202);
        return res.end();
      }
      return sendJson(res, 200, response);
    }

    return sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    return sendJson(res, 500, {
      content: [{ type: "text", text: error.message }],
      isError: true,
    });
  }
});

server.listen(port, host, () => {
  process.stderr.write(`[${SERVER_NAME}] HTTP listening on http://${host}:${port}  POST /mcp\n`);
});

function authorize(req) {
  if (!token) return true;
  const header = String(req.headers.authorization || "");
  if (header === `Bearer ${token}`) return true;
  const alt = String(req.headers["x-ritornu-token"] || "");
  return alt === token;
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Ritornu-Token");
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 });
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}
