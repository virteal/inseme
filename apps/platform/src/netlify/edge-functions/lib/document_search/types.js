/**
 * @typedef {Object} DocSnippet
 * @property {string} docId - Identifiant interne du document (File Search ou autre)
 * @property {string} title - Titre lisible par un humain
 * @property {string} url - Lien public vers le fichier (Supabase Storage)
 * @property {string} [sourceType] - Type de document (convocation, pv, deliberation, rapport, autre)
 * @property {string} [date] - Date du document (YYYY-MM-DD)
 * @property {string} excerpt - Extrait de texte pertinent
 */

/**
 * @typedef {Object} DocContext
 * @property {boolean} relevant - Indique si des extraits utiles ont été trouvés
 * @property {string} query - La question telle qu'elle a été utilisée pour la recherche (normalisée/reformulée)
 * @property {DocSnippet[]} snippets - Liste des extraits pertinents (0 à 5)
 */

/**
 * @typedef {Object} SearchFilters
 * @property {string} [year] - Année filtrée
 * @property {string} [month] - Mois filtré
 * @property {string} [type] - Type de document filtré
 */

/**
 * @typedef {Object} ReformulatedQuery
 * @property {string} rewrittenQuery - La question reformulée pour être autonome
 * @property {SearchFilters} filters - Les filtres extraits de la question
 */

export {};
