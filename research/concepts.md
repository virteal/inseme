---
title: "Concept Index — inseme"
description:
  "Typed concept registry for humans and AI agents; structure only, not semantic authority."
layout: default
nav_order: 3
last_modified_at: 2026-05-16
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md
last_stamped_at: 2026-05-16
---

# Concept Index — inseme

This file maps concepts used across the corpus.

`cogentia.js` maintains structure, links, scopes, status and graphs. It does not infer semantic
truth.

## Status scale

- **Seed** — intuition not yet stabilized.
- **Working** — recurring and usable, but still evolving.
- **Defined** — explicit definition exists.
- **Operational** — connected to implementation, protocol, code, governance or legal use.
- **Canonical** — should be treated as a reference concept unless revised.

---

## Cogentia

**Type:** abstract concept / agentivity class **Scope:** Global **Status:** Working

**Short definition:** Cogentia designates the actual situated agentivity of an entity — physical
person, legal person, or AI agent — combining memory, mandate, capabilities, procedures, acts and
traces.

**Parent concepts:**

- Traceable agency

**Child concepts:**

- Cogentigram
- Operational memory

**Reference documents:**

- `research/concepts.md`

**Used in:**

- digital twin work
- AI agent governance

---

## Cogentigram

**Type:** representation / map **Scope:** Global **Status:** Working

**Short definition:** A cogentigram is a structured, partial, auditable and revisable representation
of a Cogentia.

**Parent concepts:**

- Cogentia

**Related concepts:**

- Map vs territory
- Operational memory
- Traceable agency

---

## COP (Continuous Operation Protocol)

**Type:** protocol / runtime **Scope:** Global **Status:** Canonical

**Short definition:** The base runtime and persistent event log maintaining states and actions
across the Inseme platform.

**Reference documents:**

- `packages/cop-core/Architecture.md`

---

## Briques

**Type:** modular component **Scope:** Global **Status:** Operational

**Short definition:** Modular, composable application modules embedded inside the Inseme platform
for expanding capabilities.

**Reference documents:**

- `docs/MODULAR_SYSTEM.md`

---

## Kudocracy

**Type:** governance system **Scope:** Global **Status:** Defined

**Short definition:** Democratic tooling and reputation-based governance modules built natively on
the Inseme platform.

---

## Agora

**Type:** system model **Scope:** Global **Status:** Defined

**Short definition:** A structured digital space for assembly and deliberation, running on the COP
foundation.

---

## Ophélia

**Type:** agent **Scope:** Global **Status:** Operational

**Short definition:** The trusted, protocol-native AI mediator connecting the ecosystem and
assisting humans in navigating the platform.

---

## COP Invariants

**Type:** cryptographic rule **Scope:** repository-specific **Status:** Canonical

**Short definition:** The unchangeable, hardened rules and cryptographic state boundaries that the
Continuous Operation Protocol enforces locally upon all state machines.

**Reference documents:**

- `packages/cop-core/Invariants.md`

---

## Brique Spec / Multi-Instance

**Type:** technical specification **Scope:** project-specific **Status:** Defined

**Short definition:** The technical specification dictating how Briques are instantiated, isolated,
and operated across different rooms and groups.

**Reference documents:**

- `packages/cop-host/BRIQUE_SPEC.md`
- `packages/cop-host/docs/MULTI_INSTANCE.md`

---

## Modular System

**Type:** frontend architecture **Scope:** repository-specific **Status:** Working

**Short definition:** The architecture permitting dynamic loading, unloading, and routing of Briques
within the React and Vite frontend ecosystems.

**Reference documents:**

- `docs/MODULAR_SYSTEM.md`

<!-- BEGIN_AUTO: backlinks -->

### Backlinks

_These documents link to this file:_

- [Corpus Status — inseme](corpus-status.md)
- [Research Index — Inseme](index.md)

<!-- END_AUTO: backlinks -->
