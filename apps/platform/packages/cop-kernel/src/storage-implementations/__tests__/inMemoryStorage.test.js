import { test } from "node:test";
import assert from "node:assert";
import { createInMemoryStorage } from "../inMemoryStorage.js";
import { testStorageContract } from "./sharedStorageContract.js";
import { ERROR_CODES } from "../../storage.js";

test("inMemoryStorage", async (t) => {
  const storage = createInMemoryStorage(ERROR_CODES);

  t.beforeEach(() => {
    storage.clearCache();
  });

  await t.test("should return an object with expected properties", () => {
    assert.ok(storage.tasks, "should have tasks property");
    assert.ok(storage.steps, "should have steps property");
    assert.ok(storage.events, "should have events property");
  });

  await t.test("tasks", async (t) => {
    await t.test("should upsert a task", async () => {
      const task = { id: "task1", name: "Test Task" };
      const result = await storage.tasks.upsert(task);
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, { ...task, version: 1 });
    });

    await t.test("should list tasks", async () => {
      await storage.tasks.upsert({ id: "task1", name: "Test Task" });
      await storage.tasks.upsert({ id: "task2", name: "Another Task" });
      const result = await storage.tasks.list();
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.data.length, 2);
      assert.deepStrictEqual(result.data[0], { id: "task1", name: "Test Task", version: 1 });
      assert.deepStrictEqual(result.data[1], { id: "task2", name: "Another Task", version: 1 });
    });

    await t.test("should get a task by id", async () => {
      await storage.tasks.upsert({ id: "task1", name: "Test Task" });
      const result = await storage.tasks.get("task1");
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, { id: "task1", name: "Test Task", version: 1 });
    });

    await t.test("should return null if task not found", async () => {
      const result = await storage.tasks.get("nonexistent_task");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.data, null);
      assert.strictEqual(result.error, "Task not found");
    });
  });

  await t.test("steps", async (t) => {
    await t.test("should upsert a step", async () => {
      const step = { id: "step1", task_id: "task1", name: "Test Step" };
      const result = await storage.steps.upsert(step);
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, step);
    });

    await t.test("should list steps by task", async () => {
      await storage.steps.upsert({ id: "step1", task_id: "task1", name: "Test Step" });
      await storage.steps.upsert({ id: "step2", task_id: "task1", name: "Another Step" });
      await storage.steps.upsert({ id: "step3", task_id: "task2", name: "Third Step" });
      const result = await storage.steps.listByTask("task1");
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.data.length, 2);
      assert.deepStrictEqual(result.data[0], { id: "step1", task_id: "task1", name: "Test Step" });
      assert.deepStrictEqual(result.data[1], {
        id: "step2",
        task_id: "task1",
        name: "Another Step",
      });
    });
  });

  await t.test("events", async (t) => {
    await t.test("should insert an event", async () => {
      const event = { id: "event1", task_id: "task1", type: "TestEvent" };
      const result = await storage.events.insert(event);
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, event);
    });
  });
});

testStorageContract("InMemoryStorage", createInMemoryStorage);
