import assert from "node:assert";
import { test } from "node:test";
import { createNodePostgresConnection } from "../../postgres/node-postgres.js";

// Mock the 'pg' client
class MockPgClient {
  constructor() {
    this.calls = { query: [], connect: [], end: [], release: [] };
    this.results = {};
  }

  async connect() {
    this.calls.connect.push({});
    return this;
  }

  async query(sql, params) {
    this.calls.query.push({ sql, params });
    if (this.results[sql]) {
      return this.results[sql];
    }
    // Default mock results for common operations
    if (sql.startsWith("INSERT") || sql.startsWith("UPDATE") || sql.startsWith("DELETE")) {
      return { rowCount: 1, rows: [{ id: 1 }] }; // Simulate affected rows and last insert ID
    }
    if (sql.startsWith("SELECT") && !sql.includes("LIMIT 1")) {
      return {
        rows: [
          { id: 1, name: "test" },
          { id: 2, name: "test2" },
        ],
      }; // Simulate multiple rows for 'all'
    }
    if (sql.startsWith("SELECT") && sql.includes("LIMIT 1")) {
      return { rows: [{ id: 1, name: "test" }] }; // Simulate single row for 'get'
    }
    return { rows: [] };
  }

  async end() {
    this.calls.end.push({});
  }

  release() {
    // Simulate client release
    this.calls.release.push({});
  }

  // Mock for transaction methods
  async begin() {
    this.calls.query.push({ sql: "BEGIN" });
  }

  async commit() {
    this.calls.query.push({ sql: "COMMIT" });
  }
  async rollback() {
    this.calls.query.push({ sql: "ROLLBACK" });
  }
}

class MockPgPool {
  constructor() {
    this.client = new MockPgClient();
  }
  async connect() {
    return this.client;
  }
  async query(sql, params) {
    return this.client.query(sql, params);
  }
  async end() {
    return this.client.end();
  }
}

class MockPgModule {
  constructor() {
    this.Pool = MockPgPool;
  }
}

test("NodePostgresConnection", async (t) => {
  let connection;
  let mockClient;
  let mockPgPool;
  let mockPgModule;

  t.beforeEach(async () => {
    mockPgModule = new MockPgModule();
    mockPgPool = new mockPgModule.Pool();
    connection = await createNodePostgresConnection(
      { connectionString: "postgres://user:password@host:port/database" },
      mockPgModule,
      mockPgPool
    );
    mockClient = mockPgPool.client; // Access the mocked client
    mockClient.calls = { query: [], connect: [], end: [], release: [] }; // Reset calls for each test
  });

  await t.test("should execute run operations", async () => {
    const sql = "INSERT INTO users (name) VALUES ($1)";
    const params = ["John Doe"];
    const result = await connection.run(sql, params);
    assert.strictEqual(mockClient.calls.query.length, 1);
    assert.deepStrictEqual(mockClient.calls.query[0], { sql, params });
    assert.strictEqual(result.rowsAffected, 1);
    assert.strictEqual(result.lastInsertId, undefined);
  });

  await t.test("should execute get operations", async () => {
    const sql = "SELECT * FROM users WHERE id = $1 LIMIT 1";
    const params = [1];
    const expectedResult = { id: 1, name: "test" };
    mockClient.results[sql] = { rows: [expectedResult] };

    const result = await connection.get(sql, params);
    assert.strictEqual(mockClient.calls.query.length, 1);
    assert.deepStrictEqual(mockClient.calls.query[0], { sql, params });
    assert.deepStrictEqual(result, expectedResult);
  });

  await t.test("should execute all operations", async () => {
    const sql = "SELECT * FROM users";
    const params = [];
    const expectedResult = [
      { id: 1, name: "test" },
      { id: 2, name: "test2" },
    ];
    mockClient.results[sql] = { rows: expectedResult };

    const result = await connection.all(sql, params);
    assert.strictEqual(mockClient.calls.query.length, 1);
    assert.deepStrictEqual(mockClient.calls.query[0], { sql, params });
    assert.deepStrictEqual(result, expectedResult);
  });

  await t.test("should execute exec operations", async () => {
    const sql = "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT)";
    await connection.exec(sql);
    assert.strictEqual(mockClient.calls.query.length, 1);
    assert.deepStrictEqual(mockClient.calls.query[0], { sql, params: undefined });
  });

  await t.test("should handle transactions", async () => {
    const sql1 = "INSERT INTO accounts (balance) VALUES ($1)";
    const params1 = [100];
    const sql2 = "UPDATE users SET balance = $1 WHERE id = $2";
    const params2 = [200, 1];

    await connection.transaction(async (trx) => {
      await trx.run(sql1, params1);
      await trx.run(sql2, params2);
    });

    assert.strictEqual(mockClient.calls.query.length, 4); // BEGIN, INSERT, UPDATE, COMMIT
    assert.deepStrictEqual(mockClient.calls.query[0], { sql: "BEGIN", params: undefined });
    assert.deepStrictEqual(mockClient.calls.query[1], { sql: sql1, params: params1 });
    assert.deepStrictEqual(mockClient.calls.query[2], { sql: sql2, params: params2 });
    assert.deepStrictEqual(mockClient.calls.query[3], { sql: "COMMIT", params: undefined });
  });

  await t.test("should rollback transaction on error", async () => {
    const sql1 = "INSERT INTO accounts (balance) VALUES ($1)";
    const params1 = [100];

    try {
      await connection.transaction(async (trx) => {
        await trx.run(sql1, params1);
        throw new Error("Transaction failed");
      });
      assert.fail("Transaction should have thrown an error");
    } catch (error) {
      assert.strictEqual(error.message, "Transaction failed");
      assert.strictEqual(mockClient.calls.query.length, 3); // BEGIN, INSERT, ROLLBACK
      assert.deepStrictEqual(mockClient.calls.query[0], { sql: "BEGIN", params: undefined });
      assert.deepStrictEqual(mockClient.calls.query[1], { sql: sql1, params: params1 });
      assert.deepStrictEqual(mockClient.calls.query[2], { sql: "ROLLBACK", params: undefined });
    }
  });
});
