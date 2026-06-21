---
title: "COP Memory Profile"
subtitle: "Trace memory, content addressing, locality and cognitive orchestration"
author: "Jean Hugues Noël Robert"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
date: "2026-06-21"
license: "CC BY-SA 4.0"
status: "seed working note"
corpus_role: "source"
language: "en"
---

# COP Memory Profile

## 1. Object

This document seeds a COP memory profile.

It treats memory not as a simple store but as an ecology of accessible traces useful for distributed cognitive orchestration.

The guiding intuition is:

```text
Memory is not storage.
Memory is organized access to traces under constraints of locality, salience, decay, consolidation and retrieval cost.
```

The profile is inspired by three families of memory:

- living memory: episodic, semantic, procedural, affective, spatial, reconstructive;
- material memory: patina, wear, repair, deformation, sedimentation, place-bound traces;
- computational memory: caches, locality, temperature, capacity limits, invalidation, persistence tiers.

## 2. COP starting point

COP already contains memory primitives:

- immutable Events;
- immutable Artifacts;
- Topics as episodic containers;
- Tasks and Steps as procedural structure;
- Continuations as prospective memory;
- causal links through parentEventIds;
- hashes, signatures and ledgers for probative memory.

The missing layer is not storage. The missing layer is governed remembrance:

```text
encoding -> indexing -> retrieval -> reactivation -> reinterpretation -> consolidation -> decay/archive
```

## 3. Strong analogy with computer memory

Human and living memory can be read through an analogy with computer memory, provided the analogy remains disciplined.

Useful correspondences:

| Computer memory concept | COP memory interpretation |
|---|---|
| cache | rapidly accessible trace projection |
| locality | traces recently or contextually near an active task are cheaper to recall |
| temperature | traces become hot, warm, cold or frozen depending on use and salience |
| limited capacity | attention, storage, compute and review bandwidth are bounded |
| eviction | traces may leave fast memory without being destroyed |
| invalidation | a trace or projection becomes obsolete when the source changes |
| write-through | immediate durable inscription of governance-critical acts |
| write-back | temporary local accumulation before durable consolidation |
| hierarchy | registers/cache/RAM/disk/archive mirror attention/working memory/corpus/archive |
| garbage collection | controlled forgetting, compaction or archival |
| snapshot | consolidated projection at a given time |
| log-structured storage | Events as append-only durable memory |
| content addressing | ni: or hash identifies the exact content rather than its current location |

## 4. Locality

Locality is essential for cognitive orchestration.

A trace should be easier to retrieve when it is near the current activity along at least one axis:

- temporal locality: recently used or recently created;
- topical locality: same Topic, Task, Step or continuation;
- causal locality: parent, child or sibling event in the causal DAG;
- semantic locality: same concept, tag, embedding cluster or ontology branch;
- social locality: same subject, role, mandate or group;
- spatial locality: same place, object, device or territory;
- procedural locality: same workflow, checklist, agent pattern or recurring operation;
- affective/salience locality: high-risk, high-value, traumatic, strategic or foundational trace.

COP/Memory should therefore not provide a single flat lookup model. It should provide poly-indexed retrieval.

## 5. Temperature

Trace temperature expresses expected usefulness under bounded attention and bounded resources.

Initial states:

```text
hot      = immediately relevant to active orchestration
warm     = likely reusable soon
cold     = stable but rarely accessed
frozen   = archival / heritage / probative preservation
volatile = short-lived signal, useful only if consumed quickly
decayed  = degraded, superseded or low-confidence trace
```

Temperature is not truth. It is retrieval priority.

A false trace may be hot. A true trace may be cold. COP must keep temperature separate from confidence and probative value.

## 6. Capacity limits

Every memory system has limits:

- attention capacity;
- storage capacity;
- retrieval cost;
- indexing cost;
- privacy budget;
- review bandwidth;
- legal retention constraints;
- energy and network costs;
- human interpretability.

COP/Memory should therefore make retention and access policies explicit.

Examples:

```text
volatile signal -> expire unless attached to a durable event
working trace -> keep while task is active
source document -> preserve with content address and metadata
public decision -> write-through, signed, ledger-capable
material trace -> preserve observation and evidence, not the object itself
```

## 7. Obsolescence and invalidation

Obsolescence must be explicit.

A trace can remain intact while its interpretation becomes obsolete.

COP should distinguish:

- content invalidation: the bytes were wrong or corrupted;
- reference invalidation: a pointer broke;
- semantic obsolescence: the meaning changed;
- legal obsolescence: the rule or mandate expired;
- contextual obsolescence: the trace no longer applies to the current situation;
- projection obsolescence: an index or summary must be rebuilt;
- confidence decay: the trace remains accessible but lower-trust.

Correction should create new traces rather than mutate old ones.

## 8. Suggested artifacts

Initial artifact types:

```text
cop/content-descriptor
cop/memory-trace
cop/memory-cue
cop/memory-index
cop/consolidation-record
cop/trace-temperature
cop/retention-policy
cop/invalidation-record
```

## 9. Suggested events

Initial event types:

```text
memory.trace.encoded
memory.trace.indexed
memory.trace.retrieved
memory.trace.reactivated
memory.trace.reinterpreted
memory.trace.consolidated
memory.trace.temperature_changed
memory.trace.invalidated
memory.trace.archived
memory.trace.decayed
```

## 10. Core invariant

```text
A memory trace may become easier or harder to retrieve, more or less salient, more or less trusted, and more or less consolidated; but its original durable inscription must remain distinguishable from every later interpretation, projection or summary.
```

## 11. Continuation

Next work:

1. define JSON schemas for content descriptors, memory traces and retention policies;
2. connect ni: content addressing to COP artifacts;
3. define hot/warm/cold/frozen projection policies;
4. specify invalidation and consolidation events;
5. integrate with existing COP audit and continuation mechanisms.
