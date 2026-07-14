---
title: "COP Store, Persistence, and Memory Boundaries"
subtitle: "Normative consolidation of durable truth, projections, bounded memory views, and backend adapters"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
license: "CC BY-SA 4.0"
date: "2026-07-14"
version: "0.1"
status: "working-source — normative consolidation candidate"
document_role: "source"
document_kind: "protocol-architecture-note"
visibility: "public"
lifecycle_state: "working"
human_validation_required: true
related_documents:
  - "packages/cop-core/Architecture.md"
  - "packages/cop-core/Invariants.md"
  - "packages/cop-core/COP_PERSISTENCE.md"
  - "packages/cop-core/src/types.ts"
  - "packages/cop-kernel/src/storage.js"
  - "research/cop_memory_map_territory.md"
  - "research/cop_mission_stigmergy_exploration.md"
tags:
  - cop
  - store
  - persistence
  - memory
  - projections
  - event-sourcing
  - fractanet
  - consolidation
---

# COP Store, Persistence, and Memory Boundaries

## 1. Purpose

This note consolidates terminology that became ambiguous during the early evolution of COP.

The earlier corpus used the word **Store** for several different things:

```text
projection state
artifact retrieval
event persistence
backend adapters
application CRUD
agent context
memory access
```

These meanings must now be separated.

COP is not required to preserve an obsolete ambiguity merely because it appeared in an earlier draft or reference implementation. Earlier documents remain valuable as historical traces, but an explicitly newer source may supersede their terminology while preserving the protocol invariants.

The consolidation rule is:

> Preserve history as evidence; preserve invariants as law; revise categories when a better model is discovered.

This note does not erase previous specifications. It declares which interpretation should guide future specification and implementation work.

---

## 2. Normative decisions

### Decision 1 — Durable truth is not the COP Store

COP durable truth is composed of:

```text
immutable append-only Events
+
immutable Artifacts
```

All meaningful observable state must remain explainable from those durable traces.

The durable event log and artifact set are therefore not merely one projection backend among others. They are the reconstructive basis of COP.

### Decision 2 — `COP/Persistence` is the umbrella service layer

`COP/Persistence` is the backend-independent service contract that exposes durable and derived storage capabilities.

It may include:

```text
EventStore
ArtifactStore
DescriptorStore
ProjectionStore
ResourceStore
PolicyStore
IndexStore
CacheStore
TemporalResolver
MemoryViewService
ExportImportService
CapabilityService
ReplicationService
```

A concrete implementation may support only a conformant subset, but it must report its actual guarantees honestly.

### Decision 3 — `COPStore` means projection store

From this note onward, the unqualified term **COPStore** should designate the COP projection layer:

```text
Events + Artifacts
       ↓ replay / projectors
COPStore
       ↓
rebuildable observable state
```

A `COPStore` stores or exposes derived state such as:

```text
Topic state
Task state
Step state
Mission state
current map state
continuation indexes
agent dashboards
materialized temporal views
```

A projection is not authoritative truth. It may be invalidated, destroyed, and rebuilt.

`COPStore` may therefore be implemented as, or as a facade over, `COPProjectionStore`.

### Decision 4 — Agents receive `COPReadOnlyStore`

Ordinary agents should consume read-only projections.

They should not directly mutate Topics, Tasks, Steps, Missions, Maps, or other projected state.

Their normal production paths are:

```text
emit an Event
produce an immutable Artifact
request or extend a bounded MemoryView
```

Projectors and infrastructure services transform durable traces into projections.

### Decision 5 — `COP/Memory` is above persistence

Persistence answers:

```text
What traces and contents exist?
Where can they be retrieved?
How can they be verified?
What projections can be rebuilt?
```

Memory answers:

```text
What bounded representation is useful for this human, agent, mission, risk level, and cost budget?
```

`COP/Memory` therefore builds task-relative and mission-relative views above persistence, indexes, projections, temporal resolution, policies, and provenance.

A `MemoryView` is a map. It is not the territory and it is not the complete durable graph.

### Decision 6 — backend adapters are not protocol categories

SQLite, Postgres, Supabase, object stores, filesystems, Git, IPFS, Syncthing, NATS persistence, and future Fractanet nodes are implementation circumstances.

They may implement one or more persistence ports. They must not become COP identities or semantic categories.

### Decision 7 — the historical kernel `StorageInterface` is an adapter facade

`packages/cop-kernel/src/storage.js` currently exposes a broad `StorageInterface` containing events, artifacts, tasks, steps, identities, file storage, and caches.

This interface should be treated as a historical implementation facade, not as the normative meaning of `COPStore` or `COP/Persistence`.

It may remain temporarily for compatibility while adapters are progressively split behind the newer service ports.

---

## 3. Canonical terminology

| Term | Canonical meaning |
|---|---|
| Event log | Append-only durable sequence of COP Events |
| Artifact set | Immutable durable contents produced or consumed by COP |
| `COP/Persistence` | Umbrella backend-independent persistence service layer |
| `EventStore` | Durable append and retrieval of Events |
| `ArtifactStore` | Durable storage and retrieval of immutable Artifacts |
| `DescriptorStore` | Backend-independent content identity, verification, and fetch hints |
| `ResourceStore` | Registry and immutable states of evolving named resources |
| `PolicyStore` | Retrieval of versioned retention, access, cost, and replication policies |
| `ProjectionStore` | Rebuildable derived state |
| `COPStore` | COP-facing projection store or projection facade |
| `COPReadOnlyStore` | Read-only projection view supplied to ordinary agents |
| `IndexStore` | Rebuildable search and traversal indexes |
| `CacheStore` | Evictable optimization state |
| `TemporalResolver` | Situated views of evolving resources across declared time axes |
| `MemoryViewService` | Production of bounded, governed, task-relative memory maps |
| `ExportImportService` | Backend-independent migration, recovery, and archival packages |
| `CapabilityService` | Honest declaration of implementation guarantees |
| `ReplicationService` | Incremental synchronization between autonomous persistence domains |
| backend adapter | Replaceable implementation of one or more ports |

---

## 4. Layer model

```text
┌──────────────────────────────────────────────────────────────┐
│                     Humans and Agents                        │
└──────────────────────────────┬───────────────────────────────┘
                               │
                    bounded governed views
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                         COP/Memory                           │
│ MemoryViews, maps, relevance, confidence, temporal scope,    │
│ provenance, privacy, cost, sufficiency, mission context      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                projections, indexes, durable reads
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                      COP/Persistence                         │
│ EventStore, ArtifactStore, DescriptorStore, ResourceStore,   │
│ PolicyStore, ProjectionStore, IndexStore, CacheStore,        │
│ TemporalResolver, ExportImport, Capability, Replication      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                      adapter interfaces
                               │
┌──────────────┬───────────────┴───────────────┬───────────────┐
│ SQLite/local │ Postgres/Supabase coordination│ object storage│
│ filesystem   │ mirrors and operational views │ peer nodes    │
└──────────────┴───────────────────────────────┴───────────────┘
```

The layers are related but not interchangeable.

```text
backend ≠ adapter ≠ persistence contract ≠ projection ≠ memory view
```

---

## 5. Core interfaces

### 5.1 Persistence facade

```ts
interface COPPersistence {
  events: COPEventStore;
  artifacts: COPArtifactStore;
  descriptors: COPDescriptorStore;
  projections: COPProjectionStore;
  exportImport: COPExportImportService;
  capabilities: COPCapabilityService;

  resources?: COPResourceStore;
  policies?: COPPolicyStore;
  indexes?: COPIndexStore;
  caches?: COPCacheStore;
  temporal?: COPTemporalResolver;
  memoryViews?: COPMemoryViewService;
  replication?: COPReplicationService;
}
```

This facade describes available services. It is not required to imply one process, one database, one provider, or one physical node.

### 5.2 Read-only projection store

```ts
interface COPReadOnlyStore {
  getTopic(id: string): Promise<COPTopic | null>;
  getTask(id: string): Promise<COPTask | null>;
  listTasksByTopic(input: {
    topicId: string;
    status?: TaskStatus[];
  }): Promise<COPTask[]>;
  getSteps(taskId: string): Promise<COPStep[]>;
  getProjection<T>(key: ProjectionKey): Promise<T | null>;
}
```

### 5.3 Full projection store

```ts
interface COPStore extends COPReadOnlyStore {
  putProjection<T>(input: {
    key: ProjectionKey;
    value: T;
    sourceEventId?: string;
    sourceEventSeq?: number;
    sourceArtifactIds?: string[];
    rebuildable: true;
    stale?: boolean;
  }): Promise<void>;

  invalidateProjection(key: ProjectionKey): Promise<void>;
  rebuildProjection(key: ProjectionKey): Promise<ProjectionRebuildResult>;
}
```

Only trusted projector and infrastructure components should normally receive the mutating projection interface.

### 5.4 Agent context

Target form:

```ts
interface AgentContext {
  bus: COPBus;
  store: COPReadOnlyStore;
  artifacts: COPArtifactReader;
  memory?: COPMemoryViewService;

  emit(input: COPEventDraft): Promise<AppendEventResult>;
  produceArtifact(input: ProduceArtifactInput): Promise<PutArtifactResult>;
  now(): ISODateTime;
}
```

An ordinary agent should not directly call:

```text
saveTopic
saveTask
saveStep
putProjection
invalidateProjection
```

Those calls bypass the event-sourced boundary when used as primary mutation paths.

---

## 6. Data placement rules

| Object or state | Primary durable representation | Derived or access representation |
|---|---|---|
| Topic lifecycle | Events | Topic projection |
| Task lifecycle | Events | Task projection |
| Step lifecycle | Events | Step projection |
| Continuation | Immutable Artifact plus lifecycle Events | continuation index/projection |
| Mission mandate | Immutable Artifact | mission projection |
| Mission lifecycle | Events | current mission projection |
| Stigmergic trace | Event and/or immutable Artifact | map and search projections |
| Map schema | Immutable Artifact | schema index |
| Map observations | Events and immutable evidence Artifacts | current map projection |
| Stabilized map snapshot | Immutable Artifact | MemoryView source |
| Evolving external resource | NamedResource plus immutable ResourceStates and ChangeEvents | TemporalView |
| Embedding or full-text index | Rebuildable index | search result |
| Agent context | MemoryView plus read-only projections | ephemeral runtime input |
| Large binary content | Artifact descriptor plus backend object | fetch through hints |
| Policy | Versioned immutable Artifact | PolicyStore resolution view |

The key rule is:

> Mutable operational state is projected; durable change is recorded; durable content is immutable.

---

## 7. Maps, territory, and bounded memory

COP persistence preserves traces of the territory.

COP projections reconstruct useful maps.

COP memory selects a bounded map for a situated observer.

```text
Territory
  ≠ durable trace graph
  ≠ global projection graph
  ≠ MemoryView
```

A `MemoryView` must declare, where relevant:

```text
purpose
requesting agent or human
mission or task
scope
time range
time axis
included sources
excluded or inaccessible regions
confidence
freshness
staleness
cost limit
privacy limit
sufficiency
provenance expansion level
```

The service must be able to answer that a requested map is insufficient rather than silently presenting a partial map as the territory.

---

## 8. Domains, hosts, and Fractanet

A future COP/Fractanet profile should distinguish:

```text
MemoryDomain
Host
Node
Replica
Custodian
Topic
Mission
Map
```

These categories must not collapse into one another.

In particular:

```text
one community ≠ one physical database
one database ≠ one memory domain
one memory domain ≠ one host
one host ≠ one authority
```

A `MemoryDomain` is a governed logical scope. A `Host` is a deployment circumstance. Several domains may share one host, and one domain may be replicated across several hosts.

The logical memory should be globally resolvable where authorized, but it should not be globally centralized or fully replicated by default.

---

## 9. Replication boundary

Export/import and replication are distinct.

```text
Export/import
= explicit transfer of a bounded durable graph or package

Replication
= incremental synchronization between autonomous stores or domains
```

A future `COPReplicationService` should support at least:

```ts
interface COPReplicationService {
  advertiseHeads(input: ReplicationScope): Promise<ReplicationHead[]>;
  computeDelta(input: ReplicationRequest): Promise<ReplicationDelta>;
  exportDelta(input: ReplicationDeltaRequest): Promise<ReplicationEnvelope>;
  importDelta(input: ReplicationEnvelope): Promise<ReplicationResult>;
  acknowledge(input: ReplicationAcknowledgement): Promise<void>;
  listConflicts(input: ReplicationScope): Promise<COPConflict[]>;
}
```

Replication must preserve:

```text
event identity
artifact identity
content verification
topic-local ordering
idempotency
source domain
policy constraints
conflict visibility
```

A replication conflict must not be confused with an epistemic contradiction. Both are first-class, but they are different kinds of conflict.

---

## 10. Compatibility and migration

### 10.1 No immediate breaking rename

Existing implementations may temporarily retain the broad historical `COPStore` and `StorageInterface` shapes.

They should be marked as compatibility facades and progressively adapted.

### 10.2 Target migration sequence

```text
1. Stabilize terminology in source specifications.
2. Add COPReadOnlyStore and COPProjectionStore interfaces.
3. Keep the historical COPStore as a deprecated compatibility facade.
4. Route ordinary agents through COPReadOnlyStore.
5. Move artifact writes behind ArtifactStore.
6. Move event append behind EventStore.
7. Restrict projection mutation to projectors and infrastructure.
8. Split backend adapters by persistence port where useful.
9. Add conformance tests for durable truth and rebuildability.
10. Introduce COP/Memory and COP/Fractanet profiles additively.
```

### 10.3 Deprecation rule

A historical interface may remain available while it is used, but documentation must stop presenting it as the ideal architecture.

Compatibility is a migration concern, not an ontological commitment.

---

## 11. Volatile fallback

A persistence adapter must not silently replace requested durable storage with volatile in-memory storage when semantic durability is required.

Fallback must be governed by an explicit policy such as:

```text
allow_volatile_fallback
require_durable
require_offline_durable
fail_closed
```

The result must expose the actual guarantee obtained.

```text
requested durable + obtained volatile + reported success without warning
= non-conformant
```

---

## 12. Supersession map

This note amends earlier interpretations as follows.

| Earlier formulation | Consolidated interpretation |
|---|---|
| `COPStore` as broad mutable repository | compatibility facade; target meaning is projection store |
| agents receive full mutable store | agents receive `COPReadOnlyStore` plus explicit event/artifact production ports |
| `saveTask`, `saveStep`, `saveTopic` as normal agent mutation | deprecated as primary mutation path; emit Events instead |
| artifacts mixed into projection CRUD | artifacts belong to `ArtifactStore` |
| one storage interface equals persistence model | implementation facade only |
| memory equals everything retrievable | memory is a bounded, governed view built above persistence |
| backend location as practical identity | backend locations are fetch hints, not durable identities |
| one instance equals one database | deployment choice, not protocol identity |

---

## 13. Invariants preserved

This consolidation changes categories, not COP's constitutional invariants.

It preserves:

```text
immutable Events
immutable Artifacts
topic-local ordering
at-least-once delivery
idempotent projectors
stateless agents
coordination through Events and Artifacts
deterministic replay of recorded traces
explicit schema versioning
transparency over hidden convenience
human anchoring for consequential decisions
```

---

## 14. Open questions

The following remain open for later specification:

```text
Should ResourceStore be mandatory at a higher conformance level?
Should policies always be ordinary immutable Artifacts with a specialized resolver?
How are encrypted descriptors replicated without leaking metadata?
What is the minimum domain identity model for COP/Fractanet?
How are partial map schemas transformed across heterogeneous submaps?
Which replication conflicts can be merged automatically?
How are secret traces preserved while access remains revocable?
How are MemoryView sufficiency claims audited?
What is the exact deprecation schedule for the historical kernel StorageInterface?
```

These questions should be explored without reopening the boundaries fixed in this note unless evidence shows that the boundaries themselves are defective.

---

## 15. Consolidated formula

```text
Events record durable change.
Artifacts preserve immutable content.
COP/Persistence keeps both retrievable, verifiable, exportable, and replicable.
COPStore reconstructs operational maps.
COP/Memory selects bounded maps for situated agents and missions.
Fractanet distributes governed memory domains across replaceable hosts and peers.
```

Or, more compactly:

> The durable traces are not the Store; the Store is a rebuildable map; Memory is a bounded view of that map; the backend remains a replaceable circumstance.
