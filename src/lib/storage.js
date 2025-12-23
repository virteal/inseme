// src/lib/storage.js
import { supabase } from './supabase'

/**
 * Storage Utility for Inseme
 * Handles file uploads to Supabase Storage or Cloudflare R2 (via Edge Functions)
 */

export const storage = {
    /**
     * Uploads a file (Blob/File) to the configured storage.
     * Defaults to Supabase Storage if R2 is not configured.
     */
    async upload(bucket, path, file, options = {}) {
        const useR2 = import.meta.env.VITE_USE_R2 === 'true';

        if (useR2) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('bucket', bucket);
                formData.append('key', path);
                formData.append('contentType', options.contentType || file.type);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error);
                
                return { path: data.path, url: data.url };
            } catch (err) {
                console.warn('R2 upload failed, falling back to Supabase:', err);
                // Fallback to Supabase if R2 fails
            }
        }

        // Fallback to Supabase Storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: true,
                ...options
            });

        if (error) throw error;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);

        return { path: data.path, url: publicUrl };
    },

    /**
     * Specialized function for archiving session snapshots (JSON)
     * If ephemeral is true, stores in 'temp/' folder for automatic cleanup.
     * Use this for intermediate snapshots that aren't the final "Official Record".
     */
    async archiveSession(roomId, sessionId, snapshot, ephemeral = true) {
        const folder = ephemeral ? 'temp' : 'sessions';
        const fileName = `${folder}/${roomId}/${sessionId}.json`;
        const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
        
        return this.upload('public-documents', fileName, blob);
    },

    /**
     * Uploads a vocal message to temporary storage.
     * Returns the public URL.
     */
    async uploadVocal(roomId, blob, customFileName = null) {
        const fileName = customFileName || `temp/${roomId}/vocal_${Date.now()}.webm`;
        const { url } = await this.upload('public-documents', fileName, blob, {
            contentType: 'audio/webm'
        });
        return url;
    }
};
