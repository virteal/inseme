// src/lib/permissions.js

export const ROLE_USER = "user";
export const ROLE_MODERATOR = "moderator";
export const ROLE_ADMIN = "admin";
export const ROLE_ANONYMOUS = "anonymous";
export const ROLE_SUPER_ADMIN = "super_admin";
export const ROLE_AGENT = "agent";

// If the email of an user becomes anonymous@lepp.com, they are considered anonymous
// Administrator can "silence" an user by setting their email to this value
export const ANONYMOUS_EMAIL = "anonymous@lepp.com";

/**
 * Get the role of a user
 *
 * STRATÉGIE DE PERMISSIONS (Décembre 2025):
 * ------------------------------------------
 * La colonne `users.role` existe en base de données et est utilisée par les
 * policies RLS de Supabase.
 *
 * Migration progressive vers DB-based roles :
 *   1. [FAIT] Colonne users.role ajoutée (default: 'user')
 *   2. [TOTO] Policies RLS utilisent users.role
 *   3. [TODO] Cette fonction doit vérifier users.role depuis le profil
 *   4. [TODO] Interface admin pour gérer les rôles
 *
 * Pour promouvoir un utilisateur admin côté DB :
 *   UPDATE users SET role = 'admin' WHERE id = '<user-id>';
 *
 * @param {Object} user - The user object from Supabase or useCurrentUser
 * @returns {string} - The role of the user
 */
export function getUserRole(user) {
  if (!user) {
    return ROLE_ANONYMOUS;
  }

  const email = user.email || user.profile?.email;
  if (email === ANONYMOUS_EMAIL) {
    return ROLE_ANONYMOUS;
  }

  // Vérifier d'abord le rôle en base de données (si disponible dans le profil)
  // Ceci permet une migration progressive vers les rôles DB-based
  const dbRole = user.role || user.profile?.role;
  if (dbRole && ["admin", "moderator", "user"].includes(dbRole)) {
    return dbRole;
  }

  return ROLE_USER;
}

/**
 * Check if a user can comment
 * @param {Object} user - The user object
 * @returns {boolean} - True if the user can comment
 */
export function canComment(user) {
  const role = getUserRole(user);
  // TODO: for now everybody can comment, this may change
  return [ROLE_USER, ROLE_ADMIN, ROLE_ANONYMOUS].includes(role);
}

/**
 * Check if a user can write (vote, post, edit wiki, save chat)
 * @param {Object} user - The user object
 * @param {Object} [opts] - Optional: { agentApproval, forUser }
 * @returns {boolean} - True if the user can write
 */
export function canWrite(user, opts = {}) {
  const role = getUserRole(user);
  if (role === ROLE_AGENT) {
    // Agent can only write if explicit approval and forUser is set
    return Boolean(opts.agentApproval && opts.forUser);
  }
  // Anonymouse visitor cannot write, they can only read and comment
  return [ROLE_USER, ROLE_ADMIN].includes(role);
}

/**
 * Check if an agent can write (must have approval and forUser)
 * @param {Object} agentUser - The agent user object
 * @param {Object} forUser - The user on behalf of whom the agent acts
 * @param {boolean} agentApproval - Explicit approval for this action
 * @returns {boolean}
 */
export function canAgentWrite(agentUser, forUser, agentApproval) {
  return getUserRole(agentUser) === ROLE_AGENT && Boolean(agentApproval && forUser);
}

/**
 * Attribution helper for logs/feeds
 * @param {Object} action - The action object (should include agent, forUser, withUser)
 * @returns {Object} - { attributionType, user, agent }
 */
export function getActionAttribution(action) {
  if (action.agent && action.forUser) {
    return { attributionType: "for_user", user: action.forUser, agent: action.agent };
  }
  if (action.withUser && action.user) {
    return { attributionType: "with_user", user: action.user, agent: action.withUser };
  }
  return { attributionType: "user", user: action.user };
}

/**
 *  Check if a user is an admin
 */
export function isAdmin(user) {
  const role = getUserRole(user);
  return role === ROLE_ADMIN;
}

/**
 * Check if a user is a moderator (moderator or admin)
 */
export function isModerator(user) {
  const role = getUserRole(user);
  return role === ROLE_ADMIN || role === ROLE_MODERATOR;
}

export function isAnonymous(user) {
  const role = getUserRole(user);
  return role === ROLE_ANONYMOUS;
}
