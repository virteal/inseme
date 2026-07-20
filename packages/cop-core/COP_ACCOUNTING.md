---
title: "COP/Accounting — Resource, Budget, Mandate, and Ledger Semantics"
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
license: "CC BY-SA 4.0"
date: "2026-07-20"
version: "0.1-draft"
status: "working-source — human validation required"
document_role: "source"
document_kind: "protocol-profile"
visibility: "public"
lifecycle_state: "working"
update_policy: "UP-DECISION-REVIEW"
human_validation_required: true
provenance:
  origin_type: "conversation"
  origin_repository: "JeanHuguesRobert/inseme"
  origin_ref: "local-draft"
  origin_date: "2026-07-20"
  derived_from:
    - "packages/cop-core/Invariants.md"
    - "packages/cop-core/COP_STORE_AND_PERSISTENCE.md"
    - "packages/cop-core/COP_IDENTITY.md"
review:
  status: "unreviewed"
  reviewed_by: []
tags:
  - cop
  - accounting
  - resources
  - budgets
  - mandates
  - audit
  - fractanet
  - kudos
---

# COP/Accounting — Resource, Budget, Mandate, and Ledger Semantics

## 1. Decision and status

COP/Accounting specifies how a COP system records resources, budgets, reservations, commitments,
settlements, and delegated acts without losing accountability.

This profile is:

- **mandatory from day one for Fractanet**, including cognitive-packet routing;
- normative for any COP application that allocates, consumes, transfers, reserves, creates, or
  destroys consequential resources;
- optional for COP applications that perform no such act;
- a draft requiring human validation before being declared stable.

The accounting trace MUST exist before reputation, market signals, or routing weights are computed.
Good intentions, transient agent memory, and application logs are not accounting records.

## 2. Scope

COP/Accounting is a multidimensional resource-accounting profile. It covers monetary and
non-monetary resources, including:

- legal tender and bank balances;
- complementary units such as Kudos;
- energy, compute, storage, bandwidth, materials, and time;
- cognitive-packet budgets;
- reservations, quotas, rights of use, and other capacities.

This profile does not claim that every resource has a monetary value. Quantity, unit, valuation,
legal ownership, operational control, custody, and beneficial interest are distinct facts and MUST
NOT be silently conflated.

This profile is not, by itself, a substitute for statutory, tax, banking, or regulated financial
accounting. Adapters MAY produce such ledgers when their jurisdictional rules are explicitly stated.

## 3. Relationship to COP Core

COP/Accounting adds semantics and conformance rules, not a parallel persistence system.

- An accounting fact is recorded as an immutable COP `Event`.
- Supporting evidence is recorded or referenced as a COP `Artifact`.
- Accounts, ledgers, balances, available budgets, statements, reconciliations, and routing metrics
  are `View`s derived from Events and Artifacts.
- A correction is a new reversal or compensating Event. History is never overwritten.

Consequently, accounting MUST preserve all COP invariants: ordering, idempotency, durability,
stateless agents, event-mediated coordination, deterministic replay, schema versioning, and
transparency.

## 4. Normative vocabulary

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** express normative
requirements.

### 4.1 Core concepts

| Concept | Meaning |
|---|---|
| Subject | Identified natural person, legal person, informal collective, agent, node, packet, community, or other accountable entity. |
| Resource type | Kind of resource being accounted for, independently of its unit. |
| Unit | Exact measurement unit used by a posting. |
| Account | Stable analytical address associating a subject, a resource type, a capacity, and a scope. |
| Transaction | One atomic, causally coherent set of postings. |
| Posting | Signed quantity applied to one account in one transaction. |
| Budget | Bounded authorization to use specified resources for a specified purpose. |
| Reservation | Temporary exclusion of an amount from the budget available to competing acts. |
| Commitment | Resource obligation that has been accepted but may not yet be settled. |
| Settlement | Event establishing that the expected transfer or consumption occurred. |
| Mandate | Bounded authority through which an actor acts for a principal. |
| Evidence | Artifact or external reference supporting an assertion or reconciliation. |
| Valuation | Time- and source-bounded interpretation of one resource in another unit. |

An `Account` is a projection address, not necessarily a bank account and not a new durable COP
primitive.

## 5. Accounting invariants

### 5.1 Complete attribution

Every consequential posting MUST identify:

- the transaction and posting;
- the account and accountable subject;
- the resource type, unit, and exact signed quantity;
- the actor that emitted the act;
- the principal on whose behalf the act was performed;
- the applicable mandate and budget when delegation or bounded spending is involved;
- its causal event, purpose, time, schema version, and privacy classification.

An actor and a principal MAY be the same subject. When they differ, the distinction MUST be
explicit.

### 5.2 Balanced transactions

Within every conserved `(resourceType, unit, accountingDomain)` dimension, the signed postings of
a settled transaction MUST sum to exactly zero.

Creation, destruction, demurrage, loss, or transformation MUST use an explicit source, sink, or
transformation account and MUST cite the rule and authority that permit it. Nothing is created or
destroyed merely to make a balance reconcile.

### 5.3 No implicit conversion

Postings expressed in different units MUST NOT be balanced against each other. A conversion or
valuation requires an explicit event stating at least its source, rate or method, effective time,
precision, and scope.

A valuation is a derived interpretation. It MUST NOT rewrite the original quantities.

### 5.4 Exact quantities

Authoritative quantities MUST use decimal integers with an explicit scale, or another exact
canonical representation. Binary floating-point numbers MUST NOT be used for authoritative
postings.

### 5.5 Budget and reservation safety

A budget MUST define its owner or principal, permitted resource dimensions, purpose, scope,
validity period, limits, and applicable mandate.

At every accepted transition:

```text
available = granted + received - settled - committed - reserved - expired_or_revoked
```

The exact projection MAY refine these terms, but MUST NOT permit the same capacity to be spent
twice. A reservation MUST precede an asynchronous consequential act whenever concurrent execution
could overspend the budget.

### 5.6 Bounded delegation

An act performed by a human, software agent, cognitive packet, or node on behalf of another subject
MUST reference a valid mandate. The verifier MUST reject an act outside the mandate's resource,
amount, purpose, recipient class, time, or delegation bounds.

No mandate may infer unbounded authority from silence.

### 5.7 Lifecycle and finality

Implementations MUST distinguish at least:

```text
proposed -> reserved -> committed -> settled
```

They MUST also support rejection, expiry, release, reversal, and dispute without mutating prior
events. A state transition MUST identify the state it expects; conflicting concurrent transitions
MUST fail deterministically.

### 5.8 Evidence and reconciliation

External observations—bank transactions, meters, sensors, invoices, delivery receipts—MUST retain
their source identity and observation time. Matching an external observation to an internal
transaction MUST produce a reconciliation Event; it MUST NOT erase either trace.

Reconciliation confidence and human validation status MUST remain inspectable.

### 5.9 Rights are not one field

Legal ownership, beneficial interest, custody, operational control, authority to spend, and
liability MUST be representable separately. In particular, resources held by a treasurer for a
community MUST remain distinguishable from the treasurer's private resources.

### 5.10 Public proof and private content

Each event MUST declare a disclosure class and support purpose-limited projections. Auditability
does not imply publishing every underlying fact.

For example, a public Kudos trace MAY establish that an identified giver voluntarily rewarded an
identified provider in relation to a genuine exchange, while the purchased goods, bank details,
private price, and unrelated transactions remain private.

Public, restricted, confidential, and regulator/auditor projections MUST derive from the same
authoritative trace, with redaction decisions themselves governed and auditable.

### 5.11 Idempotency and replay

Every command and transaction MUST carry a stable idempotency key. Receiving the same request more
than once MUST have the same accounting effect as receiving it once.

Given the same ordered Events, Artifacts, schemas, and deterministic projectors, balances, budget
availability, statements, and accounting-derived routing inputs MUST replay identically.

### 5.12 Reputation and routing are derived signals

Reputation, market signals, and information-gravity weights are contextual `View`s. They are not
assets, balances, or authoritative facts about a subject.

The COP routing layer:

- MUST derive such signals only from eligible, traceable events;
- MUST state the context, time window, algorithm version, and evidence set used;
- MUST distinguish proposed, committed, settled, reversed, and disputed acts;
- MUST NOT count a reversed, invalid, duplicated, self-dealing, or unauthorized act as ordinary
  positive evidence;
- MUST NOT collapse contextual reputation into an unexplained global moral score;
- SHOULD limit feedback loops in which past attraction mechanically creates permanent dominance;
- MUST preserve alternative routing factors and the ability to audit or contest the result.

The accounting trace therefore supplies evidence to routing. It never delegates the routing
decision to a balance alone.

## 6. Minimal event families

An implementation MAY choose different names, but MUST preserve equivalent semantics.

| Event family | Purpose |
|---|---|
| `accounting.budget.granted` | Establish a bounded resource authorization. |
| `accounting.budget.amended` | Add, reduce, extend, revoke, or replace authority explicitly. |
| `accounting.resource.reserved` | Exclude capacity before concurrent/asynchronous execution. |
| `accounting.resource.released` | Release an unused or rejected reservation. |
| `accounting.transaction.committed` | Record accepted reciprocal obligations. |
| `accounting.transaction.settled` | Record balanced final postings. |
| `accounting.transaction.reversed` | Neutralize a prior transaction without deleting it. |
| `accounting.observation.recorded` | Preserve an external resource observation. |
| `accounting.reconciliation.asserted` | Link internal and external traces. |
| `accounting.dispute.opened` | Contest a posting, mandate, observation, or settlement. |
| `accounting.dispute.resolved` | Record the governed outcome and any compensating acts. |

## 7. Minimum settled-transaction payload

The following is illustrative; a versioned JSON Schema is required before implementation.

```json
{
  "transactionId": "txn_...",
  "idempotencyKey": "packet:pk_123:node:n_456:service:s_789",
  "principalId": "person:alice",
  "actorId": "packet:pk_123",
  "mandateId": "mandate:m_123",
  "budgetId": "budget:b_123",
  "purpose": "relay cognitive packet pk_123",
  "effectiveAt": "2026-07-20T12:00:00Z",
  "disclosureClass": "restricted",
  "postings": [
    {
      "postingId": "post_1",
      "accountId": "packet:pk_123:kudos-available",
      "subjectId": "packet:pk_123",
      "resourceType": "kudos",
      "unit": "KUDOS",
      "quantity": { "coefficient": "-250", "scale": 2 }
    },
    {
      "postingId": "post_2",
      "accountId": "node:n_456:kudos-received",
      "subjectId": "node:n_456",
      "resourceType": "kudos",
      "unit": "KUDOS",
      "quantity": { "coefficient": "250", "scale": 2 }
    }
  ],
  "evidenceArtifactIds": ["artifact:service-proof-s_789"]
}
```

This example specifies accounting mechanics only. It does not presume that Kudos are convertible,
fixed to the euro, legally regulated as a payment instrument, or implemented in any particular
community regime.

## 8. Kudos activation modes

The ledger MUST make the active community regime explicit. At minimum, it MUST distinguish:

1. `recognition_only` — public, nominative, voluntary recognition; no euro redemption and no fixed
   euro parity;
2. `reserved_nonconvertible` — a governed reserve exists, but holders have no automatic redemption
   claim;
3. `regulated_convertible` — conversion or redemption is enabled under an identified lawful
   operator, agreement, and compliance regime.

Changing mode MUST be a governed, prospective, versioned event. It MUST NOT retroactively change
the rights attached to prior Kudos.

Community-specific demurrage, common-pool distribution, weekly redistribution, eligibility, and
cross-community compensation MUST be explicit policies referenced by the relevant transactions.
They are not universal COP invariants.

If a regime asserts a backing rule such as “one Kudos created implies one euro reserved,” the
projector MUST expose reserve coverage separately from Kudos circulation, and conformance tests MUST
prove that unauthorized issuance cannot create apparent coverage.

## 9. Day-one Fractanet requirements

Before a cognitive packet can consume a consequential resource or influence accounting-derived
routing, the reference implementation MUST provide:

1. versioned schemas for budgets, mandates, reservations, postings, settlements, and reversals;
2. exact arithmetic and balance validation;
3. idempotent append and deterministic accounting projectors;
4. atomic reservation or an equivalent concurrency-safe mechanism;
5. mandate, expiry, and limit validation before commitment;
6. public and restricted projections with explicit redaction policy;
7. reconciliation hooks for external providers without treating external data as infallible;
8. conformance vectors covering success, rejection, retries, disputes, and replay;
9. routing inputs that cite the accounting events and algorithm version from which they derive.

A prototype that routes packets without these controls MAY be an isolated simulation, but MUST NOT
be described as a production-conformant Fractanet.

## 10. Minimum conformance tests

A conforming implementation MUST demonstrate that:

- a balanced transaction is accepted and replayed identically;
- an unbalanced transaction is rejected atomically;
- different units cannot balance without an explicit conversion;
- duplicate delivery changes no balance;
- concurrent reservations cannot overspend one budget;
- an expired, revoked, or out-of-scope mandate is rejected;
- reversal preserves the original trace and neutralizes its accounting effect;
- creation and destruction require authorized source or sink accounts;
- private purchase content does not appear in the public Kudos projection;
- a disputed or reversed reward is treated according to an explicit routing policy;
- external reconciliation preserves both the external observation and internal transaction;
- full replay reconstructs the same balances, reservations, and routing evidence references.

Regime-specific tests MUST be added for reserve coverage, demurrage, redistribution, exchange, or
convertibility whenever those features are activated.

## 11. Matters requiring human decision

Before stabilization, the corpus maintainers must validate:

- the canonical account-address format and accounting-domain boundary;
- the minimum lifecycle and finality rules for each resource class;
- the privacy/disclosure taxonomy and who may authorize redaction;
- the distinction between community, confederation, and external settlement domains;
- the anti-manipulation rules applied to Kudos-derived reputation;
- the routing policy's safeguards against concentration and self-reinforcing attraction;
- the legal and operational activation criteria for each Kudos mode;
- whether this profile becomes a COP-wide normative profile or remains mandatory only within the
  Fractanet implementation profile.

