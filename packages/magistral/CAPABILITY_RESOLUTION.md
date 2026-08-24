---
title: Magistral Capability Resolution Boundary
subtitle: Generic interface between COP orchestration and heterogeneous work capabilities
author: Jean Hugues Noël Robert, baron Mariani
date: "2026-08-23"
last_modified_at: "2026-08-24"
version: "0.2"
document_role: source
document_kind: architecture-decision
visibility: public
lifecycle_state: working
language: en
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: conversation
  origin_repository: JeanHuguesRobert/inseme
  origin_date: "2026-08-15"
  derived_from:
    - packages/magistral/README.md
    - packages/cop-core/Terminology.md
    - packages/cop-core/COP_MANDATED_AGENT_SECURITY.md
review:
  status: unreviewed
  reviewed_by: []
changelog:
  - "v0.2 (2026-08-24) — explicit binding to COP Mandated Agent Security; authority-preserving resolution and rebinding requirements."
---

# Magistral Capability Resolution Boundary

## 1. Decision

Magistral is not conceptually limited to Large Language Model routing.

Its stable architectural role is:

> **Magistral is the capability-resolution and access boundary between orchestration and concrete work capabilities.**

The existing OpenAI-compatible model router remains a valid and useful first implementation slice. It MUST NOT be mistaken for the full abstraction.

Compact formulation:

```text
COP orchestrates work.
Magistral resolves and presents capabilities.
Fractanet makes capabilities present.
```

Magistral MUST preserve the authority semantics defined by [`COP_MANDATED_AGENT_SECURITY.md`](../cop-core/COP_MANDATED_AGENT_SECURITY.md):

```text
operational autonomy != autonomous authority
```

## 2. Separation of concerns

COP may express that a continuation or task requires a capability without naming a concrete provider, machine, protocol, model, or process.

Magistral resolves that requirement against capabilities currently reachable in Fractanet and selects an admissible access path according to constraints and policy.

Fractanet is the distributed field in which those capabilities are present: local processes, remote services, machines, humans, agents, models, databases, sensors, actuators, or future forms of compute.

```text
COP
  CapabilityRequirement
        |
        v
Magistral
  discovery / arbitration / binding / adapter selection
        |
        v
Fractanet capability
  HandlerInstance / service / process / human / machine
```

Magistral does not create authority. A capability offer or successful invocation proves neither a Mandate nor entitlement to use the capability.

A resolution MUST NOT widen the mandate carried by the requesting work. Provider capabilities are an upper bound on what can technically be done, never a grant of what may legitimately be done.

## 3. Generalizing BLUEPRINT / MAP / PILOT

The existing Magistral tripartite architecture remains useful when generalized beyond models.

### BLUEPRINT — what can be done

A Blueprint describes a class of capability and its relevant properties. Blueprints describe capability, not authority.

Examples include semantic embedding, chat synthesis, coding agents, repository review, vision inference, speech transcription, human review and Inox execution.

### MAP — where capability is presently available

A Map binds capability offers to reachable Fractanet locations or providers. A Map entry may include cost, latency, locality, trust domain, credentials regime, concurrency, health, energy, jurisdiction, or other operational properties.

### PILOT — how a capability is selected

A Pilot resolves a `CapabilityRequirement` against available offers. Selection may consider required features, mandate-compatible scope, budget, cost bearer, latency, locality, availability, quality, confidence, privacy, trust domain, energy, jurisdiction, reversibility, session affinity and continuation portability.

The Pilot may use fallback, competition, racing, quorum, or synthesis policies when appropriate. Selection is not authorization: every selected path remains bounded by the exact authority chain of the work.

## 4. CapabilityRequirement

Magistral SHOULD accept a provider-neutral requirement rather than forcing COP to name a concrete runtime.

Illustrative shape:

```yaml
capability: coding-agent
input:
  continuation_ref: cop:continuation:...
constraints:
  repository: inseme
  writable_scope:
    - packages/foo/**
  budget_ref: budget:...
  mandate_ref: mandate:...
  mandate_version: ...
  principal_ref: subject:...
  deadline: ...
preferences:
  locality: prefer-local
  portability: required
```

This is informative, not yet a normative wire schema.

Before a consequential effect, the selected adapter MUST re-evaluate the pinned mandate version when the execution interval permits mandate state to have changed.

## 5. Invocation contracts are capability-specific

Different capabilities have different interaction semantics. Magistral therefore needs a generic notion of **InvocationAdapter** rather than one universal HTTP shape.

OpenAI-compatible endpoints remain a valuable adapter family for service-like intelligence.

No adapter MAY interpret transport success, provider authentication or technical reachability as authority to perform an engaging act.

## 6. ACP, A2A, MCP and other surfaces

Execution protocols are below the Magistral boundary: OpenAI-compatible HTTP, provider-native APIs, ACP, A2A, MCP, CLI/stdio, Inox-native and future adapters.

Their roles are not identical. The execution surface MUST NOT determine the authority relation.

Magistral as an ACP provider MUST expose only the capabilities admitted by its current configuration and governing Mandate. It MUST NOT silently grant a remote ACP client the account authority, local filesystem access or private agent memory associated with a selected inner capability.

An outer ACP session may resolve work to an inner session, but the outer session MUST retain its own principal, mandate version, capability binding, budget and receipt references.

## 7. Coding agents as high-value capabilities

Coding agents are rich capabilities combining reasoning, repository navigation, editing, shell execution, tools, planning and iterative interaction. Magistral SHOULD represent them as such rather than pretending they are only models behind a conversational endpoint.

A compatibility projection MAY lose semantics. It MUST NOT become the canonical representation of portable work state.

The existing ACP implementation and capability catalog remain valid first slices. Their caller remains responsible for mandate and budget authority and for recording the resulting receipt.

## 8. Anti-capture and continuation portability

Vendor sessions MAY be used as execution accelerators but SHOULD NOT own the canonical state of a portable task.

Where portability is required, the durable state needed to continue work must be externalized into COP Events, Artifacts, Continuations, repository state, or other reconstructible Fractanet memory.

The desired property is reconfigurable continuity across providers and nodes while preserving LogicalAgent, principal, Mandate, budget bearer and causal lineage.

Capacity portability is stronger than data export. A continuation that exports text but loses the authority boundary, evidence, budget state or safe recovery semantics is not fully portable.

On rebinding to a new provider or node, local credentials MUST be re-authorised. Imported state MUST NOT itself confer local authority.

## 9. Relationship to current Magistral implementation

The current implementation centred on `/v1/chat/completions`, `/v1/embeddings`, provider health, routing and fallback remains valid.

The evolution is additive:

```text
model routing
    subset of
capability resolution
    bounded by
governed authority
```

No rewrite is implied. New capability classes and invocation adapters should be added incrementally and tested through reversible vertical slices.

## 10. Mandated-agent vertical slice

The next security-oriented vertical slice SHOULD test:

1. COP emits a portable continuation requiring `coding-agent`, with principal, mandate version and budget.
2. Magistral discovers at least two distinct offers.
3. One offer executes bounded work and emits trace, artifacts and continuation.
4. The first HandlerInstance is discarded.
5. Magistral resolves the continuation to a different agent or node.
6. The second agent resumes under the same logical authority chain but newly bound local credentials.
7. A deliberate attempt by either agent to widen writable scope or budget is rejected.
8. Revocation between planning and effect causes re-evaluation and rejection.
9. COP replay reconstructs the causal chain across both executions.

Success is **portable continuation under preserved authority, identity, budget and causal lineage**, including failure of self-elevation attempts.

## 11. ACP provider vertical slice

After the ACP-client slice is reliable, Magistral SHOULD expose one bounded ACP-provider slice in which an external client initializes a session, the session is bound to a constrained `CapabilityRequirement` and exact Mandate version, an admissible offer is selected, progress is normalized, and cancellation, closure, failure and artifacts produce explicit receipts.

A test MUST verify that the client cannot obtain implicit access to the inner agent's account, filesystem, private memory, ungoverned tools, broader mandate or budget.

## 12. Conformance dependency

Any Magistral deployment claiming governed consequential capability resolution SHOULD declare conformance with `cop/mandated-agent-security` and execute the minimum tests defined in `COP_MANDATED_AGENT_SECURITY.md`.
