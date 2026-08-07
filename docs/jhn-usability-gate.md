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

| Piece                                           | Location                                      | Tests                          |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------ |
| Governed Act chain                              | `packages/cop-core/src/governed-act.js`       | `scripts/test-governed-act.js` |
| CapabilityInvocation → Act → Trace → Imputation | same                                          | same                           |
| `jhnDelegateToHandler`                          | same                                          | same                           |
| John + replaceable handler                      | `apps/platform/mcp/cop/jhnDelegatingAgent.js` | same                           |
| Existing local chat path                        | `run-jhn-local-chat.js` + `jhnLocalAgent.js`  | existing                       |

### U-gate status (agent evidence only)

| Gate                                | Status         | Evidence                                                                                  |
| ----------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| **U1** John conversational identity | **partial**    | Delegating agent always returns `conversational_identity: "John"`; local chat path exists |
| **U2** bounded context / privacy    | **partial**    | Restricted visibility on COP events; full public/private overlay still instance config    |
| **U3** governed handler delegation  | **yes (unit)** | Handler id recorded separately; failure path does not wipe store                          |
| **U4** first real governed Act      | **yes (unit)** | Four-event chain + receipt; not yet a live repo write                                     |
| **U5** interrupt/revoke             | **not yet**    | Needs mandate revoke path                                                                 |
| **U6** runbook + tests              | **partial**    | This doc + unit tests; full start/stop runbook still RUNBOOK_JHN                          |

## Commands

```bash
cd inseme
node scripts/test-governed-act.js

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
