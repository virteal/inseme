import assert from "node:assert";
import { test } from "node:test";
import { createNodeSqliteConnection } from "../../sqlite/node-sqlite.js";

// Mock the 'sqlite3' and 'sqlite' database
class MockSqliteDatabase {
  constructor(filename) {
    this.calls = { run: [], get: [], all: [], exec: [], close: [], prepare: [], finalize: [] };
    this.results = {};
    this.inTransaction = false;
    this.filename = filename;
  }

  async run(sql, params, callback) {
    this.calls.run.push({ sql, params });
    if (callback) {
      callback(null, { changes: 1, lastID: 1 });
    }
    return Promise.resolve({ changes: 1, lastID: 1 });
  }

  async get(sql, params, callback) {
    this.calls.get.push({ sql, params });
    const result = this.results[sql] || { id: 1, name: "test" };
    if (callback) {
      callback(null, result);
    }
    return Promise.resolve(result);
  }

  async all(sql, params, callback) {
    this.calls.all.push({ sql, params });
    const result = this.results[sql] || [
      { id: 1, name: "test" },
      { id: 2, name: "test2" },
    ];
    if (callback) {
      callback(null, result);
    }
    return Promise.resolve(result);
  }

  async exec(sql, callback) {
    this.calls.exec.push({ sql });
    if (callback) {
      callback(null);
    }
    return Promise.resolve();
  }

  async close(callback) {
    this.calls.close.push({});
    if (callback) {
      callback(null);
    }
    return Promise.resolve();
  }

  // Mock for transactions
  async beginTransaction() {
    this.inTransaction = true;
    this.calls.run.push({ sql: "BEGIN TRANSACTION" });
  }

  async commit() {
    this.inTransaction = false;
    this.calls.run.push({ sql: "COMMIT" });
  }

  async rollback() {
    this.inTransaction = false;
    this.calls.run.push({ sql: "ROLLBACK" });
  }

  // Mock for sqlite library (promises)
  async prepare(sql) {
    this.calls.prepare.push({ sql });
    return {
      run: async (params) => {
        this.calls.run.push({ sql, params });
        return { changes: 1, lastID: 1 };
      },
      get: async (params) => {
        this.calls.get.push({ sql, params });
        return this.results[sql] || { id: 1, name: "test" };
      },
      all: async (params) => {
        this.calls.all.push({ sql, params });
        return (
          this.results[sql] || [
            { id: 1, name: "test" },
            { id: 2, name: "test2" },
          ]
        );
      },
      finalize: async () => {
        this.calls.finalize.push({ sql });
      },
    };
  }
}

// Mock the 'sqlite' module to return our MockSqliteDatabase
const mockSqlite = {
  open: async (options) => {
    const db = new MockSqliteDatabase(options.filename);
    db.options = options;
    return db;
  },
};

// Mock the 'sqlite3' module to return our MockSqliteDatabase
const mockSqlite3 = {
  Database: class {
    constructor(filename, mode, callback) {
      const db = new MockSqliteDatabase();
      db.filename = filename;
      db.mode = mode;
      if (callback) {
        callback(null);
      }
      return db;
    }
  },
  OPEN_READWRITE: 1,
  OPEN_CREATE: 2,
};

// Temporarily override the 'sqlite' and 'sqlite3' imports for testing

test("NodeSqliteConnection", async (t) => {
  let connection;
  let mockDb;

  t.beforeEach(async () => {
    connection = await createNodeSqliteConnection({ uri: ":memory:" }, mockSqlite, mockSqlite3);
    mockDb = connection.db; // Access the mocked database
    mockDb.calls = { run: [], get: [], all: [], exec: [], close: [], prepare: [], finalize: [] }; // Reset calls for each test
    mockDb.results = {};
    mockDb.inTransaction = false;
  });

  await t.test("should connect and close", async () => {
    assert.strictEqual(mockDb.filename, ":memory:");
    await connection.close();
    assert.strictEqual(mockDb.calls.close.length, 1);
  });

  await t.test("should execute run operations", async () => {
    const sql = "INSERT INTO users (name) VALUES (?)";
    const params = ["John Doe"];
    const result = await connection.run(sql, params);
    assert.strictEqual(mockDb.calls.run.length, 1);
    assert.deepStrictEqual(mockDb.calls.run[0], { sql, params });
    assert.strictEqual(result.rowsAffected, 1);
    assert.strictEqual(result.lastInsertId, 1);
  });

  await t.test("should execute get operations", async () => {
    const sql = "SELECT * FROM users WHERE id = ?";
    const params = [1];
    const expectedResult = { id: 1, name: "test" };
    mockDb.results[sql] = expectedResult;

    const result = await connection.get(sql, params);
    assert.strictEqual(mockDb.calls.get.length, 1);
    assert.deepStrictEqual(mockDb.calls.get[0], { sql, params });
    assert.deepStrictEqual(result, expectedResult);
  });

  await t.test("should execute all operations", async () => {
    const sql = "SELECT * FROM users";
    const params = [];
    const expectedResult = [
      { id: 1, name: "test" },
      { id: 2, name: "test2" },
    ];
    mockDb.results[sql] = expectedResult;

    const result = await connection.all(sql, params);
    assert.strictEqual(mockDb.calls.all.length, 1);
    assert.deepStrictEqual(mockDb.calls.all[0], { sql, params });
    assert.deepStrictEqual(result, expectedResult);
  });

  await t.test("should execute exec operations", async () => {
    const sql = "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)";
    await connection.exec(sql);
    assert.strictEqual(mockDb.calls.exec.length, 1);
    assert.deepStrictEqual(mockDb.calls.exec[0], { sql });
  });

  await t.test("should handle transactions", async () => {
    const sql1 = "INSERT INTO accounts (balance) VALUES (?)";
    const params1 = [100];
    const sql2 = "UPDATE users SET balance = ? WHERE id = ?";
    const params2 = [200, 1];

    await connection.transaction(async (trx) => {
      await trx.run(sql1, params1);
      await trx.run(sql2, params2);
    });

    assert.strictEqual(mockDb.calls.run.length, 4); // BEGIN TRANSACTION, INSERT, UPDATE, COMMIT
    assert.deepStrictEqual(mockDb.calls.run[0], { sql: "BEGIN TRANSACTION", params: undefined });
    assert.deepStrictEqual(mockDb.calls.run[1], { sql: sql1, params: params1 });
    assert.deepStrictEqual(mockDb.calls.run[2], { sql: sql2, params: params2 });
    assert.deepStrictEqual(mockDb.calls.run[3], { sql: "COMMIT", params: undefined });
  });

  await t.test("should rollback transaction on error", async () => {
    const sql1 = "INSERT INTO accounts (balance) VALUES (?)";
    const params1 = [100];

    try {
      await connection.transaction(async (trx) => {
        await trx.run(sql1, params1);
        throw new Error("Transaction failed");
      });
      assert.fail("Transaction should have thrown an error");
    } catch (error) {
      assert.strictEqual(error.message, "Transaction failed");
      assert.strictEqual(mockDb.calls.run.length, 3); // BEGIN TRANSACTION, INSERT, ROLLBACK
      assert.deepStrictEqual(mockDb.calls.run[0], { sql: "BEGIN TRANSACTION", params: undefined });
      assert.deepStrictEqual(mockDb.calls.run[1], { sql: sql1, params: params1 });
      assert.deepStrictEqual(mockDb.calls.run[2], { sql: "ROLLBACK", params: undefined });
    }
  });
});
