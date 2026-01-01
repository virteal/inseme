/**
 * Format a date to a human-readable French format
 * @param {string|Date} dateString - The date to format
 * @param {boolean} includeTime - Whether to include the time
 * @returns {string} Formatted date string
 */
export function formatDate(dateString, includeTime = true) {
  if (!dateString) return "Date inconnue";

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return "Date invalide";

  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(includeTime && { hour: "2-digit", minute: "2-digit" }),
  };

  return new Intl.DateTimeFormat("fr-FR", options).format(date);
}

/**
 * Format a date to a relative format (e.g., "il y a 2 jours")
 * @param {string|Date} dateString - The date to format
 * @returns {string} Relative date string
 */
export function formatRelativeDate(dateString) {
  if (!dateString) return "Date inconnue";

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return "Date invalide";

  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins} minute${diffMins > 1 ? "s" : ""}`;
  if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? "s" : ""}`;
  if (diffDays < 7) return `il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  if (diffWeeks < 4) return `il y a ${diffWeeks} semaine${diffWeeks > 1 ? "s" : ""}`;
  if (diffMonths < 12) return `il y a ${diffMonths} mois`;
  return `il y a ${diffYears} an${diffYears > 1 ? "s" : ""}`;
}

/**
 * Format a short date (DD/MM/YYYY)
 * @param {string|Date} dateString - The date to format
 * @returns {string} Short formatted date
 */
export function formatShortDate(dateString) {
  if (!dateString) return "Date inconnue";

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return "Date invalide";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}
