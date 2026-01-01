/**
 * packages/cop-host/src/lib/template.js
 * Utilitaire de substitution de variables de type Mustache {{ VARIABLE }}
 */

/**
 * Substitue les variables dans une chaîne de caractères.
 * @param {string} text - Le texte contenant des placeholders {{ KEY }}
 * @param {Object} variables - Dictionnaire des variables { KEY: value }
 * @returns {string} Le texte avec les variables substituées
 */
export function substituteVariables(text, variables = {}) {
  if (!text || typeof text !== "string") return text;

  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // On supporte {{KEY}} et {{ KEY }}
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      result = result.replace(regex, String(value));
    }
  });

  return result;
}

/**
 * Récupère les variables communes à partir d'une configuration d'instance.
 * @param {Function} getConfigFn - Fonction pour récupérer une valeur de config (ex: getConfig de instanceConfig)
 * @returns {Object} Dictionnaire des variables standards
 */
export function getCommonVariables(getConfigFn) {
  if (typeof getConfigFn !== "function") return {};

  return {
    CITY_NAME: getConfigFn("city_name", "Corte"),
    PARTY_NAME: getConfigFn("party_name", "Petit Parti"),
    APP_URL: getConfigFn("app_url", "https://lepp.fr").replace(/\/$/, ""),
    FACEBOOK_APP_ID: getConfigFn("facebook_app_id", ""),
    BOT_NAME: getConfigFn("bot_name", "Ophélia"),
    CONTACT_EMAIL: getConfigFn("contact_email", "contact@lepp.fr"),
  };
}

/**
 * Version asynchrone pour charger la config si nécessaire avant substitution.
 * @param {string} text
 * @param {Object} options
 * @returns {Promise<string>}
 */
export async function substituteWithInstanceConfig(
  text,
  { loadConfig, getConfig } = {}
) {
  if (!text) return text;
  if (typeof loadConfig === "function") {
    await loadConfig();
  }
  const vars = getCommonVariables(getConfig);
  return substituteVariables(text, vars);
}
