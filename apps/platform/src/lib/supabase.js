// src/lib/supabase.js
// Factorisé dans @inseme/cop-host
// Ce fichier est maintenant une façade pour la rétro-compatibilité.

export {
  getSupabase,
  initSupabase,
  initSupabaseWithInstance,
  isSupabaseReady,
  resetSupabase,
  getConfig,
  getAllConfigKeys,
  getInstance,
} from "@inseme/cop-host";

/**
 * Hook to get current authenticated user (deprecated - use useSupabase context instead)
 */
export function deprecated_useAuth() {
  console.warn("useAuth is deprecated. Use useSupabase context instead.");
  return { user: null, loading: false };
}
