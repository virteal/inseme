---
title: COP Terminology — Mandated Cognitive Handling
document_role: source
document_kind: protocol-terminology
visibility: public
lifecycle_state: active
language: en
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: JeanHuguesRobert/inseme
  origin_issue: 31
  origin_date: "2026-08-01"
review:
  status: human-validated
  reviewed_by:
    - Jean Hugues Noël Robert
---

# COP Terminology — Mandated Cognitive Handling

This document is the normative vocabulary for COP concepts concerning authority, execution,
and accountability. It resolves the previously overloaded use of `agent`.

COP Core remains a protocol for durable coordination through Events, Artifacts, Views, and
Continuations. COP/Mandate remains an additive profile; this terminology does not make mandate
enforcement a Core claim.

## 1. Normative chain

```text
Principal → Mandate → LogicalAgent → HandlerProfile → HandlerInstance
          → CapabilityInvocation → Act → Trace → Imputation
```

Each relation is explicit when it matters to authorization, replay, accountability, or audit.
An implementation MUST NOT infer authority solely from technical reachability, capability, or
successful execution.

## 2. Terms

| Term | Definition |
|---|---|
| **Subject** | Any identifiable entity to which COP may relate: a person, legal person, informal collective, digital instance, or other organized entity. |
| **Principal** | A Subject from which authority originates for a given Mandate. A Principal is not necessarily the owner of every resource involved. |
| **Actor** | Any entity that may cause, participate in, attest to, or be attributed an Act. This is the generic term. |
| **Mandate** | A durable, reviewable authorization relation specifying who may do what, for whom, under which scope, limits, delegation rules, trace regime, and revocation conditions. |
| **LogicalAgent** | A durable mandate-bearing identity that may receive, hold, or delegate authority. It is a role of an Actor or Subject, not a process and not necessarily the concrete executor. |
| **HandlerProfile** | A stable declaration of how work may be handled: accepted packet classes, required or offered capabilities, policy constraints, and result contract. |
| **Handler** | A competent executor of a Cognitive Packet. A Handler may be human, model, script, tool, repository, review queue, publication process, runtime, or governance process. It is not presumed to hold authority. |
| **HandlerInstance** | A concrete, identifiable incarnation of a Handler Profile executing work in a bounded context. It may be durable, suspended, restarted, substituted, or ephemeral. |
| **Capability** | A declared ability to perform a bounded transformation or effect. Capability proves neither authority nor entitlement to use it. |
| **CapabilityInvocation** | One recorded attempt or execution of a Capability by a HandlerInstance. |
| **Act** | A meaningful operation or effect asserted by COP. An Act MAY be proposed, authorized, attempted, completed, refused, compensated, or observed; these states MUST NOT be conflated. |
| **Trace** | Durable, causally linkable evidence about authority, handling, inputs, outputs, effects, custody, or review. FractaLog is a governed trace projection, not merely runtime telemetry. |
| **Imputation** | The explicit relation by which responsibility, credit, cost, custody, or consequence is attributed. |
| **Supervisor** | A runtime component that starts, stops, monitors, or restarts child work. Supervision does not create Mandate authority. |
| **Continuation** | A durable, resumable request or state describing what remains to be handled. A Continuation SHOULD be capability-bound unless identity-bound resumption is explicitly required. |

## 3. Rules for `agent`

The bare term **Agent** is NOT normative in new COP schemas, API names, or specification prose.

Permitted uses are limited to:

- the compound term `LogicalAgent`;
- an exact external protocol, product, historical name, or quoted source;
- a clearly marked historical compatibility note while this clean-slate migration is incomplete.

The former `COPAgent` runtime interface is to be replaced by a handler-oriented name in Issue #31
Phase 2. No compatibility alias is intended.

## 4. Public metaphors

Terms such as *Father Christmas*, *elves*, *workshop*, or equivalent localized metaphors are
informative public communication only. They have no protocol, authorization, identity, schema, or
runtime meaning.

## 5. Execution and authority

A HandlerInstance MAY execute an Act only within the applicable protocol and policy conditions.
For consequential effects, the record MUST be capable of distinguishing, where applicable:

```text
Principal / authorizing Subject
Mandate / authority reference
LogicalAgent / mandated continuity
HandlerProfile and HandlerInstance / concrete execution
CapabilityInvocation
Act and effect receipt
Trace and Imputation
```

A successful capability invocation does not itself prove a valid mandate. A delivered message does
not itself prove representation or authorization.

## 6. Lifecycle and substitution

A HandlerInstance can be created, paused, resumed, replaced, or terminated without changing the
identity of a LogicalAgent or the causal history of the work. Correct continuation state MUST NOT
exist solely in inaccessible HandlerInstance memory.

A Supervisor may manage many ephemeral HandlerInstances, including homogeneous instances created on
demand. Their lifecycle events and relevant outcomes remain traceable even after their runtime
processes cease to exist.

## 7. Migration status

This terminology is a **pre-operational clean break**. COP has no compatibility obligation to early
prototypes. Existing terms and identifiers are to be removed rather than preserved through aliases,
unless a later documented operational boundary creates a genuine third-party reliance.

See [Issue #31](https://github.com/JeanHuguesRobert/inseme/issues/31) for the bounded migration
phases and resumption checkpoints.
