import fs from "node:fs/promises";
import path from "node:path";
import { createAuditLogger } from "./auditLogger.js";

// Define ERROR_CODES for consistency
const ERROR_CODES = {
  NOT_FOUND: "STORAGE_NOT_FOUND",
  DB_ERROR: "STORAGE_DATABASE_ERROR", // Generic error for file operations
  CONFLICT: "STORAGE_CONFLICT_ERROR",
  OPTIMISTIC_LOCK_FAIL: "STORAGE_OPTIMISTIC_LOCK_FAILED",
};

export async function createFileBasedStorage(options = {}) {
  const {
    basePath: rawBasePath = "./file_storage_data",
    auditLogPath = "./audit_logs.jsonl",
    fs: injectedFs = fs,
    createAuditLogger: injectedCreateAuditLogger = createAuditLogger,
  } = options;
  const basePath = normalizePath(rawBasePath);
  const auditLogger = injectedCreateAuditLogger({ auditLogPath });

  function normalizePath(p) {
    return p.replace(/\\/g, "/");
  }

  // Ensure the base directory exists
  async function ensureDir(dirPath) {
    await injectedFs.mkdir(normalizePath(dirPath), { recursive: true });
  }

  // Helper to get file path for an entity
  function getEntityFilePath(entityType, id) {
    return normalizePath(path.posix.join(basePath, entityType, `${id}.json`));
  }

  function getAuditLogFilePath(logId) {
    return normalizePath(path.posix.join(basePath, "audit_logs", `${logId}.json`));
  }

  // Helper to read a JSON file
  async function readJsonFile(filePath) {
    try {
      const content = await injectedFs.readFile(normalizePath(filePath), "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null; // File not found
      }
      throw error;
    }
  }

  // Helper to write a JSON file
  async function writeJsonFile(filePath, data) {
    await ensureDir(normalizePath(path.dirname(filePath)));
    await injectedFs.writeFile(normalizePath(filePath), JSON.stringify(data, null, 2), "utf8");
  }

  // Helper to get index file path
  function getIndexFilePath(entityType, indexName) {
    return normalizePath(path.posix.join(basePath, `${entityType}_${indexName}_index.json`));
  }

  // Helper to read an index file
  async function readIndexFile(entityType, indexName) {
    const filePath = getIndexFilePath(entityType, indexName);
    try {
      const content = await injectedFs.readFile(normalizePath(filePath), "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {}; // Return empty object if index file not found
      }
      throw error;
    }
  }

  // Helper to write an index file
  async function writeIndexFile(entityType, indexName, indexData) {
    const filePath = getIndexFilePath(entityType, indexName);
    await ensureDir(normalizePath(path.dirname(filePath)));
    await injectedFs.writeFile(normalizePath(filePath), JSON.stringify(indexData, null, 2), "utf8");
  }

  // Initialize directories
  await ensureDir(normalizePath(path.posix.join(basePath, "agentIdentities")));
  await ensureDir(normalizePath(path.posix.join(basePath, "tasks")));
  await ensureDir(normalizePath(path.posix.join(basePath, "steps")));
  await ensureDir(normalizePath(path.posix.join(basePath, "events")));
  await ensureDir(normalizePath(path.posix.join(basePath, "debug_logs")));
  await ensureDir(normalizePath(path.posix.join(basePath, "audit_logs")));
  await ensureDir(normalizePath(path.posix.join(basePath, "artifacts")));

  // Implement the StorageInterface methods
  const fileBasedStorage = {
    options: { ...options, type: "file" },
    ERROR_CODES,

    // Metadata interfaces (simplified for file-based)
    debugLogs: {
      async insert(logRecord) {
        // For file-based, we might append to a log file or just return ok
        // For simplicity, let's just return ok for now.
        // A real implementation would write to a log file.
        return { ok: true };
      },
    },
    events: {
      async insert(eventRecord) {
        // Similar to debugLogs, for simplicity just return ok
        return { ok: true, event: eventRecord };
      },
    },
    artifacts: {
      async insert(artifactRecord) {
        // Similar to debugLogs, for simplicity just return ok
        return { ok: true, artifact: artifactRecord };
      },
    },

    agentIdentities: {
      async upsert(identity, conflictKey = "agent_name") {
        const filePath = getEntityFilePath("agentIdentities", identity.agent_id);
        await writeJsonFile(filePath, identity);

        // Update name index
        const nameIndex = await readIndexFile("agentIdentities", "name");
        nameIndex[identity.agent_name] = identity.agent_id;
        await writeIndexFile("agentIdentities", "name", nameIndex);

        await auditLogger.logEvent({
          eventType: "AgentIdentityUpserted",
          entityType: "agentIdentity",
          entityId: identity.agent_id,
          payload: identity,
        });
        return { ok: true, identity };
      },
      async getById(agent_id) {
        const filePath = getEntityFilePath("agentIdentities", agent_id);
        const identity = await readJsonFile(filePath);
        return { ok: !!identity, identity };
      },
      async getByName(agent_name) {
        const nameIndex = await readIndexFile("agentIdentities", "name");
        const agent_id = nameIndex[agent_name];
        if (agent_id) {
          return this.getById(agent_id);
        }
        return { ok: false, error: "Agent not found", code: ERROR_CODES.NOT_FOUND };
      },
      async list({ status, limit = 100 } = {}) {
        const dirPath = normalizePath(path.posix.join(basePath, "agentIdentities"));
        await ensureDir(dirPath);
        const files = await injectedFs.readdir(dirPath);
        let identities = [];
        for (const file of files) {
          const identity = await readJsonFile(normalizePath(path.posix.join(dirPath, file)));
          if (identity) {
            identities.push(identity);
          }
        }
        if (status) {
          identities = identities.filter((a) => a.status === status);
        }
        return { ok: true, identities: identities.slice(0, limit) };
      },
      async updateStatus(agent_id, status) {
        const filePath = getEntityFilePath("agentIdentities", agent_id);
        const identity = await readJsonFile(filePath);
        if (identity) {
          const oldStatus = identity.status;
          identity.status = status;
          await writeJsonFile(filePath, identity);
          await auditLogger.logEvent({
            eventType: "AgentIdentityStatusUpdated",
            entityType: "agentIdentity",
            entityId: agent_id,
            payload: { oldStatus, newStatus: status },
          });
          return { ok: true, identity };
        }
        return { ok: false, error: "Agent not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    tasks: {
      async upsert(taskRecord) {
        const newTask = { ...taskRecord, id: taskRecord.id || `task_${Date.now()}` };
        newTask.version = (newTask.version || 0) + 1;
        const filePath = getEntityFilePath("tasks", newTask.id);
        await writeJsonFile(filePath, newTask);
        await auditLogger.logEvent({
          eventType: "TaskUpserted",
          entityType: "task",
          entityId: newTask.id,
          payload: newTask,
        });
        return { ok: true, task: newTask };
      },
      async get(taskId) {
        const filePath = getEntityFilePath("tasks", taskId);
        const task = await readJsonFile(filePath);
        return { ok: !!task, task };
      },
      async list({ status, limit = 100 } = {}) {
        const dirPath = normalizePath(path.posix.join(basePath, "tasks"));
        await ensureDir(dirPath);
        const files = await injectedFs.readdir(dirPath);
        let tasks = [];
        for (const file of files) {
          const task = await readJsonFile(normalizePath(path.posix.join(dirPath, file)));
          if (task) {
            tasks.push(task);
          }
        }
        if (status) {
          tasks = tasks.filter((j) => j.status === status);
        }
        return { ok: true, tasks: tasks.slice(0, limit) };
      },
      async update(taskId, patch) {
        const filePath = getEntityFilePath("tasks", taskId);
        const existingTask = await readJsonFile(filePath);

        if (!existingTask) {
          return { ok: false, code: ERROR_CODES.NOT_FOUND };
        }

        // Optimistic locking check
        if (patch.version !== undefined && existingTask.version !== patch.version) {
          return { ok: false, code: ERROR_CODES.OPTIMISTIC_LOCK_FAIL };
        }

        const updatedTask = { ...existingTask, ...patch, version: existingTask.version + 1 };
        await writeJsonFile(filePath, updatedTask);

        console.log("Logging TaskUpdated event:", { taskId, patch, newTask: updatedTask }); // Debug log
        await auditLogger.logEvent({
          eventType: "TaskUpdated",
          entityType: "task",
          entityId: taskId,
          payload: { patch, newTask: updatedTask },
        });

        return { ok: true, task: updatedTask };
      },
    },

    steps: {
      async upsert(stepRecord) {
        const newStep = {
          ...stepRecord,
          id: stepRecord.id || `step_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        };
        const filePath = getEntityFilePath("steps", newStep.id);
        await writeJsonFile(filePath, newStep);
        await auditLogger.logEvent({
          eventType: "StepUpserted",
          entityType: "step",
          entityId: newStep.id,
          payload: newStep,
        });
        return { ok: true, step: newStep };
      },
      async listByTask(taskId, { limit = 100 } = {}) {
        const dirPath = normalizePath(path.posix.join(basePath, "steps"));
        await ensureDir(dirPath);
        const files = await injectedFs.readdir(dirPath);
        let steps = [];
        for (const file of files) {
          const step = await readJsonFile(normalizePath(path.posix.join(dirPath, file)));
          if (step && step.task_id === taskId) {
            steps.push(step);
          }
        }
        return { ok: true, steps: steps.slice(0, limit) };
      },
      async update(taskId, stepId, patch) {
        const filePath = getEntityFilePath("steps", stepId);
        const existingStep = await readJsonFile(filePath);

        if (!existingStep || existingStep.task_id !== taskId) {
          return { ok: false, code: ERROR_CODES.NOT_FOUND };
        }

        const updatedStep = { ...existingStep, ...patch };
        await writeJsonFile(filePath, updatedStep);

        console.log("Logging StepUpdated event:", { taskId, stepId, patch, newStep: updatedStep }); // Debug log
        await auditLogger.logEvent({
          eventType: "StepUpdated",
          entityType: "step",
          entityId: stepId,
          payload: { patch, newStep: updatedStep },
        });

        return { ok: true, step: updatedStep };
      },
      async get(stepId) {
        const filePath = getEntityFilePath("steps", stepId);
        const step = await readJsonFile(filePath);
        return { ok: !!step, step };
      },
    },

    fileStorage: {
      defaultBucket: "cop-artifacts",

      async uploadArtifact(bucketName, filePath, fileBody, options = {}) {
        const fullPath = normalizePath(
          path.posix.join(basePath, "artifacts", bucketName, filePath)
        );
        await ensureDir(normalizePath(path.dirname(fullPath)));
        await injectedFs.writeFile(fullPath, fileBody, "utf8");
        return { ok: true, path: fullPath };
      },

      async downloadArtifact(bucketName, filePath) {
        const fullPath = normalizePath(
          path.posix.join(basePath, "artifacts", bucketName, filePath)
        );
        try {
          const data = await injectedFs.readFile(fullPath, "utf8");
          return { ok: true, data };
        } catch (error) {
          if (error.code === "ENOENT") {
            return { ok: false, error: "Artifact not found", code: ERROR_CODES.NOT_FOUND };
          }
          throw error;
        }
      },

      async getPublicUrl(bucketName, filePath) {
        const fullPath = normalizePath(
          path.posix.join(basePath, "artifacts", bucketName, filePath)
        );
        try {
          await injectedFs.access(fullPath); // Check if file exists
          return { ok: true, url: `file://${fullPath}` };
        } catch (error) {
          if (error.code === "ENOENT") {
            return { ok: false, error: "Artifact not found", code: ERROR_CODES.NOT_FOUND };
          }
          throw error;
        }
      },
    },

    // No direct cache contents for file-based, as it's always reading from disk.
    // But we can provide a way to "clear" the storage (delete all files).
    clearCache: async () => {
      // This is a destructive operation, use with caution.
      // For testing, it's fine.
      try {
        await injectedFs.rm(basePath, { recursive: true, force: true });
        // Also remove index files
        await injectedFs.unlink(getIndexFilePath("agentIdentities", "name")).catch(() => {}); // Ignore if file doesn't exist
        await ensureDir(basePath); // Recreate base directory
      } catch (error) {
        // Ignore if directory doesn't exist
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    },

    getCacheContents: () => {
      return {
        agentIdentities: [],
        tasks: [],
        steps: [],
      };
    },
  };

  return fileBasedStorage;
}
