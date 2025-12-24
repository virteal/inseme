// netlify/edge-functions/lib/permissions.js
// Edge-compatible permission helpers that mirror src/lib/permissions.js behavior
import { getConfig } from "../../../common/config/instanceConfig.edge.js";

export const ROLE_USER = "user";
export const ROLE_MODERATOR = "moderator";
export const ROLE_ADMIN = "admin";
export const ROLE_ANONYMOUS = "anonymous";
export const ROLE_SUPER_ADMIN = "super_admin";
export const ROLE_AGENT = "agent";

const ANONYMOUS_EMAIL = "anonymous@lepp.com";

function normalizeRole(r) {
  if (!r) return null;
  return String(r).toLowerCase();
}

export function getUserRole(user) {
  if (!user) return ROLE_ANONYMOUS;

  const email = user.email || (user.profile && user.profile.email);
  if (email === ANONYMOUS_EMAIL) return ROLE_ANONYMOUS;

  // Check DB/profile role first
  const dbRole = user.role || (user.profile && user.profile.role) || null;
  if (dbRole) {
    const nr = normalizeRole(dbRole);
    if ([ROLE_ADMIN, ROLE_MODERATOR, ROLE_USER, ROLE_AGENT].includes(nr)) return nr;
  }

  // Fallback: admin by contact email
  const contactEmail = getConfig("contact_email", null);
  if (contactEmail && email === contactEmail) return ROLE_ADMIN;

  return ROLE_USER;
}

export function isAdmin(user) {
  const role = getUserRole(user);
  return role === ROLE_ADMIN || role === ROLE_SUPER_ADMIN;
}

export function isModerator(user) {
  const role = getUserRole(user);
  return role === ROLE_ADMIN || role === ROLE_MODERATOR;
}

export function canWrite(user, opts = {}) {
  const role = getUserRole(user);
  if (role === ROLE_AGENT) return Boolean(opts.agentApproval && opts.forUser);
  return [ROLE_USER, ROLE_ADMIN].includes(role);
}

export default { getUserRole, isAdmin, isModerator, canWrite };
