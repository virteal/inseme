import { getSupabaseClient } from "./supabase-client.js";
import { DocumentSearchConfig } from "./config.js";

export class FileSearchCache {
  constructor() {
    this.supabase = getSupabaseClient();
    this.tableName = DocumentSearchConfig.FILE_SEARCH_CACHE_TABLE;
    this.ttlDays = DocumentSearchConfig.FILE_SEARCH_CACHE_TTL_DAYS;
  }

  /**
   * Génère un hash SHA-256 pour la clé de cache.
   * @param {string} text
   * @returns {Promise<string>}
   */
  async _hash(text) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Récupère une entrée de cache valide.
   * @param {string} scopeKey
   * @param {string} normalizedQuestion
   * @returns {Promise<import("./types.js").DocContext | null>}
   */
  async get(scopeKey, normalizedQuestion) {
    try {
      const questionHash = await this._hash(`${scopeKey}::${normalizedQuestion}`);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("scope_key", scopeKey)
        .eq("question_hash", questionHash)
        .single();

      if (error || !data) {
        return null;
      }

      // Vérification TTL
      const createdAt = new Date(data.created_at);
      const now = new Date();
      const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24);

      if (diffDays > this.ttlDays) {
        // Expired
        return null;
      }

      // Incrémenter hit_count en arrière-plan (fire and forget)
      this.supabase.rpc("increment_cache_hit", { row_id: data.id }).catch(() => {});

      return data.doc_context_json;
    } catch (err) {
      console.error("[FileSearchCache] Error reading cache:", err);
      return null;
    }
  }

  /**
   * Stocke une nouvelle entrée dans le cache.
   * @param {string} scopeKey
   * @param {string} normalizedQuestion
   * @param {import("./types.js").DocContext} docContext
   */
  async set(scopeKey, normalizedQuestion, docContext) {
    try {
      const questionHash = await this._hash(`${scopeKey}::${normalizedQuestion}`);

      // Upsert
      const { error } = await this.supabase.from(this.tableName).upsert(
        {
          scope_key: scopeKey,
          question_hash: questionHash,
          question_text: normalizedQuestion, // Pour debug
          doc_context_json: docContext,
          created_at: new Date().toISOString(),
          hit_count: 0,
        },
        { onConflict: "scope_key,question_hash" }
      );

      if (error) {
        console.error("[FileSearchCache] Error writing cache:", error);
      }
    } catch (err) {
      console.error("[FileSearchCache] Error writing cache:", err);
    }
  }
}
