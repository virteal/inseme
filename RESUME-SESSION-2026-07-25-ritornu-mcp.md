---
title: Resume note — Ritornu M0/M1 + federated Inseme MCP
date: 2026-07-25
issue: https://github.com/JeanHuguesRobert/inseme/issues/26
status: committed locally on main as 832053d — not pushed to origin yet
repo: JeanHuguesRobert/inseme
branch: main
author_note: Safe handoff before PC reboot. Work is in local git; push after reboot when ready.
---

# Resume: Ritornu + Inseme MCP hub (issue #26)

## Situation

| Slice                                              | Status                                            |
| -------------------------------------------------- | ------------------------------------------------- |
| M0 — schemas, normalize, handoff, tests            | **Done** (in `832053d`)                           |
| M1 — Substack public URL adapter                   | **Done**                                          |
| Storage = Supabase private bucket (not `~/.local`) | **Done**                                          |
| Federated MCP hub (Cogentia.js + Ritornu)          | **Done** (`inseme-mcp`)                           |
| Local commit on `main`                             | **`832053d`**                                     |
| Push to `origin/main`                              | **Not done** (`main` ahead by 1)                  |
| VS Code Insiders MCP registration                  | **Not done**                                      |
| Supabase migration applied on live instance        | **Not verified**                                  |
| Ophelia sees `prepare_substack_post` in runtime    | **Not verified** (registry gen may be gitignored) |

Skeleton on remote: `ab4c4b7`. Full implementation: **`832053d`**.

## After reboot

```powershell
cd C:\tweesic\inseme
git log -1 --oneline    # 832053d feat(ritornu): M0/M1 packages, Supabase storage, federated Inseme MCP hub
git status              # main...origin/main [ahead 1]
# optional:
# git push origin main

cd packages\brique-ritornu
node --test ./tests/*.test.js   # expect 42 pass
```

MCP entrypoints:

- Federated: `node bin/inseme-mcp.js` / `bin/inseme-mcp-http.js`
- Docs: `packages/brique-ritornu/docs/MCP.md`

## Next steps

1. `git push origin main` (when online)
2. Register `inseme` in VS Code Insiders `%APPDATA%\Code - Insiders\User\mcp.json`
3. Apply migration `20260724120000_ritornu_private_storage.sql`
4. Start Cogentia daemon; dogfood hub tools
5. Issue #26 status comment

## Pouzin paper (separate)

- `C:\tweesic\barons-Mariani\research\louis_pouzin_datagram_pioneer.md`
- Reviews under `research/reviews/*louis_pouzin*`

## Resume prompt

```text
Resume from C:\tweesic\inseme\RESUME-SESSION-2026-07-25-ritornu-mcp.md
Local commit 832053d on inseme main (push if desired). Next: MCP IDE registration, migration, dogfood.
```
