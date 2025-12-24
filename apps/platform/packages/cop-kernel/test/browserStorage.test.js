import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { createBrowserStorage } from "../src/storage-implementations/browserStorage.js";
import { ERROR_CODES } from "../src/storage.js";

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = value.toString();
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

describe("Browser Storage (localStorage) Implementation", () => {
  let storage;

  beforeEach(() => {
    localStorageMock.clear(); // Clear localStorage before each test
    // Define localStorage on globalThis for each test
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true, // Make it configurable so it can be redefined
    });
    storage = createBrowserStorage({ ERROR_CODES });
  });

  it("should initialize with type 'browser'", () => {
    assert.strictEqual(storage.options.type, "browser");
  });

  describe("agentIdentities", () => {
    it("should upsert and retrieve an agent identity by id", async () => {
      const identity = { agent_id: "agent1", agent_name: "Agent One", status: "active" };
      const result = await storage.agentIdentities.upsert(identity);
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.identity, identity);

      const retrieved = await storage.agentIdentities.getById("agent1");
      assert.strictEqual(retrieved.ok, true);
      assert.deepStrictEqual(retrieved.identity, identity);
    });

    it("should retrieve an agent identity by name", async () => {
      const identity = { agent_id: "agent2", agent_name: "Agent Two", status: "active" };
      await storage.agentIdentities.upsert(identity);

      const retrieved = await storage.agentIdentities.getByName("Agent Two");
      assert.strictEqual(retrieved.ok, true);
      assert.deepStrictEqual(retrieved.identity, identity);
    });

    it("should list agent identities", async () => {
      const identity1 = { agent_id: "agent3", agent_name: "Agent Three", status: "active" };
      const identity2 = { agent_id: "agent4", agent_name: "Agent Four", status: "inactive" };
      await storage.agentIdentities.upsert(identity1);
      await storage.agentIdentities.upsert(identity2);

      const result = await storage.agentIdentities.list();
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.identities.length, 2);
      assert.deepStrictEqual(
        result.identities.find((id) => id.agent_id === "agent3"),
        identity1
      );
    });

    it("should update agent status", async () => {
      const identity = { agent_id: "agent5", agent_name: "Agent Five", status: "active" };
      await storage.agentIdentities.upsert(identity);

      const result = await storage.agentIdentities.updateStatus("agent5", "inactive");
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.identity.status, "inactive");

      const retrieved = await storage.agentIdentities.getById("agent5");
      assert.strictEqual(retrieved.ok, true);
      assert.strictEqual(retrieved.identity.status, "inactive");
    });
  });

  describe("tasks", () => {
    it("should upsert and retrieve a task", async () => {
      const task = { id: "task1", status: "pending", version: 0 };
      const result = await storage.tasks.upsert(task);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.task.version, 1);

      const retrieved = await storage.tasks.get("task1");
      assert.strictEqual(retrieved.ok, true);
      assert.deepStrictEqual(retrieved.task.id, "task1");
      assert.strictEqual(retrieved.task.version, 1);
    });

    it("should list tasks", async () => {
      const task1 = { id: "task2", status: "pending", version: 0 };
      const task2 = { id: "task3", status: "completed", version: 0 };
      await storage.tasks.upsert(task1);
      await storage.tasks.upsert(task2);

      const result = await storage.tasks.list();
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.tasks.length, 2);
    });

    it("should update a task with optimistic locking", async () => {
      const task = { id: "task4", status: "pending", version: 0 };
      const upserted = await storage.tasks.upsert(task);

      const patch = { status: "running", version: upserted.task.version };
      const result = await storage.tasks.update("task4", patch);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.task.status, "running");
      assert.strictEqual(result.task.version, upserted.task.version + 1);

      const failedPatch = { status: "failed", version: upserted.task.version }; // Old version
      const failedResult = await storage.tasks.update("task4", failedPatch);
      assert.strictEqual(failedResult.ok, false);
      assert.strictEqual(failedResult.code, storage.ERROR_CODES.OPTIMISTIC_LOCK_FAIL);
    });
  });

  describe("steps", () => {
    it("should upsert and list steps by task", async () => {
      const step1 = { id: "step1", task_id: "task5", status: "created" };
      const step2 = { id: "step2", task_id: "task5", status: "running" };
      const step3 = { id: "step3", task_id: "task6", status: "created" };

      await storage.steps.upsert(step1);
      await storage.steps.upsert(step2);
      await storage.steps.upsert(step3);

      const result = await storage.steps.listByTask("task5");
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.steps.length, 2);
      assert.deepStrictEqual(
        result.steps.find((s) => s.id === "step1"),
        step1
      );
    });

    it("should update a step", async () => {
      const step = { id: "step4", task_id: "task7", status: "created" };
      await storage.steps.upsert(step);

      const patch = { status: "completed", output: "done" };
      const result = await storage.steps.update("task7", "step4", patch);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.step.status, "completed");
      assert.strictEqual(result.step.output, "done");
    });
  });

  it("should clear cache", async () => {
    const identity = { agent_id: "agent6", agent_name: "Agent Six", status: "active" };
    await storage.agentIdentities.upsert(identity);

    await storage.clearCache();

    const retrieved = await storage.agentIdentities.getById("agent6");
    assert.strictEqual(retrieved.ok, false);
    assert.strictEqual(retrieved.code, ERROR_CODES.NOT_FOUND);
  });

  it("should handle debugLogs insert", async () => {
    const logRecord = { message: "Test log", level: "info" };
    const result = await storage.debugLogs.insert(logRecord);
    assert.strictEqual(result.ok, true);
    // In browserStorage, debug logs are just console.logged, so we just check the return value
  });

  it("should handle events insert", async () => {
    const eventRecord = { type: "testEvent", payload: { data: "test" } };
    const result = await storage.events.insert(eventRecord);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.event, eventRecord);
  });

  it("should not support artifacts storage", async () => {
    const artifactRecord = { name: "test.txt", path: "/path/to/test.txt" };
    const result = await storage.artifacts.insert(artifactRecord);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, ERROR_CODES.DB_ERROR);
  });

  it("should not support fileStorage operations", async () => {
    const uploadResult = await storage.fileStorage.uploadArtifact();
    assert.strictEqual(uploadResult.ok, false);
    assert.strictEqual(uploadResult.code, ERROR_CODES.DB_ERROR);

    const downloadResult = await storage.fileStorage.downloadArtifact();
    assert.strictEqual(downloadResult.ok, false);
    assert.strictEqual(downloadResult.code, ERROR_CODES.NOT_FOUND);

    const getUrlResult = await storage.fileStorage.getPublicUrl();
    assert.strictEqual(getUrlResult.ok, false);
    assert.strictEqual(getUrlResult.code, ERROR_CODES.NOT_FOUND);
  });
});
