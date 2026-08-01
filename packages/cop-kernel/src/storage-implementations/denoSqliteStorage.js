/* eslint-env deno */
/* global Deno */
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { SQLITE_SCHEMA, CURRENT_SCHEMA_VERSION, checkTableSchema } from "./sqliteSchema.js";

export function createDenoSqliteStorage(options) {
  const { ERROR_CODES } = options;
  let db;

  function initializeDb() {
    db = new DB("cop_kernel.db");
  }

  initializeDb();

  return {
    options: { type: "deno-sqlite" },
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
            [step.id, step.task_id, step.status, step.output]
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
            patch.output,
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
          error: "Artifacts not supported in Deno SQLite",
        };
      },
    },
    fileStorage: {
      async uploadArtifact() {
        return {
          ok: false,
          code: ERROR_CODES.DB_ERROR,
          error: "File storage not supported in Deno SQLite",
        };
      },
      async downloadArtifact() {
        return {
          ok: false,
          code: ERROR_CODES.NOT_FOUND,
          error: "File storage not supported in Deno SQLite",
        };
      },
      async getPublicUrl() {
        return {
          ok: false,
          code: ERROR_CODES.NOT_FOUND,
          error: "File storage not supported in Deno SQLite",
        };
      },
    },
    async clearCache() {
      // For SQLite, clearing cache means closing the database connection and re-initializing it
      db.close();
      try {
        Deno.removeSync("cop_kernel.db");
      } catch (error) {
        // Ignore if file does not exist
      }
      initializeDb();
      return { ok: true };
    },
    async close() {
      db.close();
      return { ok: true };
    },
  };
}
