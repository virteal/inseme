/**
 * src\common\config\instanceConfig.edge.js
 * Adaptateur Edge Function (Deno) pour l'initialisation de la configuration de l'instance.
 * Gère l'accès aux variables d'environnement Netlify et l'initialisation du client Supabase.
 */

import { inited, initializeInstanceCore, loadInstanceConfigCore } from "./instanceConfig.core.js";

// Pour Deno Edge Functions, le client Supabase est généralement importé depuis un CDN ou un module spécifique à Deno.
// Assurez-vous que cette importation est correcte pour votre environnement Deno.
// Par exemple, si vous utilisez le client Supabase pour Deno :
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1"; // Exemple d'importation pour Deno

// Function to get env var in Netlify
function getenv(key) {
  return Netlify.env.get(key);
}

// Fonction pour créer une instance Supabase côté Deno Edge , sync
const createSupabase_Edge = (admin = false, options = {}) => {
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

export function newSupabase(admin = false, options = {}) {
  // Debug: Log Supabase URL and Service Role Key
  console.log("Supabase URL:", getenv("SUPABASE_URL"));
  console.log("Supabase Anon Key:", getenv("SUPABASE_ANON_KEY"));
  console.log(
    "Supabase Service Role Key:",
    getenv("SUPABASE_SERVICE_ROLE_KEY").substring(0, 4) + "..."
  );
  return createSupabase_Edge(admin, options);
}

export async function initializeInstance(supabase, admin = false) {
  return await initializeInstanceCore(supabase, getenv, newSupabase, admin);
}

// Edge functions should call this function very early on.
// TODO: where should the instance be selected in the multi-instance case?
export async function initializeInstanceAdmin(supabase) {
  return initializeInstance(supabase, true);
}

export async function loadInstanceConfig(force = false, supabase_config = null) {
  // Invalid if not initialized properly
  if (!inited()) {
    console.warn("loadInstanceConfig: calling initializeInstanceAdmin()");
    await initializeInstanceAdmin();
  }
  return await loadInstanceConfigCore(force, supabase_config);
}

// Ré-exporter tout de instanceConfig.core.js pour une utilisation facile dans les Edge Functions
export * from "./instanceConfig.core.js";
