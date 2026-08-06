---
shared_instructions: https://github.com/JeanHuguesRobert/cogentia/blob/main/instructions/AGENTS.shared.md
---

# AGENTS.md — Inseme Multi-Agent Working Contract

This file defines the working contract for coding agents, research agents, and review agents contributing to this repository.

It is intentionally short. Agents should read it before modifying code, documents, workflows, or package structure.

---

## 0. Shared baseline and read order

Before acting here:

1. read this repository-local `AGENTS.md`;
2. read the shared [`cogentia/AGENTS.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/AGENTS.md);
3. inspect any closer package-level rule files;
4. apply the most specific and most restrictive applicable mandate.

The shared baseline supplies the default corpus workflow. This file specializes it for Inseme, COP, the monorepo, and implementation work; it does not silently widen permissions.

---

## 1. Repository priority

`inseme` is the platform repository of the corpus.

### Current North Star — first Cogentia Digital Twin

The current integration target is the first operational Cogentia Personal Digital Twin:

```text
represented subject: JHN
TwinRoot: twin:jhn
first LogicalAgent: Agent JHN / John
```

The purpose of current COP work is not to perfect protocol components in isolation. It is to make this first Twin capable of performing real, bounded, replayable work through replaceable handlers.

Target governed execution chain:

```text
Principal
→ Mandate
→ LogicalAgent
→ Capability selection
→ HandlerInstance
→ CapabilityInvocation
→ Act
→ Trace
→ Imputation
```

Consequential capabilities additionally require the applicable budget/resource discipline and proportional trace regime.

Use Issue #17 as the JHN vertical-slice epic and Issue #31 as the immediate COP semantic integration track. The scoped runtime instructions in `apps/platform/mcp/cop/AGENTS.md` define the current implementation frontier.

Keep generic and instance-specific layers separate:

```text
Cogentia / Inseme
= generic Digital Twin and COP machinery

JeanHuguesRobert/JeanHuguesRobert
= public JHN Twin / Agent John instance definition

JeanHuguesRobert/registre-mariani
= private/restricted overlay for the same Twin
```

Do not hard-code JHN-specific doctrine into generic COP contracts merely because JHN is the first implementation. Missing abstractions discovered by the JHN vertical slice should be repaired generically when they are genuinely reusable.

Current COP implementation priority remains especially:

- `packages/cop-core` — protocol, data model, invariants, interfaces;
- `packages/cop-kernel` — reference runtime / implementation layer;
- `packages/cop-host` — hosting and brique integration surface;
- `apps/platform/mcp/cop` — first JHN governed runtime slice;
- `cop-cli`, `cop-chat`, and future adapters — operational profiles or surfaces.

COP must remain distinguishable from its implementations.

```text
cop-core     = abstract protocol / invariant level
cop-kernel   = reference implementation profile
cop-host     = platform integration surface
cop-cli/chat = operational derived interfaces
```

---

## 2. Core rule: one issue = one bounded mandate

Before starting substantial work, identify the issue or create one.

A good issue should state:

- target files or packages;
- problem or opportunity;
- proposed change;
- risks;
- expected closure condition;
- agent-resumable next step.

Do not expand the scope silently. If the work reveals a new problem, create or propose a new issue.

---

## 3. Branch / PR discipline

Current solo-corpus rule: write directly to the default branch unless Jean Hugues Robert explicitly asks for a branch or a pull request.

This repository follows **Optimistic Mainline Governance** by reference:

- [`cogentia/AGENTS.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/AGENTS.md)
- [`cogentia/research/optimistic_mainline_governance.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/optimistic_mainline_governance.md)

Direct-main work remains legitimate only when scoped, reversible, inspectable by diff and reported. Branches or PRs are exceptions when they materially improve safety, review or external collaboration.

Avoid mixing protocol changes, runtime changes, UI changes, documentation updates, refactors and generated files unless the coupling is necessary and explained.

---

## 4. Preserve COP invariants

Any change touching COP must preserve these invariants unless the change explicitly proposes a versioned protocol revision:

- immutable Events and Artifacts;
- topic-local ordering;
- idempotency under at-least-once delivery;
- durability of meaningful state;
- stateless / replaceable handlers;
- durable `LogicalAgent` identity and resumable work state must not depend solely on inaccessible `HandlerInstance` memory;
- coordination via Events and Artifacts, not hidden direct coupling;
- deterministic replay of recorded traces and projections;
- explicit schema versioning;
- transparency over convenience.

If a shortcut violates one of these invariants, flag it clearly as non-conformant or experimental.

---

## 5. Abstract / implementation separation

When working on COP or related systems, separate:

- **abstract level** — concepts, invariants, interfaces, conformance;
- **implementation level** — concrete runtime, storage, bus, scheduler, UI, adapter, package;
- **instance level** — JHN-specific configuration, public definition, private overlays and situated mandates.

Do not let an implementation or one personal instance silently redefine the protocol. Do not let protocol documents drift into untested speculation.

---

## 6. Documentation expectations

For significant changes, update or create the smallest useful document:

- README for package-level usage;
- architecture note for structural choices;
- implementation profile note for concrete runtimes;
- state-of-play note for living implementation status;
- issue comment for temporary continuation.

Documentation should state what is stable, what is experimental, and what remains to verify.

---

## 7. Testing and validation

Before presenting work as ready, run the relevant checks when available.

At minimum, report:

- commands run;
- tests passed or missing;
- failures and suspected causes;
- files intentionally not tested;
- assumptions requiring human review.

If no tests exist, say so and propose the smallest conformance or regression test that would reduce risk.

For the JHN vertical slice, prefer integration tests that demonstrate governed real Acts rather than only conversational quality.

---

## 8. Traceability and uncertainty

Agents must preserve traceability.

When making decisions, state:

- why the change was made;
- which issue or document it serves;
- what evidence supports it;
- what remains uncertain;
- what could break.

For consequential execution, keep material actor / `HandlerInstance`, `LogicalAgent`, Principal, Mandate, CapabilityInvocation, Act, evidence/effect and Imputation distinguishable where applicable.

Do not conceal uncertainty behind confident prose.

---

## 9. Human validation anchors

Stop and request human validation when a change affects:

- COP invariants;
- public doctrine or institutional positioning;
- licensing;
- security model;
- irreversible data migrations;
- naming of major concepts;
- deletion of documents or package structure;
- anything likely to affect several repositories.

A valid explicit ongoing mandate may cover ordinary in-scope reversible acts; use judgment rather than adding approval ceremony to every micro-action. Human decision artifacts remain part of the governance model.

---

## 10. Existing agent tools and references

Use current documentation tools rather than guessing about third-party packages.

Also inspect, when present:

- `.rules.md`;
- `.ai-rules.md`;
- `.gemini.md`;
- `.api-docs.md`;
- `ARCHITECTURE.md`;
- `ROADMAP-TECH.md`;
- [`cogentia/AGENTS.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/AGENTS.md);
- [`cogentia/research/agent_configuration_layer.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/agent_configuration_layer.md);
- [`cogentia/research/optimistic_mainline_governance.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/optimistic_mainline_governance.md).

If these files disagree with this document, preserve the conflict and report it. Do not silently choose one.

---

## 11. Minimal completion report

Every substantial agent contribution should end with:

```text
Issue:
Files changed:
Tests run:
Known risks:
Reversibility:
Next step:
Human validation needed: yes/no
```

This keeps multi-agent work reviewable, resumable, and compatible with the Cogentia / COP traceability doctrine.
