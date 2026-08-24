---
title: "Olé Olé — MVP specification"
description: "Implementation-ready specification for Olé Olé, C.O.R.S.I.C.A.'s territorial Presence/discovery service, including the FractaTerritorialContext boundary."
author: "Jean Hugues Noël Robert, baron Mariani"
affiliation: "Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica"
date: "2026-08-11"
last_modified_at: "2026-08-24"
license: "CC BY-SA 4.0"
language: "en"
status: "working-paper — implementation-ready working specification"
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/docs/oleole-mvp-spec.md"
document_role: "operational"
document_kind: "specification"
visibility: "public"
lifecycle_state: "working"
target_audience:
  - "coding agents"
  - "C.O.R.S.I.C.A. maintainers"
target_scene: "technical"
document_function: "specification"
tags:
  - "Olé Olé"
  - "Presence"
  - "Presencology"
  - "FractaTerritorialContext"
  - "Corsica Digital Twin"
  - "Autonomy of Capacity"
  - "Cogentia"
related_projects:
  - "Olé Olé"
  - "C.O.R.S.I.C.A."
  - "Cogentia"
  - "Corsica Digital Twin"
provenance:
  origin_type: "repository"
  origin_repository: "JeanHuguesRobert/inseme"
  origin_ref: "e873783ec6964d15318c855d3adf01387d29c9b5"
  origin_date: "2026-08-11"
  derived_from: []
review:
  status: "unreviewed"
  reviewed_by: []
update_policy: "UP-DEFAULT-REVIEWED"
---
# Olé Olé — MVP specification

Status: implementation-ready working specification  
Date: 2026-08-11  
Operator: Association C.O.R.S.I.C.A.  
Service agent: John / Agent JHN  
Target surface: `oleole.acorsica.org`

## 1. Purpose

Olé Olé is a free public-interest service operated by C.O.R.S.I.C.A. and exposed as a service of John / Agent JHN.

Its first purpose is to increase the effective capacity of people in Corsica to perceive what is happening around them, discover places and possibilities, communicate present or future presence with low friction, and decide for themselves what to do with that information.

Olé Olé is not a Tinder clone. Human encounters — social, friendly, affective or sexual — are an explicitly assumed use case, but the service is primarily a territorial Presence / discovery surface rather than a catalogue of profiles.

The MVP must demonstrate a useful loop:

```text
open Olé Olé
→ perceive contributed presences / places
→ ask John or explore the map
→ optionally contribute current/future presence
→ optionally automate contribution
→ perceive new territorial possibilities
→ human chooses what to do
```

## 2. Product invariants

1. **Autonomy of Capacity.** The system increases the user's capacity to perceive, understand, explore, choose and act; it does not optimize the user toward an operator-selected outcome.
2. **Non-directive assistance.** John may explain, compare, suggest and prepare actions. Human choice remains the default; delegated action requires an appropriate mandate/policy.
3. **Privacy without prevention; automation without capture.** Privacy controls must not make contribution so burdensome that the service becomes useless. Automatic presence contribution is a first-class capability.
4. **User is not the product.** No sale/rental of individual presence data, no behavioral advertising, no commercial profiling.
5. **No pay-to-rank.** Public-interest discovery/ranking must not be purchasable by the highest bidder.
6. **Progressive disclosure.** Presence contribution does not imply public individual visibility or availability for contact.
7. **Provenance.** A contributed or inferred assertion is not reality; its source/modality must remain identifiable.
8. **Open and anti-capture architecture.** Prefer open data, open-source components, interoperable formats and portable identities/data.

## 3. MVP scope — MUST

### 3.1 Map and time

- Mobile-first map of Corsica.
- Display contributed/declared presence aggregates.
- Explicitly label contributed presence; do not present it as a statistically representative population estimate.
- Basic temporal selector, at minimum: `now`, `tonight`, `tomorrow` or equivalent intervals.
- Display POIs / Places relevant to exploration.
- Map and conversation share spatial and temporal context.

### 3.2 Presence contribution

Support:

- current presence;
- future/intended presence;
- bounded validity interval;
- immediate pause/revocation;
- at least manual and automatic contribution modes.

Automatic mode is not continuous server-side GPS logging by definition. Preferred flow:

```text
OS/device location
→ local significant-change detection when feasible
→ local interpretation / precision reduction
→ semantic PresenceClaim
→ server
```

The implementation may use platform-specific background-location facilities where required. Exact technical strategy is a spike/implementation decision, not a reason to remove automatic mode from the MVP.

### 3.3 Presence precision

The data model must support multiple precision levels such as:

- municipality/place;
- approximate area/cell;
- POI;
- finer coordinates when explicitly required/selected.

Do not assume raw GPS coordinates are the canonical server-side representation.

### 3.4 Presence intent

Allow a user to attach a temporary, voluntary intent to a presence, with a deliberately small initial vocabulary. At minimum the model must be able to represent:

- discovery / looking for something to do;
- social / meeting people;
- `olé olé` / openness to a more personal encounter;
- no particular encounter intent.

The exact UX wording may be refined during implementation. Sexual/affective intent is not to be inferred silently from behavior.

MVP public output is aggregate intent, not an individually browsable dating catalogue.

### 3.5 John conversational surface

John / Agent JHN is the conversational agent of the service. Do not create a separate fictional Olé Olé agent unless later justified.

John should support natural-language questions such as:

- “Où ça bouge ce soir ?”
- “Je suis à Corte, où pourrais-je aller ?”
- “Je serai à Calvi demain, qu’est-ce qui semble intéressant ?”
- “Je cherche quelque chose de calme.”
- “J’aimerais rencontrer du monde ce soir.”

Minimum service tools/capabilities:

```text
search_places
get_presence
get_presence_map
declare_presence
declare_future_presence
set_presence_mode
get_my_presence_state
```

Names are illustrative; reuse existing Inseme/Cogentia tool conventions where appropriate.

John must use the same Presence/Place service layer as the graphical UI rather than inventing a parallel data path.

For writes, use explicit confirmation unless an active mandate/policy already authorizes the operation. John must know the active service context and must not silently mix Olé Olé service memory with JHN personal memory.

### 3.6 Identity/session

- Browsing the public map must not require an account.
- Keep first contribution as low-friction as reasonably possible.
- Use the existing Agent JHN Supabase environment initially when practical.
- Design identity tables/references so they can later migrate to a dedicated Supabase project / Cogentia identity infrastructure without changing public semantic identifiers.
- An authenticated account and a semantic `Subject` are distinct concepts.
- Do not require a complete general-purpose Cogentia IdP before shipping the MVP.

### 3.7 Places / POI

Initial open-data strategy:

- OpenStreetMap;
- Overture Maps Places;
- internal stable `Place` identifier;
- explicit source/provenance references.

The internal model must not use Overture GERS, OSM IDs or another provider ID as its sole canonical identifier.

Conceptual model:

```yaml
place:
  id: place:...
  geometry: ...
  names: ...
  classifications: ...
  status: ...
  sources:
    - provider: overture
      ref: ...
    - provider: osm
      ref: ...
```

Use PostGIS/Supabase for runtime data. GeoParquet/DuckDB are preferred candidates for lightweight ingestion/exploration. Foursquare OS Places and Wikidata are compatible future enrichments, not MVP blockers.

### 3.8 Visual language / CSS

Olé Olé should visibly belong to the same broad design family as FractaVolta.com:

- minimalist / functional Bauhaus influence;
- geometric grid/composition;
- Mondrian-like primary palette: red, yellow, blue, complemented by black/white/neutrals;
- strong flat areas and borders;
- little/no decorative shadowing or glassmorphism;
- functional animation only;
- mobile-first readability and accessibility.

Do not paste approximate colors if FractaVolta's actual design tokens/CSS can be reused or extracted. Use centralized design tokens.

Brand colors must not override cartographic semantics when another visualization is more legible/accessibile. Do not literally reproduce a Mondrian artwork.

Avoid premature extraction of a global design-system package; create one later if reuse across multiple surfaces justifies it.

## 4. SHOULD

- PWA installability and good mobile browser experience.
- Thin native wrapper / shared-code mobile build where required for reliable background location.
- Assisted mode between manual and automatic: detect a meaningful change and ask/propose before publishing a PresenceClaim.
- Chat ↔ map synchronization: John can focus/filter the map; map selections become conversational context.
- Natural-language parsing of future presence, with structured proposal before write.
- Coverage/confidence indicators for contributed presence.
- Local processing/precision reduction before network transmission where feasible.
- Data-export/deletion controls compatible with future Cogentia identity portability.

## 5. MAY / implementation spikes

- Capacitor or equivalent thin native packaging; choose after a focused background-location spike.
- Leaflet initially; keep Presence/Place models renderer-independent enough to permit MapLibre/deck.gl later.
- PMTiles for static/public layers.
- Nominatim or Pelias for geocoding/place search if required by MVP UX.
- Foursquare OS Places comparison/import.

## 6. Explicit non-goals for V0

The following are not required to ship the first useful version:

- Tinder-style swipe/profile catalogue;
- individual matching engine;
- direct messaging between strangers;
- public precise individual locations;
- detailed sexual preference profiles;
- long-term individual behavioral prediction;
- advertising or paid ranking;
- monetization/payment;
- statistically calibrated whole-population Presence estimates;
- sophisticated differential privacy, PSI/MPC or federated Presence infrastructure;
- full independent Cogentia IdP;
- large refactoring of Inseme/brique-map before the first vertical slice works.

The architecture should not unnecessarily prevent legitimate later extensions.

## 7. Minimal data model

Exact SQL belongs to implementation, but agents should converge on these semantic entities rather than invent incompatible models:

```text
subjects
account_subject_links
service_subjects
places
place_sources
presence_claims
presence_policies
presence_intents
```

### PresenceClaim — conceptual fields

```yaml
id: uuid
subject_ref: ephemeral-or-subject
place_ref: place:...
valid_from: timestamp
valid_until: timestamp
modality: declared | intended | automatic | inferred
precision: municipality | area | poi | precise
visibility: aggregate | bounded | private
source: ...
created_at: timestamp
revoked_at: timestamp|null
```

Do not freeze these enum values if existing Cogentia/Presence conventions provide better canonical terms.

### PresencePolicy — conceptual fields

```yaml
subject_ref: ...
mode: off | manual | assisted | auto
precision: ...
valid_until: ...
revocable: true
```

### PresenceIntent — conceptual fields

```yaml
claim_ref: ...
discovery: boolean
social: boolean
oleole: boolean
valid_until: ...
visibility: aggregate
```

## 8. Privacy and safety baseline

- No behavioral-advertising SDKs.
- No sale/rental of personal Presence data.
- Public map must not expose an individual’s exact location by default.
- Presence and encounter intent are separate dimensions.
- `oleole=true` does not mean consent to contact, meet or sexual activity.
- Automatic contribution must be easy to see, pause and revoke.
- Store only the precision needed for the explicitly selected capability where practical.
- Service-scoped data/memory must not silently become JHN personal-agent memory.
- Future individual encounter/contact features require a dedicated safety/threat-model pass before exposure.

## 9. Architecture direction

Prefer vertical slices and reuse of existing Inseme components.

```text
                         John / conversation
                                │
                                ▼
User ↔ Olé Olé UI/map ↔ Presence / Place service layer
                                │
                         Supabase/PostGIS
                                │
                   OSM / Overture ingestion
```

Likely repository direction (adapt to current Inseme conventions after inspection):

```text
apps/oleole/                  # or existing equivalent app/site structure
packages/brique-map/          # reuse, minimal extensions
packages/brique-ophelia/      # reuse conversational runtime
presence/place core           # reuse existing core if present; otherwise small shared module
```

Do not create parallel implementations when an existing Inseme core/brique already owns the capability.

### 9.1 FractaTerritorialContext

Olé Olé owns the territorial semantics of a **FractaTerritorialContext**: a bounded, versioned, multi-source projection of the territorially relevant present (and near future) used by maps, conversation, exploration and later by a Corsica Digital Twin.

It is structurally analogous to a Personal Twin's hot context, but it is **not personal-agent memory** and must not be implemented as a generic Cogentia-owned territorial database. Cogentia may provide reusable context/projection primitives; Olé Olé owns the Presence/Place/Presencology meaning, source policies and territorial governance.

Conceptually:

```text
Presence claims ─────┐
Places / POI ────────┤
Presence intents ────┤
Events ──────────────┤
Supply / demand ─────┼──► FractaTerritorialContext
Mobility / flows ────┤          │
Other territorial ───┘          ├──► map / visual surfaces
signals                         ├──► John / conversation
                                ├──► exploration / Revealer
                                └──► Corsica Digital Twin
```

Not every source above belongs in the MVP. Presence and Place are the first concrete sources; the others are anticipated extensions.

The context should be a **projection/view over source-owned facts and claims**, not a new god object that becomes the canonical owner of every territorial datum. Source assertions retain provenance, validity interval, precision/confidence and their own lifecycle. Context snapshots select and compose what is relevant for a given spatial, temporal and policy scope.

A useful conceptual snapshot may include:

```yaml
territorial_context:
  id: ...
  version: ...
  spatial_scope: ...
  temporal_scope: ...
  as_of: ...
  policy_scope: ...
  sources: ...
  provenance: ...
```

This is deliberately not a frozen storage schema. It describes the semantics of a projection.

The first useful implementation can remain implicit: the existing map/time filters plus Presence/Place service queries already form a primitive territorial context. Do not block the MVP on creating a generalized context engine.

The architectural invariant is:

```text
Cogentia
  owns reusable context / Twin / capability mechanisms

Olé Olé
  owns territorial Presence / Place / Presencology semantics
  and FractaTerritorialContext projections

Corsica Digital Twin
  consumes territorial projections; it does not redefine their source semantics
```

This boundary is important for anti-capture and reuse: a future territorial service may reuse Cogentia mechanisms without forcing personal and territorial contexts into one authority or memory domain.

## 10. Acceptance scenarios

The MVP is implementation-ready when the following scenarios can be automated or manually demonstrated:

1. A visitor opens `oleole.acorsica.org` without an account and sees the map, open Places and contributed Presence aggregates.
2. The visitor changes the temporal view and sees appropriate current/future contributed Presence data.
3. A user declares “I am in Corte until 20:00”; the claim appears in the aggregate view without publicly exposing that individual.
4. A user declares “I will be in Calvi tomorrow evening”; John and the map can use that future Presence context.
5. A user enables automatic contribution, sees clearly that it is active, and can pause/revoke it immediately.
6. When coarse precision is selected, the server does not require/store raw precise GPS merely for convenience.
7. A user asks John “où ça bouge ce soir ?”; John answers from the same Presence/Place data represented by the map.
8. John can turn a natural-language presence statement into a structured proposed write and execute it after required confirmation/policy check.
9. Selecting a place/time on the map affects subsequent conversational context; conversational filtering can affect the map, at least in a minimal implementation.
10. A user may declare an aggregate `olé olé` encounter intent without becoming an individually browsable profile.
11. Disabling/revoking a presence policy stops future automatic publication according to the documented semantics.
12. No behavioral advertising/tracking SDK is required for the service to function.
13. Place records preserve source provenance and can hold both OSM and Overture references.
14. The UI visibly follows the FractaVolta-derived Bauhaus/Mondrian design direction while remaining accessible and map-legible.

## 11. Success criteria

Do not optimize the MVP primarily for session duration or compulsive engagement.

Useful early signals include:

- successful low-friction Presence contribution;
- repeat consultation because the Presence field becomes useful;
- automatic mode increasing useful contributions without unacceptable battery/privacy friction;
- users reporting that Olé Olé revealed a useful possibility or influenced a deliberate choice;
- John reducing interaction friction compared with forms alone.

Candidate qualitative outcomes:

```text
I discovered a place.
I changed my plan.
I avoided a crowd.
I found something to do.
I met someone.
```

## 12. Implementation strategy

1. Inspect existing Inseme map, Ophélia/John, Supabase and GIS code before creating new abstractions.
2. Implement the thinnest end-to-end vertical slice: public map → Place → manual PresenceClaim → aggregate display.
3. Add John read access to that same service layer.
4. Add future Presence and John write proposal/confirmation.
5. Add automatic/background contribution through a focused platform spike and shared semantic API.
6. Add intent aggregates and `olé olé` flag without individual exposure.
7. Harden privacy controls, deletion/revocation, tests and visual identity.
8. Only then refactor shared packages where demonstrated reuse justifies it.
9. Treat the resulting map/time/Presence/Place query projection as the first implicit FractaTerritorialContext; generalize only when a second concrete consumer/source requires it.

## 13. Deferred but anticipated

- Presencology estimation beyond contributed claims;
- richer Presence forecasts;
- Personal Twin integration for users other than JHN;
- individual encounter discovery/mutual consent;
- messaging and associated Trust & Safety;
- open Presence APIs/MCP tools;
- federated Place/Presence services;
- richer territorial-potentiality layers combining Presence, intent, events, supply and demand;
- explicit/versioned FractaTerritorialContext snapshots when demonstrated consumers require them;
- contribution of validated local POI corrections back to open commons.

## 14. Canonical interpretation

Olé Olé is a small, concrete demonstrator of Cogentia and Autonomy of Capacity: a territorial service that makes possibilities more perceptible and easier to act upon while leaving human beings in control of their goals, disclosures and choices.

John is not a decorative chatbot attached to the product. The conversation is one surface of the same service capabilities exposed by the map and structured APIs.

The FractaTerritorialContext is the territorial projection layer of this same service: it makes a relevant slice of the territorial present available consistently to human and machine surfaces without confusing the projection with reality, the source data, or personal memory.
