/**
 * Utilitaires pour afficher les noms d'utilisateurs de manière cohérente
 */

/**
 * Obtient le nom d'affichage d'un utilisateur
 * Priorité: metadata.displayName > display_name > metadata.email > email > 'Utilisateur'
 *
 * @param {Object} user - Objet utilisateur (peut venir de users, auth, etc.)
 * @returns {string} Le nom d'affichage
 */
export function getDisplayName(user) {
  if (!user) return "Anonyme";

  // Priorité 1: metadata.displayName (enriched metadata)
  if (user.metadata?.displayName && typeof user.metadata.displayName === "string") {
    return user.metadata.displayName;
  }

  // Priorité 2: display_name SQL column (backward compatibility)
  if (user.display_name) return user.display_name;

  // Priorité 3: metadata.email (enriched metadata)
  // Ne pas exposer l'email publiquement. Retourner un email masqué.
  if (user.metadata?.email && typeof user.metadata.email === "string") {
    const parts = user.metadata.email.split("@");
    if (parts.length === 2) {
      const local = parts[0];
      const domain = parts[1];
      const visible = local.slice(0, 2);
      return `${visible}****@${domain}`;
    }
  }

  // Priorité 4: email SQL column (backward compatibility)
  if (user.email && typeof user.email === "string") {
    const parts = user.email.split("@");
    if (parts.length === 2) {
      const local = parts[0];
      const domain = parts[1];
      const visible = local.slice(0, 2);
      return `${visible}****@${domain}`;
    }
  }

  return "Utilisateur";
}

/**
 * Obtient l'initiale pour un avatar
 *
 * @param {Object} user - Objet utilisateur
 * @returns {string} L'initiale en majuscule
 */
export function getUserInitials(user) {
  const displayName = getDisplayName(user);

  // Si c'est "Anonyme", retourne "?"
  if (displayName === "Anonyme") return "?";

  // Retourne la première lettre en majuscule
  return displayName[0].toUpperCase();
}

/**
 * Obtient le nom court (prénom seulement si nom complet)
 *
 * @param {Object} user - Objet utilisateur
 * @returns {string} Le nom court
 */
export function getShortDisplayName(user) {
  const fullName = getDisplayName(user);

  // Si c'est un email, retourne la partie avant @
  if (fullName.includes("@")) {
    return fullName.split("@")[0];
  }

  // Si c'est un nom complet (avec espace), retourne le prénom
  const parts = fullName.split(" ");
  return parts[0];
}
