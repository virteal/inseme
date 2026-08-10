---
title: "La Nasa access boundary"
status: "implementation-ready, not deployed"
visibility: "public"
---

# La Nasa access boundary

La Nasa has two deliberately different surfaces:

| Surface           | URL                                                                 | Audience                | Capability                                                 |
| ----------------- | ------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| Public projection | `https://cogentia.fractavolta.com/ops/console/?view=fix-bugs-first` | everyone                | read-only, expurgated operational and Fix Bugs First views |
| John workspace    | `https://jhn.baronsmariani.org/nasa`                                | authenticated operators | future, server-mediated work actions                       |

The public surface contains no browser token, node identity, endpoint, private registry data, or
action control. It must remain safe to share as a demonstration URL.

## John authentication boundary

`/nasa` sends the current John Supabase access token only to its same-origin endpoint:

```text
GET or POST /api/nasa/control
```

The Netlify Edge Function `nasa-control` validates the token with the JHN Supabase project using
`auth.getUser(token)`. It recognizes the Principal only when the user’s immutable Supabase subject
(`auth.users.id`) matches the server-only Netlify variable:

```text
NASA_PRINCIPAL_SUBJECT=<uuid-for-jeanhuguesrobert-gmail>
```

Delegates are separately listed, only after a mandate exists:

```text
NASA_OPERATOR_SUBJECTS=<uuid-for-a-mandated-agent-account>
```

Do not use email addresses or editable `user_metadata` for the runtime authorization decision. The
Principal’s authoritative email binding remains private configuration, not public site content. Each
agent must have a separate Supabase account and subject UUID; never share the Principal password or
a browser session with an agent.

The endpoint is fail-closed:

- absent or invalid session → `401`;
- missing Principal subject → `503`;
- authenticated but not allowed → `403`;
- operator action before an action bridge is configured → `501`.

The `501` response is intentional. It proves that authentication and authorization are in place
without accidentally granting write access to Fracta.

## Deployment checklist

Before publishing the John increment:

1. Create or confirm the Principal’s designated email/password account on `jhn.baronsmariani.org`.
2. In Supabase Authentication, identify that account’s UUID; create separate accounts only for
   mandated agents.
3. In the JHN Netlify site environment, set `NASA_PRINCIPAL_SUBJECT` to the Principal UUID. Add
   `NASA_OPERATOR_SUBJECTS` only for approved delegates.
4. Ensure the existing server-only `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or
   `VITE_SUPABASE_ANON_KEY`) refer to the JHN project. Do not add a service-role key for this
   endpoint.
5. Deploy, then test the four outcomes above from a browser and HTTP client.
6. Only then implement a narrow, audited action bridge. It must receive the validated John identity
   server-side and use a host-only Fracta credential; it must never accept a Fracta token supplied
   by a browser.

## Current limit

No public or authenticated write operation has been deployed by this increment. The public dashboard
is a projection; the John workspace is the authentication and authorization foundation for later
bounded actions.
