# COP Core — Cognitive Orchestration Protocol

`cop-core` is the **reference specification package** for the Cognitive Orchestration Protocol
(COP).

It defines the **canonical data model, invariants, and interfaces** required to build durable,
replayable, and interoperable cognitive systems (AI agents, workflows, human-in-the-loop processes).

This package intentionally contains **no executable logic**.

COP is a **protocol**, not a framework, SDK, runtime, or product.

---

## What COP Is

COP standardizes how cognition is:

- **represented** (Events, Artifacts, Tasks, Steps),
- **ordered** (topic-local sequencing and causality),
- **persisted** (immutable event logs),
- **replayed** (deterministic reconstruction),
- **audited** (hashing, optional ledger),
- **shared** (CloudEvents, JSON-LD).

COP treats cognition as a **durable process**, not a transient computation.

Agents are replaceable. Models evolve. Cognition remains.

---

## What COP Is Not

COP is deliberately minimal. It does **not**:

- execute workflows,
- run agents,
- schedule tasks,
- manage infrastructure,
- depend on any database, broker, or cloud provider.

Those concerns belong to **runtimes** built on top of COP.

---

## Core Concepts

COP defines a small set of foundational primitives:

- **Event** — immutable record of a cognitive action
- **Topic** — unit of cognitive coherence
- **Task** — structured objective within a Topic
- **Step** — atomic unit of work inside a Task
- **Artifact** — durable cognitive output
- **Continuation** — suspended, resumable execution state

All durable state lives in Events and Artifacts.

Agents are **stateless**.

---

## Runtime Interfaces

`cop-core` defines pure interfaces that real systems must implement:

- **COPBus** — event publication and replay
- **COPStore** — deterministic projection storage
- **COPScheduler** — event dispatch and coordination
- **COPAgent** — stateless cognitive actor

Any technology stack can implement these interfaces:

- Node / Deno / Bun
- SQL (Postgres, Supabase)
- Kafka / NATS / Redis Streams
- Temporal
- Edge runtimes
- In-memory test harnesses

---

## Protocol Invariants

COP is defined by a small number of **non-negotiable invariants**:

1. Immutability
2. Topic-local ordering
3. Idempotency
4. Durability
5. Stateless agents
6. Isolation via events

These invariants are normative and MUST be preserved by all implementations.

See **`invariants.md`** for the formal definition.

---

## Profiles

Profiles extend COP without modifying the core.

Examples:

- Chat / conversational agents
- RAG pipelines
- Planning and workflow orchestration
- Tool invocation
- Human-in-the-loop governance

Profiles define **additional semantics**, not new execution rules.

---

## Interoperability

COP is designed to interoperate cleanly with existing standards:

- **CloudEvents** — transport and envelope
- **JSON-LD** — semantic layer
- **JCS (RFC 8785)** — canonical hashing

COP Events can be transported anywhere while preserving meaning.

---

## Who COP Is For

COP is intended for:

- system architects designing long-lived AI systems,
- framework authors seeking interoperability,
- institutions requiring auditability and traceability,
- researchers focused on reproducibility,
- regulated or safety-critical domains.

---

## Status

COP is currently in **v0.3**:

- the core model is stable,
- schemas are versioned,
- additive evolution only,
- breaking changes require explicit major versions.

COP is designed for **multi-decade persistence**.

---

## Philosophy

Frameworks come and go.

Cognition should not.

COP exists to ensure that reasoning, decisions, and coordination outlive any single model, vendor,
or runtime.
