import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DocumentSearchConfig } from "./config.js";

/**
 * Crée et retourne une instance du client Supabase configurée pour les Edge Functions.
 * Utilise la clé SERVICE_ROLE pour avoir les droits d'admin (nécessaire pour le cache et les sources).
 */
export function getSupabaseClient() {
  if (!DocumentSearchConfig.SUPABASE_URL || !DocumentSearchConfig.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase URL or Service Role Key is missing in configuration.");
  }

  return createClient(
    DocumentSearchConfig.SUPABASE_URL,
    DocumentSearchConfig.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
