/**
 * User data transformation utilities
 *
 * These functions manage the transformation between database columns and metadata:
 * - On READ: Enrich metadata with SQL column values
 * - On WRITE: Strip SQL columns from metadata before saving
 */

/**
 * SQL column names that should be merged into metadata on read
 * and stripped from metadata on write
 *
 * Note: 'email' is NOT included as it's not a column in public.users
 * (it only exists in auth.users and should be synced to metadata)
 */
const USER_SQL_COLUMNS = ["display_name", "displayName"];

/**
 * Enriches a user object by merging SQL columns into metadata.
 * Note: Email is already in metadata (synced from auth.users), not from SQL column.
 * This function primarily ensures display_name from SQL is available in metadata.
 *
 * @param {Object} user - User object from database
 * @returns {Object} User with enriched metadata
 */
export function enrichUserMetadata(user) {
  if (!user) return user;

  // Create enriched metadata by merging display_name SQL column
  const enriched = {
    ...user,
    metadata: {
      ...user.metadata,
      // Add display_name SQL column to metadata for easy access
      // Email should already be in metadata (synced from auth.users)
      displayName: user.display_name || user.metadata?.displayName,
    },
  };

  return enriched;
}

/**
 * Enriches an array of user objects
 *
 * @param {Array} users - Array of user objects
 * @returns {Array} Array of users with enriched metadata
 */
export function enrichUsersMetadata(users) {
  if (!Array.isArray(users)) return users;
  return users.map(enrichUserMetadata);
}

/**
 * Enriches user objects within a nested data structure (e.g., posts with users)
 *
 * @param {Object|Array} data - Data structure containing user objects
 * @returns {Object|Array} Data with enriched user metadata
 */
export function enrichNestedUsers(data) {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map(enrichNestedUsers);
  }

  if (typeof data === "object") {
    const enriched = { ...data };

    // If this object has a 'users' property, enrich it
    if (enriched.users) {
      enriched.users = enrichUserMetadata(enriched.users);
    }

    // If this object has a 'user' property, enrich it
    if (enriched.user) {
      enriched.user = enrichUserMetadata(enriched.user);
    }

    return enriched;
  }

  return data;
}

/**
 * Cleans metadata by removing SQL column names before writing to database
 * This prevents duplication and conflicts with actual SQL columns
 *
 * @param {Object} metadata - Metadata object that may contain SQL column names
 * @returns {Object} Cleaned metadata without SQL columns
 */
export function cleanMetadataForWrite(metadata) {
  if (!metadata || typeof metadata !== "object") return metadata;

  const cleaned = { ...metadata };

  // Remove SQL column names from metadata
  USER_SQL_COLUMNS.forEach((column) => {
    delete cleaned[column];
  });

  return cleaned;
}

/**
 * Prepares a user object for database write by cleaning metadata
 *
 * @param {Object} userData - User data to be written
 * @returns {Object} User data with cleaned metadata
 */
export function prepareUserForWrite(userData) {
  if (!userData) return userData;

  return {
    ...userData,
    metadata: cleanMetadataForWrite(userData.metadata),
  };
}
