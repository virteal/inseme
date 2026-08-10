---
title: "COP Mission Stigmergy and Rational Exploration"
subtitle: "Technical bridge between Mission, The Possible, continuations, stigmergic traces, FractaLog, and corpus return"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
license: "CC BY-SA 4.0"
date: "2026-07-10"
status: "working-note"
document_role: "source"
document_kind: "technical-architecture-note"
visibility: "public"
lifecycle_state: "working"
language: "en"
related_documents:
  - "packages/cop-core/Architecture.md"
  - "packages/cop-kernel/docs/task-step-continuation-lineage.md"
  - "sandbox/cop-continuation-bac-a-sable/README.md"
  - "sandbox/cop-continuation-bac-a-sable/scenarios/machine-a-explorer-gabarit-abstrait.js"
  - "research/cop_fractalog_profile.md"
  - "barons-Mariani/research/rational_odysseys_the_possible.md"
  - "barons-Mariani/research/presencology.md"
  - "FractaVolta/research/fractalog.md"
  - "FractaVolta/research/ownership_packets_and_cop.md"
tags:
  - cop
  - mission
  - continuation
  - stigmergy
  - fractalog
  - the-possible
  - rational-exploration
  - agents
  - corpus
  - presencology
  - presence-map
---

# COP Mission Stigmergy and Rational Exploration

## Technical bridge between Mission, The Possible, continuations, stigmergic traces, FractaLog, and corpus return

*Working note — 2026-07-10*

---

## 1. Purpose

COP currently has strong primitives for events, artifacts, tasks, steps, continuations, traces, and resumable workflows. This note introduces a higher-level operational object: **Mission**.

A Mission is the protocol-level envelope for the rational exploration of **The Possible**.

It answers:

```text
Why is this exploration launched?
For whom?
In which possible-space?
With which agents?
With which capabilities?
With which trace requirements?
With which return protocol?
With which ownership, custody, and succession rules?
```

A Task executes. A Mission explores.

---

## 2. Core definitions

### Mission

A **COPMission** is a mandate-bearing exploration envelope coordinating agents, tasks, steps, continuations, artifacts, logs, traces, and return protocols around a defined region of The Possible.

```text
Mission = mandate + possible-space + agents + capabilities + traces + return protocol
```

### Possible-space

A **possible-space** is the region of The Possible being explored by a Mission.

It may be conceptual, institutional, technical, territorial, legal, scientific, political, or mixed.

### Stigmergic trace

A **stigmergic trace** is a structured marker left by an agent in a shared environment so that later agents may orient, reinforce, contradict, avoid, resume, or synthesize.

### Return protocol

A **return protocol** defines how an exploration becomes useful to the corpus:

```text
debrief
trace sorting
artifact promotion
map update
open question declaration
dead-end preservation
theory candidate extraction
next mission proposal
```

---

## 3. Mission versus Task

| Concept | Scope | Main question |
|---|---|---|
| Topic | Long-lived context | Where does the work belong? |
| Mission | Exploration envelope | Why explore, for whom, and under which mandate? |
| Task | Work unit | What should be done now? |
| Step | Executable move | What atomic operation is performed? |
| Continuation | Suspended branch | Where can this process resume? |
| Artifact | Durable result | What survived the work? |
| FractaLog | Probatory memory | What happened and under which trace? |
| Trace | Stigmergic marker | What should guide the next intelligence? |

A Mission can contain many Tasks. A Task should not be forced to carry the entire normative, epistemic, and lifecycle burden of a Mission.

---

## 4. Mythic grammar mapped to COP

The public grammar of rational exploration maps cleanly to COP primitives.

| Image | COP primitive |
|---|---|
| Odyssey | Mission lifecycle |
| Ithaca | Corpus return point |
| Sea | Possible-space |
| Island | Branch / hypothesis / domain |
| Monster | Inhibitor / capture / failure mode |
| Ariadne's thread | Continuation / provenance / trace-back |
| Logbook | FractaLog |
| Base camp | Mission coordination and custody substrate |
| Argonauts | Multi-agent crew |
| Flotilla | Distributed agentic architecture |
| Ark | Corpus resilience layer |
| Theory | Stabilized high-level synthesis |

This grammar is not required for machine execution. It is useful for human understanding, public explanation, and system design.

---

## 5. Core data model

### COPMission

```json
{
  "type": "COPMission",
  "schemaVersion": "cop.mission.v0",
  "missionId": "urn:cop:mission:...",
  "title": "Explore ownership, mission and stigmergy in COP",
  "principalIdentityId": "did:example:principal",
  "missionKind": "rational_exploration",
  "possibleSpaceRef": "urn:cop:possible-space:...",
  "status": "active",
  "createdAt": "2026-07-10T00:00:00+02:00",
  "tracePolicyRef": "urn:cop:policy:mission-trace:v0",
  "returnProtocolRef": "urn:cop:policy:return-to-corpus:v0",
  "baseCampRef": "urn:cop:basecamp:...",
  "ownershipPolicyRef": "urn:cop:policy:mission-ownership:v0",
  "fractalogRef": "urn:fractalog:log:..."
}
```

### COPPossibleSpace

```json
{
  "type": "COPPossibleSpace",
  "schemaVersion": "cop.possible_space.v0",
  "possibleSpaceId": "urn:cop:possible-space:...",
  "label": "Mission, ownership and stigmergic exploration",
  "domain": ["cop", "agents", "ownership", "fractalog"],
  "knownZones": [],
  "frontierZones": [],
  "dangerZones": [],
  "promisingZones": [],
  "mapArtifactRefs": []
}
```

### Presence as a generic adjacent primitive

COP should not define `COPPresence` as the canonical ontology of presence. Presence is a more general primitive, defined in the Barons Mariani research corpus by **Presencology**, and may concern humans, physical objects, software agents, populations, or other subjects.

COP consumes this generic concept for Mission exploration.

A Mission may therefore associate qualified presence information with an agent and a region of a possible-space:

```json
{
  "type": "PresenceClaim",
  "subjectRef": "urn:cop:agent:...",
  "spaceRef": "urn:cop:possible-space:...",
  "regionRef": "concept://cop/mission/stigmergy",
  "validTime": {
    "start": "2026-08-10T18:00:00+02:00",
    "end": null
  },
  "modality": "observed|inferred|declared|scheduled|expected|predicted|conditional|hypothetical",
  "evidenceRefs": [],
  "confidence": null
}
```

The exact Presence schema remains a Presencology research problem and MUST NOT be frozen by this technical note.

### Possible-space maps as projections

`COPPossibleSpace.mapArtifactRefs` should be understood as references to **projections** of a multidimensional possible-space, not as a claim that the Mission possesses a complete map of The Possible.

A map artifact SHOULD declare, when relevant:

```text
projection purpose
dimensions retained
dimensions collapsed
resolution
known distortions
provenance
validity domain
uncertainty
```

A Mission may maintain multiple simultaneous maps.

### Potentiality, presence and trace layers

A Cartographer may maintain distinct but alignable layers:

```text
Potentiality Map  -> where exploration appears promising
Presence Map      -> where explorers are / were / may be
Trace Map         -> what earlier exploration left behind
Constraint Map    -> what inhibits or bounds movement / actualization
```

These layers MUST NOT be silently collapsed.

In particular:

```text
PresenceDensity != Potentiality
Presence != Trace
Map != The Possible
```

The joint structure of those layers may guide exploration, but any inferred "underexplored region" remains a contestable Mission hypothesis.

### Latent Functional Map

COP SHOULD NOT assume that collective map knowledge must be centralized.

A flotilla may functionally orient through the evolving configuration of:

```text
agent local state
presences
stigmergic traces
continuations
artifacts
base-camp memory
environmental state
interaction rules
```

without any single agent or artifact containing a complete representation.

Presencology calls this a **Latent Functional Map**.

The COP Cartographer therefore externalizes useful map projections; it does not claim to exhaust the distributed informational state of the Mission.

### COPStigmergicTrace

```json
{
  "type": "COPStigmergicTrace",
  "schemaVersion": "cop.stigmergic_trace.v0",
  "traceId": "urn:cop:trace:...",
  "missionId": "urn:cop:mission:...",
  "agentId": "urn:cop:agent:...",
  "traceKind": "promising|dead_end|danger|verified|unverified|contradiction|landmark|synthesis_candidate|return_required",
  "locationRef": "concept://cop/mission/stigmergy",
  "summary": "This branch connects COP continuations with stigmergic coordination.",
  "evidenceRefs": [],
  "confidence": 0.82,
  "strength": 0.64,
  "decayPolicy": "decay_unless_reinforced",
  "reinforcementCount": 0,
  "contradictionRefs": [],
  "createdAt": "2026-07-10T00:00:00+02:00",
  "expiresAt": null
}
```

---

## 6. Trace kinds

Recommended trace vocabulary:

```text
trace.direction
trace.danger
trace.dead_end
trace.promising
trace.verified
trace.unverified
trace.contradiction
trace.landmark
trace.bridge
trace.resource
trace.open_question
trace.return_required
trace.synthesis_candidate
trace.decay
trace.reinforcement
trace.warning
```

Each trace should be:

```text
short
actionable
contestable
source-linked
freshness-aware
decay-aware
mission-scoped
```

A trace is not a conclusion. It is a sign left for future cognition.

---

## 7. Trace decay and reinforcement

Stigmergy needs forgetting.

A trace that never decays becomes clutter. A trace that decays too quickly destroys memory. COP should therefore support explicit trace decay policies.

Possible policies:

```text
no_decay
fixed_ttl
decay_unless_reinforced
decay_after_mission_close
legal_hold
until_superseded
review_required
```

Possible reinforcement events:

```text
cop.trace.reinforced
cop.trace.weakened
cop.trace.contradicted
cop.trace.superseded
cop.trace.expired
cop.trace.promoted_to_artifact
cop.trace.attached_to_map
```

A trace that becomes central should be promoted into an Artifact or a Map update.

---

## 8. Mission lifecycle events

Recommended event family:

```text
cop.mission.created
cop.mission.mandated
cop.mission.started
cop.mission.agent_assigned
cop.mission.basecamp_defined
cop.mission.asset_attached
cop.mission.capability_granted
cop.mission.task_created
cop.mission.path_opened
cop.mission.trace_left
cop.mission.trace_reinforced
cop.mission.trace_contradicted
cop.mission.presence_claimed
cop.mission.presence_observed
cop.mission.presence_estimated
cop.mission.presence_forecast
cop.mission.presence_invalidated
cop.mission.presence_map_updated
cop.mission.continuation_created
cop.mission.continuation_suspended
cop.mission.continuation_resumed
cop.mission.branch_obsoleted
cop.mission.checkpoint_created
cop.mission.agent_lost
cop.mission.agent_returned
cop.mission.agent_died
cop.mission.possessions_liquidated
cop.mission.debriefed
cop.mission.map_updated
cop.mission.artifact_promoted
cop.mission.theory_candidate_created
cop.mission.closed
cop.mission.archived
```

These events should be FractaLog-compatible and replayable.

---

## 9. Agent roles in a mission

A rational exploration Mission may assign specialized agents:

| Role | Function |
|---|---|
| Scout | Explore quickly and leave lightweight traces. |
| Cartographer | Maintain explicit projections of possible-space, including potentiality, presence, trace and constraint layers; preserve provenance, uncertainty and contradictions; never imply that one projection is The Possible itself. |
| Verifier | Check sources and reduce false positives. |
| Contradictor | Seek objections, dead ends, hidden inhibitors. |
| Synthesizer | Detect patterns and candidate theory. |
| Archivist | Preserve provenance and integrate corpus traces. |
| Captain | Arbitrate local tactical decisions. |
| Base camp | Coordinate, preserve, rescue, synchronize. |

Agents may be human, software, AI-assisted, institutional, or hybrid.

---

## 10. Base camp

A base camp is not merely storage. It is a Mission continuity substrate.

It should know:

```text
which agents are outside
which tasks are active
which continuations are suspended
which traces have been left
which assets are held or referenced
which capabilities are active
which logs are sealed
which return obligations are pending
who inherits if an agent dies
```

Base camp responsibilities:

```text
checkpoint custody
log anchoring
capability renewal or revocation
trace aggregation
rendezvous scheduling
mission rescue
agent succession
debrief reception
corpus integration
```

---

## 11. Flotilla architecture

The Mission model should favor flotilla-like resilience rather than a single Titanic-like agent.

```text
large centralized agent:
  high coherence
  high fragility
  catastrophic failure mode

flotilla of agents:
  partial knowledge
  distributed exploration
  local loss tolerance
  requires rendezvous and recomposition protocols
```

The flotilla is only superior if it has:

```text
dispersion rules
rendezvous rules
signal rules
trace standards
map merge rules
return obligations
succession rules
```

COP provides the grammar for those rules.

---

## 12. Return to corpus

The return protocol is the final phase of rational exploration.

A Mission should not be considered complete until it has produced one of the following:

```text
documented failure
stable artifact
map update
continuation set
open question list
corpus note
public report
theory candidate
```

Return events:

```text
cop.mission.return_started
cop.mission.debrief_submitted
cop.mission.trace_reviewed
cop.mission.artifact_promoted
cop.mission.map_updated
cop.mission.dead_end_preserved
cop.mission.open_question_declared
cop.mission.theory_candidate_created
cop.mission.return_completed
```

A Mission without return is not complete. It may be active, lost, suspended, abandoned, or failed, but not complete.

---

## 13. Ownership, custody and mission possessions

Mission exploration creates and touches many objects. COP must not treat them all as owned by the Mission.

Possible relations:

```text
owned_by_principal
held_in_custody_by_agent
held_in_custody_by_basecamp
referenced_only
produced_by_mission
licensed_for_use
capability_to_operate
secret_reference_only
public_artifact
restricted_artifact
```

Rule:

> A Mission should declare for each object whether it owns, holds, controls, references, uses, produces, transfers, or merely observes it.

This connects Mission to the COP ownership model and to FractaLog custody.

---

## 14. Theory candidates

A Mission may produce more than a report. It may produce a theory candidate.

A theory candidate is a high-level synthesis extracted from traces, artifacts, contradictions, observations, and documented failures.

```json
{
  "type": "COPTheoryCandidate",
  "schemaVersion": "cop.theory_candidate.v0",
  "theoryCandidateId": "urn:cop:theory:...",
  "missionId": "urn:cop:mission:...",
  "title": "Mission as rational Odyssey into The Possible",
  "derivedFromTraces": [],
  "derivedFromArtifacts": [],
  "claims": [],
  "objections": [],
  "status": "candidate",
  "requiresHumanValidation": true
}
```

The theory candidate should never silently replace its trace base. It should reference it.

---

## 15. Implementation checklist

Minimal support for Mission Stigmergy in COP:

```text
COPMission schema
COPPossibleSpace schema
generic Presence reference/profile
Presence Claim / Estimate references
presence lifecycle events
presence-map artifacts
projection metadata
Potentiality / Presence / Trace layer separation
latent-functional-map compatibility
COPStigmergicTrace schema
mission lifecycle events
trace lifecycle events
trace decay and reinforcement
mission base camp registry
mission-agent assignment
mission return protocol
artifact promotion policy
ownership/custody relations
FractaLog compatibility
corpus integration hooks
```

---

## 16. Compact invariant

```text
Task executes.
Mission explores.
Presence locates.
Trace orients.
Continuation preserves return.
FractaLog proves.
Base camp remembers.
Corpus receives.
Theory reconfigures.
```

This invariant should guide COP Mission design.
