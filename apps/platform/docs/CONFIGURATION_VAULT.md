# Configuration Vault (`instance_config`)

**Status:** canonical (2026-07)  
**Scope:** every Inseme / platform Supabase instance (Pertitellu, JHN, future personal or civic)

---

## Why this exists (remember this)

Without a vault, every new API key had to be copy-pasted into the **Netlify UI** (and again for
previews, other sites, other instances). That was operational hell: easy to forget, easy to mix
projects (e.g. Pertitellu vs JHN), impossible to review in git, painful for multi-instance.

**The vault was built so Netlify only needs the minimum bootstrap credentials**, while the full set
of keys and identity config lives in the instance database and is shared by all runtimes that can
reach that project.

```text
Workstation SoT:  inseme/.env
        │
        │  push-env-to-vault / loadConfig align
        ▼
Supabase table:   public.instance_config   ← "the vault"
        ▲
        │  service_role client reads full table
        │
   ┌────┴────┬──────────────────┬─────────────────────┐
   │ Local   │ Netlify Node     │ Netlify Edge (Deno) │
   │ Vite /  │ functions/       │ edge-functions/     │
   │ scripts │ (legacy Node)    │ (modern Deno)       │
   └─────────┴──────────────────┴─────────────────────┘
```

| Runtime | How it gets secrets | Bootstrap outside vault |
|---------|---------------------|-------------------------|
| **Local** (Vite, scripts) | `.env` and/or vault if `SERVICE_ROLE` present | Full `.env` is fine for dogfood |
| **Netlify Functions** (`netlify/functions/`, **Node**) | `instanceConfig.backend.js` → admin client → vault | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` of **this** project |
| **Netlify Edge** (`netlify/edge-functions/`, **Deno**) | `instanceConfig.edge.js` → admin client → vault | Same two vars in Netlify env |

Public HTTP config endpoints **must not** expose `is_secret=true` rows (code filter + RLS).

---

## Design principles

1. **One vault per Supabase project** — never share Pertitellu secrets into JHN or the reverse.
2. **Workstation → vault is a full copy of real capabilities** — every non-empty, non-placeholder
   key available in `inseme/.env` should be pushable (`push-env-to-vault --apply`).
3. **Empty / placeholders stay empty** — e.g. `ANTHROPIC_API_KEY=` or `your_…` must not be stored
   as a fake key (code would believe the provider is configured).
4. **Netlify stays thin** — only bootstrap to open the vault; not a second secret spreadsheet.
5. **Migrations for public/identity schema seeds** — CLI `supabase/migrations/`; secrets never
   committed in migration SQL (use the push script).

---

## Table (conceptual)

See live migrations under `apps/platform/supabase/migrations/` for the authoritative DDL.

Important columns:

| Column | Role |
|--------|------|
| `key` | Normalized name (`openai_api_key`, not `OPENAI_API_KEY`) |
| `value` / `value_json` | Payload |
| `is_secret` | Never serve to browsers / public config API |
| `is_public` | Safe for public config snapshot |
| `category` | identity, branding, features, secrets, … |

RLS (JHN+): secret rows are **not** readable by `anon` / `authenticated`. **Service role** bypasses
RLS (edge/backend admin path).

---

## Day-to-day commands

```powershell
cd C:\tweesic\inseme\apps\platform

# Dry-run: what would go to the vault
node scripts/push-env-to-vault.js

# Complete copy of non-empty / non-placeholder .env keys → vault
node scripts/push-env-to-vault.js --apply --verbose

# Schema / public seed only (no secrets in git)
supabase db push
supabase migration list
```

Source implementation:

- CLI push / env mapping: `apps/platform/scripts/lib/config.js`, `scripts/push-env-to-vault.js`
- Frontend: `@inseme/cop-host` + `instanceConfig.client.js`
- Node functions: `packages/cop-host/src/config/instanceConfig.backend.js` + `runtime/function.js`
- Deno edge: `packages/cop-host/src/config/instanceConfig.edge.js` + `runtime/edge.js`

---

## Netlify: two function families

Netlify has (names vary in docs):

1. **Serverless / Functions** — traditionally **Node.js** → our `netlify/functions/`
2. **Edge Functions** — **Deno** → our `netlify/edge-functions/`

Both should load config through the vault after bootstrapping with the **same project’s**
service role. Prefer the matching adapter (`backend` vs `edge`); avoid importing Node-only modules
from Deno edge.

---

## Instance lifecycle (mental model)

```text
1. Create blank Supabase project
2. CLI migrations (schema + public identity seed)
3. inseme/.env → JHN URL + service_role + all workstation keys
4. push-env-to-vault --apply
5. Netlify site env: only SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ build vars)
6. Local: pnpm platform:dev against same project
```

Personal instance dogfood: `docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md`.  
Multi-instance overview: `docs/ARCHITECTURE_MULTI_INSTANCE.md`.  
Provisioning: `docs/PROVISIONING_GUIDE.md` (step-vault).

---

## Anti-patterns

| Don't | Do |
|-------|-----|
| Paste every API key into Netlify UI | Vault + thin Netlify bootstrap |
| Copy vault rows between Supabase projects blindly | Per-project push from that instance’s SoT |
| Store `your_anthropic_key_here` in vault | Leave empty until real key exists |
| Commit secrets in SQL migrations | `push-env-to-vault` only |
| Use Pertitellu service_role with JHN URL | Always pair URL + keys of one project |
| Push `HTTP_PROXY` / `VITE_PROXY_URL` into vault | Keep proxies **workstation-only** (CSP + dogfood break otherwise) |

---

## Related

- `apps/platform/scripts/push-env-to-vault.js`
- `apps/platform/scripts/sync-secrets.js` (hygiene / dry-run; `.env` remains SoT on workstation)
- `apps/platform/docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md`
- `apps/platform/docs/ARCHITECTURE_MULTI_INSTANCE.md` (section vault / Netlify thin env)

---

_Last updated: 2026-07-20 — rewrote obsolete Survey-era notes; records “avoid Netlify key hell” rationale and Node vs Deno edge paths._
