/**
 * packages/brique-cyrnea/src/lib/gameManager.js
 * Gestion des jeux et défis au bar
 */

export const GAMES = {
  chess: { id: "chess", label: "Échecs", reward: "Café offert" },
  cards: { id: "cards", label: "Cartes", reward: "Demi offert au gagnant" },
  crosswords: { id: "crosswords", label: "Mots Croisés", reward: "Succès Badge" },
};

export function startChallenge(gameId, tableId) {
  console.log(`Challenge ${gameId} lancé à la table ${tableId}`);
  return { success: true, challengeId: Math.random() };
}
