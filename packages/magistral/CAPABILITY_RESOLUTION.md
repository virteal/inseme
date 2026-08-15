---
title: Magistral Capability Resolution Boundary
subtitle: Generic interface between COP orchestration and heterogeneous work capabilities
author: Jean Hugues Noël Robert, baron Mariani
date: "2026-08-15"
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
review:
  status: unreviewed
  reviewed_by: []
---

# Magistral Capability Resolution Boundary

## 1. Decision

Magistral is not conceptually limited to Large Language Model routing.

Its stable architectural role is:

> **Magistral is the capability-resolution and access boundary between orchestration and concrete work capabilities.**

The existing OpenAI-compatible model router remains a valid and useful first implementation slice.
It MUST NOT be mistaken for the full abstraction.

Compact formulation:

```text
COP orchestrates work.
Magistral resolves and presents capabilities.
Fractanet makes capabilities present.
```

## 2. Separation of concerns

COP may express that a continuation or task requires a capability without naming a concrete provider,
machine, protocol, model, or process.

Magistral resolves that requirement against capabilities currently reachable in Fractanet and
selects an admissible access path according to constraints and policy.

Fractanet is the distributed field in which those capabilities are present: local processes,
remote services, machines, humans, agents, models, databases, sensors, actuators, or future forms of
compute.

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

Magistral does not create authority. A capability offer or successful invocation proves neither a
Mandate nor entitlement to use the capability.

## 3. Generalizing BLUEPRINT / MAP / PILOT

The existing Magistral tripartite architecture remains useful when generalized beyond models.

### BLUEPRINT — what can be done

A Blueprint describes a class of capability and its relevant properties.

Examples:

```text
semantic-embedding
chat-synthesis
coding-agent
repository-review
vision-inference
speech-transcription
human-review
inox-execution
```

A coding-agent Blueprint may advertise, for example:

```yaml
capability: coding-agent
features:
  - repository-read
  - repository-edit
  - shell
  - git
  - mcp
  - long-running-session
  - checkpoint
```

Blueprints describe capability, not authority.

### MAP — where capability is presently available

A Map binds capability offers to reachable Fractanet locations or providers.

Examples:

```text
poco-jhr       -> Grok Build, Codex
thinkpad-jhr   -> Claude Code, Codex
fracta         -> local embedding service, Ollama
remote-openai  -> responses, embeddings, vision
human:jhr      -> review / decision / contextual expertise
```

A Map entry may include cost, latency, locality, trust domain, credentials regime, concurrency,
health, energy, jurisdiction, or other operational properties.

### PILOT — how a capability is selected

A Pilot resolves a `CapabilityRequirement` against available offers.

Selection may consider:

```text
required features
mandate-compatible scope
budget
cost bearer
latency
locality
availability
quality
confidence
privacy
trust domain
energy
jurisdiction
reversibility
session affinity
continuation portability
```

The Pilot may use fallback, competition, racing, quorum, or synthesis policies when appropriate.

## 4. CapabilityRequirement

Magistral SHOULD accept a provider-neutral requirement rather than forcing COP to name a concrete
runtime.

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
  deadline: ...
preferences:
  locality: prefer-local
  portability: required
```

This is informative, not yet a normative wire schema.

## 5. Invocation contracts are capability-specific

A major reason not to reduce Magistral to `/v1/chat/completions` is that different capabilities have
different interaction semantics.

```text
embedding
  request -> vector

chat synthesis
  request -> streamed response

coding agent
  session -> actions -> events -> artifacts -> checkpoint

human review
  request -> wait -> decision

physical actuation
  request -> authorization -> effect -> receipt
```

Magistral therefore needs a generic notion of **InvocationAdapter** rather than one universal HTTP
shape.

OpenAI-compatible endpoints remain a valuable adapter family for service-like intelligence.

## 6. ACP, A2A, MCP and other surfaces

Execution protocols are below the Magistral boundary.

```text
Magistral
  |- OpenAI-compatible HTTP adapter
  |- provider-native API adapter
  |- ACP adapter
  |- A2A adapter
  |- MCP adapter where capability invocation is appropriate
  |- CLI / stdio compatibility adapter
  |- Inox-native adapter
  `- future adapters
```

Their roles are not identical:

- ACP is suited to rich host-to-agent execution sessions;
- A2A is suited to cooperation with a peer autonomous agent;
- MCP is suited to tools and resources;
- OpenAI-compatible APIs are suited to service-like model capabilities;
- CLI/stdio remains a pragmatic compatibility surface.

The execution surface MUST NOT determine the authority relation.

## 7. Coding agents as high-value capabilities

Coding agents are not merely language models. They can combine reasoning, repository navigation,
editing, shell execution, tools, planning, and iterative interaction.

Magistral SHOULD therefore represent a coding agent as a rich capability rather than pretending that
it is only a model behind a conversational endpoint.

The existing Agent CLI Gateway remains useful as a compatibility projection:

```text
rich coding-agent capability
        |
        +-> ACP or future rich adapter
        |
        `-> /v1/chat/completions compatibility projection
```

A compatibility projection MAY lose semantics. It MUST NOT become the canonical representation of
portable work state.

## 8. Anti-capture and continuation portability

Vendor sessions MAY be used as execution accelerators but SHOULD NOT own the canonical state of a
portable task.

Where portability is required, the durable state needed to continue work must be externalized into
COP Events, Artifacts, Continuations, repository state, or other reconstructible Fractanet memory.

The desired property is:

```text
Codex / node A
  -> checkpoint
COP continuation + artifacts
  -> resolve again
Claude / node B
  -> checkpoint
COP continuation + artifacts
  -> resolve again
Grok / node C
```

Changing HandlerInstance MUST NOT silently change the LogicalAgent, Mandate, budget bearer, or causal
lineage of the work.

## 9. Relationship to current Magistral implementation

The current implementation centred on:

```text
/v1/chat/completions
/v1/embeddings
model/provider health
routing and fallback
```

remains valid and SHOULD continue to work.

The evolution is additive:

```text
model routing
    subset of
capability resolution
```

No rewrite is implied by this decision. New capability classes and invocation adapters should be
added incrementally and tested through reversible vertical slices.

## 10. First new vertical slice

The first non-model capability SHOULD be `coding-agent`.

Target experiment:

1. COP emits or references a portable continuation requiring `coding-agent`.
2. Magistral discovers at least two distinct offers.
3. One offer executes part of the work.
4. Execution emits trace, artifacts and a new continuation.
5. The first HandlerInstance is discarded.
6. Magistral resolves the continuation to a different agent and, preferably, a different node.
7. The second agent resumes without relying on inaccessible vendor-session state.
8. COP replay reconstructs the causal chain across both executions.

Success is not merely task completion. Success is **portable continuation under preserved authority,
identity, budget and causal lineage**.
