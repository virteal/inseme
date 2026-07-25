# Inseme federated MCP

One MCP server that **maximizes the visible and actionable tool surface** for ChatGPT, Claude, Grok,
Cursor, Codex, and other hosts:

| Surface      | Source of truth               | Examples                                                       |
| ------------ | ----------------------------- | -------------------------------------------------------------- |
| **Cogentia** | `cogentia.js` daemon HTTP API | search, context pack, lines, issues, CLI, index, continuations |
| **Ritornu**  | this package                  | prepare Substack, normalize copy, handoff (no Git)             |
| **Hub**      | federation meta               | `inseme_cockpit`, `inseme_list_surfaces`                       |

Issue memory: [inseme#26](https://github.com/JeanHuguesRobert/inseme/issues/26) (Ritornu) + corpus
tooling.

## Prefer this entrypoint

```bash
cd packages/brique-ritornu
node bin/inseme-mcp.js          # stdio — Claude / Cursor / Grok / Codex
node bin/inseme-mcp-http.js     # HTTP POST /mcp — remote / ChatGPT connectors
```

Ritornu-only remains available: `node bin/ritornu-mcp.js`.

## Host config (stdio)

```json
{
  "mcpServers": {
    "inseme": {
      "command": "node",
      "args": ["C:/tweesic/inseme/packages/brique-ritornu/bin/inseme-mcp.js"],
      "env": {
        "INSEME_MCP_SURFACE": "full",
        "COGENTIA_DAEMON_URL": "http://127.0.0.1:8790",
        "COGENTIA_MCP_VIEW": "public",
        "SUPABASE_URL": "https://YOUR.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "…",
        "RITORNU_STORAGE_BUCKET": "ritornu-private"
      }
    }
  }
}
```

### Environment

| Variable                 | Role                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| `COGENTIA_DAEMON_URL`    | Default `http://127.0.0.1:8790` — run `cogentia.js` daemon             |
| `COGENTIA_MCP_VIEW`      | `public` (default) or `full` (needs admin token)                       |
| `COGENTIA_ADMIN_TOKEN`   | Full-view bearer to daemon                                             |
| `COGENTIA_MCP_ALLOW_OPS` | `1` to expose side-effect tools (index rebuild, emit-static, registry) |
| `INSEME_MCP_SURFACE`     | `full` \| `cogentia` \| `ritornu`                                      |
| `SUPABASE_*`             | Ritornu private captures (else session memory)                         |
| `INSEME_MCP_TOKEN`       | Optional bearer for HTTP transport                                     |

## Agent workflow (recommended)

1. **`inseme_cockpit`** — situational picture (both surfaces)
2. **Corpus** — `cogentia_search` → `cogentia_context_pack` → `cogentia_get_lines` (cite)
3. **Navigation** — `cogentia_guide_resolve`, `cogentia_issue_graph`, `cogentia_continuation_list`
4. **CLI mirrors** — `cogentia_grep`, `cogentia_docs_*`, `cogentia_concepts_*`
5. **Retrofit** (mandate) — `ritornu_prepare_substack` / `ritornu_normalize_provided` → human review
   → `ritornu_create_handoff` (patch only)

## Cogentia tools (high level)

**Always listed when surface includes cogentia (read):**  
status, state, repos, plugins, agent*health, views_snapshot, health, search, context_pack,
context_pack_batch, get_doc, get_lines, explain, guide_resolve, index_status, index_search,
issue_graph, issues_list, continuation_list/inspect, cli_status/state, grep, docs*_, concepts\__,
git_verify.

**Only with `COGENTIA_MCP_ALLOW_OPS=1`:**  
index_rebuild, index_update, emit_static, publish_registry, nav_benchmark.

If the daemon is down, tools remain **visible** in `tools/list`; calls return a clear error with
start hints.

## HTTP

```bash
set PORT=8793
set INSEME_MCP_TOKEN=long-secret
node bin/inseme-mcp-http.js
# POST http://127.0.0.1:8793/mcp
# GET  /health  /tools
```

## Tests

```bash
node --test ./tests/hub-mcp.test.js ./tests/mcp.test.js
```
