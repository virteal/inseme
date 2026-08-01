import { describe, it } from "node:test";
import assert from "node:assert";
import { ERROR_CODES } from "../../storage.js";

/**
 * Fonction utilitaire pour tester le contrat de l'interface de stockage.
 * @param {string} storageName - Le nom de l'implémentation de stockage (ex: "InMemoryStorage").
 * @param {function(): Promise<import('../../storage').StorageInterface>} createStorageInstance - Une fonction qui retourne une nouvelle instance de l'interface de stockage.
 */
export function testStorageContract(storageName, createStorageInstance) {
  describe(`${storageName} - StorageInterface Contract`, () => {
    let storage;

    it("should create a storage instance", async () => {
      storage = await createStorageInstance(ERROR_CODES);
      assert.ok(storage, "Storage instance should be created");
    });

    it("should expose ERROR_CODES", () => {
      assert.ok(storage.ERROR_CODES, "Storage should expose ERROR_CODES");
      assert.strictEqual(typeof storage.ERROR_CODES, "object", "ERROR_CODES should be an object");
      assert.ok(storage.ERROR_CODES.NOT_FOUND, "ERROR_CODES should contain NOT_FOUND");
      assert.ok(storage.ERROR_CODES.DB_ERROR, "ERROR_CODES should contain DB_ERROR");
      assert.ok(storage.ERROR_CODES.CONFLICT, "ERROR_CODES should contain CONFLICT");
      assert.ok(
        storage.ERROR_CODES.OPTIMISTIC_LOCK_FAIL,
        "ERROR_CODES should contain OPTIMISTIC_LOCK_FAIL"
      );
    });

    describe("debugLogs", () => {
      it("should have a debugLogs object", () => {
        assert.ok(storage.debugLogs, "debugLogs should exist");
        assert.strictEqual(typeof storage.debugLogs, "object", "debugLogs should be an object");
      });

      it("should have a debugLogs.insert method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.debugLogs.insert,
          "function",
          "debugLogs.insert should be a function"
        );
        const result = storage.debugLogs.insert({});
        assert.ok(result instanceof Promise, "debugLogs.insert should return a Promise");
        // We don't await here as the implementation might not be fully functional yet,
        // but we ensure it returns a Promise.
      });
    });

    describe("events", () => {
      it("should have an events object", () => {
        assert.ok(storage.events, "events should exist");
        assert.strictEqual(typeof storage.events, "object", "events should be an object");
      });

      it("should have an events.insert method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.events.insert,
          "function",
          "events.insert should be a function"
        );
        const result = storage.events.insert({});
        assert.ok(result instanceof Promise, "events.insert should return a Promise");
      });
    });

    describe("artifacts", () => {
      it("should have an artifacts object", () => {
        assert.ok(storage.artifacts, "artifacts should exist");
        assert.strictEqual(typeof storage.artifacts, "object", "artifacts should be an object");
      });

      it("should have an artifacts.insert method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.artifacts.insert,
          "function",
          "artifacts.insert should be a function"
        );
        const result = storage.artifacts.insert({});
        assert.ok(result instanceof Promise, "artifacts.insert should return a Promise");
      });
    });

    describe("logicalAgents", () => {
      it("should have an logicalAgents object", () => {
        assert.ok(storage.logicalAgents, "logicalAgents should exist");
        assert.strictEqual(
          typeof storage.logicalAgents,
          "object",
          "logicalAgents should be an object"
        );
      });

      it("should have logicalAgents.upsert method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.logicalAgents.upsert,
          "function",
          "logicalAgents.upsert should be a function"
        );
        const result = storage.logicalAgents.upsert({});
        assert.ok(result instanceof Promise, "logicalAgents.upsert should return a Promise");
      });

      it("should have logicalAgents.getById method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.logicalAgents.getById,
          "function",
          "logicalAgents.getById should be a function"
        );
        const result = storage.logicalAgents.getById("some-id");
        assert.ok(result instanceof Promise, "logicalAgents.getById should return a Promise");
      });

      it("should have logicalAgents.getByName method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.logicalAgents.getByName,
          "function",
          "logicalAgents.getByName should be a function"
        );
        const result = storage.logicalAgents.getByName("some-name");
        assert.ok(result instanceof Promise, "logicalAgents.getByName should return a Promise");
      });

      it("should have logicalAgents.list method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.logicalAgents.list,
          "function",
          "logicalAgents.list should be a function"
        );
        const result = storage.logicalAgents.list({});
        assert.ok(result instanceof Promise, "logicalAgents.list should return a Promise");
      });

      it("should have logicalAgents.updateStatus method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.logicalAgents.updateStatus,
          "function",
          "logicalAgents.updateStatus should be a function"
        );
        const result = storage.logicalAgents.updateStatus("some-id", "active");
        assert.ok(
          result instanceof Promise,
          "logicalAgents.updateStatus should return a Promise"
        );
      });
    });

    describe("tasks", () => {
      it("should have a tasks object", () => {
        assert.ok(storage.tasks, "tasks should exist");
        assert.strictEqual(typeof storage.tasks, "object", "tasks should be an object");
      });

      it("should have tasks.upsert method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.tasks.upsert,
          "function",
          "tasks.upsert should be a function"
        );
        const result = storage.tasks.upsert({});
        assert.ok(result instanceof Promise, "tasks.upsert should return a Promise");
      });

      it("should have tasks.get method that returns a Promise", async () => {
        assert.strictEqual(typeof storage.tasks.get, "function", "tasks.get should be a function");
        const result = storage.tasks.get("some-id");
        assert.ok(result instanceof Promise, "tasks.get should return a Promise");
      });

      it("should have tasks.list method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.tasks.list,
          "function",
          "tasks.list should be a function"
        );
        const result = storage.tasks.list({});
        assert.ok(result instanceof Promise, "tasks.list should return a Promise");
      });

      it("should have tasks.update method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.tasks.update,
          "function",
          "tasks.update should be a function"
        );
        const result = storage.tasks.update("some-id", {});
        assert.ok(result instanceof Promise, "tasks.update should return a Promise");
      });
    });

    describe("steps", () => {
      it("should have a steps object", () => {
        assert.ok(storage.steps, "steps should exist");
        assert.strictEqual(typeof storage.steps, "object", "steps should be an object");
      });

      it("should have steps.upsert method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.steps.upsert,
          "function",
          "steps.upsert should be a function"
        );
        const result = storage.steps.upsert({});
        assert.ok(result instanceof Promise, "steps.upsert should return a Promise");
      });

      it("should have steps.listByTask method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.steps.listByTask,
          "function",
          "steps.listByTask should be a function"
        );
        const result = storage.steps.listByTask("some-task-id");
        assert.ok(result instanceof Promise, "steps.listByTask should return a Promise");
      });

      it("should have steps.get method that returns a Promise", async () => {
        assert.strictEqual(typeof storage.steps.get, "function", "steps.get should be a function");
        const result = storage.steps.get("some-step-id");
        assert.ok(result instanceof Promise, "steps.get should return a Promise");
      });

      it("should have steps.update method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.steps.update,
          "function",
          "steps.update should be a function"
        );
        const result = storage.steps.update("some-task-id", "some-step-id", {});
        assert.ok(result instanceof Promise, "steps.update should return a Promise");
      });
    });

    describe("fileStorage", () => {
      it("should have a fileStorage object", () => {
        assert.ok(storage.fileStorage, "fileStorage should exist");
        assert.strictEqual(typeof storage.fileStorage, "object", "fileStorage should be an object");
      });

      it("should have fileStorage.uploadArtifact method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.fileStorage.uploadArtifact,
          "function",
          "fileStorage.uploadArtifact should be a function"
        );
        const result = storage.fileStorage.uploadArtifact("bucket", "path", Buffer.from(""), {});
        assert.ok(result instanceof Promise, "fileStorage.uploadArtifact should return a Promise");
      });

      it("should have fileStorage.downloadArtifact method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.fileStorage.downloadArtifact,
          "function",
          "fileStorage.downloadArtifact should be a function"
        );
        const result = storage.fileStorage.downloadArtifact("bucket", "path");
        assert.ok(
          result instanceof Promise,
          "fileStorage.downloadArtifact should return a Promise"
        );
      });

      it("should have fileStorage.getPublicUrl method that returns a Promise", async () => {
        assert.strictEqual(
          typeof storage.fileStorage.getPublicUrl,
          "function",
          "fileStorage.getPublicUrl should be a function"
        );
        const result = storage.fileStorage.getPublicUrl("bucket", "path");
        assert.ok(result instanceof Promise, "fileStorage.getPublicUrl should return a Promise");
      });
    });

    it("should have a getCacheContents method that returns an object", () => {
      assert.strictEqual(
        typeof storage.getCacheContents,
        "function",
        "getCacheContents should be a function"
      );
      const result = storage.getCacheContents();
      assert.strictEqual(typeof result, "object", "getCacheContents should return an object");
    });

    it("should have a clearCache method that returns void", () => {
      assert.strictEqual(typeof storage.clearCache, "function", "clearCache should be a function");
      const result = storage.clearCache();
      assert.strictEqual(result, undefined, "clearCache should return void (undefined)");
    });
  });
}
