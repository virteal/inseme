---
title: "Interactions Registry & multichannel messaging (Personal Twin service)"
date: "2026-08-08"
version: "0.1"
license: "CC BY-SA 4.0"
document_role: operational
document_kind: design-note
visibility: public
repository: "JeanHuguesRobert/inseme"
canonical_path: "research/interactions_registry_and_multichannel_messaging.md"
status: planned
github_issues:
  platform: "https://github.com/JeanHuguesRobert/inseme/issues/36"
  personal_public: "https://github.com/JeanHuguesRobert/JeanHuguesRobert/issues/2"
  method: "https://github.com/JeanHuguesRobert/cogentia/issues/84"
related:
  - research/personal_twin_access_policy.md
  - research/user_personal_twin_link.md
  - research/instance_map.md
  - "https://github.com/JeanHuguesRobert/cogentia/tree/main/interaction_packets"
  - "https://github.com/JeanHuguesRobert/JeanHuguesRobert/tree/main/interaction_packets"
  - "JeanHuguesRobert/inseme#35"
  - "JeanHuguesRobert/inseme#34"
  - "JeanHuguesRobert/inseme#36"
  - "JeanHuguesRobert/JeanHuguesRobert#2"
  - "JeanHuguesRobert/cogentia#84"
---

# Interactions Registry & multichannel messaging

**Tracking (cross-repo):**

| Layer                         | Issue                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Platform / Twin desk (Inseme) | **[inseme#36](https://github.com/JeanHuguesRobert/inseme/issues/36)**                   |
| Public personal traces (JHR)  | **[JeanHuguesRobert#2](https://github.com/JeanHuguesRobert/JeanHuguesRobert/issues/2)** |
| Generic method (Cogentia)     | **[cogentia#84](https://github.com/JeanHuguesRobert/cogentia/issues/84)**               |

Private overlay stays in **`registre-mariani`** (no public secrets in issues or public packs).

**Audience:** all agents (Inseme, Cogentia, personal Twin, Operium). Do not invent a second packet
format without reading the generic method first.

## 1. Problem (Principal, 2026-08-08)

- Prefer **traceable** interactions; **SMTP email** is a strong default spine (durable, addressable,
  archival).
- Reality is **fragmented**: email, chat apps, social DMs, GitHub issues, WhatsApp, forms, etc. — a
  “mess” for many people.
- Cogentia Personal Twin should help **manage that mess**, not replace every channel.
- Starting point already exists: the **Interactions Registry** (Interaction Packets), maintained
  with AI agents.

## 2. What already exists (do not reinvent)

| Layer                            | Repo / path                                                                | Role                                                                 |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Method (generic)**             | `JeanHuguesRobert/cogentia` → `interaction_packets/`                       | Schema, prompts, architecture, extract/update pipeline               |
| **Public personal traces**       | `JeanHuguesRobert/JeanHuguesRobert` → `interaction_packets/`               | Live packets, readable/raw copies, dashboard, archive policy (D0–D4) |
| **Private / restricted overlay** | `JeanHuguesRobert/registre-mariani` → `interaction_packets/` (and related) | Non-public cases, credentials never in public packs                  |
| **Archive policy**               | JHR `interaction_packets/archive_policy.md`                                | YAML + readable + redacted raw; disclosure levels; follow-ups        |

Principle already stated in archive policy:

```text
Method lives in cogentia.
Traces live with the subject (personal / org repo), not only in the method repo.
```

Packet sketch today: id, dates, `canal`, interlocutor, subject, status, disclosure level, public
summary, copies (readable / redacted raw), follow-ups.

## 3. Product vision

```text
Many channels in the wild
        │
        ▼
  Channel adapters (ingress / egress)
        │
        ▼
  Interaction Packets (registry spine)
        │
        ├── public pack (JHR or other twin public repo)
        ├── private pack (registre / twin private store)
        └── optional COP Event link (Inseme runtime)
        │
        ▼
  Personal Twin “interaction desk”
  (owner full access; visitors per #35)
```

**SMTP / email:** preferred **traceable** path and archival spine — not the only UI people use.
Other channels are first-class _ingress_, with email (or redacted email-shaped archive) as the
durable copy when possible.

**Service for others later:** any Personal Twin can run the same registry pattern (method =
cogentia; traces = that person’s repos / twin store).

## 4. Relation to access policy (#35) and twin link (#34)

| Topic                  | Role                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **#35 access classes** | Who may **read/write** which interactions (anonymous cannot see private packs; owner sees all; agent writes under mandate). |
| **#34 user↔twin**      | Cross-instance identity; not the message store.                                                                             |
| **This plan**          | **What** is recorded, on which channel, with what disclosure and follow-up.                                                 |

Conversational agent on `jhn.baronsmariani.org` must:

1. Know `access_class` (#35).
2. Prefer creating/updating **Interaction Packets** for consequential exchanges (not only chat
   ephemera).
3. Never dump private registry content to anonymous visitors.

## 5. Implementation plan

### Phase 0 — Doctrine & inventory

- [x] This note
- [ ] Issues opened (inseme + JHR)
- [ ] Short inventory table of current packets / channels in use
- [ ] Confirm D0–D4 still fit multichannel (chat vs email)

### Phase 1 — Stabilize packet fields for multichannel

Extend (generically in **cogentia** method) without breaking existing YAML:

```text
canal / channel_kind     email | github | web_chat | whatsapp | other
channel_message_ids[]    external ids when available
participants[]           subject refs + display labels
twin_root_ref            e.g. twin:jhn
access_context           who initiated (owner | visitor | agent)
cop_event_ref?           optional link to COP runtime
```

Keep **disclosure level** and **three copy forms** (YAML / readable / redacted raw).

### Phase 2 — Agent workflow (already partially real)

1. Document “when to open a packet” vs “chat only.”
2. Reuse cogentia prompts: `extract_interaction_packet`, `update_registry`, `followup_generation`.
3. Public vs private: route by disclosure; private never to public GitHub.

### Phase 3 — Personal Twin product surface (Inseme)

1. Owner “desk”: list open cases, follow-ups due, channel mix.
2. Optional: visitor leaves a **message** → creates claimed packet (public or private per policy) +
   optional SMTP notify owner.
3. Enforce #35 on all desk APIs.

### Phase 4 — Channel adapters (incremental)

| Order | Channel                   | Notes                                                          |
| ----- | ------------------------- | -------------------------------------------------------------- |
| 1     | Email / SMTP              | Spine; mail_trace pipeline already sketched in cogentia        |
| 2     | GitHub issues / comments  | Already agent-native                                           |
| 3     | Web chat on personal twin | New; maps to packets when consequential                        |
| 4     | Others (WhatsApp, etc.)   | Experimental; always archive to packet + preferably email copy |

### Phase 5 — Multi-user service

- Package method + desk UI so other Personal Twins adopt the same registry.
- Hosting: git-backed packs first; optional Supabase projection later (like wiki story).

## 6. Non-goals (v1)

- Replacing WhatsApp / Telegram for users
- Single global social graph
- Storing private mail bodies in public JHR without redaction
- Making Inseme instance registry own interaction traces

## 7. Repo ownership

| Work                                     | Home                                        |
| ---------------------------------------- | ------------------------------------------- |
| Packet method, prompts, schema evolution | **cogentia** `interaction_packets/`         |
| Public JHN traces                        | **JeanHuguesRobert** `interaction_packets/` |
| Private traces                           | **registre-mariani**                        |
| Twin UI / access / chat integration      | **inseme** (this note + #36)                |
| Ops / deploy                             | **operium** only if production plumbing     |

## 8. Open questions for Principal

1. Should **every** web chat turn become a packet, or only “consequential” ones (default:
   consequential + explicit “record this”)?
2. Default disclosure for visitor→owner messages on jhn (D2 private desk vs D3 public)?
3. Is **email notify** mandatory when a visitor leaves a desk message?

## 9. See also

- Cogentia method: https://github.com/JeanHuguesRobert/cogentia/tree/main/interaction_packets
- JHR register: https://github.com/JeanHuguesRobert/JeanHuguesRobert/tree/main/interaction_packets
- [Personal Twin access policy](personal_twin_access_policy.md) (#35)
- [User ↔ personal twin link](user_personal_twin_link.md) (#34)  
  )
