// packages/ophelia/README.md

# Ophélia npm package

Accès simple à l’API REST centrale d’Ophélia depuis Node.js/JavaScript.

## Installation

```
npm install ./packages/ophelia
```

## Utilisation

```js
const { ask } = require("ophelia");

(async () => {
  const res = await ask("Quelle est la capitale de la Corse ?");
  console.log(res.answer);
})();
```

## Options avancées

- `history` : tableau d’historique de conversation
- `provider`, `model`, `modelMode` : personnalisation du moteur
- `apiKey` : clé API personnalisée (sinon `dev-demo-key`)
- `apiUrl` : URL API personnalisée

## Environnement

- `OPHELIA_API_URL` : URL par défaut de l’API
- `OPHELIA_API_KEY` : clé API par défaut

## À venir

- Support streaming (`stream`)
- Typage TypeScript
- Publication npm

---

Voir aussi : `docs/NPM-OPHELIA.md` et `docs/API-OPHELIA.md`
