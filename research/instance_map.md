---
title: "Instance map — locked names and regimes"
date: "2026-07-29"
version: "0.1"
license: "CC BY-SA 4.0"
document_role: "operational"
document_kind: "operational-note"
visibility: "public"
lifecycle_state: "active"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "operational-note"
classification_confidence: "medium"
repository: "JeanHuguesRobert/inseme"
canonical_path: "research/instance_map.md"
---

# Instance map — locked names and regimes

**Locked order of founding instances:**

1. **`pertitellu-corte`** (Pertitellu / LePP / lepp.fr) — first **collective / civic** instance
2. **`jhn`** (jhn.baronsmariani.org) — founding **personal** TwinRoot
3. **`fractavolta-public-guide`** — public **infant** corpus Guide surface (Cogentia, not Inseme
   tenant)

| `instance_id`              | Kind            | Domain                   | Codebase              |
| -------------------------- | --------------- | ------------------------ | --------------------- |
| `pertitellu-corte`         | civic           | lepp.fr                  | survey → inseme later |
| `jhn`                      | personal        | jhn.baronsmariani.org    | inseme apps/platform  |
| `fractavolta-public-guide` | service surface | fractavolta.com / Guide  | cogentia              |
| `cogentia-public-mcp`      | service         | cogentia.fractavolta.com | cogentia              |

Agents/personas are COP objects **inside** an instance, not new DNS tenants.  
Rename only by explicit human decision and a new version of this note.

### Federation vs person↔twin link (do not conflate)

| Concern                     | Where                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Instance registry / hub** | Discovery of _instances_ in the Pertitellu federation (Corte = first collective + bootstrap hub). Optional dual-role on the hub Supabase.              |
| **User ↔ personal twin**    | Optional association of a _collective member account_ with a _personal TwinRoot address_ (email match as primary verification). **Not in schema yet.** |

Full plan (agents must read before inventing columns):  
[user_personal_twin_link.md](user_personal_twin_link.md) — tracking
**[inseme#34](https://github.com/JeanHuguesRobert/inseme/issues/34)**.

**Access on the personal twin host** (`jhn.baronsmariani.org`): visitor classes and owner full
access —  
[personal_twin_access_policy.md](personal_twin_access_policy.md) —
**[inseme#35](https://github.com/JeanHuguesRobert/inseme/issues/35)**.

**Public intelligence:** John public chat is a readonly **superset** of the FractaVolta Guide
(public corpus about the Principal). Factorization plan —
[personal_twin_public_intelligence_core.md](personal_twin_public_intelligence_core.md) —
**[inseme#37](https://github.com/JeanHuguesRobert/inseme/issues/37)** ·
**[cogentia#85](https://github.com/JeanHuguesRobert/cogentia/issues/85)**.

See also:
[personal_instance_democracy_and_non_capturable_match.md](personal_instance_democracy_and_non_capturable_match.md),  
[RUNBOOK_JHN_PERSONAL_INSTANCE.md](../apps/platform/docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md),  
[user_personal_twin_link.md](user_personal_twin_link.md).
