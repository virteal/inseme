import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { SQLITE_SCHEMA, CURRENT_SCHEMA_VERSION, checkTableSchema } from "./sqliteSchema.js";

export function createBrowserSqliteStorage(options) {
  const { ERROR_CODES, dbName = "cop_kernel_browser.db" } = options;
  let db;

  function initializeDb() {
    // In browser, SQLite will typically be in-memory or use IndexedDB for persistence
    // Persistent database via IndexedDB
    db = new DB(dbName);

    // Gestion du versionnement du schéma
    db.query(SQLITE_SCHEMA.schemaVersion);

    // Vérifier la version actuelle du schéma
    const [currentVersionRow] = db.query(
      `SELECT version FROM schema_version ORDER BY version DESC LIMIT 1`
    );
    const currentDbVersion = currentVersionRow ? currentVersionRow[0] : 0;

    if (currentDbVersion < CURRENT_SCHEMA_VERSION) {
      // Appliquer le schéma centralisé
      db.query(SQLITE_SCHEMA.logicalAgents);
      db.query(SQLITE_SCHEMA.tasks);
      db.query(SQLITE_SCHEMA.steps);
      db.query(SQLITE_SCHEMA.debugLogs);
      db.query(SQLITE_SCHEMA.events);

      // Mettre à jour la version du schéma
      db.query(`INSERT INTO schema_version (version, applied_at) VALUES (?, ?)`, [
        CURRENT_SCHEMA_VERSION,
        new Date().toISOString(),
      ]);
    }

    // Vérifier les schémas des tables
    checkTableSchema(db, "logicalAgents", ["logical_agent_id", "logical_agent_name", "status"]);
    checkTableSchema(db, "tasks", ["id", "status", "version"]);
    checkTableSchema(db, "steps", ["id", "task_id", "status", "output"]);
    checkTableSchema(db, "debugLogs", ["id", "message", "level", "timestamp"]);
    checkTableSchema(db, "events", ["id", "type", "payload", "timestamp"]);

    // Artifacts and fileStorage are not supported in this implementation
  }

  initializeDb();

  return {
    options: { type: "browser-sqlite" },
    logicalAgents: {
      async upsert(identity) {
        try {
          db.query(
            `INSERT INTO logicalAgents (logical_agent_id, logical_agent_name, status) VALUES (?, ?, ?) ON CONFLICT(logical_agent_id) DO UPDATE SET logical_agent_name = EXCLUDED.logical_agent_name, status = EXCLUDED.status`,
            [identity.logical_agent_id, identity.logical_agent_name, identity.status]
          );
          return { ok: true, identity };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async getById(logical_agent_id) {
        try {
          const [row] = db.query(`SELECT * FROM logicalAgents WHERE logical_agent_id = ?`, [logical_agent_id]);
          if (row) {
            const identity = { logical_agent_id: row[0], logical_agent_name: row[1], status: row[2] };
            return { ok: true, identity };
          } else {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async getByName(logical_agent_name) {
        try {
          const [row] = db.query(`SELECT * FROM logicalAgents WHERE logical_agent_name = ?`, [
            logical_agent_name,
          ]);
          if (row) {
            const identity = { logical_agent_id: row[0], logical_agent_name: row[1], status: row[2] };
            return { ok: true, identity };
          } else {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async list() {
        try {
          const rows = db.query(`SELECT * FROM logicalAgents`);
          const identities = rows.map((row) => ({
            logical_agent_id: row[0],
            logical_agent_name: row[1],
            status: row[2],
          }));
          return { ok: true, identities };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async updateStatus(logical_agent_id, status) {
        try {
          db.query(`UPDATE logicalAgents SET status = ? WHERE logical_agent_id = ?`, [status, logical_agent_id]);
          const { identity } = await this.getById(logical_agent_id);
          return { ok: true, identity };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    tasks: {
      async upsert(task) {
        try {
          const currentTask = await this.get(task.id);
          let newVersion = 1;
          if (currentTask.ok) {
            newVersion = currentTask.task.version + 1;
          }
          db.query(
            `INSERT INTO tasks (id, status, version) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = EXCLUDED.status, version = EXCLUDED.version`,
            [task.id, task.status, newVersion]
          );
          return { ok: true, task: { ...task, version: newVersion } };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async get(id) {
        try {
          const [row] = db.query(`SELECT * FROM tasks WHERE id = ?`, [id]);
          if (row) {
            const task = { id: row[0], status: row[1], version: row[2] };
            return { ok: true, task };
          } else {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async list() {
        try {
          const rows = db.query(`SELECT * FROM tasks`);
          const tasks = rows.map((row) => ({ id: row[0], status: row[1], version: row[2] }));
          return { ok: true, tasks };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async update(id, patch) {
        try {
          const currentTask = await this.get(id);
          if (!currentTask.ok) {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
          if (currentTask.task.version !== patch.version) {
            return { ok: false, code: ERROR_CODES.OPTIMISTIC_LOCK_FAIL };
          }
          const newVersion = currentTask.task.version + 1;
          db.query(`UPDATE tasks SET status = ?, version = ? WHERE id = ? AND version = ?`, [
            patch.status,
            newVersion,
            id,
            patch.version,
          ]);
          const { task } = await this.get(id);
          return { ok: true, task };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    steps: {
      async upsert(step) {
        try {
          db.query(
            `INSERT INTO steps (id, task_id, status, output) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET task_id = EXCLUDED.task_id, status = EXCLUDED.status, output = EXCLUDED.output`,
            [step.id, step.task_id, step.status, step.output || null]
          );
          return { ok: true, step };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async listByTask(task_id) {
        try {
          const rows = db.query(`SELECT * FROM steps WHERE task_id = ?`, [task_id]);
          const steps = rows.map((row) => ({
            id: row[0],
            task_id: row[1],
            status: row[2],
            output: row[3],
          }));
          return { ok: true, steps };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async update(task_id, step_id, patch) {
        try {
          db.query(`UPDATE steps SET status = ?, output = ? WHERE task_id = ? AND id = ?`, [
            patch.status,
            patch.output || null,
            task_id,
            step_id,
          ]);
          const [row] = db.query(`SELECT * FROM steps WHERE task_id = ? AND id = ?`, [
            task_id,
            step_id,
          ]);
          if (row) {
            const step = { id: row[0], task_id: row[1], status: row[2], output: row[3] };
            return { ok: true, step };
          } else {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    debugLogs: {
      async insert(log) {
        try {
          db.query(`INSERT INTO debugLogs (message, level, timestamp) VALUES (?, ?, ?)`, [
            log.message,
            log.level,
            new Date().toISOString(),
          ]);
          return { ok: true };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    events: {
      async insert(event) {
        try {
          db.query(`INSERT INTO events (type, payload, timestamp) VALUES (?, ?, ?)`, [
            event.type,
            JSON.stringify(event.payload),
            new Date().toISOString(),
          ]);
          return { ok: true, event };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    artifacts: {
      async insert() {
        return {
          ok: false,
          code: ERROR_CODES.DB_ERROR,
          error: "Artifacts not supported in Browser SQLite",
        };
      },
    },
    fileStorage: {
      async uploadArtifact() {
        return {
          ok: false,
          code: ERROR_CODES.DB_ERROR,
          error: "File storage not supported in Browser SQLite",
        };
      },
      async downloadArtifact() {
        return {
          ok: false,
          code: ERROR_CODES.NOT_FOUND,
          error: "File storage not supported in Browser SQLite",
        };
      },
      async getPublicUrl() {
        return {
          ok: false,
          code: ERROR_CODES.NOT_FOUND,
          error: "File storage not supported in Browser SQLite",
        };
      },
    },
    async clearCache() {
      // For SQLite, clearing cache means truncating all tables
      db.query(`DELETE FROM logicalAgents`);
      db.query(`DELETE FROM tasks`);
      db.query(`DELETE FROM steps`);
      db.query(`DELETE FROM debugLogs`);
      db.query(`DELETE FROM events`);
      return { ok: true };
    },
    async close() {
      db.close();
      return { ok: true };
    },
  };
}
