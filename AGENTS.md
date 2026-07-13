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

Current priority: stabilize the **Cognitive Orchestration Protocol (COP)** implementation path, especially:

- `packages/cop-core` — protocol, data model, invariants, interfaces;
- `packages/cop-kernel` — reference runtime / implementation layer;
- `packages/cop-host` — hosting and brique integration surface;
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

Rationale:

1. Jean Hugues Robert is currently the sole active corpus operator.
2. Branches add cognitive and operational complexity.
3. By Occam's razor, unnecessary workflow layers should be avoided.
4. The corpus already has traceability through source documents, commits, diffs, issues, future corrections and explicit continuation notes.
5. Direct-main work remains legitimate only when scoped, reversible, inspectable by diff and reported.

Therefore agents MUST NOT create feature branches or pull requests by default.

Prefer:

- small direct commits to `main`;
- coherent changes with explicit commit messages;
- source documents before implementation when the concept is still unstable;
- later corrections by explicit follow-up commits.

Branches or PRs MAY be used only when:

- Jean Hugues Robert explicitly asks for them;
- the change is a high-risk refactor that should be isolated;
- external collaboration requires review before integration;
- repository protection rules make direct commits impossible;
- the change affects COP invariants, security, irreversible migrations, package structure, or several subsystems at once.

If a branch is used exceptionally, explain why in the work report.

Avoid mixing:

- protocol changes;
- runtime changes;
- UI changes;
- documentation updates;
- refactors;
- generated files.

If mixed changes are unavoidable, explain why in the commit or PR description.

---

## 4. Preserve COP invariants

Any change touching COP must preserve these invariants unless the change explicitly proposes a versioned protocol revision:

- immutable Events and Artifacts;
- topic-local ordering;
- idempotency under at-least-once delivery;
- durability of meaningful state;
- stateless agents;
- coordination via Events and Artifacts, not hidden direct coupling;
- deterministic replay of recorded traces and projections;
- explicit schema versioning;
- transparency over convenience.

If a shortcut violates one of these invariants, flag it clearly as non-conformant or experimental.

---

## 5. Abstract / implementation separation

When working on COP or related systems, separate:

- **abstract level** — concepts, invariants, interfaces, conformance;
- **implementation level** — concrete runtime, storage, bus, scheduler, UI, adapter, package.

Do not let an implementation silently redefine the protocol.

Do not let protocol documents drift into untested speculation.

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

---

## 8. Traceability and uncertainty

Agents must preserve traceability.

When making decisions, state:

- why the change was made;
- which issue or document it serves;
- what evidence supports it;
- what remains uncertain;
- what could break.

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

Human decision artifacts are part of the governance model, not optional ceremony.

---

## 10. Existing agent tools and references

### Context7

Use Context7 or equivalent documentation tools when you need to understand third-party or internal packages instead of guessing.

Typical uses:

- Netlify configuration or Edge Functions;
- Vite configuration;
- React libraries;
- `@dnd-kit/core`;
- `@tanstack/react-query`;
- `framer-motion`;
- `playwright`;
- `tailwindcss`.

### Local rule files

Also inspect, when present:

- `.rules.md` — general development rules;
- `.ai-rules.md` — AI assistant behavior and response style;
- `.gemini.md` — Gemini-specific context;
- `.api-docs.md` — important API references;
- `ARCHITECTURE.md` — system architecture;
- `ROADMAP-TECH.md` — technical roadmap.
- [`cogentia/AGENTS.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/AGENTS.md) — shared operational baseline and default read order.
- [`cogentia/research/agent_configuration_layer.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/agent_configuration_layer.md) — AGENTS.md, `.agents/`, and governed operational projections of the corpus.
- [`cogentia/research/optimistic_mainline_governance.md`](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/optimistic_mainline_governance.md) — direct agent work on `main` under trace, reversibility and scoped authorization.

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
