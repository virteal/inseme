/**
 * Creates an in-memory storage implementation that conforms to the StorageInterface.
 * @returns {StorageInterface} An in-memory storage object.
 */
export function createInMemoryStorage(ERROR_CODES) {
  const inMemoryData = {
    debugLogs: [],
    events: [],
    artifacts: [],
    agentIdentities: new Map(),
    tasks: new Map(),
    steps: new Map(),
    fileContent: new Map(),
  };

  const inMemoryStorage = {
    options: { type: "memory" },
    // Interfaces de métadonnées (CRUD)
    debugLogs: {
      async insert(logRecord) {
        inMemoryData.debugLogs.push(logRecord);
        return { ok: true };
      },
    },
    events: {
      async insert(eventRecord) {
        inMemoryData.events.push(eventRecord);
        return { ok: true, data: eventRecord };
      },
    },
    artifacts: {
      async insert(artifactRecord) {
        inMemoryData.artifacts.push(artifactRecord);
        return { ok: true, data: artifactRecord };
      },
      // Basic query support for cache / exploration reuse / retention GC
      async list(criteria = {}) {
        let results = inMemoryData.artifacts;
        if (criteria.cacheKey) {
          results = results.filter(
            (a) => a.cache_key === criteria.cacheKey || a.metadata?.cacheKey === criteria.cacheKey
          );
        }
        if (criteria.stabilityLevel) {
          results = results.filter(
            (a) =>
              a.stability_level === criteria.stabilityLevel ||
              a.metadata?.stability === criteria.stabilityLevel
          );
        }
        if (criteria.minStability) {
          // simplistic ordering: stable > provisional > transient
          const order = { stable: 3, provisional: 2, transient: 1 };
          results = results.filter(
            (a) =>
              (order[a.stability_level || a.metadata?.stability] || 0) >=
              (order[criteria.minStability] || 0)
          );
        }
        if (criteria.taskId) {
          results = results.filter((a) => a.task_id === criteria.taskId);
        }
        if (criteria.legalHold !== undefined) {
          results = results.filter((a) => !!a.legal_hold === !!criteria.legalHold);
        }
        if (criteria.retentionPolicyType) {
          results = results.filter(
            (a) => a.retention_policy?.type === criteria.retentionPolicyType
          );
        }
        return { ok: true, data: results };
      },
      async applyRetention(artifactId, action = "mark_superseded") {
        const art = inMemoryData.artifacts.find((a) => a.id === artifactId);
        if (!art) return { ok: false, error: "not found" };
        if (action === "mark_superseded") art.stability_level = "superseded";
        if (action === "apply_legal_hold") art.legal_hold = true;
        if (action === "lift_legal_hold") art.legal_hold = false;
        return { ok: true, data: art };
      },
    },

    agentIdentities: {
      async upsert(identity, conflictKey = "agent_name") {
        const existing = Array.from(inMemoryData.agentIdentities.values()).find(
          (a) => a[conflictKey] === identity[conflictKey]
        );
        if (existing) {
          Object.assign(existing, identity);
          inMemoryData.agentIdentities.set(existing.agent_id, existing);
          return { ok: true, data: existing };
        } else {
          const newIdentity = {
            ...identity,
            agent_id: identity.agent_id || `agent_${inMemoryData.agentIdentities.size + 1}`,
          };
          inMemoryData.agentIdentities.set(newIdentity.agent_id, newIdentity);
          return { ok: true, data: newIdentity };
        }
      },
      async getById(agent_id) {
        const identity = inMemoryData.agentIdentities.get(agent_id);
        return { ok: !!identity, data: identity || null };
      },
      async getByName(agent_name) {
        const identity = Array.from(inMemoryData.agentIdentities.values()).find(
          (a) => a.agent_name === agent_name
        );
        return { ok: !!identity, data: identity || null };
      },
      async list({ status, limit = 100 } = {}) {
        let identities = Array.from(inMemoryData.agentIdentities.values());
        if (status) {
          identities = identities.filter((a) => a.status === status);
        }
        return { ok: true, data: identities.slice(0, limit) };
      },
      async updateStatus(agent_id, status) {
        const identity = inMemoryData.agentIdentities.get(agent_id);
        if (identity) {
          identity.status = status;
          return { ok: true, data: identity };
        }
        return { ok: false, error: "Agent not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    tasks: {
      async upsert(taskRecord) {
        const newTask = {
          ...taskRecord,
          id: taskRecord.id || `task_${inMemoryData.tasks.size + 1}`,
        };
        newTask.version = (newTask.version || 0) + 1;
        inMemoryData.tasks.set(newTask.id, newTask);
        return { ok: true, data: newTask };
      },
      async get(taskId) {
        const task = inMemoryData.tasks.get(taskId);
        return { ok: !!task, data: task || null, error: task ? undefined : "Task not found" };
      },
      async list({ status, limit = 100 } = {}) {
        let tasks = Array.from(inMemoryData.tasks.values());
        if (status) {
          tasks = tasks.filter((j) => j.status === status);
        }
        return { ok: true, data: tasks.slice(0, limit) };
      },
      async update(taskId, patch) {
        const task = inMemoryData.tasks.get(taskId);
        if (task) {
          if (patch.version !== undefined && task.version !== patch.version) {
            return {
              ok: false,
              error: "Optimistic lock failed. Version mismatch.",
              code: ERROR_CODES.OPTIMISTIC_LOCK_FAIL,
            };
          }
          Object.assign(task, patch);
          task.version = (task.version || 0) + 1;
          return { ok: true, data: task };
        }
        return { ok: false, error: "Task not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    steps: {
      async upsert(stepRecord) {
        const newStep = {
          ...stepRecord,
          id: stepRecord.id || `step_${inMemoryData.steps.size + 1}`,
        };
        inMemoryData.steps.set(newStep.id, newStep);
        return { ok: true, data: newStep };
      },
      async listByTask(taskId) {
        const steps = Array.from(inMemoryData.steps.values()).filter((s) => s.task_id === taskId);
        return { ok: true, data: steps };
      },
      async update(taskId, stepId, patch) {
        const step = inMemoryData.steps.get(stepId);
        if (step && step.task_id === taskId) {
          Object.assign(step, patch);
          return { ok: true, data: step };
        }
        return { ok: false, error: "Step not found", code: ERROR_CODES.NOT_FOUND };
      },
      async get(stepId) {
        const step = inMemoryData.steps.get(stepId);
        return { ok: !!step, data: step || null, error: step ? undefined : "Step not found" };
      },
    },

    // Implémentation fileStorage In-Memory (Simulée)
    fileStorage: {
      defaultBucket: "cop-artifacts",

      async uploadArtifact(bucketName, path, fileBody, options = {}) {
        const key = `${bucketName || this.defaultBucket}/${path}`;
        inMemoryData.fileContent.set(key, fileBody);
        return { ok: true, data: { path } };
      },

      async downloadArtifact(bucketName, path) {
        const key = `${bucketName || this.defaultBucket}/${path}`;
        const data = inMemoryData.fileContent.get(key);
        if (!data) {
          return { ok: false, error: "Artifact not found in memory", code: ERROR_CODES.NOT_FOUND };
        }
        return { ok: true, data: data };
      },

      async getPublicUrl(bucketName, path) {
        const key = `${bucketName || this.defaultBucket}/${path}`;
        if (!inMemoryData.fileContent.has(key)) {
          return { ok: false, error: "Artifact not found", code: ERROR_CODES.NOT_FOUND };
        }
        return { ok: true, data: { url: `memory://fake-url/${key}` } };
      },
    },

    getCacheContents: () => ({
      agentIdentities: Array.from(inMemoryData.agentIdentities.entries()),
      tasks: Array.from(inMemoryData.tasks.entries()),
      steps: Array.from(inMemoryData.steps.entries()),
      debugLogs: inMemoryData.debugLogs,
      events: inMemoryData.events,
      artifacts: inMemoryData.artifacts,
    }),
    clearCache: () => {
      inMemoryData.agentIdentities.clear();
      inMemoryData.tasks.clear();
      inMemoryData.steps.clear();
      inMemoryData.debugLogs = [];
      inMemoryData.events = [];
      inMemoryData.artifacts = [];
      inMemoryData.fileContent.clear(); // Vide le stockage de fichiers
    },
    ERROR_CODES: ERROR_CODES,
  };

  return inMemoryStorage;
}
