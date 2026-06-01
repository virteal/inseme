# COP Continuation Bac-à-Sable

**CLI unique, automatisable et testable** dont le but est de **faire converger** le Cognitive
Orchestration Protocol (COP) avec le travail conceptuel et pratique fait dans Cogentia.

**Principe directeur** :

- On injecte **le plus tôt possible du vrai code** venant de `packages/cop-kernel`.
- Il ne s'agit **pas** de créer une simulation jetable.
- L'objectif est d'obtenir au minimum la somme sémantique de COP + Cogentia, idéalement plus.
- Chaque expérimentation doit servir à durcir l'implémentation réelle.

Inspiré du style de pipeline Cogentia (étapes claires, artefacts structurés, traçabilité forte), ce
bac à sable est un outil de **convergence et de facilitation d'implémentation**, pas un prototype
isolé.

## Objectif principal

Faire en sorte que les continuations COP, les patterns de reprise, la causalité et la traçabilité
deviennent utilisables concrètement, en les confrontant très tôt aux besoins et aux concepts
développés dans Cogentia.

## Objectif (Phase B)

Valider et explorer :

- Création de continuations
- Suspension d'un flux cognitif
- Reprise ultérieure (manuelle ou conditionnelle)
- Chaîne de causalité et traçabilité

## Utilisation

```bash
# Lister les scénarios
node index.js list

# Exécuter un scénario
node index.js run research-review

# Rejouer une trace (quand l'écriture de fichier sera implémentée)
node index.js replay trace-xxx.jsonl
```

## Structure

- `index.js` — CLI unique (style Cogentia)
- `src/pipeline.js` — Moteur d'exécution des scénarios (utilise le vrai cop-kernel quand possible, y
  compris COPJobScheduler + Fractanet bus primitives)
- `src/cop-simulator.js` — Helpers légers
- `src/cop-kernel-adapter.js` — Pont vers le vrai code de `packages/cop-kernel` (bus + sub-buses +
  federation, COPScheduler, COPJobScheduler, continuations)
- `scenarios/` — Scénarios de test (inclut `federation-demo` pour tester les bus fédérés + sub-buses
  par topic)

### Scénarios Cogentia-style actuels (en cours d'enrichissement)

- `examen-projet-loi-constitutionnelle-workflow` — Examen parlementaire d'un projet ou proposition
  de loi constitutionnelle : de l'initiative jusqu'à l'adoption définitive (via Congrès ou
  référendum), en passant par les travaux en commission, la navette, la gestion des amendements et
  la mémoire constituante sur le très long terme.
- `notaire-finalisation-vente-immobiliere-workflow` — Finalisation d'une vente immobilière par un
  Notaire : du compromis de vente à la signature de l'acte authentique, la publicité foncière, la
  transmission des clés/documents et l'archivage long terme (le notaire comme gardien de la mémoire
  juridique de la transaction).
- `agence-immobiliere-changement-locataire-workflow` — Gestion par une agence immobilière du départ
  d'un locataire et de son remplacement : préavis, état des lieux, recherche, sélection, nouveaux
  baux, travaux, dépôt de garantie, et mémoire long terme pour litiges futurs.
- `commissaire-aux-comptes-certification-bilan-workflow` — Mission de certification des comptes
  annuels par un Commissaire aux Comptes : acceptation du mandat, planification, travaux d'audit
  (intermédiaires et finaux), gestion des points en suspens (confirmations, réponses de la
  direction), émission du rapport de certification, et archivage du dossier pour la période de
  responsabilité (anti-Ubik sur l'information financière).
- `mairie-appel-offre-suivi-equipement-public-workflow` — Suivi complet d'un appel d'offre lancé par
  une mairie pour un équipement public décidé en conseil municipal : de la décision politique
  jusqu'à la réception, les garanties et la mémoire administrative sur le long terme.
- `assemblee-greffier-workflow` — Rôle du Greffier lors d'une Assemblée : capture des événements en
  temps réel, gestion explicite des points en suspens (continuations), production d'artefacts
  (procès-verbal, relevés de décisions), et stabilisation de la mémoire collective sur le long terme
  contre l'oubli et la manipulation.
- `technical-infrastructure-stabilization-workflow` — Conception, construction et surtout
  stabilisation à très long terme d'une infrastructure technique territoriale (ex: abreuvoir pour
  Rossignol / République des Anes). Focus explicite sur les "Stabilisateurs" face à l'effet Ubik
  (dégradation entropique et capture).
- `territorial-cognitive-project-workflow` — Développement d'un projet territorial long terme mêlant
  recherche conceptuelle, action locale, rencontres humaines et gouvernance. Forte place au hasard
  territorial et à la mémoire sur plusieurs années.
- `solo-creative-researcher-workflow` — Processus créatif long d'un chercheur indépendant/solo.
  Ouverture d'espaces de possibilité, bifurcations, longues maturations, production d'artefacts,
  suivi sur très long terme. (Particulièrement pertinent pour un chercheur seul.)
- `cogentia-resumable-workflow` — Workflow introspectif long (type KYS / clarification personnelle)
  avec multiples suspensions, maturation, couches émotionnelles et mode maintenance.
- `personal-decision-workflow` — Workflow de prise de décision avec délégation à différentes "parts
  de soi", recherche et checkpoints.
- `research-review` — Scénario plus simple de recherche + revue (point de départ).
- `federation-demo` — Petit test de fédération Fractanet : deux bus connectés, sub-buses par topic,
  subscriptions scopées, et traversée d’événements/continuations entre nœuds.

**Nouveautés bac-à-sable (Fractanet)**

- Les scénarios peuvent déclarer `defaultTopicId` → `ctx.busForCurrentTopic()` et les helpers
  deviennent automatiques.
- Nouveaux helpers : `createFederatedTopicBusPair()`, `createFederatedBusPair()`,
  `propagateInterest()`.

**Focus stratégique actuel : Construction du gabarit de la "Machine à explorer"**

Ce bac-à-sable s'inscrit désormais dans une architecture à plusieurs niveaux précisée par Jean
Hugues Robert :

1. **Cognition** (humaine, mécanique, hybride) — cadre le plus général.
2. **Méthodologie** d'exploration rationnelle des possibles.
3. **Deux déclinaisons opérationnelles** :
   - **Cogentia Commons** (version manuelle/légère : conversations IA, Markdown, GitHub).
   - **Fractanet / FractaVolta** (version automatisée/lourde, centrée sur le protocole COP).

L'objectif est de faire émerger un **écosystème de Machines à explorer coopératives** capables de
neutraliser les "Machines à empêcher".

**Artefact central en cours de construction :**

- `machine-a-explorer-gabarit-abstrait` — Gabarit abstrait de la Machine à explorer (niveau
  méthodologique). Il doit permettre de dériver des instances dans les différents niveaux ci-dessus.

**Première grande spécialisation en cours de creusement en profondeur :**

- `autorite-regulation-suivi-conformite-workflow` — Spécialisation sur la fonction de régulation
  indépendante comme Machine à explorer.

On a d'abord accumulé des exemples variés "en largeur". Nous sommes maintenant passés en mode
"creuser en profondeur" sur la piste la plus prometteuse : la fonction de régulation indépendante
comme "Machine à explorer" (opposée à une "Machine à empêcher"). Voir le scénario
`autorite-regulation-suivi-conformite-workflow`.

## Principes

- **Aucune interface web** (uniquement CLI)
- Tout doit être **automatisable** et **testable**
- Chaque exécution produit une trace d'événements riche
- On privilégie la clarté et la reproductibilité

---

Ce bac à sable est l'outil principal pour avancer sur la priorité **B** (Continuations + Resumption)
définie dans `research/COP_STATE_OF_PLAY.md`.
