# Fracta Magistral OpenAI Profile

This profile runs the Inseme unified AI server as a loopback-only Magistral router for Cogentia on
the Fracta VPS.

The first public Guide deployment uses OpenAI as the initial conversational provider. Provider keys
stay on the server. Browser code calls Cogentia, and Cogentia calls the loopback AI router.

```text
FractaVolta Guide
  -> Cogentia /guide/chat
  -> Cogentia /v1/chat/completions
  -> Magistral on 127.0.0.1:8880
  -> OpenAI-compatible provider
```

## Environment

The service should use a dedicated map file rather than mutating the shared development default map:

```text
MAGISTRAL_API_KEY=local-loopback
MAGISTRAL_MAP_PATH=/etc/cogentia/magistral-openai-map.json
MAGISTRAL_INCLUDE_LOCAL_FALLBACK=false
OPENAI_API_KEY=...
```

`MAGISTRAL_API_KEY` currently enables the embedded router inside `packages/models/src/ai.js`. It is
not exposed publicly in this profile.

Example map:

```json
[
  {
    "id": "openai-fast",
    "url": "https://api.openai.com/v1/chat/completions",
    "model": "gpt-4o-mini",
    "tier": "fast",
    "weight": 10
  },
  {
    "id": "openai-strong",
    "url": "https://api.openai.com/v1/chat/completions",
    "model": "gpt-4.1-mini",
    "tier": "strong",
    "weight": 5
  }
]
```

Cogentia should force its chat model to `magistral`:

```text
COGENTIA_CHAT_MODEL=magistral
```

Without that setting, a surface-specific visible model such as `fractavolta-guide` may be forwarded
to the AI router and miss the Magistral routing branch.

## Quota

This profile is intentionally metered-provider aware:

- do not expose provider keys to browsers;
- keep Magistral loopback-only;
- route public answers through Cogentia retrieval first;
- keep fallback answers available when quota or provider access fails;
- add usage/billing monitoring later as a vendor-neutral service concern.
