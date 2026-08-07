---
title: "COP append-only + GitHub webhook — MVP status (issues #28 / #29)"
date: "2026-08-07"
document_role: operational
document_kind: status
visibility: public
lifecycle_state: active
related_issues:
  - "https://github.com/JeanHuguesRobert/inseme/issues/28"
  - "https://github.com/JeanHuguesRobert/inseme/issues/29"
  - "https://github.com/JeanHuguesRobert/inseme/issues/30"
---

# COP append-only + GitHub webhook — MVP status

## #28 status: **DONE** (2026-08-07)

Issue #28 acceptance (append-only persistence profile + local spool) is met. Issue **#29** remains
open for live GitHub App E2E, full event map, and activity projection.

## Shipped

| Surface                                  | Location                                                                         | Tests / evidence                   |
| ---------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| Append-only SQL profile                  | `apps/platform/supabase/migrations/20260731180000_cop_append_only_event_log.sql` | schema tests; **applied on JHN**   |
| Envelope columns + `cop_event_append`    | `…/20260807120000_cop_event_log_envelope_columns.sql`                            | schema tests; **applied on JHN**   |
| Live JHN objects                         | `cop_event_log`, `github_webhook_deliveries`, `cop_spool_queue`, RPCs            | `supabase db query` 2026-08-07     |
| Envelope schema + runtime validation     | `packages/cop-core/schemas/cop.event.v1.json`, `cop-event-envelope.js`           | `test-cop-event-spool.js`          |
| Memory store + NDJSON spool/replay       | `cop-event-spool.js`                                                             | `test-cop-event-spool.js`          |
| Artifacts + visibility projection        | `cop-event-artifacts.js`                                                         | `test-cop-event-artifacts.js`      |
| Persist pipeline (store → spool on fail) | `cop-event-persist.js`                                                           | `test-cop-event-artifacts.js`      |
| Supabase row/RPC shapes                  | `cop-event-supabase-shape.js`                                                    | unit tests                         |
| Edge durable path                        | `github-webhook.js`: delivery → artifact → `cop_event_append` → spool            | `test-deno-github-webhook-edge.js` |
| Source vs projection note                | `docs/cop-persistence-source-vs-projection.md`                                   | —                                  |

## #28 checklist (complete)

- [x] COP/Core storage interfaces independent of Supabase
- [x] Working NDJSON spool + replay
- [x] `cop.event/v1` schema + runtime validation
- [x] Topic order, duplicate ingestion, rejected UPDATE/DELETE tests
- [x] Export/import path
- [x] Artifact externalization (hash + ref) + restricted visibility tests
- [x] Source vs artifact vs projection note
- [x] Migration applied on target Supabase project (**JHN** `ndiysuhzmztatpxbkezn`)
- [x] Wire edge webhook path to durable append + spool fallback

## Residual checklist — #29 (still OPEN)

- [ ] Live GitHub App install on explicit allowlist
- [ ] End-to-end: `ping` / `push` / issue / PR / workflow → delivery → COP event
- [ ] Full event subscription set from issue body
- [ ] Activity-feed projection for the mandant
- [ ] Periodic GitHub API reconcile for gaps
- [ ] Storage bucket `cop-artifacts` provisioned in each instance (edge upload optional)
- [ ] Config/docs: delivery ≠ COP event ≠ FractaLog in operator runbook

## Operator / agent commands

```bash
cd inseme
node scripts/test-cop-event-log-schema.js
node scripts/test-cop-event-spool.js
node scripts/test-cop-event-artifacts.js
node scripts/test-github-webhook-ingress.js
node scripts/test-deno-github-webhook-edge.js

# Apply migrations (linked project)
cd apps/platform && supabase db push --linked
```
