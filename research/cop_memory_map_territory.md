---
title: "COP Memory — Map and Territory"
subtitle: "Pragmatic projections without confusing memory views with reality"
author: "Jean Hugues Noël Robert"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
date: "2026-06-21"
license: "CC BY-SA 4.0"
status: "seed working note"
corpus_role: "source"
language: "en"
related:
  - "research/cop_memory_profile.md"
  - "research/cop_memory_metadata_recursion.md"
---

# COP Memory — Map and Territory

## 1. Object

This note records a key invariant for COP/Memory:

```text
The MemoryView is a map, not the territory.
```

A distributed cognitive orchestration system must distinguish:

```text
territory = the real system, event, object, place, corpus, trace or evolving resource
map       = a bounded, task-relative, cost-aware representation of that territory
```

The map is necessary for action. The map must never be confused with the territory.

## 2. COP translation

In COP terms:

```text
Event / Artifact / NamedResource / ResourceState / material trace = closer to territory
Projection / Index / Summary / MetadataRecord / MemoryView        = map-like structures
```

This distinction is not absolute. A map can itself become a territory for another map:

```text
MemoryView -> can be stored as an Artifact
Artifact   -> can later be described by Metadata
Metadata   -> can be indexed by another MemoryView
```

This is the fractal risk. COP handles it through bounded recursion.

## 3. Practical rule

```text
Model the territory when preservation, proof or reconstruction matters.
Expose the map when action, reasoning or orientation matters.
Never let the agent forget which one it is using.
```

## 4. Why this matters

A perfect model of the territory may be impossible or too expensive to manipulate.

A useful map is necessarily selective:

- it chooses a scale;
- it chooses relevant features;
- it hides details;
- it simplifies topology;
- it has a date;
- it may become obsolete;
- it is made for an intended use.

The same applies to `MemoryView`.

A MemoryView should therefore declare:

```text
scale
purpose
scope
freshness
confidence
cost
excluded zones
expansion rules
```

## 5. Map failures

A map can fail in several ways:

```text
outdated map       = source changed, projection not invalidated
wrong scale        = too much or too little detail for the task
wrong purpose      = legal/probative use from a drafting view
missing territory  = important traces excluded or unavailable
overconfident map  = uncertainty hidden
captured map       = projection shaped by an actor's interest
beautiful map      = coherent representation masking a false premise
```

COP/Memory must therefore record not only what a MemoryView contains, but why it was generated and under which constraints.

## 6. Agent invariant

```text
An agent should not act as if its MemoryView is the whole memory.
An agent should know whether it holds a pointer, a sketch, a working map, a probative map or an audited reconstruction.
```

The practical question is not:

```text
Do I have the complete territory?
```

It is:

```text
Is this map sufficient for this action, at this risk level, with these costs and constraints?
```

## 7. Relation to pragmatic memory

The pragmatic memory layer can be read as a disciplined map-making system:

```text
absolute memory model -> bounded MemoryView -> agent action
territory             -> map                -> navigation
```

The absolute model prevents category errors.
The map enables action.
The stop rules prevent infinite cartography.

## 8. Stable formula

```text
The absolute model protects truth conditions.
The MemoryView enables action.
The map is useful only while it remains explicitly distinct from the territory.
```
