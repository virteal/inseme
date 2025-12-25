/**
 * src/lib/config/instanceConfig.edge.js
 * Adaptateur Edge Function (Deno) pour l'initialisation de la configuration de l'instance.
 */

import { inited, initializeInstanceCore, loadConfigTable as loadInstanceConfigCore } from "./instanceConfig.core.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Function to get env var in Netlify Edge
function getenv(key) {
  return Deno.env.get(key) || Deno.env.get(`VITE_${key}`) || Deno.env.get(`VITE_${key.toUpperCase()}`);
}

// Fonction pour créer une instance Supabase côté Deno Edge
const createSupabase_Edge = (admin = false, options = {}) => {
  const supabaseUrl = options.supabaseUrl || getenv("SUPABASE_URL");
  const supabaseServiceRoleKey = options.supabaseKey || getenv("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = options.supabaseKey || getenv("SUPABASE_ANON_KEY");

  const supabaseKey = admin ? supabaseServiceRoleKey : (options.supabaseKey || supabaseAnonKey);
  if (!supabaseKey || !supabaseUrl) {
    console.warn(
      `Supabase ${admin ? "Service Role" : "Anon"} Key or URL not found in Deno Edge environment.`
    );
    return null;
  }

  // No need of auto refresh or persist session in edge functions
  options.auth = {
    ...options.auth,
    autoRefreshToken: false,
    persistSession: false,
  };

  return createClient(supabaseUrl, supabaseKey, options);
};

export function newSupabase(admin = false, options = {}) {
  return createSupabase_Edge(admin, options);
}

export async function initializeInstance(supabase, admin = false) {
  return await initializeInstanceCore(supabase, getenv, newSupabase, admin);
}

export async function initializeInstanceAdmin(supabase) {
  return initializeInstance(supabase, true);
}

export async function loadInstanceConfig(force = false, supabase_config = null) {
  if (!inited()) {
    await initializeInstanceAdmin();
  }
  return await loadInstanceConfigCore(force, supabase_config);
}

export * from "./instanceConfig.core.js";
