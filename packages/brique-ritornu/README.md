# @inseme/brique-ritornu

Ritornu est la brique de **retrofit patrimonial sélectif** : elle aide une personne à reprendre une publication personnelle ancienne depuis une URL ou une exportation officielle, à en préserver la preuve privée, puis à préparer une transcription et une remise au corpus soumise à revue.

Statut : `skeleton`. Le package ne réalise encore aucune acquisition.

## Frontière

```text
source personnelle
  -> capture privée
  -> candidat normalisé
  -> décision humaine de routage
  -> remise au corpus ou rejet
```

La capture brute et ses métadonnées de preuve restent hors Git et privées par défaut. Le corpus ne reçoit qu'un candidat explicitement revu ; une publication n'est jamais créée ou modifiée par la brique elle-même.

## Invariants

- mandat humain explicite, publication par publication ;
- pas de collecte récursive, de graphe social, de commentaires ou de réactions ;
- pas de contournement de CAPTCHA, paywall, authentification, limitation de débit ou protection technique ;
- aucun cookie, identifiant ou secret lu ou stocké par la brique ;
- aucune écriture Git ou GitHub directe ;
- conservation du lien entre source, capture, normalisation et décision de revue ;
- tout échec doit rester visible et conduire vers une voie légitime : export officiel, copie fournie ou navigation assistée par l'utilisateur.

## États de travail

`capture` → `candidate` → `review-request` → `handoff` → `watch-change`

Ces états décrivent des paquets de travail ; ils ne définissent pas encore une révision du protocole COP. Toute intégration COP durable devra préserver les invariants d'immuabilité, d'idempotence, de traçabilité et de replay déterministe.

## Périmètre des prochaines étapes

1. M0 : formats locaux versionnés de capture, manifeste et diff de normalisation, accompagnés de fixtures et tests ;
2. M1 : adaptateur Substack, à partir d'une URL publique, sans API cachée ni contournement ;
3. M2 : adaptateur Facebook pour un permalink choisi, avec voie d'export officielle et navigation locale assistée ;
4. M3 : paquet de remise et revue explicite avant toute opération sur le corpus.

Aucun de ces jalons n'est autorisé par ce squelette seul. Voir [issue #26](https://github.com/JeanHuguesRobert/inseme/issues/26).
