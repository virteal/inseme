import assert from "node:assert";
import { test } from "node:test";
import { DatabaseService } from "../DatabaseService.js";

// Mock GenericConnection implementation
class MockConnection {
  constructor() {
    this.calls = {
      run: [],
      get: [],
      all: [],
      exec: [],
      close: [],
    };
  }

  async run(sql, params) {
    this.calls.run.push({ sql, params });
    return { rowsAffected: 1, lastInsertId: 1 };
  }

  async get(sql, params) {
    this.calls.get.push({ sql, params });
    return { id: 1, name: "test" };
  }

  async all(sql, params) {
    this.calls.all.push({ sql, params });
    return [{ id: 1, name: "test" }];
  }

  async exec(sql) {
    this.calls.exec.push({ sql });
  }

  async close() {
    this.calls.close.push({});
  }

  async transaction(callback) {
    // For injection mode, we can just call the callback directly
    // as the transaction logic is handled by the injected connection
    const trx = {
      run: this.run.bind(this),
      get: this.get.bind(this),
      all: this.all.bind(this),
      exec: this.exec.bind(this),
      beginTransaction: () => Promise.resolve(),
      commit: () => Promise.resolve(),
      rollback: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };
    return callback(trx);
  }
}

test("DatabaseService in Injection Mode", async (t) => {
  const mockConnection = new MockConnection();
  const dbService = new DatabaseService(mockConnection);

  await t.test("should call run on the injected connection", async () => {
    const sql = "INSERT INTO users (name) VALUES (?)";
    const params = ["John Doe"];
    await dbService.run(sql, params);
    assert.strictEqual(mockConnection.calls.run.length, 1);
    assert.deepStrictEqual(mockConnection.calls.run[0], { sql, params });
  });

  await t.test("should call get on the injected connection", async () => {
    const sql = "SELECT * FROM users WHERE id = ?";
    const params = [1];
    await dbService.get(sql, params);
    assert.strictEqual(mockConnection.calls.get.length, 1);
    assert.deepStrictEqual(mockConnection.calls.get[0], { sql, params });
  });

  await t.test("should call all on the injected connection", async () => {
    const sql = "SELECT * FROM users";
    await dbService.all(sql);
    assert.strictEqual(mockConnection.calls.all.length, 1);
    assert.deepStrictEqual(mockConnection.calls.all[0], { sql, params: undefined });
  });

  await t.test("should call exec on the injected connection", async () => {
    const sql = "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)";
    await dbService.exec(sql);
    assert.strictEqual(mockConnection.calls.exec.length, 1);
    assert.deepStrictEqual(mockConnection.calls.exec[0], { sql });
  });

  await t.test("should not close the injected connection on release", async () => {
    await dbService.release();
    assert.strictEqual(mockConnection.calls.close.length, 0);
  });

  await t.test("should handle transactions via the injected connection", async () => {
    const transactionCallback = async (trx) => {
      await trx.run("INSERT INTO logs (message) VALUES (?)", ["Transaction log"]);
    };
    await dbService.transaction(transactionCallback);
    // In this mock, the run method of the mockConnection is called directly by the trx object
    assert.strictEqual(mockConnection.calls.run.length, 2); // One from previous run test, one from transaction
    assert.deepStrictEqual(mockConnection.calls.run[1], {
      sql: "INSERT INTO logs (message) VALUES (?)",
      params: ["Transaction log"],
    });
  });
});
