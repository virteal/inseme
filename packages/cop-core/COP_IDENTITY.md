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

## Identified things

Identity is not limited to persons or subjects.

COP also needs stable identifiers for things that may be referenced, routed, versioned, audited, replayed or challenged.

Initial categories:

```text
cop_event
cop_artifact
cop_topic
cop_task
cop_step
cop_continuation
proposal
proposal_version
public_decision
vote_session
mandate_record
capacity_record
role_record
influence_trace
civic_protection_report
ledger_record
signature_key
credential
proof_or_evidence
dns_root
repository
corpus
source_document
derived_artifact
software_package
runtime_node
physical_place
physical_object
sensor_or_device
resource_stream
external_reference
```

Rule:

```text
Subjects can act or bear rights, roles, capacities and mandates.
Identified things can be referenced, versioned, routed, audited or used as evidence.
A thing must not be treated as a subject unless a profile explicitly grants it subject status.
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
identity/identified-thing
identity/object-reference
```

## Rule

A governance-sensitive event should identify not only who acts, but also the type of subject, the role, the capacity, the possible principal, the mandate and the publicity rule.

A governance-sensitive reference should identify what is being referenced, which version or hash is meant, and whether the reference is normative, evidential, informative or operational.

## Continuation

This seed should later be expanded into a fuller profile and connected to JSON schemas and TypeScript types.
