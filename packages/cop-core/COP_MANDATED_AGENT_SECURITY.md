---
title: "COP/Mandated Agent Security — Authority, Revocation, and Capacity Portability"
author: "Jean Hugues Noël Robert"
date: "2026-08-24"
version: "0.1"
status: "working profile — doctrinal alignment"
license: "CC BY-SA 4.0"
document_role: "source"
document_kind: "protocol-profile"
visibility: "public"
related:
  - "COP_IDENTITY.md"
  - "COP_ACCOUNTING.md"
  - "Invariants.md"
  - "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/souverainete_delegation_agents_mandates.md"
  - "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/security_model_representative_democracy.md"
---

# COP/Mandated Agent Security

## 1. Purpose

This profile translates the Corpus doctrine of sovereignty, bounded delegation and the **Mandated Agent** into COP conformance rules.

The governing distinction is:

```text
operational autonomy != autonomous authority
```

An agent MAY choose how to execute within an authorised space. It MUST NOT enlarge that authorised space by its own decision.

## 2. Mandated Agent

A **Mandated Agent** is an identifiable actor exercising capabilities for a principal under a versioned, bounded, auditable and revocable mandate.

The actor MAY be human, software, institutional or hybrid. The security properties do not depend on the actor being artificial.

A mandate authorises exercise. It does not transfer ownership of the source of authority.

## 3. Mandatory authority chain

Every consequential delegated act MUST make the following chain reconstructible:

```text
principal
-> authority source
-> mandate
-> actor / agent instance
-> capability invocation
-> consequential act
-> evidence
-> effect
-> accounting / receipt
```

Missing links MUST fail closed when the profile or local constitution classifies the act as engaging or consequential.

## 4. Non-self-elevation

A Mandated Agent MUST NOT, by its own authority:

- add a new permitted capability to its mandate;
- remove a prohibition;
- extend its validity period;
- increase an enforceable budget or resource ceiling;
- widen recipient, data, endpoint, territorial or institutional scope;
- lower a required human or institutional approval gate;
- redefine the principal whose authority it exercises;
- turn a suggestion or recommendation into an authorisation;
- delegate more authority than it possesses.

A proposed elevation MAY be emitted as an Event or Artifact. Its activation MUST require an authority path distinct from the requesting agent.

## 5. Mandate version pinning

Every consequential invocation MUST reference the exact mandate version evaluated before execution.

If the mandate has changed, expired, been suspended or revoked between planning and commitment, the invocation MUST be re-evaluated before the external effect.

Silence, cached permission, prior success or model confidence MUST NOT substitute for an active mandate.

## 6. Revocation and recovery

Revocation MUST distinguish at least:

```text
suspend_future_authority
revoke_future_authority
cancel_pending_effect
compensate_reversible_effect
rectify_record
record_irreversible_effect
```

Stopping future authority does not erase past effects. COP MUST preserve the original trace and express correction or compensation through new Events.

## 7. Right of recovery

Where the governing constitution permits it, the principal MUST retain an effective recovery path over delegated capability. Recovery MAY require stronger gates for collective, constitutional or third-party-sensitive acts.

A system MUST NOT claim principal control merely because it offers a dashboard. The recovery path must be operationally effective and testable.

## 8. Capacity portability

Data export alone is insufficient for capacity portability.

A portable governed capability SHOULD export, in open and documented representations where legally and technically possible:

- subject and actor references without collapsing them;
- mandate definitions and versions;
- policy and constitution references;
- relevant Events and Artifacts;
- provenance and evidence links;
- accounting receipts and unsettled commitments;
- capability descriptors;
- revocation state;
- schema versions;
- continuation state needed for safe resumption.

Secrets and provider credentials MUST NOT be exported merely for completeness. They SHOULD be replaced by explicit unresolved capability requirements or re-binding instructions.

A receiving implementation MUST re-authorise local credentials and MUST NOT infer authority from imported data alone.

## 9. Implementation plurality

COP compliance is a policy property, not a vendor identity.

Different runtimes, models, providers, stores and interfaces MAY implement the same governed capability. Conformance depends on preservation of authority boundaries, trace, replay semantics, accounting and recovery — not on using a canonical runtime.

This gives the architectural rule:

> **common governance policy, plural implementations, verifiable conformance.**

## 10. Minimum conformance tests

A conforming implementation MUST test at least:

1. **No mandate** — consequential delegated act is rejected.
2. **Expired mandate** — act is rejected.
3. **Revoked mandate** — act is rejected even if previously planned.
4. **Scope escalation** — self-requested widening does not activate itself.
5. **Budget escalation** — agent cannot raise its own ceiling.
6. **Child delegation** — child authority cannot exceed parent authority.
7. **Recommendation boundary** — recommendation does not become authorisation.
8. **Version race** — changed mandate forces re-evaluation before effect.
9. **Recovery** — authorised principal can suspend future authority.
10. **Irreversibility** — revocation does not falsify or erase prior effects.
11. **Portability** — a governed capability can be exported and inspected without provider-specific hidden state being mistaken for authority.
12. **Rebinding** — imported capability requires local credential and authority binding before consequential execution.

## 11. Relationship to existing COP profiles

`COP_IDENTITY.md` defines the separation between subject, actor, principal, role, capacity and mandate. This profile strengthens the security semantics of that separation.

`COP_ACCOUNTING.md` already requires bounded delegation, principal/actor attribution and resource budgets. This profile adds explicit non-self-elevation, recovery and capacity portability.

`Invariants.md` remains the core protocol invariant set. The present profile is normative for implementations declaring `cop/mandated-agent-security` conformance and is a candidate for future promotion of selected rules into COP Core after implementation experience.

## 12. Open questions

The following remain deliberately unresolved:

- how collective principals authorise mandate elevation;
- threshold and quorum semantics for emergency revocation;
- treatment of constitutionally irreversible acts;
- cryptographic proof formats for portable mandate bundles;
- cross-instance equivalence of capability descriptors;
- how much policy state belongs in portable receipts versus referenced Corpus documents.

These questions MUST be resolved by explicit profiles or constitutions, not by hidden runtime defaults.
