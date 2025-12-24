// Configuration pour le module de recherche documentaire
import { getConfig } from "../../../../common/config/instanceConfig.edge.js";

export const DocumentSearchConfig = {
  // Gemini
  GEMINI_API_KEY: getConfig("google_filesearch_api_key") || getConfig("gemini_api_key"),

  // Supabase
  SUPABASE_URL: getConfig("supabase_url"),
  SUPABASE_SERVICE_ROLE_KEY: getConfig("supabase_service_role_key"),

  // File Search
  // Liste des stores par défaut séparés par des virgules
  FILE_SEARCH_DEFAULT_STORES: (getConfig("file_search_default_stores") || "")
    .split(",")
    .filter((s) => s.trim().length > 0),

  // Context Caching (Alternative recommandée)
  GEMINI_CACHE_ID: getConfig("gemini_cache_id"),

  // Storage
  SUPABASE_STORAGE_BUCKET: getConfig("supabase_storage_bucket"),

  // Cache
  FILE_SEARCH_CACHE_TABLE: getConfig("file_search_cache_table"),
  FILE_SEARCH_CACHE_TTL_DAYS: parseInt(getConfig("file_search_cache_ttl_days") || "7", 10),

  // Sources History
  DOCUMENT_SOURCES_TABLE: "document_sources",

  // Constraints
  MAX_SNIPPETS: 5,
  MAX_CONTEXT_CHARS: 4000,
};

/**
 * Valide que la configuration minimale est présente.
 * @throws {Error} Si une variable requise est manquante.
 */
export function validateConfig() {
  const required = ["gemini_api_key", "supabase_url", "supabase_service_role_key"];

  const missing = required.filter((key) => !getConfig(key));

  if (missing.length > 0) {
    throw new Error(`[DocumentSearch] Configuration manquante : ${missing.join(", ")}`);
  }
}
