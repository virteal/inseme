# COP/Identity Profile — Seed

Status: operational seed, v0.1.

This profile extends COP/Core with a minimal vocabulary for subjects, capacities and mandates.

It keeps COP/Core unchanged.

## Subject kinds

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

## Core fields for governance-sensitive events

```text
actor_subject_id
actor_subject_kind
acting_as
capacity_basis
principal_subject_id
mandate_id
scope
publicity_rule
attribution_evidence
```

## Initial artifacts

```text
identity/subject
identity/capacity
identity/mandate
identity/role
identity/attribution-evidence
```

## Rule

A governance-sensitive event should identify not only who acts, but also the type of subject, the role, the capacity, the possible principal, the mandate and the publicity rule.

## Continuation

This seed should later be expanded into a fuller profile and connected to JSON schemas and TypeScript types.
