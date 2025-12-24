import assert from "node:assert";
import { test } from "node:test";
import mockMysql2 from "../../mysql/__mocks__/mysql2-promise.js";

global.mockMysql2 = mockMysql2;

test("NodeMysqlConnection", async (t) => {
  let connection;
  let mockPoolConnection;
  let createNodeMySQLConnection;

  t.beforeEach(async () => {
    if (!createNodeMySQLConnection) {
      ({ createNodeMySQLConnection } = await import("../../mysql/node-mysql.js"));
    }
    connection = await createNodeMySQLConnection({
      host: "localhost",
      user: "root",
      password: "password",
      database: "testdb",
    });

    console.log("connection.pool:", connection.pool);
    mockPoolConnection = connection.pool.mockConnection;
    mockPoolConnection.calls = {
      execute: [],
      query: [],
      beginTransaction: [],
      commit: [],
      rollback: [],
      end: [],
    };
    mockPoolConnection.results = {};
  });

  await t.test("should connect and release", async () => {
    // connect is implicitly handled by pool
    await connection.close();
    assert.strictEqual(mockPoolConnection.calls.end.length, 1);
  });

  await t.test("should run a query", async () => {
    const result = await connection.run("INSERT INTO users (name) VALUES (?)", ["test"]);
    assert.strictEqual(mockPoolConnection.calls.execute.length, 1);
    assert.deepStrictEqual(result, { rowsAffected: 1, lastInsertId: 1 });
  });

  await t.test("should get a single row", async () => {
    mockPoolConnection.results["SELECT * FROM users WHERE id = ? LIMIT 1"] = [
      { id: 1, name: "test" },
    ];
    const row = await connection.get("SELECT * FROM users WHERE id = ? LIMIT 1", [1]);
    assert.strictEqual(mockPoolConnection.calls.execute.length, 1);
    assert.deepStrictEqual(row, { id: 1, name: "test" });
  });

  await t.test("should get all rows", async () => {
    mockPoolConnection.results["SELECT * FROM users"] = [
      { id: 1, name: "test" },
      { id: 2, name: "test2" },
    ];
    const rows = await connection.all("SELECT * FROM users");
    assert.strictEqual(mockPoolConnection.calls.execute.length, 1);
    assert.deepStrictEqual(rows, [
      { id: 1, name: "test" },
      { id: 2, name: "test2" },
    ]);
  });

  await t.test("should execute a query without returning data", async () => {
    await connection.exec("CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255))");
    assert.strictEqual(mockPoolConnection.calls.execute.length, 1);
  });

  await t.test("should handle transactions", async () => {
    let transactionExecuted = false;
    let trxMockConnection;
    await connection.transaction(async (trx) => {
      transactionExecuted = true;
      trxMockConnection = trx._mockConnection;
      await trx.run("INSERT INTO users (name) VALUES (?)", ["test"]);
      await trx.get("SELECT * FROM users WHERE id = ?", [1]);
      await trx.all("SELECT * FROM users");
      await trx.exec("CREATE TABLE IF NOT EXISTS test_table (id INT)");
    });
    assert.ok(transactionExecuted);
    assert.strictEqual(trxMockConnection.calls.beginTransaction.length, 1);
    assert.strictEqual(trxMockConnection.calls.commit.length, 1);
    assert.strictEqual(trxMockConnection.calls.rollback.length, 0);
    assert.strictEqual(trxMockConnection.calls.execute.length, 4);
  });

  await t.test("should rollback transaction on error", async () => {
    let transactionExecuted = false;
    let trxMockConnection;
    try {
      await connection.transaction(async (trx) => {
        transactionExecuted = true;
        trxMockConnection = trx._mockConnection;
        await trx.run("INSERT INTO products (name) VALUES (?)", ["product1"]);
        throw new Error("Transaction failed");
      });
    } catch (error) {
      assert.strictEqual(error.message, "Transaction failed");
    }
    assert.ok(transactionExecuted);
    assert.strictEqual(trxMockConnection.calls.beginTransaction.length, 1);
    assert.strictEqual(trxMockConnection.calls.commit.length, 0);
    assert.strictEqual(trxMockConnection.calls.rollback.length, 1);
    assert.strictEqual(trxMockConnection.calls.execute.length, 1);
  });
});
