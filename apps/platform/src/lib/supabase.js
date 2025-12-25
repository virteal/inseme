// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";
import { resolveInstance } from "./instanceResolver.js";

import {
  getConfig as getInstanceConfig,
  getAllConfigKeys as getAllInstanceConfigKeys,
  getSupabase as getInstanceSupabase,
} from "../../../../packages/cop-host/src/config/instanceConfig.core.js";

// ============================================================================
// SUPABASE DYNAMIQUE MULTI-INSTANCES
// ============================================================================
// L'instance Supabase est résolue dynamiquement selon l'URL :
// 1. Paramètre ?instance=xxx (dev/localhost)
// 2. Sous-domaine : corte.transparence.corsica
// 3. Fallback : variables d'environnement
//
// En développement : utiliser http://localhost:5173?instance=corte
// En production : les sous-domaines sont résolus automatiquement

let supabaseInstance = null;
let currentInstanceConfig = null;
let initPromise = null;

// ============================================================================
// CRÉATION DU CLIENT AVEC LOGGING
// ============================================================================

/**
 * Crée un client Supabase avec logging
 * @param {string} url
 * @param {string} anonKey
 * @param {string} subdomain - Pour isoler les sessions
 * @returns {SupabaseClient}
 */
function createLoggingClient(url, anonKey, subdomain = "local", supabase_client = null) {
  const existing_supabase = supabase_client || getInstanceSupabase();
  const rawClient =
    existing_supabase ||
    createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Clé de stockage unique par instance (isole les sessions)
        storageKey: `sb-${subdomain}-auth`,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });

  // Proxy de logging (même logique qu'avant)
  return new Proxy(rawClient, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === "function") {
        return (...args) => {
          const startTime = Date.now();
          console.log(`Supabase: Calling ${prop}`, args.length > 0 ? args[0] : "");

          try {
            const result = value.apply(target, args);

            if (result && typeof result.then === "function") {
              return result.then(
                (data) => {
                  const duration = Date.now() - startTime;
                  if (data?.error) {
                    console.error(
                      `Supabase: ${prop} resolved in ${duration}ms Error: ${data.error.message}`
                    );
                    throw new Error(`Supabase error in ${prop}: ${data.error.message}`);
                  } else {
                    console.log(`Supabase: ${prop} resolved in ${duration}ms Success`);
                  }
                  return data;
                },
                (error) => {
                  const duration = Date.now() - startTime;
                  console.error(`Supabase: ${prop} rejected in ${duration}ms`, error);
                  throw error;
                }
              );
            }

            console.log(`Supabase: ${prop} returned synchronously`);
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`Supabase: ${prop} threw synchronously in ${duration}ms`, error);
            throw error;
          }
        };
      }
      return value;
    },
  });
}

// ============================================================================
// INITIALISATION DYNAMIQUE
// ============================================================================

/**
 * Initialise Supabase avec l'instance résolue
 * @param {Object} instanceConfig - Config depuis instanceResolver
 * @returns {SupabaseClient|null}
 */
export function initSupabaseWithInstance(instanceConfig) {
  // We need either a supabase instance or a supabaseUrl and supabaseAnonKey
  if (!instanceConfig.supabase) {
    if (!instanceConfig?.supabaseUrl || !instanceConfig?.supabaseAnonKey) {
      throw new Error("❌ Configuration Supabase invalide");
    }
  }

  currentInstanceConfig = instanceConfig;
  // Debug trace
  console.log(
    `🔧 Initializing Supabase for: ${instanceConfig.displayName || instanceConfig.subdomain}`
  );
  console.log(
    `🔧 Config: ${JSON.stringify({
      supabaseUrl: instanceConfig.supabaseUrl,
      supabaseAnonKey: instanceConfig.supabaseAnonKey,
      subdomain: instanceConfig.subdomain || "local",
    })}`
  );
  // Debug trace, is there a supabase instance already?
  console.log(`🔧 supabaseInstance: ${JSON.stringify(supabaseInstance)}`);
  supabaseInstance = createLoggingClient(
    instanceConfig.supabaseUrl,
    instanceConfig.supabaseAnonKey,
    instanceConfig.subdomain || "local",
    instanceConfig.supabase || null
  );
  console.log(`🔧 Supabase Logging Client created`);
  instanceConfig.supabase = supabaseInstance;

  console.log(
    `✅ Supabase initialisé pour: ${instanceConfig.displayName || instanceConfig.subdomain}`
  );

  // Exposer pour debug
  if (typeof window !== "undefined") {
    window.__SUPABASE_INSTANCE__ = {
      subdomain: instanceConfig.subdomain,
      displayName: instanceConfig.displayName,
      source: instanceConfig.source,
      supabase: supabaseInstance,
    };
  }

  return supabaseInstance;
}

/**
 * Initialise Supabase de manière asynchrone (résout l'instance automatiquement)
 * @returns {Promise<{supabase: SupabaseClient, instance: Object}>}
 */
export async function initSupabase() {
  console.log(`🔧 initSupabase: ${JSON.stringify(currentInstanceConfig)}`);
  // Éviter les initialisations multiples
  if (initPromise) {
    return initPromise;
  }

  // Si déjà initialisé, retourner directement
  if (supabaseInstance && currentInstanceConfig) {
    return { supabase: supabaseInstance, instance: currentInstanceConfig };
  }

  initPromise = (async () => {
    const instance = await resolveInstance();

    if (!instance.isConfigured && !instance.supabaseUrl) {
      throw new Error("Aucune configuration Supabase valide trouvée");
    }

    console.log(`🔧 initSupabase: ${JSON.stringify(instance)}`);
    const client = initSupabaseWithInstance(instance);

    return { supabase: client, instance };
  })();

  return initPromise;
}

// ============================================================================
// ACCESSEURS
// ============================================================================

/**
 * Récupère le client Supabase initialisé
 * @returns {SupabaseClient}
 * @throws {Error} si non initialisé
 */
export function getSupabase() {
  if (!supabaseInstance) {
    throw new Error("Supabase non initialisée. Appeler initSupabase() d'abord.");
  }
  return supabaseInstance;
}

/**
 * Récupère la configuration de l'instance actuelle
 * @returns {Object|null}
 */
export function getInstance() {
  return currentInstanceConfig;
}

/**
 * Vérifie si Supabase est initialisé
 * @returns {boolean}
 */
export function isSupabaseReady() {
  return supabaseInstance !== null;
}

// ============================================================================
// RESET (pour tests)
// ============================================================================

/**
 * Réinitialise le client Supabase (pour tests)
 */
export function resetSupabase() {
  supabaseInstance = null;
  currentInstanceConfig = null;
  initPromise = null;
}

// ============================================================================
// HOOK DEPRECATED
// ============================================================================

/**
 * Hook to get current authenticated user (deprecated - use useSupabase context instead)
 */
export function deprecated_useAuth() {
  console.warn("useAuth is deprecated. Use useSupabase context instead.");
  return { user: null, loading: false };
}

export function getConfig(key) {
  if (!currentInstanceConfig) {
    throw new Error("Instance non configurée. Appeler initSupabase() d'abord.");
  }
  return getInstanceConfig(key);
}

export function getAllConfigKeys() {
  return getAllInstanceConfigKeys();
}

