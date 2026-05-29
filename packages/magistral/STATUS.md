# Magistral — Current Status (May 2026)

## Context

Work on Magistral was paused during the massive 2025 refactoring of the Inseme platform.  
As of now (late May 2026), **no brique is marked "active"** — everything is `experimental` (except
`brique-auxilia` which is `skeleton`).

## High-Level State

| Component                       | Status       | Notes                                                                                      |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| Core Router (`src/router.js`)   | **Advanced** | Most of the plan is implemented (metrics, disable/enable, traffic log, probe, map editing) |
| Standalone Deno Pilot           | **Advanced** | Endpoints for metrics, logs, probe, map/add/save, disable/enable are present               |
| Sovereign Node (`models/ai.js`) | **Good**     | Persistence, logging, basic routing work. Some admin endpoints present                     |
| Admin UI (pilot)                | **Partial**  | Metrics tab works. Explore and Logs tabs have UI + JS but need full backend parity testing |
| Registry (maps + blueprints)    | **Basic**    | `default.json` + `coding.json` exist                                                       |
| Documentation                   | **Outdated** | README contains old ambitious prompt + partial spec                                        |
| Easy "Run" experience           | **Weak**     | Requires manual `node scripts/launcher.js --pilot ...`                                     |

## What is Working Today

- Intelligent routing across multiple LLM providers with tier + fallback logic.
- Automatic exhaustion handling (429/403/402).
- Manual `disable` / `enable` of nodes.
- Per-node metrics (requests, successes, avg latency, last error).
- Traffic logging (NDJSON + ring buffer) with filtering.
- Model probing (`/v1/magistral/probe`).
- Dynamic map editing + save (`/v1/magistral/map/add` + `/map/save`).
- Persistence across restarts for both the standalone pilot and the embedded Sovereign router.

## Remaining Work (from implementation_plan.md)

1. **Polish "Explore" tab** (probe → nice table → "Add to map" → Save)
2. **Full Logs browser** in the Sovereign inspector (`ai-inspector.html`)
3. **Better token usage estimation** (currently mostly 0 for streams)
4. **End-to-end testing** of the probe + map editing flow from the UI
5. **Cleaner launcher / one-command start** for development
6. **Documentation refresh** (current README is a mix of old ambitious prompt and partial spec)

## Recommended Next Steps (prioritized)

**DONE (May 2026 - DX focus)**

- Created `scripts/dev.js` + `npm run dev` / `npm run dev:full`
- Cleaned up README with realistic current instructions
- Created this STATUS.md

**Next priorities**

1. Improve the "Explore" tab experience (probe + add to map flow)
2. Finish/polish the Logs browser in both UIs
3. Make the Sovereign Node (`packages/models`) fully expose the same rich Magistral admin surface as
   the standalone pilot
4. Better error messages and onboarding when maps/blueprints are missing

---

**Last updated:** 2026-05-28 — Work resumed after long pause.
