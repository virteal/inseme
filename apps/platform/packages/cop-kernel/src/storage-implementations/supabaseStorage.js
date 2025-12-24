import { createClient } from "@supabase/supabase-js";
import { createInMemoryStorage } from "./inMemoryStorage.js"; // Pour les fallbacks simulés

// --- DÉFINITIONS DES ERREURS STANDARDISÉES ---
const ERROR_CODES = {
  NOT_FOUND: "STORAGE_NOT_FOUND",
  DB_ERROR: "STORAGE_DATABASE_ERROR",
  CONFLICT: "STORAGE_CONFLICT_ERROR",
  OPTIMISTIC_LOCK_FAIL: "STORAGE_OPTIMISTIC_LOCK_FAILED",
};

/**
 * Crée une implémentation de stockage basée sur Supabase qui est conforme à la StorageInterface.
 * Gère le cache, le versionnement optimiste et Supabase Storage.
 * @param {object} options - Options de configuration.
 * @param {string} [options.syncMode='none'] - Mode de synchronisation.
 * @param {boolean} [options.debugMode=false] - Active le mode debug.
 * @param {object} [options.supabaseClient] - Client Supabase pré-initialisé.
 * @param {string} [options.supabaseUrl] - URL de Supabase.
 * @param {string} [options.supabaseServiceKey] - Clé de service Supabase.
 * @returns {StorageInterface} Un objet de stockage Supabase.
 */
export function createSupabaseStorage(options = {}) {
  const {
    syncMode = "none",
    debugMode = false,
    supabaseClient: opt_client,
    supabaseUrl: url,
    supabaseServiceKey: key,
  } = options;
  let currentSyncMode = syncMode;
  let currentDebugMode = debugMode;

  const logOperation = (type, operation, details = {}) => {
    if (currentDebugMode) {
      console.log(`[Storage Debug] ${type}: ${operation}`, details);
    }
  };

  if (!opt_client) {
    if (!url || !key) {
      throw new Error(
        "COP.createSupabaseStorage: 'supabaseUrl' or 'supabaseServiceKey' not set for Supabase type."
      );
    }
  }
  const client = opt_client || createClient(url, key);

  // Caches for frequently accessed data
  const agentIdentitiesCache = new Map();
  const tasksCache = new Map();
  const stepsCache = new Map();

  const flushAllCaches = () => {
    agentIdentitiesCache.clear();
    tasksCache.clear();
    stepsCache.clear();
  };

  // Fonctions utilitaires (omises pour concision ici, mais existantes)
  const areObjectsEqual = (obj1, obj2) => {
    /* ... */ return true;
  }; // TODO: Implémenter ou importer
  const debugLogs = {
    async insert(logRecord) {
      try {
        const { error } = await client.debugLogs.insert(logRecord);
        if (error) {
          console.error("[FATAL LOG ERROR] Failed to insert debug log:", error.message, logRecord);
          return { ok: false, error: error.message };
        }
        return { ok: true };
      } catch (e) {
        console.error(
          "[CRITICAL LOG ERROR] Exception during debug log insertion:",
          e.message,
          logRecord
        );
        return { ok: false, error: e.message };
      }
    },
  };

  // Logic pour exécuter les opérations DB (avec gestion des erreurs/logs)
  const executeStorageOperation = async (type, operation, dbOperation, details = {}) => {
    try {
      logOperation(type, operation, details);
      const response = await dbOperation();
      const { data, error, status } = response;
      if (error) {
        await debugLogs.insert({
          level: "error",
          message: `[DB Error] ${operation} failed: ${error.message}`,
          context: {
            error: { code: error.code, message: error.message, hint: error.hint },
            details,
            status,
          },
        });
        return { ok: false, error: error.message, code: ERROR_CODES.DB_ERROR };
      }
      if (type === "Write") {
        flushAllCaches();
      }
      return { ok: true, data };
    } catch (e) {
      await debugLogs.insert({
        level: "fatal",
        message: `[Fatal Exception] ${operation} execution failed: ${e.message}`,
        context: { error: e.stack, details },
      });
      return { ok: false, error: e.message, code: ERROR_CODES.DB_ERROR };
    }
  };

  // Fonctions d'abstraction CRUD (handleReadSingle, handleUpsert, handleUpdate)
  const handleReadSingle = async (tableName, id, cache, operationName, idKey = "id") => {
    if (cache && cache.has(id)) {
      return { ok: true, data: cache.get(id) };
    }

    const result = await executeStorageOperation(
      "Read",
      operationName,
      async () => {
        const response = await client.from(tableName).select().eq(idKey, id).maybeSingle();
        if (response.error) throw response.error;
        if (response.data && cache) {
          cache.set(id, response.data);
        }
        return response; // Return full response
      },
      { tableName, id, idKey }
    );
    return result;
  };
  const handleUpsert = async (
    tableName,
    record,
    cache,
    operationName,
    idKey,
    conflictKey = idKey
  ) => {
    const result = await executeStorageOperation(
      "Write",
      operationName,
      async () => {
        const response = await client
          .from(tableName)
          .upsert(record, { onConflict: conflictKey })
          .select()
          .maybeSingle();
        if (response.error) throw response.error;
        if (response.data && cache) {
          cache.set(response.data[idKey], response.data);
        }
        return response; // Return full response
      },
      { tableName, record, idKey, conflictKey }
    );
    return result;
  };
  const handleUpdate = async (
    tableName,
    id,
    patch,
    cache,
    operationName,
    idKey = "id",
    versionKey = "version"
  ) => {
    const result = await executeStorageOperation(
      "Write",
      operationName,
      async () => {
        const { data: existingRecord, error: readError } = await client
          .from(tableName)
          .select(versionKey)
          .eq(idKey, id)
          .maybeSingle();
        console.log(
          `[handleUpdate] existingRecord for ${tableName} (id: ${id}, idKey: ${idKey}, versionKey: ${versionKey}):`,
          existingRecord
        );
        if (readError) throw readError;
        if (!existingRecord) {
          console.log(`[handleUpdate] No existing record found for ${tableName} (id: ${id})`);
          throw new Error(ERROR_CODES.NOT_FOUND);
        }
        if (patch[versionKey] && existingRecord[versionKey] !== patch[versionKey]) {
          console.log(
            `[handleUpdate] Optimistic lock failed for ${tableName} (id: ${id}). Existing version: ${existingRecord[versionKey]}, Patch version: ${patch[versionKey]}`
          );
          throw new Error(ERROR_CODES.OPTIMISTIC_LOCK_FAIL);
        }

        const response = await client.from(tableName).update(patch).eq(idKey, id).select().single();
        console.log(`[handleUpdate] Update response for ${tableName} (id: ${id}):`, response);
        if (response.error) throw response.error;
        if (cache) {
          cache.set(response.data[idKey], response.data);
        }
        return response; // Return full response
      },
      { tableName, id, patch, idKey, versionKey }
    );
    return result;
  };

  // Définition des interfaces CRUD (Agent, Tasks, Steps)
  const events = {
    async insert(eventRecord) {
      return executeStorageOperation("Write", "events.insert", async () => {
        const response = await client.from("cop_events").insert(eventRecord).select().maybeSingle();
        if (response.error) throw response.error;
        return response; // Return full response
      });
    },
  };
  const artifacts = {
    async insert(artifactRecord) {
      return executeStorageOperation("Write", "artifacts.insert", async () => {
        const response = await client
          .from("cop_artifacts")
          .insert(artifactRecord)
          .select()
          .maybeSingle();
        if (response.error) throw response.error;
        return response; // Return full response
      });
    },
  };
  const agentIdentities = {
    async upsert(identity) {
      const result = await handleUpsert(
        "cop_agent_identities",
        identity,
        agentIdentitiesCache,
        "agentIdentities.upsert",
        "agent_id",
        "agent_id"
      );
      return result;
    },
    async getById(agent_id) {
      const result = await handleReadSingle(
        "cop_agent_identities",
        agent_id,
        agentIdentitiesCache,
        "agentIdentities.getById",
        "agent_id"
      );
      return result;
    },
    async getByName(agent_name) {
      const result = await executeStorageOperation(
        "Read",
        "agentIdentities.getByName",
        async () => {
          const response = await client
            .from("cop_agent_identities")
            .select()
            .eq("agent_name", agent_name)
            .maybeSingle();
          if (response.error) throw response.error;
          if (response.data) {
            agentIdentitiesCache.set(response.data.agent_id, response.data);
          }
          return response; // Return full response
        },
        { agent_name }
      );
      return result;
    },
    async list({ status, limit = 100 } = {}) {
      const result = await executeStorageOperation(
        "Read",
        "agentIdentities.list",
        async () => {
          let query = client.from("cop_agent_identities").select();
          if (status) {
            query = query.eq("status", status);
          }
          query = query.limit(limit);
          const response = await query;
          if (response.error) throw response.error;
          (response.data || []).forEach((identity) =>
            agentIdentitiesCache.set(identity.agent_id, identity)
          );
          return response; // Return full response
        },
        { status, limit }
      );
      return result;
    },
    async updateStatus(agent_id, status) {
      const result = await handleUpdate(
        "cop_agent_identities",
        agent_id,
        { status },
        agentIdentitiesCache,
        "agentIdentities.updateStatus",
        "agent_id"
      );
      return result;
    },
  };
  const tasks = {
    async upsert(taskRecord) {
      const result = await handleUpsert(
        "cop_tasks",
        taskRecord,
        tasksCache,
        "tasks.upsert",
        "id",
        "id"
      );
      return result;
    },
    async update(taskId, patch) {
      const result = await handleUpdate(
        "cop_tasks",
        taskId,
        patch,
        tasksCache,
        "tasks.update",
        "id",
        "version"
      );
      return result;
    },
    async get(taskId) {
      const result = await handleReadSingle("cop_tasks", taskId, tasksCache, "tasks.get", "id");
      return result;
    },
    async list({ status, limit = 100 } = {}) {
      const result = await executeStorageOperation(
        "Read",
        "tasks.list",
        async () => {
          let query = client.from("cop_tasks").select();
          if (status) {
            query = query.eq("status", status);
          }
          query = query.limit(limit);
          const response = await query;
          if (response.error) throw response.error;
          (response.data || []).forEach((task) => tasksCache.set(task.id, task));
          return response; // Return full response
        },
        { status, limit }
      );
      return result;
    },
  };
  const steps = {
    async upsert(stepRecord) {
      const result = await handleUpsert(
        "cop_steps",
        stepRecord,
        stepsCache,
        "steps.upsert",
        "id",
        "id"
      );
      return result;
    },
    async listByTask(taskId) {
      const result = await executeStorageOperation(
        "Read",
        "steps.listByTask",
        async () => {
          const response = await client.from("cop_steps").select().eq("task_id", taskId);
          if (response.error) throw response.error;
          if (!response.data) return { data: [] }; // Return full response with empty data
          (response.data || []).forEach((step) => stepsCache.set(step.id, step));
          return response; // Return full response
        },
        { taskId }
      );
      return result;
    },
    async update(taskId, stepId, patch) {
      const result = await handleUpdate(
        "cop_steps",
        stepId,
        patch,
        stepsCache,
        "steps.update",
        "id"
      );
      return result;
    },
    async get(stepId) {
      const result = await handleReadSingle("cop_steps", stepId, stepsCache, "steps.get", "id");
      return result;
    },
  };

  // Implémentation fileStorage Supabase Storage Buckets
  const fileStorage = {
    defaultBucket: "cop-artifacts",

    async uploadArtifact(bucketName, path, fileBody, options = {}) {
      const bucket = bucketName || this.defaultBucket;
      return executeStorageOperation(
        "Write",
        "fileStorage.uploadArtifact",
        async () => {
          const { data, error } = await client.storage.from(bucket).upload(path, fileBody, options);
          if (error) throw error;
          return { data: { path: data.path } }; // Return full response
        },
        { bucket, path, options }
      );
    },

    async downloadArtifact(bucketName, path) {
      const bucket = bucketName || this.defaultBucket;
      return executeStorageOperation(
        "Read",
        "fileStorage.downloadArtifact",
        async () => {
          const { data, error } = await client.storage.from(bucket).download(path);
          if (error) throw error;
          return { data: data }; // Return full response
        },
        { bucket, path }
      );
    },

    async getPublicUrl(bucketName, path) {
      const bucket = bucketName || this.defaultBucket;
      try {
        const { data, error } = client.storage.from(bucket).getPublicUrl(path);
        if (error) throw error;

        if (!data || !data.publicUrl) {
          throw new Error("Public URL could not be generated, check bucket policies.");
        }
        return { ok: true, data: { url: data.publicUrl } }; // Return full response
      } catch (e) {
        return { ok: false, error: e.message, code: ERROR_CODES.DB_ERROR };
      }
    },
  };

  const supabaseStorage = {
    options: { ...options, type: "supabase" },
    debugLogs,
    events,
    artifacts,
    agentIdentities,
    tasks,
    steps,
    fileStorage, // EXPOSÉ
    getCacheContents: () => ({
      agentIdentities: Array.from(agentIdentitiesCache.values()),
      tasks: Array.from(tasksCache.values()),
      steps: Array.from(stepsCache.values()),
    }),
    clearCache: () => {
      flushAllCaches();
    },
    ERROR_CODES,
  };

  options.storage = supabaseStorage;
  return supabaseStorage;
}
