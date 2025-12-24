# Package npm Ophélia – Documentation rapide

## Objectif

Permettre l’intégration d’Ophélia dans toute application Node.js/JavaScript via un package npm
simple, typé, et documenté.

## Structure prévue

- Dossier : `packages/ophelia/`
- Exporte :
  - `ask(question, options)` : réponse unique
  - `stream(question, cb, options)` : réponse en streaming
  - `getSources()` : sources documentaires
- Typage TypeScript
- Documentation intégrée (JSDoc)

## Exemple d’utilisation

```js
import { ask } from "ophelia";

const answer = await ask("Quelle est la capitale de la Corse ?");
console.log(answer);
```

## API

### `ask(question, options)`

- `question` (string, requis)
- `options` (object, optionnel) :
  - `history` (array)
  - `provider`, `model`, `modelMode`
  - `apiKey` (string, recommandé)
- Retourne : `{ answer, metadata, sources }`

### `stream(question, cb, options)`

- `cb` : callback appelée à chaque chunk de texte
- Retourne : rien (asynchrone)

### `getSources()`

- Retourne : tableau des sources documentaires

## Installation

```
npm install ophelia
```

## Configuration

- Par défaut, utilise l’API REST centrale (`/api/ophelia`)
- Clé API à fournir via `options.apiKey` ou variable d’environnement

## À venir

- Publication sur npm
- Exemples d’intégration (CLI, Next.js, Electron…)
- Tests unitaires et d’intégration
- Support ESM/CJS

---

Pour toute question, voir le plan dans `docs/plan-ophelia.md` ou contacter l’équipe.
