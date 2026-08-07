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

**Hygiene purpose:** dual-plane residual inventory so agents do not re-discover partial delivery.
This is **not** a claim that #28 / #29 acceptance criteria are fully met.

## Shipped (unit-tested MVP)

| Surface                     | Location                                                                                                                 | Tests                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Append-only SQL profile     | `apps/platform/supabase/migrations/20260731180000_cop_append_only_event_log.sql` (mirrored under `supabase/migrations/`) | `scripts/test-cop-event-log-schema.js`     |
| Tables                      | `github_webhook_deliveries`, `cop_event_log` (immutability trigger), `cop_spool_queue`                                   | schema string checks                       |
| Ingress library             | `packages/cop-core/src/github-ingress.js` (HMAC, normalize, allowlist, map)                                              | `scripts/test-github-webhook-ingress.js`   |
| Edge function               | `apps/platform/netlify/edge-functions/github-webhook.js` (`202` path)                                                    | `scripts/test-deno-github-webhook-edge.js` |
| Event envelope + hash       | `packages/cop-core/src/cop-event-envelope.js`, `schemas/cop.event.v1.json`                                               | `scripts/test-cop-event-spool.js`          |
| Memory store + NDJSON spool | `packages/cop-core/src/cop-event-spool.js` (append-only, replay, export/import)                                          | `scripts/test-cop-event-spool.js`          |
| Source vs projection note   | `docs/cop-persistence-source-vs-projection.md`                                                                           | —                                          |

Commits of record: `91b9141`, `e5cec1d`, `9f749ed`, plus 2026-08-07 residual envelope/spool.

## Residual checklist — #28 (keep OPEN)

- [x] COP/Core **storage interfaces** independent of Supabase (memory store + NDJSON spool ports)
- [x] **Working** NDJSON spool + **replay** into durable store (SQLite adapter still optional later)
- [x] Versioned **`cop.event/v1` JSON Schema** + runtime validation of full envelope
- [x] Store-level tests: topic order, duplicate ingestion, rejected UPDATE/DELETE
- [x] Export/import path (`exportAll` / `importAll`)
- [ ] Artifact externalization (hash + object-store ref) + restricted visibility tests
- [x] Short note: source vs artifact vs projection vs cache vs export
- [ ] Migration **applied** on target Supabase project (CI schema ≠ live apply)
- [ ] Wire edge webhook `202` path to spool/store (still #29 residual)

## Residual checklist — #29 (keep OPEN)

- [ ] Live GitHub App install on explicit allowlist
- [ ] End-to-end: `ping` / `push` / issue / PR / workflow → delivery → COP event
- [ ] Full event subscription set from issue body (many still unmapped)
- [ ] Async normalize after `202` wired to durable #28 store
- [ ] Idempotent re-delivery + mapper **replay**
- [ ] DB outage → spool/replay (#28 residual)
- [ ] Private **activity-feed projection** for the mandant
- [ ] Periodic GitHub API reconcile for gaps
- [ ] Config/docs: delivery ≠ COP event ≠ FractaLog; secrets never in git

## Non-goals (still true)

- #30 owns peer identity / mandate enforcement
- GitHub is ingress only; not Cogentia peer identity
- No autonomous agent writes from webhook path

## Operator / agent command surface

```bash
cd inseme
node scripts/test-cop-event-log-schema.js
node scripts/test-github-webhook-ingress.js
node scripts/test-deno-github-webhook-edge.js
node scripts/test-cop-event-spool.js
```

When a residual row is completed, tick it here **and** comment on the issue with evidence (commit
SHA, test name, live probe). Close #28 / #29 only when their checklist is empty or a human narrows
scope in writing.
