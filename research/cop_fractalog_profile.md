---
title: "COP FractaLog Profile"
subtitle: "Agent-bound logs, custody events, restricted traces and delayed transparency"
description: "Source profile for integrating FractaLog semantics into COP: lifecycle-aware logs, custody, inheritance, redaction, restricted access, review deadlines and non-erasure of mandate traces."
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A. / Inseme"
canonical_path: "inseme/research/cop_fractalog_profile.md"
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/research/cop_fractalog_profile.md"
version: "0.1-draft"
status: "source profile draft — human validation required before COP-core extraction"
date: "2026-07-06"
last_modified_at: "2026-07-06"
last_stamped_at: "2026-07-06"
license: "CC BY-SA 4.0"
language: "en"
type: "source-document"
source_or_derived: "source-document"
repository: "inseme"
related_repositories:
  - "JeanHuguesRobert/inseme"
  - "JeanHuguesRobert/FractaVolta"
  - "JeanHuguesRobert/barons-Mariani"
related_documents:
  - "FractaVolta/research/fractalog.md"
  - "FractaVolta/research/fractanet.md"
  - "FractaVolta/research/traceable_governance.md"
  - "inseme/packages/cop-core/Architecture.md"
  - "inseme/packages/cop-core/Invariants.md"
  - "inseme/research/cop_memory_profile.md"
  - "inseme/research/cop_identity_kudocracy_profile.md"
  - "barons-Mariani/research/traceabilite_des_actes.md"
tags:
  - cop
  - fractalog
  - append-only-log
  - agent-logs
  - custody
  - inheritance
  - restricted-traces
  - delayed-transparency
  - mandate-trace
  - auditability
  - anti-capture
human_validation_required: true
document_role: "source"
document_kind: "protocol-profile"
visibility: "public"
lifecycle_state: "working"
---

# COP FractaLog Profile

## Agent-bound logs, custody events, restricted traces and delayed transparency

**Jean Hugues Noël Robert, baron Mariani**  
Institut Mariani / C.O.R.S.I.C.A. / Inseme  
Working source profile — 2026-07-06

---

## 1. Purpose

This document defines a source-level COP profile for FractaLog.

FractaLog is defined in [`FractaVolta/research/fractalog.md`](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractalog.md). This COP profile does not restate the whole theory. It specifies how FractaLog semantics should project into COP.

The profile adds conventions for:

- agent-bound logs;
- child-agent log trees;
- log lifecycle events;
- custody and ownership references;
- inheritance and successor events;
- redaction without causal erasure;
- restricted traces;
- delayed transparency;
- review deadlines;
- non-erasure of mandate traces.

This profile is a source draft. It should not yet be treated as a normative `cop-core` specification.

---

## 2. Relation to COP/Core

This profile must preserve all COP/Core invariants.

It does not replace Event, Topic, Task, Step, Artifact, Continuation, Store, Projector, Scheduler or Bus.

COP/Core already requires immutable Events and Artifacts, topic-local ordering, idempotency, durable state, stateless agents, coordination through Events and Artifacts, deterministic replay of recorded traces, explicit schema versioning and transparency over convenience.

COP/FractaLog adds profile-specific semantics:

```text
log lifecycle projections
agent/log binding
custody transitions
successor and inheritance events
restricted visibility policies
review obligations
redaction without causal erasure
mandate-trace non-erasure
```

---

## 3. Non-goals

This profile does not:

1. define a universal legal theory of ownership;
2. decide who owns a log in all jurisdictions;
3. replace application-level access control;
4. require all logs to be public;
5. require all content to be retained forever;
6. require immediate transparency for sensitive material;
7. require storage of private model internals;
8. weaken COP/Core immutability.

Ownership should be referenced through FractaNet ownership or mandate artifacts. COP/FractaLog only defines how those references affect logs and projections.

---

## 4. Core objects

### 4.1 FractaLog object

A FractaLog is a governed append-only log attached to one or more COP objects.

Minimal fields:

```json
{
  "schemaVersion": "cop.fractalog.log.v0",
  "logId": "urn:fractalog:log:...",
  "topicId": "urn:cop:topic:...",
  "subjectAgentId": "urn:cop:agent:...",
  "parentLogId": "urn:fractalog:log:...",
  "logKind": "agent|task|tool|audit|custody|mandate|restricted|federation",
  "createdByEventId": "urn:cop:event:...",
  "ownerRef": "urn:fractanet:ownership:...",
  "custodianRef": "urn:cop:agent-or-node:...",
  "visibilityPolicyRef": "urn:cop:artifact:policy:...",
  "retentionPolicyRef": "urn:cop:artifact:policy:...",
  "inheritancePolicyRef": "urn:cop:artifact:policy:..."
}
```

### 4.2 FractaLog entry

A FractaLog entry is normally represented by a COP Event plus profile metadata.

```json
{
  "fractalog": {
    "logId": "urn:fractalog:log:...",
    "logSeq": 42,
    "previousEntryHash": "sha256-...",
    "entryHash": "sha256-...",
    "visibility": "open|redacted|restricted|sealed|escrowed"
  }
}
```

---

## 5. Lifecycle states

Lifecycle state is a projection from events.

Allowed initial vocabulary:

```text
created
active
quiescent
sealed
retired
transferred
inherited
archived
tombstoned
redacted_view
restricted
released
```

A state transition must be explainable by replaying COP Events.

---

## 6. Event vocabulary

### 6.1 Log lifecycle events

```text
fractalog.log.created
fractalog.log.bound_to_agent
fractalog.log.bound_to_topic
fractalog.log.bound_to_parent_log
fractalog.log.segment.opened
fractalog.log.segment.sealed
fractalog.log.root.anchored
fractalog.log.snapshot.created
fractalog.log.archived
fractalog.log.tombstoned
```

### 6.2 Custody and ownership-reference events

```text
fractalog.custody.assigned
fractalog.custody.transferred
fractalog.custody.accepted
fractalog.custody.refused
fractalog.custody.contested
fractalog.custody.resolved
fractalog.ownership.ref_attached
fractalog.ownership.claimed
fractalog.ownership.contested
fractalog.ownership.resolved
```

### 6.3 Agent succession events

```text
agent.spawned
agent.mandated
agent.suspended
agent.resumed
agent.retired
agent.failed
agent.died
agent.replaced
agent.successor.appointed
fractalog.log.inheritance.rule.declared
fractalog.log.inherited
```

### 6.4 Redaction and retention events

```text
fractalog.erasure.requested
fractalog.erasure.granted_private_data
fractalog.erasure.rejected_mandate_trace
fractalog.redaction.applied
fractalog.context.added
fractalog.correction.added
fractalog.public_interest_retention.asserted
fractalog.mandate_trace.sealed
```

### 6.5 Restricted-trace events

```text
fractalog.restriction.requested
fractalog.restriction.applied
fractalog.restriction.denied
fractalog.restriction.review_scheduled
fractalog.restriction.review_due
fractalog.restriction.review_overdue
fractalog.restriction.review_performed
fractalog.restriction.extended
fractalog.restriction.extension_denied
fractalog.restriction.released
fractalog.restriction.partially_released
fractalog.restriction.redacted_release_created
fractalog.restriction.audit_requested
fractalog.restriction.audit_completed
fractalog.restriction.abuse_suspected
fractalog.restriction.abuse_confirmed
```

---

## 7. Restricted trace model

COP/FractaLog must distinguish content visibility from trace existence.

| Level | Meaning |
|---|---|
| `open` | Event and content are publicly accessible. |
| `redacted` | Event is accessible, selected fields are masked. |
| `restricted` | Event or content requires authorization. |
| `sealed` | Existence and integrity may be attestable, content is closed. |
| `escrowed` | Public confirmation is delayed, but an accountable record exists. |

Profile rule:

```text
Restricted visibility may hide content.
It must not silently erase the causal existence of an engaging act.
```

---

## 8. Restriction artifact

Restricted access should be represented by an Artifact referenced by Events.

Minimal payload:

```json
{
  "schemaVersion": "cop.fractalog.restriction.v0",
  "targetEventId": "urn:cop:event:...",
  "targetArtifactId": "urn:cop:artifact:...",
  "restrictionLevel": "restricted|sealed|escrowed",
  "authority": "urn:cop:actor:...",
  "reasonSummary": "Temporary restriction is required by the applicable policy.",
  "restrictedFields": ["payload.operationalDetails"],
  "publicEnvelopeAllowed": true,
  "existenceMayBeAcknowledged": true,
  "restrictedAt": "2026-07-06T00:00:00Z",
  "reviewDueAt": "2027-07-06T00:00:00Z",
  "releaseAt": "2036-07-06T00:00:00Z",
  "maxRestrictionUntil": "2051-07-06T00:00:00Z",
  "extensionRequires": {
    "humanDecision": true,
    "independentAudit": true,
    "reasonedAct": true
  },
  "appealOrAuditPath": "urn:fractalog:procedure:restriction-review"
}
```

---

## 9. Scheduler obligations

COP/FractaLog implementations that support restricted trace metadata must project deadlines.

Required projection fields:

```text
targetId
currentLevel
authority
restrictedAt
reviewDueAt
releaseAt
maxRestrictionUntil
lastReviewEventId
overdue
extensionCount
nextRequiredAction
```

Required behavior:

```text
restriction.applied
  -> schedule review task
  -> if no review before reviewDueAt
  -> emit or project review_overdue
  -> escalate according to policy
```

A restriction without review at deadline becomes a protocol anomaly.

A prolongation without a reasoned event is non-conformant.

---

## 10. Redaction without causal erasure

Redaction must not rewrite the past.

Example event payload:

```json
{
  "schemaVersion": "cop.fractalog.redaction.v0",
  "targetEventId": "urn:cop:event:...",
  "reason": "privacy.third_party_collateral_data",
  "redactedFields": [
    "payload.personalAddress"
  ],
  "tracePreserved": true,
  "mandatePreserved": true,
  "respondentPreserved": true,
  "basis": "privacy_minimization_without_erasing_mandate_trace"
}
```

A redacted view is a new Artifact or projection. The source event remains part of the accountable history according to its visibility policy.

---

## 11. Mandate-trace non-erasure

COP/FractaLog distinguishes three data classes:

| Class | Profile treatment |
|---|---|
| `private_data` | May be erased, minimized, redacted or access-limited. |
| `collateral_personal_data` | Should be minimized or pseudonymized unless accountability requires otherwise. |
| `mandate_trace` | Must remain causally visible, though content may be restricted. |

Profile principle:

```text
The right to be forgotten protects private persons from undue exposure.
It must not become a right for mandate-holders to erase the trace of acts performed on behalf of others.
```

---

## 12. Delayed transparency

Profile principle:

```text
Secrecy may defer access.
It must not destroy memory.
```

A restricted trace must have at least one accountable path to later review:

```text
authority
reason
scope
review deadline
release event or maximum duration
extension conditions
audit path
respondent
```

---

## 13. Conformance requirements

A minimal COP/FractaLog implementation must:

1. preserve COP/Core invariants;
2. append FractaLog lifecycle events rather than mutating prior events;
3. distinguish content visibility from trace existence;
4. project log lifecycle state from Events;
5. project custody state from Events;
6. reject silent erasure of mandate traces;
7. represent redaction as a new Event or Artifact;
8. represent restricted access as a reasoned Event or Artifact;
9. track review deadlines for restricted traces;
10. preserve enough information to audit lawful content destruction, if destruction is allowed;
11. provide deterministic replay of the visible trace projection under a given access policy.

---

## 14. Non-conformant patterns

The following are not COP/FractaLog conformant:

```text
hard-deleting an engaging mandate event without tombstone or destruction trace
changing owner/custodian fields without a custody or ownership event
marking a restricted event as hidden forever without review deadline
extending a restriction by inaction
redacting fields without recording the redaction act
letting an agent die while its log becomes unreachable
using privacy erasure to remove the accountable trace of a mandate-holder's act
using restricted status to remove auditability rather than restrict access
```

---

## 15. Open implementation questions

1. Should log sequence numbers be independent of `topicSeq`, or derived from it?
2. Should every agent have a default log, or only agents performing engaging acts?
3. How should child-agent logs inherit visibility and retention policy from parent logs?
4. How should ownership projection be linked to the future FractaNet ownership model?
5. Should restricted-access metadata be inside Event metadata, separate Artifacts, or both?
6. How should access-policy replay work for users with different rights?
7. What is the minimal test fixture for proving that mandate traces cannot be silently erased?
8. How should Merkle anchoring be represented in COP Events?
9. Should the profile require signatures, or define signatures as a stronger conformance level?
10. How should `escrowed` be prevented from becoming a general-purpose opacity loophole?

---

## 16. Continuation

Next useful actions:

1. Validate this profile as source-level only.
2. Add it to `inseme/research/index.md`.
3. Cross-link from `FractaVolta/research/fractalog.md`.
4. Later extract a shorter operational note under `packages/cop-core/`.
5. Add conformance tests once event schemas stabilize.
