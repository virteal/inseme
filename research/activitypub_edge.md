---
title: "ActivityPub Edge — frontière fédérée d’Inseme / Fractanet"
subtitle: "Publication dérivée, interactions externes et exécution multi-tenant avec Fedify"
author: "Jean Hugues Noël Robert"
affiliation: "Institut Mariani / C.O.R.S.I.C.A."
license: "CC BY-SA 4.0"
status: "working-paper — source document"
date: "2026-07-31"
language: "fr"
repository: "JeanHuguesRobert/inseme"
canonical_path: "research/activitypub_edge.md"
canonical_url: "https://github.com/JeanHuguesRobert/inseme/blob/main/research/activitypub_edge.md"
corpus_role: "source"
document_role: "source"
document_kind: "architecture-decision"
visibility: "public"
lifecycle_state: "working"
classification_source: "cogentia.js"
classification_version: "1"
classification_rule: "architecture-decision"
classification_confidence: "medium"
---

# ActivityPub Edge — frontière fédérée d’Inseme / Fractanet

## 1. Décision

Inseme adopte **ActivityPub** comme frontière de fédération avec le Fediverse, non comme source
canonique de la mémoire, des mandats, des décisions ou des droits.

L’implémentation de référence envisagée est **[Fedify](https://fedify.dev/)** — et non « Fedly » —
un framework TypeScript sous licence MIT. Le futur composant est nommé, à ce stade :

```text
inseme/packages/brique-activitypub-edge/
```

Il sera une brique optionnelle, multi-tenant dès sa conception. L’absence actuelle de ce package
est explicite : cette note en fixe la cible architecturale, elle ne prétend pas annoncer une
implémentation achevée.

## 2. Rôle et frontière

ActivityPub est la couche d’échange avec des serveurs externes, analogue à un protocole de courrier
ou de routage : utile pour publier, recevoir, suivre et dialoguer, mais insuffisant pour porter à
lui seul une institution ou une mémoire fiable.

| Couche | Autorité / rôle |
| --- | --- |
| GitHub et corpus versionné | sources, historique et provenance publiable |
| Ubikia | publication dérivée, lisible et vérifiable |
| Cogentia / COP | paquets, traces, continuations, mandats, actes et règles de traitement |
| Inseme | instances, briques, interaction collective et application des politiques |
| ActivityPub Edge | projection publique fédérée et ingestion d’interactions externes |
| PrivAI | garanties proportionnées : preuve, limite, recours, expiration et responsabilité |

Une activité fédérée doit donc pointer vers sa source ou son produit dérivé vérifiable. Elle ne
devient pas, par sa seule diffusion, la vérité de référence du corpus.

## 3. Invariants

1. **Projection, jamais substitution.** Une publication ActivityPub est une projection publique,
   dérivée et révoquable ; la source et son historique restent identifiables.
2. **Séparation des identités.** `tenant`, `subject`, `actor`, `persona`, `agent`, `mandate` et
   `act` sont des objets distincts. Une adresse fédérée n’est pas une preuve de personne vivante,
   de droit de vote ni de mandat.
3. **Agent explicite.** Un acteur automatisé est déclaré comme tel, rattaché à un sujet ou mandat
   lorsque cela est pertinent, et ne se confond pas avec une personne humaine.
4. **Données minimales.** Seuls les éléments explicitement publics et nécessaires à la projection
   sortent vers la fédération ; aucune donnée privée du corpus ne devient visible par défaut.
5. **Entrant non fiable par défaut.** Une activité reçue est un paquet externe : authentification,
   quotas, politique de contenu, traçabilité et contrôle humain s’appliquent avant tout effet
   institutionnel ou toute réponse engageante.
6. **Multi-tenant réel.** L’isolation, les clés, les quotas, les journaux et les politiques sont
   portés par tenant dès le schéma initial ; le premier tenant n’est pas une exception architecturale.
7. **Réversibilité.** L’edge peut être désactivé ou remplacé sans perdre les sources, les mandats,
   les actes ni la mémoire COP.

## 4. Chemins de traitement

```text
Source GitHub → publication dérivée Ubikia → paquet / trace Cogentia
→ projection ActivityPub par tenant → Fediverse

Fediverse → activité externe non fiable → vérification et politique
→ paquet d’interaction COP → effet autorisé, file d’attente ou contrôle humain
```

Les effets à enjeu élevé — publication au nom d’une organisation, modération sensible, décision,
engagement financier, conséquence civique — ne sont pas déduits d’un simple message fédéré. Ils
exigent le niveau de mandat, de preuve et de contrôle correspondant à leur **STAKE**, avec un
**GAGE** vérifiable : promesse bornée, éléments de preuve, durée, révocation et recours.

## 5. Modèle minimal

| Objet | Sens |
| --- | --- |
| `tenant` | instance, collectif ou surface opérée ; frontière de politique et d’isolation |
| `subject` | personne vivante, collectif, institution, agent, nœud technique ou autre sujet COP |
| `actor` | adresse et clés ActivityPub exposées pour un contexte donné |
| `persona` | présentation publique d’un sujet, distincte de l’identité ou de la capacité civique |
| `agent` | acteur logiciel, avec nature automatisée visible et responsabilité rattachable |
| `mandate` | autorisation bornée d’agir, publier ou répondre au nom d’un sujet |
| `act` | acte COP traçable, dont une activité ActivityPub peut être la projection ou l’entrée |

Une même personne, organisation ou instance peut avoir plusieurs personas et acteurs ; aucun de ces
alias ne doit multiplier les droits politiques ou contourner les règles de représentation.

## 6. Profil d’implémentation Fedify

La brique visée utilise Fedify pour les primitives de fédération : WebFinger, signatures HTTP,
inbox/outbox, livraison asynchrone, découverte et activités ActivityPub. Elle s’intègre au contrat
des briques et à COP, sans faire de Fedify le modèle de domaine interne.

Socle technique envisagé :

- TypeScript et `@fedify/fedify` ; adaptateur d’hébergement choisi selon l’application Inseme ;
- PostgreSQL/Supabase pour les objets métier, avec portée `tenant_id` et politiques d’accès ;
- Redis pour cache, quotas, anti-duplication et files légères ;
- une file durable ou AMQP seulement lorsque le volume et les garanties de livraison le justifient ;
- OpenTelemetry et FractaLog/COP pour les traces d’exécution, sans journaliser indûment les contenus
  privés ;
- clés et secrets séparés par tenant, avec rotation et révocation.

La compatibilité API Mastodon peut devenir un adaptateur ultérieur ; elle n’est pas un prérequis et
ne doit pas imposer son modèle de produit au noyau.

## 7. Vigilances opérationnelles

- vérifier les signatures et l’attribution sans les surinterpréter comme une identité civique ;
- limiter les requêtes sortantes et les récupérations d’objets distants (notamment contre SSRF) ;
- appliquer quotas, idempotence, reprise et files d’échec ;
- séparer modération, droit de publication, mandat de réponse et éligibilité civique ;
- conserver une provenance compacte : source, produit dérivé, version, tenant, politique appliquée ;
- prévoir suspension, blocage, réexamen et expiration des autorisations ;
- réserver un humain dans la boucle lorsque l’acte devient engageant ou irréversible.

## 8. Première trajectoire

1. Créer la brique vide et son contrat de configuration multi-tenant.
2. Réaliser une projection sortante publique pour le tenant personnel JHN, avec lien vers la source
   versionnée et sans ingestion automatique.
3. Ajouter l’inbox, les signatures, les quotas et la traduction en paquets d’interaction COP.
4. Ajouter progressivement politiques de modération, mandats de réponse, observabilité et outils de
   recours.
5. N’ajouter les compatibilités produit et la montée en charge qu’après validation de ces invariants.

## 9. Documents liés

- [Instance map — locked names and regimes](instance_map.md) — instances fondatrices et régimes.
- [COP Identity / Kudocracy Profile](cop_identity_kudocracy_profile.md) — sujets, capacités,
  mandats et actes publics ; ActivityPub n’en est qu’une interface.
- [COP — Cognitive Orchestration Protocol](../packages/cop-core/Architecture.md) — primitives
  canoniques de trace et de continuité.
- [BRIQUE_SPEC](../packages/cop-host/BRIQUE_SPEC.md) — contrat d’intégration de la future brique.
- [FractaNet](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md) —
  substrat distribué plus large auquel l’edge apporte une surface fédérée.
- [STAKE / GAGE](https://github.com/acorsica/privai/blob/main/stake_gage.md) — proportion entre
  conséquence, garantie et recours.

---

_Décision initiale, à éprouver par un premier flux public réversible. Toute évolution qui modifie
les invariants ci-dessus doit être explicite, versionnée et reliée à une trace de décision._

