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

## Principal verification checklist (agent-prepared)

Run before declaring FixBugsFirst:

| #   | Check                    | Command / URL                                                 | Expected                                                          |
| --- | ------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| P1  | Public site + SSL        | `node scripts/smoke-jhn-live.mjs`                             | `ok: true`, cert authorized                                       |
| P2  | Landing + `/john`        | https://jhn.baronsmariani.org/ · `/john`                      | 200, John markers in bundle                                       |
| P3  | John→Cogentia dogfood    | `cd apps/platform && node scripts/smoke-jhn-cogentia-turn.js` | `conversational_identity=John`, `cogentia_auth=jhn`, citations ≥1 |
| P4  | Governed Act unit        | `node scripts/test-governed-act.js`                           | green                                                             |
| P5  | JHN Cogentia unit        | `pnpm --filter platform run test:jhn:cogentia`                | green                                                             |
| P6  | Anon MCP still read-only | tools/list without token → no emit                            | 26 tools, no mutate                                               |
| P7  | Chat login (manual)      | Principal signs in on `/john`                                 | session works (agent cannot complete)                             |

**Agent cannot close #33 alone** — Principal must record one of the decisions below after P1–P7.

## Principal checkpoint (template)

When ready:

```text
JHN usable threshold reached → activate FixBugsFirst
Evidence: smoke-jhn-live + smoke-jhn-cogentia-turn + test-governed-act (dates…)
```

or:

```text
threshold not reached → blockers: …
```
