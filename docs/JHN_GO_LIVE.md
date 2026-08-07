---
title: "Go-live — jhn.baronsmariani.org"
date: "2026-08-07"
document_role: operational
document_kind: runbook
visibility: public
---

# Go-live — jhn.baronsmariani.org

**Goal:** public site usable as personal Twin entry (John), without touching lepp.fr.

## Status (2026-08-07)

| Check                                                             | Status                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| DNS `jhn.baronsmariani.org` → `jhn-baronsmariani-org.netlify.app` | OK                                                                                            |
| Netlify site `jhn-baronsmariani-org`                              | exists, linked to `JeanHuguesRobert/inseme`                                                   |
| **Published deploy**                                              | **ready** (manual zip of `apps/platform/dist`)                                                |
| `https://jhn-baronsmariani-org.netlify.app/`                      | **HTTP 200** (`/` and `/john`)                                                                |
| `https://jhn.baronsmariani.org/`                                  | **HTTPS 200**, cert **issued** (Let's Encrypt `CN=jhn.baronsmariani.org`, expires 2026-11-05) |
| Env `VITE_SUPABASE_*` / `SUPABASE_*`                              | present on site                                                                               |
| Landing                                                           | `HomeRoute` → John when host is `jhn.*`                                                       |

### SSL note

DNS CNAME is correct:

```text
jhn.baronsmariani.org.  CNAME  jhn-baronsmariani-org.netlify.app.
```

A missing trailing dot on the CNAME target can break ACME verification (Netlify appears “blocked”
until DNS is fixed and rechecked). After propagation, Netlify issued LE cert (`ssl=true`,
`force_ssl=true`, state `issued`). Verified with strict `curl` (no `-k`): HTTP 200 on `/` and
`/john`.

## Deploy (operator / agent on trusted machine)

```bash
cd inseme
# From monorepo root
pnpm platform:build

# Link once
netlify link --id bfe156be-6efe-4d28-9d45-4c60fb5de6b5

# Production publish (publish dir apps/platform/dist)
netlify deploy --prod --dir apps/platform/dist --site bfe156be-6efe-4d28-9d45-4c60fb5de6b5
```

Or trigger GitHub build: push to `main` with Netlify build settings:

- base / package path: `apps/platform` (or monorepo root with `pnpm platform:build`)
- publish: `apps/platform/dist`
- command: `pnpm platform:build` (from root) or site `package_path` = `apps/platform`

## Smoke after deploy

```bash
curl -fsS -m 20 https://jhn-baronsmariani-org.netlify.app/ | head
curl -fsS -m 20 https://jhn.baronsmariani.org/   # after SSL ready
# Expect JHN landing (John), not civic consultations home
```

| Path                   | Expected                     |
| ---------------------- | ---------------------------- |
| `/`                    | Landing John (personal twin) |
| `/john`                | Chat surface                 |
| `/cop-core`            | COP page                     |
| `/api/webhooks/github` | edge (POST only)             |

## Product surface (code)

- `HomeRoute` → `JhnLandingPage` when host/instance is personal twin
- `/john` → chat (`Bob` / Ophelia chat component)
- Governed Act + mandate revoke: `packages/cop-core/src/governed-act.js`

## Not required for first public smoke

- Full U1–U6 Principal checkpoint
- Live GitHub App webhooks
- Multi-tenant hub

## After smoke green

1. Confirm SSL cert issued for custom domain (Netlify Domain management).
2. Auth redirect URLs on Supabase JHN include `https://jhn.baronsmariani.org/**`.
3. Optional: set `feature_chatbot=true` in instance_config vault.
