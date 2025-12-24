import { getSupabaseClient } from "./supabase-client.js";
import { DocumentSearchConfig } from "./config.js";

export class DocumentSources {
  constructor() {
    this.supabase = getSupabaseClient();
    this.tableName = DocumentSearchConfig.DOCUMENT_SOURCES_TABLE;
    this.storageBucket = DocumentSearchConfig.SUPABASE_STORAGE_BUCKET;
  }

  /**
   * Upload a document to Supabase Storage and track it in database
   * @param {File|Buffer} file - The file to upload (File object in browser, Buffer in Node)
   * @param {Object} metadata - Document metadata (type, date, description, etc.)
   * @param {string} userId - ID of the user uploading
   * @param {string} method - Ingestion method ('ui_upload' or 'cli_bulk')
   * @returns {Promise<{success: boolean, documentId?: string, publicUrl?: string, isDuplicate?: boolean, error?: string}>}
   */
  async uploadDocument(file, metadata = {}, userId = null, method = "ui_upload") {
    try {
      // 1. Calculate content hash for deduplication
      const contentHash = await this._calculateHash(file);

      // 2. Check for duplicates
      const existingDoc = await this.findDuplicateByHash(contentHash);
      if (existingDoc) {
        console.log(`[DocumentSources] Duplicate detected: ${existingDoc.filename}`);
        return {
          success: false,
          isDuplicate: true,
          existingDocument: existingDoc,
          error: `Document already exists: ${existingDoc.filename}`,
        };
      }

      // 3. Generate unique filename
      const timestamp = Date.now();
      const filename = file.name || `document_${timestamp}`;
      const sanitizedFilename = this._sanitizeFilename(filename);
      const storagePath = `${timestamp}_${sanitizedFilename}`;

      // 4. Upload to Supabase Storage
      const fileData = file instanceof Blob ? file : new Blob([file]);
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.storageBucket)
        .upload(storagePath, fileData, {
          contentType: file.type || metadata.mimeType || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error(`[DocumentSources] Upload error:`, uploadError);
        return { success: false, error: uploadError.message };
      }

      // 5. Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.storageBucket)
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      // 6. Insert record into database
      const { data: dbData, error: dbError } = await this.supabase
        .from(this.tableName)
        .insert({
          filename: sanitizedFilename,
          content_hash: contentHash,
          public_url: publicUrl,
          file_size_bytes: file.size,
          mime_type: file.type || metadata.mimeType,
          metadata: metadata,
          ingestion_method: method,
          status: "active",
          ingested_by: userId,
        })
        .select()
        .single();

      if (dbError) {
        console.error(`[DocumentSources] Database error:`, dbError);
        // Try to clean up uploaded file
        await this.supabase.storage.from(this.storageBucket).remove([storagePath]);
        return { success: false, error: dbError.message };
      }

      console.log(`[DocumentSources] Document uploaded successfully: ${sanitizedFilename}`);
      return {
        success: true,
        documentId: dbData.id,
        publicUrl: publicUrl,
        contentHash: contentHash,
      };
    } catch (error) {
      console.error(`[DocumentSources] Unexpected error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a document already exists by content hash
   * @param {string} contentHash - SHA-256 hash of file content
   * @returns {Promise<Object|null>} Existing document record or null
   */
  async findDuplicateByHash(contentHash) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("content_hash", contentHash)
      .eq("status", "active")
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = not found
      console.error("[DocumentSources] Error checking duplicate:", error);
    }

    return data || null;
  }

  /**
   * List all documents with optional filters
   * @param {Object} filters - { status, dateFrom, dateTo, type, search }
   * @param {number} limit - Max number of results
   * @param {number} offset - Pagination offset
   * @returns {Promise<{documents: Array, total: number}>}
   */
  async listDocuments(filters = {}, limit = 50, offset = 0) {
    let query = this.supabase.from(this.tableName).select("*", { count: "exact" });

    // Apply filters
    if (filters.status) {
      query = query.eq("status", filters.status);
    } else {
      query = query.eq("status", "active"); // Default to active only
    }

    if (filters.dateFrom) {
      query = query.gte("created_at", filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte("created_at", filters.dateTo);
    }

    if (filters.type) {
      query = query.eq("metadata->>type", filters.type);
    }

    if (filters.search) {
      query = query.ilike("filename", `%${filters.search}%`);
    }

    // Order and pagination
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[DocumentSources] Error listing documents:", error);
      return { documents: [], total: 0 };
    }

    return { documents: data || [], total: count || 0 };
  }

  /**
   * Archive or delete a document
   * @param {string} documentId - UUID of the document
   * @param {boolean} hardDelete - If true, removes from storage and database
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async removeDocument(documentId, hardDelete = false) {
    try {
      // Get document info first
      const { data: doc, error: fetchError } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("id", documentId)
        .single();

      if (fetchError || !doc) {
        return { success: false, error: "Document not found" };
      }

      if (hardDelete) {
        // Extract storage path from public URL
        const urlPath = new URL(doc.public_url).pathname;
        const storagePath = urlPath.split("/").slice(-1)[0]; // Get filename from URL

        // Delete from storage
        const { error: storageError } = await this.supabase.storage
          .from(this.storageBucket)
          .remove([storagePath]);

        if (storageError) {
          console.error("[DocumentSources] Storage deletion error:", storageError);
        }

        // Delete from database
        const { error: dbError } = await this.supabase
          .from(this.tableName)
          .delete()
          .eq("id", documentId);

        if (dbError) {
          return { success: false, error: dbError.message };
        }

        console.log(`[DocumentSources] Document hard deleted: ${doc.filename}`);
      } else {
        // Soft delete (archive)
        const { error: updateError } = await this.supabase
          .from(this.tableName)
          .update({ status: "archived" })
          .eq("id", documentId);

        if (updateError) {
          return { success: false, error: updateError.message };
        }

        console.log(`[DocumentSources] Document archived: ${doc.filename}`);
      }

      return { success: true };
    } catch (error) {
      console.error("[DocumentSources] Error removing document:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all active documents (for cache rebuilding)
   * @returns {Promise<Array>}
   */
  async getAllActiveDocuments() {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[DocumentSources] Error fetching active documents:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Calculate SHA-256 hash of file content
   * @private
   */
  async _calculateHash(file) {
    const arrayBuffer = file instanceof Blob ? await file.arrayBuffer() : file.buffer;

    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Sanitize filename for storage
   * @private
   */
  _sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_")
      .toLowerCase();
  }

  // === LEGACY METHODS (kept for backward compatibility) ===

  /**
   * @deprecated Use findDuplicateByHash instead
   */
  async exists(contentHash) {
    const doc = await this.findDuplicateByHash(contentHash);
    return !!doc;
  }

  /**
   * @deprecated Not needed for Context Caching workflow
   */
  async logIngestion({
    filename,
    contentHash,
    publicUrl,
    geminiFileUri,
    ingestionMethod,
    metadata = {},
  }) {
    console.warn("[DocumentSources] logIngestion is deprecated. Use uploadDocument instead.");
  }

  /**
   * @deprecated Not applicable for Context Caching
   */
  async getPublicUrl(geminiFileUri) {
    console.warn("[DocumentSources] getPublicUrl by geminiFileUri is deprecated.");
    return null;
  }
}
