/**
 * src\common\config\instanceConfig.backend.js
 * Adaptateur backend (Node.js) pour l'initialisation de la configuration de l'instance.
 * Gère l'accès aux variables d'environnement côté serveur et l'initialisation du client Supabase.
 */

import { inited, initializeInstanceCore, loadInstanceConfigCore } from "./instanceConfig.core.js";
import { createClient } from "@supabase/supabase-js";

// Use dotenv to load .env
import dotenv from "dotenv";
dotenv.config();

// Fonction pour récupérer les variables d'environnement côté backend (Node.js)
function getenv(key) {
  return process.env[key];
}

// Fonction pour créer une instance Supabase côté Nodejs backend
const createSupabase = (admin = false, options = {}) => {
  const supabaseUrl = getenv("SUPABASE_URL");
  const supabaseServiceRoleKey = getenv("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = getenv("SUPABASE_ANON_KEY");

  const supabaseKey = admin ? supabaseServiceRoleKey : supabaseAnonKey;
  if (!supabaseKey) {
    console.warn(
      `Supabase ${admin ? "Service Role" : "Anon"} Key not found in Deno Edge environment. Supabase client will not be initialized.`
    );
    return null;
  }

  // Debug, display options unless none
  if (Object.keys(options).length > 0) {
    console.log("Supabase Options:", options);
  }

  // No need of auto refresh in auth option, unless specically asked for
  if (!options.auth || !options.auth.autoRefreshToken) {
    options.auth = {
      ...options.auth,
      autoRefreshToken: false,
    };
  }

  // No need to persist session in auth option, unless specically asked for
  if (!options.auth || !options.auth.persistSession) {
    options.auth = {
      ...options.auth,
      persistSession: false,
    };
  }

  // Pour les Edge Functions, comme pour le backend, il est courant d'utiliser la clé de rôle de service.
  return createClient(supabaseUrl, supabaseKey, options);
};

export function newSupabase(admin = true, options = {}) {
  return createSupabase(admin, options);
}

export async function initializeInstance(supabase = null, admin = false, options = {}) {
  return await initializeInstanceCore(supabase, getenv, newSupabase, admin, options);
}

export async function initializeInstanceAdmin(supabase = null, options = {}) {
  return await initializeInstanceCore(supabase, getenv, newSupabase, true, options);
}

export async function loadInstanceConfig(force = false, supabase_config = null) {
  if (!inited()) {
    console.warn("loadInstanceConfig: calling initializeInstanceAdmin()");
    await initializeInstanceAdmin();
  }
  return await loadInstanceConfigCore(force, supabase_config);
}

// Ré-exporter tout de instanceConfig.core.js pour une utilisation facile dans le backend
export * from "./instanceConfig.core.js";
