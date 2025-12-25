// packages/ophelia/test.js
// Test rapide du package Ophélia (API REST)

import { ask } from "./index.js";

(async () => {
  try {
    const res = await ask("Quelle est la capitale de la Corse ?");
    console.log("Réponse:", res.answer);
    console.log("Metadata:", res.metadata);
  } catch (e) {
    console.error("Erreur:", e.message);
  }
})();
