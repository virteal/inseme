---
title: "JHN usability gate (Inseme #33)"
date: "2026-08-07"
document_role: operational
document_kind: status
visibility: public
related_issues:
  - "https://github.com/JeanHuguesRobert/inseme/issues/33"
  - "https://github.com/JeanHuguesRobert/inseme/issues/31"
---

# JHN usability gate — progress

**Issue #33 is not closed** until U1–U6 have Principal evidence and a human checkpoint for
FixBugsFirst.

## Shipped 2026-08-07 (implementation tranche)

| Piece                                           | Location                                            | Tests                                |
| ----------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| Governed Act chain                              | `packages/cop-core/src/governed-act.js`             | `scripts/test-governed-act.js`       |
| CapabilityInvocation → Act → Trace → Imputation | same                                                | same                                 |
| `jhnDelegateToHandler`                          | same                                                | same                                 |
| John + replaceable handler                      | `apps/platform/mcp/cop/jhnDelegatingAgent.js`       | same                                 |
| Existing local chat path                        | `run-jhn-local-chat.js` + `jhnLocalAgent.js`        | existing                             |
| **John → Cogentia MCP dogfood**                 | `jhnCogentiaTurn.js` + `smoke-jhn-cogentia-turn.js` | unit + live Fracta (2026-08-07)      |
| Cogentia MCP client (JHN token)                 | `cogentiaMcpClient.js`                              | `mcp/test/cogentiaMcpClient.test.js` |

### U-gate status (agent evidence only)

| Gate                                | Status               | Evidence                                                                                                                                                     |
| ----------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **U1** John conversational identity | **partial→stronger** | Live dogfood returns `conversational_identity: "John"`; Cogentia is capability metadata only; entry: `node apps/platform/scripts/smoke-jhn-cogentia-turn.js` |
| **U2** bounded context / privacy    | **partial→stronger** | Dogfood uses skill + limited search (limit 5), restricted COP events; not full corpus dump                                                                   |
| **U3** governed handler delegation  | **yes (unit)**       | Handler id recorded separately; failure path does not wipe store                                                                                             |
| **U4** first real governed Act      | **yes (unit)**       | Four-event chain + receipt; not yet a live repo write                                                                                                        |
| **U5** interrupt/revoke             | **yes (unit)**       | `recordMandateControl` + `isMandateActive` + refuse further Acts                                                                                             |
| **U6** runbook + tests              | **partial**          | Unit + live smoke + `JHN_GO_LIVE.md`; Principal checkpoint still open                                                                                        |

## Commands

```bash
cd inseme
node scripts/test-governed-act.js

# John → Cogentia (requires COGENTIA_MCP_JHN_TOKEN in inseme/.env / vault)
cd apps/platform
node mcp/test/jhnCogentiaTurn.test.js
node scripts/smoke-jhn-cogentia-turn.js --message "What is a Cognitive Packet?"
# optional subagent:
# node scripts/smoke-jhn-cogentia-turn.js --subagent elf-1 --message "…"

# Existing local COP console (requires env from run:jhn:local-cop)
# pnpm --filter platform run:jhn:local-cop  # see package scripts
```

## Principal checkpoint (template)

When ready:

```text
JHN usable threshold reached → activate FixBugsFirst
```

or:

```text
threshold not reached → blockers: …
```
