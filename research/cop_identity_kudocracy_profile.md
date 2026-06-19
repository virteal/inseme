---
title: "COP Identity / Kudocracy Profile"
subtitle: "Subjects, capacities, mandates and public civic acts"
author: "Jean Hugues Noël Robert"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
license: "CC BY-SA 4.0"
status: "working-paper — source document"
date: "2026-06-19"
language: "en"
repository: "JeanHuguesRobert/inseme"
corpus_role: "source"
---

# COP Identity / Kudocracy Profile

## 1. Purpose

This document defines a first source-level extension path for using COP in identity-sensitive and governance-sensitive systems, especially Kudocracy.

The goal is not to modify COP/Core. The goal is to add a profile layer able to express:

- subjects;
- subject kinds;
- capacities;
- roles;
- mandates;
- public civic acts;
- influence traces;
- civic protection reports;
- auditable public decision records.

COP already provides Events, Artifacts, Topics, Tasks, Steps, Continuations, causality, hashing, optional signatures and append-only ledgers. Kudocracy needs an additional civic ontology so that every governance-critical act can answer:

```text
Who acts?
What kind of subject is acting?
At what title?
For whom?
Under what mandate?
In what scope?
With what attribution evidence?
Under what publicity rule?
What influence or protection context exists?
```

## 2. Non-goal

This profile does not define a universal state identity system, a biometric identity layer, a blockchain identity system, or a complete authentication mechanism.

Identity proofing and authentication may be delegated to external systems: state wallets, verified credentials, community registries, DNS roots, signatures, accounts, or other proof systems.

COP records the claims, evidence references, acts, mandates and audit traces.

## 3. Subject taxonomy

A `Subject` is any entity that can be referred to in COP as the bearer of a status, identity, role, capacity, mandate, influence or act.

Initial subject kinds:

```text
natural_person_living
natural_person_deceased
legal_entity_collective
public_institution
unincorporated_collective
role_or_office
ai_agent
digital_twin
fictional_persona
technical_node
estate_or_legacy_corpus
unknown_or_unverified
```

The legal expression "personne morale" is institutionally established in French law, but conceptually problematic. It may be clearer to speak of `legal_entity_collective`, `non_living_legal_subject`, or `constructed_legal_subject`.

## 4. Kudocracy constitutional rule

In Kudocracy, sovereign civic voting belongs only to living natural persons who have capacity in the relevant scope.

```text
one living natural person = one sovereign civic voice
one company != one citizen
one AI agent != one citizen
one digital twin != one living citizen
```

Other subjects may contribute, recommend, certify, audit, publish, operate systems, preserve archives, or represent a bounded mandate, but they must not be confused with living citizens.

## 5. Subject / actor / role / mandate / act

Definitions:

- `Subject`: entity that can be identified or referenced.
- `Actor`: subject causing or performing an event.
- `Role`: contextual position, such as citizen, chair, auditor, operator, candidate, trustee.
- `Capacity`: right or ability to perform a class of acts in a scope.
- `Mandate`: explicit authorization for one subject to act for another subject in a bounded scope.
- `Agent`: software or AI component able to process or emit COP events.
- `Act`: imputable event such as vote, suggestion, recommendation, delegation, revocation, correction, validation.

Rule:

```text
A governance-critical event must not only say who acted.
It must say in what capacity, at what title, for whom, under what mandate, and under what publicity rule.
```

## 6. Capacity

Capacity is scope-bound. A subject may exist without being able to perform a given act.

Examples:

- a resident may vote in a municipal Kudocracy process;
- a non-resident may comment but not vote;
- an AI agent may suggest but not vote;
- a digital twin may represent a corpus but not produce a sovereign living will;
- an association may publish recommendations but not count as a citizen.

## 7. Mandate

Mandates are explicit, bounded, revocable and auditable.

A mandate must identify:

- principal subject;
- representative subject;
- representative kind;
- allowed actions;
- forbidden actions;
- scope;
- validity period;
- revocation policy;
- evidence artifacts.

An AI agent may be mandated to suggest, summarize, compare or alert. It must not be silently allowed to vote as a living citizen.

## 8. Public civic act

Kudocracy starts from the principle of public civic acts. The ideal vote is public, because a robust democracy should protect citizens sufficiently for them to assume their opinions.

The secret ballot is therefore treated as a defensive mechanism, sometimes necessary in insufficiently protective contexts, but not as the democratic ideal.

A public civic act should include:

```text
actor_subject_id
actor_subject_kind
acting_as
capacity_basis
mandate_id, if any
proposal_id
proposal_version_hash
act_value
publicity level
attribution evidence
signature or equivalent proof
influence trace reference
civic protection reference, if any
```

## 9. Influence trace

Because Kudocracy distinguishes suggestion, recommendation, delegation and prescription, a vote may carry an influence trace.

Rules:

```text
suggestion = illuminates possibilities
recommendation = stronger orientation requiring stricter audit
delegation = bounded transfer of decision power
prescription = prohibited for sovereign civic acts
```

## 10. Digital twin rule

A digital twin is not a living natural person.

It may represent a continuity of corpus interpretation. It must not be confused with living personal sovereignty.

Permitted roles:

- suggest;
- compare;
- explain;
- recall corpus positions;
- signal contradictions;
- simulate likely continuations;
- act under explicit bounded mandate.

Forbidden roles:

- vote as a living citizen;
- pretend to be the person;
- create sovereign will after death;
- engage others without an explicit mandate.

Formula:

```text
A digital twin may preserve interpretive continuity; it does not possess living sovereignty.
```

## 11. Profile placement

Recommended structure:

```text
COP/Core
  + COP/HITL
  + COP/AI
  + COP/Identity
  + COP/Kudocracy
```

`COP/Identity` handles subjects, capacities and mandates.

`COP/Kudocracy` handles public civic acts, proposals, votes, influence traces, civic protection and public audit.

## 12. Continuation

Next steps:

1. Add operational profile documents under `packages/cop-core/`.
2. Add minimal JSON schemas for subject and mandate.
3. Add Kudocracy schemas for public decision, influence trace and civic protection report.
4. Add TypeScript types.
5. Add validation helpers.
6. Add projections for public decision ledgers.
7. Add tests for capacity and mandate validation.
