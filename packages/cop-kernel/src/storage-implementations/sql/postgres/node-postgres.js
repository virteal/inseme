import pg from "pg";

export class NodePostgresConnection {
  constructor(config, pgModule, pgPool) {
    const Pg = pgModule || pg;
    this.pool = pgPool || new Pg.Pool(config);
  }

  async run(sql, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return { rowsAffected: result.rowCount, lastInsertId: undefined }; // PostgreSQL doesn't have a direct lastInsertId like SQLite
    } finally {
      client.release();
    }
  }

  async get(sql, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async all(sql, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async exec(sql) {
    const client = await this.pool.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const trx = {
        run: (sql, params) =>
          client
            .query(sql, params)
            .then((res) => ({ rowsAffected: res.rowCount, lastInsertId: undefined })),
        get: (sql, params) => client.query(sql, params).then((res) => res.rows[0]),
        all: (sql, params) => client.query(sql, params).then((res) => res.rows),
        exec: (sql) => client.query(sql),
        beginTransaction: () => Promise.resolve(), // Already in a transaction
        commit: () => client.query("COMMIT"),
        rollback: () => client.query("ROLLBACK"),
        close: () => Promise.resolve(), // Connection managed by the transaction
      };
      const result = await callback(trx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function createNodePostgresConnection(config, pgModule, pgPool) {
  return new NodePostgresConnection(config, pgModule, pgPool);
}
