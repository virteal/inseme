let mysqlModulePromise;

if (global.mockMysql2) {
  mysqlModulePromise = Promise.resolve(global.mockMysql2);
} else {
  mysqlModulePromise = import("mysql2/promise").then((m) => m.default);
}

export class NodeMySQLConnection {
  constructor(config, mysql) {
    this.pool = mysql.createPool(config);
  }

  async run(sql, params) {
    const [result] = await this.pool.execute(sql, params);
    return { rowsAffected: result.affectedRows, lastInsertId: result.insertId };
  }

  async get(sql, params) {
    const [rows] = await this.pool.execute(sql, params);
    return rows[0];
  }

  async all(sql, params) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  async exec(sql) {
    await this.pool.execute(sql);
  }

  async close() {
    await this.pool.end();
  }

  async transaction(callback) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const trx = {
        run: (sql, params) =>
          connection.execute(sql, params).then(([result]) => ({
            rowsAffected: result.affectedRows,
            lastInsertId: result.insertId,
          })),
        get: (sql, params) => connection.execute(sql, params).then(([rows]) => rows[0]),
        all: (sql, params) => connection.execute(sql, params).then(([rows]) => rows),
        exec: (sql) => connection.execute(sql),
        beginTransaction: () => Promise.resolve(),
        commit: () => connection.commit(),
        rollback: () => connection.rollback(),
        close: () => connection.release(),
        _mockConnection: connection, // Expose for testing
      };
      const result = await callback(trx);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export async function createNodeMySQLConnection(config) {
  const mysql = await mysqlModulePromise;
  return new NodeMySQLConnection(config, mysql);
}
