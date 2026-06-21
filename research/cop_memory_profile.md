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

## 8. Mutable resources, immutable states, temporal views

Some memory objects are not simple immutable things.

A journal, registry, corpus, law code, public feed, sensor stream or official gazette is a named resource that evolves over time.

COP/Memory should therefore distinguish:

```text
NamedResource      = stable identity for an evolving resource
ResourceState      = immutable observed state of that resource at a given time or range
ChangeEvent        = append-only event that changes or extends the resource
TemporalView       = query result such as latest known state or state at date T
MaterializedView   = cached projection of a TemporalView
```

The named resource is mutable by nature. The states and change events should be immutable.

Examples:

```text
journal-officiel              -> NamedResource
journal-officiel@2026-06-21   -> ResourceState or TemporalView
article/version hash          -> immutable content object
publication event             -> ChangeEvent
latest-known                  -> TemporalView query, not a stored truth by itself
```

The practical rule is:

```text
Do not store every full version by default.
Store immutable change units, periodic checkpoints, and enough indexes to answer temporal queries.
```

## 9. Temporal query modes

COP/Memory should support at least three temporal access modes:

```text
latest_known(resource_id)
state_at(resource_id, time)
changes_between(resource_id, t1, t2)
```

Additional modes may be useful:

```text
state_known_at(resource_id, transaction_time)
state_valid_at(resource_id, valid_time)
state_decided_at(resource_id, decision_time)
```

This introduces bitemporal or tritemporal distinctions:

```text
valid_time       = when the fact is true in the world or target domain
transaction_time = when COP recorded or accepted the fact
decision_time    = when a human or institution decided the interpretation
```

For legal, civic and governance memory, these timelines must not be collapsed.

Example:

```text
A law may be published on date P,
become valid on date V,
be recorded by COP on date T,
and later be reinterpreted by a decision on date D.
```

A query must state which time axis it uses.

## 10. Memento-like access pattern

For evolving resources, COP/Memory can borrow the pattern of time-based access:

```text
Original Resource -> stable identity
TimeGate          -> resolver able to answer temporal access
Memento           -> frozen prior state
TimeMap           -> index of known prior states
```

COP equivalent:

```text
NamedResource   -> stable evolving thing
TemporalResolver -> component that answers state_at/latest_known
ResourceState   -> immutable state or checkpoint
StateMap        -> index of known states/checkpoints/change ranges
```

The resolver may reconstruct a state from:

- append-only events;
- deltas;
- checkpoints;
- external archives;
- cached materialized views.

The result must indicate whether it is exact, reconstructed, partial, stale or best-effort.

## 11. Suggested artifacts

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
cop/named-resource
cop/resource-state
cop/change-event-descriptor
cop/temporal-view
cop/state-map
```

## 12. Suggested events

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
resource.state.observed
resource.change.appended
resource.view.materialized
resource.view.invalidated
resource.checkpoint.created
```

## 13. Core invariant

```text
A memory trace may become easier or harder to retrieve, more or less salient, more or less trusted, and more or less consolidated; but its original durable inscription must remain distinguishable from every later interpretation, projection or summary.
```

Additional invariant for evolving resources:

```text
A mutable resource is not itself a mutable content object. It is a stable identity whose immutable states, change events and temporal views must remain distinguishable.
```

## 14. Continuation

Next work:

1. define JSON schemas for content descriptors, memory traces and retention policies;
2. connect ni: content addressing to COP artifacts;
3. define hot/warm/cold/frozen projection policies;
4. specify invalidation and consolidation events;
5. integrate with existing COP audit and continuation mechanisms;
6. define schemas for NamedResource, ResourceState, TemporalView and StateMap;
7. specify bitemporal access policies for civic and legal memory.
