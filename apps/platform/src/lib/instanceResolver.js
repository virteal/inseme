// src/lib/instanceResolver.js
// Résolution dynamique de l'instance Supabase selon l'URL
//
// STRATÉGIE DE ROUTAGE :
// 1. Paramètre URL ?instance=xxx (dev/test, priorité max)
// 2. Sous-domaine : corte.transparence.corsica → instance "corte"
// 3. Fallback : variables d'environnement (instance par défaut)
//
// En développement local (localhost), utiliser ?instance=xxx
// En production, les sous-domaines sont résolus automatiquement

// ============================================================================
// CONFIGURATION
// ============================================================================

// Domaine de base pour la détection des sous-domaines
const BASE_DOMAINS = ["lepp.fr", "kudocracy.org"];

// Sous-domaines à ignorer (pas des instances)
const IGNORED_SUBDOMAINS = ["www", "app", "api", "admin", "staging", "preview"];

// ============================================================================
// ÉTAT GLOBAL
// ============================================================================

let currentInstance = null;
let resolvePromise = null;

// ============================================================================
// DÉTECTION DU SOUS-DOMAINE
// ============================================================================

/**
 * Extrait le sous-domaine de l'URL actuelle
 * @returns {string|null} - Le sous-domaine ou null
 */
export function extractSubdomain() {
  const hostname = window.location.hostname;

  // Localhost ou IP = pas de sous-domaine
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return null;
  }

  // Vérifier chaque domaine de base
  for (const baseDomain of BASE_DOMAINS) {
    if (hostname.endsWith(`.${baseDomain}`)) {
      const subdomain = hostname.replace(`.${baseDomain}`, "");
      // Ignorer les sous-domaines système
      if (!IGNORED_SUBDOMAINS.includes(subdomain)) {
        return subdomain;
      }
    }
  }

  // Netlify preview URLs : deploy-preview-123--site-name.netlify.app
  if (hostname.includes(".netlify.app")) {
    // Extraire le paramètre instance si présent dans l'URL
    return null;
  }

  return null;
}

/**
 * Récupère le paramètre ?instance= de l'URL
 * @returns {string|null}
 */
export function getInstanceParam() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("instance");
}

// ============================================================================
// RÉSOLUTION D'INSTANCE
// ============================================================================

/**
 * Résout l'instance Supabase à utiliser
 * Priorité : paramètre URL > sous-domaine > env vars
 *
 * @returns {Promise<InstanceConfig>}
 */
export async function resolveInstance() {
  // Éviter les résolutions multiples simultanées
  if (resolvePromise) {
    return resolvePromise;
  }

  // Si déjà résolu, retourner le cache
  if (currentInstance) {
    return currentInstance;
  }

  resolvePromise = doResolveInstance();
  currentInstance = await resolvePromise;
  resolvePromise = null;

  return currentInstance;
}

/**
 * Logique de résolution interne
 */
async function doResolveInstance() {
  // 1. Priorité max : paramètre URL (dev/test)
  const instanceParam = getInstanceParam();
  if (instanceParam) {
    console.log(`🔧 Instance depuis URL param: ${instanceParam}`);
    const instance = await lookupInstance(instanceParam);
    if (instance) {
      return { ...instance, source: "url-param" };
    }
  }

  // 2. Sous-domaine
  const subdomain = extractSubdomain();
  if (subdomain) {
    console.log(`🌐 Instance depuis sous-domaine: ${subdomain}`);
    const instance = await lookupInstance(subdomain);
    if (instance) {
      return { ...instance, source: "subdomain" };
    }
  }

  // 3. Fallback : variables d'environnement (instance par défaut)
  console.log("📋 Instance locale");
  return getDefaultInstance();
}

/**
 * Recherche une instance dans le registre
 * @param {string} subdomain
 * @returns {Promise<InstanceConfig|null>}
 */
async function lookupInstance(subdomain) {
  // 1. D'abord essayer le registre central (API)
  const remoteInstance = await lookupRemoteRegistry(subdomain);
  if (remoteInstance) {
    return remoteInstance;
  }
  console.warn(`⚠️ Instance non trouvée: ${subdomain}`);
  return null;
}

/**
 * Recherche dans le registre central (API)
 * @param {string} subdomain
 * @returns {Promise<InstanceConfig|null>}
 */
async function lookupRemoteRegistry(subdomain) {
  // TODO: should get this from vault
  const registryUrl = import.meta.env.VITE_REGISTRY_URL;

  if (!registryUrl) {
    return null;
  }

  try {
    const response = await fetch(`${registryUrl}/api/instance/${subdomain}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    console.log(`🌐 Instance trouvée dans registre central: ${subdomain}`);
    return data;
  } catch (error) {
    console.debug("Registre central non disponible:", error.message);
    return null;
  }
}

/**
 * Retourne l'instance par défaut (depuis env vars)
 * @returns {InstanceConfig}
 */
function getDefaultInstance() {
  return {
    subdomain: "default",
    displayName: "local",
    supabaseUrl: null,
    supabaseAnonKey: null,
    isDefault: true,
    isConfigured: true,
    source: "local",
    metadata: {},
  };
}

// ============================================================================
// ACCESSEURS
// ============================================================================

/**
 * Récupère l'instance actuelle (doit être résolue avant)
 * @returns {InstanceConfig|null}
 */
export function getInstance() {
  return currentInstance;
}

/**
 * Vérifie si on est sur l'instance par défaut
 * @returns {boolean}
 */
export function isDefaultInstance() {
  return currentInstance?.isDefault === true;
}

/**
 * Récupère le sous-domaine actuel
 * @returns {string}
 */
export function getSubdomain() {
  return currentInstance?.subdomain || "default";
}

/**
 * Génère l'URL pour une autre instance
 * @param {string} subdomain
 * @param {string} path - Chemin optionnel
 * @returns {string}
 */
export function getInstanceUrl(subdomain, path = "/") {
  // En dev, utiliser le paramètre
  if (window.location.hostname === "localhost") {
    const url = new URL(window.location.origin);
    url.pathname = path;
    url.searchParams.set("instance", subdomain);
    return url.toString();
  }

  // En prod, utiliser le sous-domaine
  const baseDomain = BASE_DOMAINS[0]; // transparence.corsica
  return `https://${subdomain}.${baseDomain}${path}`;
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Réinitialise l'instance (pour tests)
 */
export function resetInstance() {
  currentInstance = null;
  resolvePromise = null;
}

/**
 * Définit manuellement une instance (pour tests)
 * @param {InstanceConfig} instance
 */
export function setInstance(instance) {
  currentInstance = instance;
}

/**
 * Ajoute une instance au registre statique (runtime)
 * @param {string} subdomain
 * @param {InstanceConfig} config
 */
export function registerInstance(subdomain, config) {
  STATIC_REGISTRY[subdomain] = { ...config, subdomain };
}

// ============================================================================
// TYPES (pour documentation)
// ============================================================================

/**
 * @typedef {Object} InstanceConfig
 * @property {string} subdomain - Identifiant de l'instance
 * @property {string} displayName - Nom affiché
 * @property {string} supabaseUrl - URL Supabase
 * @property {string} supabaseAnonKey - Clé anonyme Supabase
 * @property {Object} [metadata] - Métadonnées (insee, type, etc.)
 * @property {boolean} [isDefault] - Instance par défaut ?
 * @property {boolean} [isConfigured] - Correctement configurée ?
 * @property {string} [source] - Source de résolution
 */

// ============================================================================
// EXPORT
// ============================================================================

export default {
  resolveInstance,
  getInstance,
  isDefaultInstance,
  getSubdomain,
  getInstanceUrl,
  extractSubdomain,
  getInstanceParam,
  resetInstance,
  setInstance,
  registerInstance,
};
