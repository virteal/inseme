---
title: "GitHub webhook ingress for Digital Twin (Inseme #29)"
date: "2026-08-07"
document_role: operational
document_kind: method
visibility: public
related_issues:
  - "https://github.com/JeanHuguesRobert/inseme/issues/29"
  - "https://github.com/JeanHuguesRobert/inseme/issues/28"
---

# GitHub webhook ingress (Digital Twin)

**GitHub delivery ≠ COP event ≠ FractaLog / activity feed.**

| Layer             | What it is                                                           |
| ----------------- | -------------------------------------------------------------------- |
| **Delivery**      | Provider-native evidence (`github_webhook_deliveries`)               |
| **COP event**     | Normalized durable fact (`cop.event/v1` via `cop_event_append`)      |
| **Activity feed** | Rebuildable private projection for the mandant (`buildActivityFeed`) |
| **FractaLog**     | Federated reconstructible view (later) — not this feed               |

GitHub signatures prove **App delivery path**, not legal Principal / mandate (#30).

## Endpoint

```text
POST /api/webhooks/github
```

Netlify edge: `apps/platform/netlify/edge-functions/github-webhook.js`

## Secrets (never in Git)

| Name                                         | Where                             |
| -------------------------------------------- | --------------------------------- |
| `GITHUB_WEBHOOK_SECRET`                      | Netlify / edge env                |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | edge                              |
| `GITHUB_REPO_ALLOWLIST`                      | comma-separated `owner/repo`      |
| `COP_ARTIFACT_BUCKET`                        | optional, default `cop-artifacts` |

## Instance profile (example)

```yaml
# instances/jhn-github-ingress.example.yaml
instance_id: jhn-personal
anchor_repository: JeanHuguesRobert/JeanHuguesRobert
observed_repositories:
  - name: JeanHuguesRobert/JeanHuguesRobert
    role: anchor
  - name: JeanHuguesRobert/inseme
    role: work
  - name: JeanHuguesRobert/cogentia
    role: work
github_events: # see GITHUB_EVENT_SUBSCRIPTIONS in github-ingress.js
  - push
  - issues
  - pull_request
  - workflow_run
  # …
```

## GitHub App setup (operator)

1. Create GitHub App (or use existing) with **Subscribe to events** matching the subscription list.
2. Set webhook URL to the deployed edge URL ending in `/api/webhooks/github`.
3. Set webhook secret → `GITHUB_WEBHOOK_SECRET`.
4. Install on **allowlisted** repositories only.
5. Provision private Storage bucket `cop-artifacts` on the instance Supabase if large payloads are
   expected.

## Code surfaces

| Module                                    | Role                                  |
| ----------------------------------------- | ------------------------------------- |
| `packages/cop-core/src/github-ingress.js` | HMAC, allowlist, full event map       |
| `github-activity-feed.js`                 | Private activity projection           |
| `github-delivery-replay.js`               | Remap after mapper changes            |
| `github-reconcile.js`                     | Gap detection vs injected GitHub list |
| Edge `github-webhook.js`                  | 202 + durable #28 path                |

## Local simulation

```bash
node scripts/simulate-github-webhook-e2e.js
node scripts/test-github-webhook-ingress.js
node scripts/test-github-activity-feed.js
```

## Activity feed

```js
import { buildActivityFeed } from "@inseme/cop-core/…";
const feed = buildActivityFeed(store, { viewer_clearance: "restricted", limit: 50 });
```

Items carry `activity_kind`: observation | work_proposal | human_decision | publication | security |
governance | system.
