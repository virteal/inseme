// packages/cop-host/src/lib/storage.js
import { getSupabase } from "../client/supabase.js";
import { getConfig } from "../config/instanceConfig.client.js";

/**
 * Shared Storage Utility for Inseme & Platform
 * Handles file uploads to Supabase Storage or Cloudflare R2 (via Edge Functions)
 */

export const storage = {
  /**
   * Uploads a file (Blob/File) to the configured storage.
   * Defaults to Supabase Storage if R2 is not configured.
   */
  async upload(bucket, path, file, options = {}) {
    const useR2 = getConfig("USE_R2") === "true";

    // Detect environment to handle FormData differences
    const isBrowser = typeof window !== "undefined";

    if (useR2) {
      try {
        let body;
        if (isBrowser) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("bucket", bucket);
          formData.append("key", path);
          formData.append("contentType", options.contentType || file.type);
          body = formData;
        } else {
          // For Node.js/CLI, we might need to handle FormData differently or use direct R2 client
          // For now, let's keep it simple as Inseme/Platform are mainly browser-based
          throw new Error(
            "R2 upload not yet supported in Node.js environment via this helper"
          );
        }

        const response = await fetch("/api/upload", {
          method: "POST",
          body,
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        return { path: data.path, url: data.url };
      } catch (err) {
        console.warn("R2 upload failed, falling back to Supabase:", err);
      }
    }

    // Fallback to Supabase Storage
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        ...options,
      });

    if (error) throw error;

    // Get Public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return { path: data.path, url: publicUrl };
  },

  /**
   * Helper to get public URL for an existing file
   */
  getPublicUrl(bucket, path) {
    const supabase = getSupabase();
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  },

  /**
   * Helper to remove files
   */
  async remove(bucket, paths) {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
    return data;
  },

  /**
   * Specialized function for archiving session snapshots (JSON)
   */
  async archiveSession(roomId, sessionId, snapshot, ephemeral = true) {
    const folder = ephemeral ? "temp" : "sessions";
    const fileName = `${folder}/${roomId}/${sessionId}.json`;
    const blob = new Blob([JSON.stringify(snapshot)], {
      type: "application/json",
    });

    return this.upload("public-documents", fileName, blob);
  },

  /**
   * Uploads a vocal message to temporary storage.
   */
  async uploadVocal(roomId, blob, customFileName = null) {
    const fileName =
      customFileName || `temp/${roomId}/vocal_${Date.now()}.webm`;
    const { url } = await this.upload("public-documents", fileName, blob, {
      contentType: "audio/webm",
    });
    return url;
  },
};
