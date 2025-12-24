import sqlite3 from "sqlite3";
import { open } from "sqlite";

export class NodeSqliteConnection {
  constructor(db) {
    this.db = db;
  }

  async run(sql, params) {
    const result = await this.db.run(sql, params);
    return { rowsAffected: result.changes, lastInsertId: result.lastID };
  }

  async get(sql, params) {
    return this.db.get(sql, params);
  }

  async all(sql, params) {
    return this.db.all(sql, params);
  }

  async exec(sql) {
    await this.db.exec(sql);
  }

  async close() {
    await this.db.close();
  }

  async transaction(callback) {
    await this.db.run("BEGIN TRANSACTION");
    try {
      const trx = {
        run: (sql, params) =>
          this.db
            .run(sql, params)
            .then((res) => ({ rowsAffected: res.changes, lastInsertId: res.lastID })),
        get: (sql, params) => this.db.get(sql, params),
        all: (sql, params) => this.db.all(sql, params),
        exec: (sql) => this.db.exec(sql),
        beginTransaction: () => Promise.resolve(), // Already in a transaction
        commit: () => this.db.run("COMMIT"),
        rollback: () => this.db.run("ROLLBACK"),
        close: () => Promise.resolve(), // Connection managed by the transaction
      };
      const result = await callback(trx);
      await this.db.run("COMMIT");
      return result;
    } catch (error) {
      await this.db.run("ROLLBACK");
      throw error;
    }
  }
}

export async function createNodeSqliteConnection(config, sqliteModule, sqlite3Module) {
  const Sqlite = sqliteModule || { open };
  const Sqlite3 = sqlite3Module || { Database: sqlite3.Database };
  const db = await Sqlite.open({
    filename: config.uri,
    driver: Sqlite3.Database,
  });
  return new NodeSqliteConnection(db);
}
