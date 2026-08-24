---
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/packages/cop-core/Invariants.md
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
license: "CC BY-SA 4.0"
last_modified_at: 2026-08-24
last_stamped_at: 2026-06-01
---

# COP Protocol Invariants

This document defines the **non-negotiable invariants** of the Cognitive Orchestration Protocol
(COP).

Any system claiming COP compliance MUST preserve these invariants.

They are architectural constraints, not implementation suggestions.

---

## 1. Immutability

**Events and Artifacts are immutable.**

Once created:

- an Event MUST never be modified or deleted,
- an Artifact MUST never be modified or deleted.

Corrections, updates, or reversals MUST be expressed as **new Events**.

Immutability guarantees:

- auditability,
- causal reasoning,
- deterministic replay,
- long-term integrity.

---

## 2. Topic-Local Ordering

All Events belong to exactly one **Topic**.

Within a Topic:

- Events are totally ordered by a monotonically increasing `topicSeq`,
- ordering MUST be strict and gap-free for persisted Events.

Across Topics:

- no global ordering is assumed,
- causal links MAY exist via explicit references.

Topic-local ordering is the foundation of replay.

---

## 3. Idempotency

Event delivery is **at-least-once**.

Therefore:

- Projectors MUST be idempotent,
- repeated processing of the same Event MUST NOT corrupt state,
- deduplication MUST rely on Event identity, not transport guarantees.

Idempotency enables:

- retries,
- fault tolerance,
- distributed execution.

---

## 4. Durability

All meaningful system state MUST be derivable from:

- the Event log,
- and the set of Artifacts.

No critical state MAY live exclusively in:

- handler-instance memory,
- process-local variables,
- ephemeral caches.

If a system cannot be reconstructed from Events and Artifacts, it is not COP-compliant.

---

## 5. Stateless Handlers

Handlers MUST be stateless.

This means:

- no mutable in-memory state across events,
- no reliance on hidden local caches for correctness,
- all context must be obtained from the Store or Continuation payloads.

Stateless handlers enable:

- horizontal scalability,
- restartability,
- deterministic replay,
- safe evolution of agent code.

---

## 6. Isolation via Events

Handlers MUST NOT communicate directly with each other.

All coordination MUST occur via:

- Events published to the Bus,
- and Artifacts referenced by Events.

This ensures:

- loose coupling,
- clear causality,
- inspectable interactions,
- elimination of hidden dependencies.

---

## 7. Deterministic Replay

Given:

- the same ordered Event log per Topic,
- the same Artifact set,
- and deterministic Projectors,

replay MUST reconstruct the same observable state.

Non-determinism MUST be externalized as Events or Artifacts.

---

## 8. Schema Versioning

Events and Artifacts MUST carry explicit `schemaVersion` fields.

Rules:

- new versions MUST be backward-readable,
- old versions MUST remain interpretable,
- breaking changes require explicit major versioning.

Versioning protects long-term interpretability.

---

## 9. Transparency over Convenience

COP favors:

- explicitness over hidden magic,
- durability over short-term performance,
- inspectability over opaque abstractions.

If an optimization violates an invariant, it is invalid.

### 9.1 Scope of Determinism and the Role of Human Anchors

The invariants guarantee deterministic replay of the _trace_ (Events, causal ordering, Artifacts
produced, continuation states). They do not require or promise deterministic re-execution of the
cognitive processes that generated those Artifacts.

When a handler step (human judgment or AI reasoning) is involved, the same inputs and context may
produce different outputs. This non-determinism is often valuable for exploration. What matters for
auditability and imputability is that the _trace_ — including the specific output chosen and, when
relevant, the human decision that enacted or validated it — is immutably recorded.

Consequently, for processes that carry real consequences, the presence of explicit human-enacted
decision Artifacts (see COP/HITL profile) is not optional decoration: it is the necessary anchor
that preserves imputability, skin in the game, and resistance to diffuse or hidden capture. Without
such anchors, traceability of the log remains, but accountability dissolves.

---

## 10. Governed Delegation Profiles

COP Core distinguishes protocol invariants from governance profiles. Systems in which an actor exercises consequential capabilities for a principal SHOULD additionally declare conformance with [`COP_MANDATED_AGENT_SECURITY.md`](COP_MANDATED_AGENT_SECURITY.md).

That profile formalizes the Corpus rule:

```text
operational autonomy != autonomous authority
```

and specifies mandate-version pinning, non-self-elevation, revocation/recovery semantics and capacity portability. These rules are deliberately profiled first rather than silently promoted to universal COP Core invariants before implementation experience exists.

---

## Final Note

These invariants are what make COP different.

Violating any of them may produce a working system — but not a COP system.
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Rendre capable — noyau doctrinal provisoire](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/noyau_doctrinal_rendre_capable.md)
- [Fractanet — Generalized Control Planes for Heterogeneous Packet Networks](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md)
- [Concept Index — inseme](../../research/concepts.md)
- [COP Reactive Cognitive Extension](REACTIVE_COGNITIVE_EXTENSION.md)
- [Reactive Cognitive COP Extension](../../research/reactive_cognitive_cop_extension.md)
- [Research Index — Inseme](../../research/index.md)
<!-- END_AUTO: backlinks -->
