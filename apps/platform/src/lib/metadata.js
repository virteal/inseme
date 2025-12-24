/**
 * Helpers génériques pour manipulation des metadata JSONB
 * Utilisable sur toutes les tables avec colonne metadata
 */

export const SCHEMA_VERSION = 1;

/**
 * Initialise un objet metadata avec schemaVersion
 * @param {Object} data - Données metadata additionnelles
 * @returns {Object} Objet metadata initialisé
 */
export function initMetadata(data = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    ...data,
  };
}

/**
 * Récupère une valeur dans metadata
 * @param {Object} entity - Entité avec metadata
 * @param {string} field - Nom du champ
 * @param {*} defaultValue - Valeur par défaut si absent
 * @returns {*} Valeur du champ ou defaultValue
 */
export function getMetadata(entity, field, defaultValue = null) {
  return entity?.metadata?.[field] ?? defaultValue;
}

/**
 * Met à jour metadata sur une entité
 * @param {Object} entity - Entité à modifier
 * @param {Object} updates - Mises à jour metadata
 * @returns {Object} Entité avec metadata mis à jour
 */
export function setMetadata(entity, updates) {
  return {
    ...entity,
    metadata: {
      ...entity.metadata,
      ...updates,
    },
  };
}

/**
 * Vérifie si une entité est marquée comme supprimée
 * @param {Object} entity - Entité à vérifier
 * @returns {boolean} true si supprimée (soft delete)
 */
export function isDeleted(entity) {
  return getMetadata(entity, "isDeleted", false) === true;
}

/**
 * Marque une entité comme supprimée (soft delete)
 * @param {Object} entity - Entité à supprimer
 * @param {string} userId - ID de l'utilisateur qui supprime
 * @param {string} reason - Raison de la suppression (optionnel)
 * @returns {Object} Entité avec metadata updated
 */
export function softDelete(entity, userId, reason = null) {
  const updates = {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: userId,
  };

  if (reason) {
    updates.deletionReason = reason;
  }

  return setMetadata(entity, updates);
}

/**
 * Restaure une entité supprimée
 * @param {Object} entity - Entité à restaurer
 * @returns {Object} Entité avec metadata updated
 */
export function restore(entity) {
  return setMetadata(entity, {
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
  });
}

/**
 * Valide qu'un metadata a la structure minimale requise
 * @param {Object} metadata - Metadata à valider
 * @returns {boolean} true si valide
 */
export function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  // schemaVersion est requis
  if (!metadata.schemaVersion || typeof metadata.schemaVersion !== "number") {
    return false;
  }

  return true;
}

/**
 * Migre metadata d'une version à une autre
 * @param {Object} entity - Entité avec metadata à migrer
 * @param {number} targetVersion - Version cible
 * @returns {Object} Entité avec metadata migré
 */
export function migrateMetadata(entity, targetVersion = SCHEMA_VERSION) {
  const currentVersion = getMetadata(entity, "schemaVersion", 0);

  if (currentVersion >= targetVersion) {
    return entity; // Déjà à jour
  }

  // Migrations incrémentales
  let migrated = { ...entity };

  // Migration v0 -> v1 (ajouter schemaVersion si manquant)
  if (currentVersion < 1) {
    migrated = setMetadata(migrated, { schemaVersion: 1 });
  }

  // Futures migrations ici
  // if (currentVersion < 2) { ... }

  return migrated;
}
