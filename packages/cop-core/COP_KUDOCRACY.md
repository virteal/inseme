# COP/Kudocracy Profile — Seed

Status: operational seed, v0.1.

This profile extends COP/Core and COP/Identity for public civic decisions.

It keeps COP/Core unchanged.

## Principle

Kudocracy treats the public civic act as the normal form of democratic expression.

The working ideal is that a living citizen should be sufficiently protected to assume a public position.

## Sovereign civic voice

Only a living natural person with capacity in the relevant scope can carry a sovereign civic voice.

Other subjects may contribute, explain, suggest, recommend, certify, operate tools, preserve archives or hold limited mandates, but they are not living citizens.

## Initial artifacts

```text
kudocracy/proposal-version
kudocracy/public-decision
kudocracy/influence-trace
kudocracy/civic-protection-report
```

## Initial fields for a public decision

```text
decision_id
actor_subject_id
actor_subject_kind
proposal_id
proposal_version_hash
value
rationale_artifact_id
capacity_basis
mandate_id
influence_trace_id
publicity_rule
signature
```

## Influence grammar

```text
suggestion
recommendation
delegation
prescription
```

Suggestion illuminates possibilities.
Recommendation is a stronger orientation and needs stricter audit.
Delegation transfers a bounded decision capacity.
Prescription is not acceptable for sovereign civic acts.

## Digital twin rule

A digital twin may preserve interpretive continuity. It does not possess living sovereignty.

## Continuation

Future work should add JSON schemas for public decisions, influence traces and civic protection reports, then TypeScript types and validation helpers.
