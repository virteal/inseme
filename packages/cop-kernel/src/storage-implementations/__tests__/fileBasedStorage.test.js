import assert from "node:assert";
import { test } from "node:test";
import { mkdtemp, rm as fsRm } from "node:fs/promises";
import { createFileBasedStorage } from "../fileBasedStorage.js";
import path from "node:path";

// Mock fs/promises
const mockFs = {
  files: new Map(),
  dirs: new Set(),

  normalizePath(p) {
    return p.replace(/\\/g, "/");
  },

  async mkdir(dirPath, options) {
    this.dirs.add(this.normalizePath(dirPath));
  },

  async writeFile(filePath, data, encoding) {
    this.files.set(this.normalizePath(filePath), data);
  },

  async readFile(filePath, encoding) {
    const normalizedPath = this.normalizePath(filePath);
    if (this.files.has(normalizedPath)) {
      return this.files.get(normalizedPath);
    }
    const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    error.code = "ENOENT";
    throw error;
  },

  async readdir(dirPath) {
    const normalizedDirPath = this.normalizePath(dirPath);
    const filesInDir = Array.from(this.files.keys()).filter((file) => {
      const fileDir = this.normalizePath(path.dirname(file));
      return fileDir === normalizedDirPath;
    });
    return filesInDir.map((file) => path.basename(file));
  },

  async rm(targetPath, options) {
    const normalizedTargetPath = this.normalizePath(targetPath);
    // Simulate removing files and directories recursively
    // Remove files
    this.files = new Map(
      Array.from(this.files.entries()).filter(
        ([filePath]) => !filePath.startsWith(normalizedTargetPath)
      )
    );

    // Remove directories
    this.dirs = new Set(
      Array.from(this.dirs).filter((dirPath) => !dirPath.startsWith(normalizedTargetPath))
    );
  },

  async access(filePath) {
    const normalizedPath = this.normalizePath(filePath);
    if (!this.files.has(normalizedPath)) {
      const error = new Error(`ENOENT: no such file or directory, access '${filePath}'`);
      error.code = "ENOENT";
      throw error;
    }
  },

  reset() {
    this.files.clear();
    this.dirs.clear();
  },
};

// Mock createAuditLogger
const mockAuditLogger = {
  logEvent: async (event) => {
    /* do nothing */
  },
};

// Mock the auditLogger module
const mockAuditLoggerModule = {
  createAuditLogger: () => mockAuditLogger,
};

const ERROR_CODES = {
  NOT_FOUND: "STORAGE_NOT_FOUND",
  DB_ERROR: "STORAGE_DATABASE_ERROR",
  CONFLICT: "STORAGE_CONFLICT_ERROR",
  OPTIMISTIC_LOCK_FAIL: "STORAGE_OPTIMISTIC_LOCK_FAILED",
};

test("FileBasedStorage", async (t) => {
  let storage;
  let testBasePath;

  t.beforeEach(async () => {
    testBasePath = path.posix.normalize(
      await mkdtemp(path.join(process.cwd(), "test_file_storage_data-"))
    );
    mockFs.reset();
    storage = await createFileBasedStorage({
      basePath: testBasePath,
      fs: mockFs,
      createAuditLogger: mockAuditLoggerModule.createAuditLogger,
    });
  });

  t.afterEach(async () => {
    await mockFs.rm(testBasePath, { recursive: true, force: true });
    mockFs.reset();
    await fsRm(testBasePath, { recursive: true, force: true });
  });

  await t.test("should insert debug logs", async () => {
    const logRecord = { message: "test log" };
    const result = await storage.debugLogs.insert(logRecord);
    assert.strictEqual(result.ok, true);
    // For file-based, we don't store debug logs in a retrievable way by default
    // So we just assert that the operation was successful.
  });

  await t.test("should insert events", async () => {
    const eventRecord = { type: "test_event", payload: { data: "test" } };
    const result = await storage.events.insert(eventRecord);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.event, eventRecord);
  });

  await t.test("should insert artifacts", async () => {
    const artifactRecord = { name: "test_artifact", content: "some content" };
    const result = await storage.artifacts.insert(artifactRecord);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.artifact, artifactRecord);
  });

  await t.test("agentIdentities should upsert new identity", async () => {
    const identity = { agent_id: "agent_1", agent_name: "test_agent", status: "active" };
    const result = await storage.agentIdentities.upsert(identity);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.identity, identity);

    const filePath = path.join(testBasePath, "agentIdentities", "agent_1.json");
    const fileContent = await mockFs.readFile(filePath);
    assert.deepStrictEqual(JSON.parse(fileContent), identity);

    const nameIndexFilePath = path.join(testBasePath, "agentIdentities_name_index.json");
    const nameIndexContent = await mockFs.readFile(nameIndexFilePath);
    assert.deepStrictEqual(JSON.parse(nameIndexContent), { test_agent: "agent_1" });
  });

  await t.test("agentIdentities should update existing identity", async () => {
    const initialIdentity = { agent_id: "agent_1", agent_name: "test_agent", status: "active" };
    await storage.agentIdentities.upsert(initialIdentity);
    const updatedIdentity = { agent_id: "agent_1", agent_name: "test_agent", status: "inactive" };
    const result = await storage.agentIdentities.upsert(updatedIdentity);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.identity, updatedIdentity);

    const filePath = path.join(testBasePath, "agentIdentities", "agent_1.json");
    const fileContent = await mockFs.readFile(filePath);
    assert.deepStrictEqual(JSON.parse(fileContent), updatedIdentity);
  });

  await t.test("agentIdentities should get identity by id", async () => {
    const identity = { agent_id: "agent_1", agent_name: "test_agent" };
    await storage.agentIdentities.upsert(identity);
    const result = await storage.agentIdentities.getById("agent_1");
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.identity, identity);
  });

  await t.test("agentIdentities should get identity by name", async () => {
    const identity = { agent_id: "agent_1", agent_name: "test_agent" };
    await storage.agentIdentities.upsert(identity);
    const result = await storage.agentIdentities.getByName("test_agent");
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.identity, identity);
  });

  await t.test("agentIdentities should list identities", async () => {
    await storage.agentIdentities.upsert({
      agent_id: "agent_1",
      agent_name: "agent1",
      status: "active",
    });
    await storage.agentIdentities.upsert({
      agent_id: "agent_2",
      agent_name: "agent2",
      status: "inactive",
    });
    const result = await storage.agentIdentities.list();
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.identities.length, 2);
    assert.deepStrictEqual(
      result.identities.map((i) => i.agent_id).sort(),
      ["agent_1", "agent_2"].sort()
    );
  });

  await t.test("agentIdentities should list identities by status", async () => {
    await storage.agentIdentities.upsert({
      agent_id: "agent_1",
      agent_name: "agent1",
      status: "active",
    });
    await storage.agentIdentities.upsert({
      agent_id: "agent_2",
      agent_name: "agent2",
      status: "inactive",
    });
    const result = await storage.agentIdentities.list({ status: "active" });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.identities.length, 1);
    assert.strictEqual(result.identities[0].status, "active");
  });

  await t.test("agentIdentities should update status", async () => {
    const identity = { agent_id: "agent_1", agent_name: "test_agent", status: "active" };
    await storage.agentIdentities.upsert(identity);
    const result = await storage.agentIdentities.updateStatus("agent_1", "inactive");
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.identity.status, "inactive");
    const updated = await storage.agentIdentities.getById("agent_1");
    assert.strictEqual(updated.identity.status, "inactive");
  });

  await t.test("tasks should upsert new task", async () => {
    const taskRecord = { name: "test_task", status: "pending" };
    const result = await storage.tasks.upsert(taskRecord);
    assert.strictEqual(result.ok, true);
    assert.ok(result.task.id);
    assert.strictEqual(result.task.name, "test_task");

    const filePath = path.join(testBasePath, "tasks", `${result.task.id}.json`);
    const fileContent = await mockFs.readFile(filePath);
    assert.deepStrictEqual(JSON.parse(fileContent), result.task);
  });

  await t.test("tasks should update existing task", async () => {
    const initialTask = { id: "task_1", name: "test_task", status: "pending", version: 1 };
    await storage.tasks.upsert(initialTask);
    const updatedTask = { id: "task_1", name: "test_task", status: "running", version: 2 };
    const result = await storage.tasks.update("task_1", updatedTask);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.task.status, "running");
    assert.strictEqual(result.task.version, 3);

    const filePath = path.join(testBasePath, "tasks", "task_1.json");
    const fileContent = await mockFs.readFile(filePath);
    assert.deepStrictEqual(JSON.parse(fileContent), result.task);
  });

  await t.test("tasks should fail update on optimistic lock mismatch", async () => {
    const initialTask = { id: "task_1", name: "test_task", status: "pending", version: 1 };
    await storage.tasks.upsert(initialTask);
    const updatedTask = { id: "task_1", name: "test_task", status: "running", version: 1 }; // Version mismatch
    const result = await storage.tasks.update("task_1", updatedTask);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, ERROR_CODES.OPTIMISTIC_LOCK_FAIL);
  });

  await t.test("tasks should get task by id", async () => {
    const task = { id: "task_1", name: "test_task" };
    await storage.tasks.upsert(task);
    const result = await storage.tasks.get("task_1");
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.task.name, "test_task");
  });

  await t.test("tasks should list tasks", async () => {
    await storage.tasks.upsert({ id: "task_1", name: "task1", status: "pending" });
    await storage.tasks.upsert({ id: "task_2", name: "task2", status: "running" });
    const result = await storage.tasks.list();
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.tasks.length, 2);
    assert.deepStrictEqual(result.tasks.map((j) => j.id).sort(), ["task_1", "task_2"].sort());
  });

  await t.test("tasks should list tasks by status", async () => {
    await storage.tasks.upsert({ id: "task_1", name: "task1", status: "pending" });
    await storage.tasks.upsert({ id: "task_2", name: "task2", status: "running" });
    const result = await storage.tasks.list({ status: "pending" });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.tasks.length, 1);
    assert.strictEqual(result.tasks[0].status, "pending");
  });

  await t.test("steps should upsert new step", async () => {
    const stepRecord = { task_id: "task_1", name: "test_step", status: "created" };
    const result = await storage.steps.upsert(stepRecord);
    assert.strictEqual(result.ok, true);
    assert.ok(result.step.id);
    assert.strictEqual(result.step.name, "test_step");

    const filePath = path.join(testBasePath, "steps", `${result.step.id}.json`);
    const fileContent = await mockFs.readFile(filePath);
    assert.deepStrictEqual(JSON.parse(fileContent), result.step);
  });

  await t.test("steps should list steps by task", async () => {
    await storage.steps.upsert({ task_id: "task_1", name: "step1" });
    await storage.steps.upsert({ task_id: "task_1", name: "step2" });
    await storage.steps.upsert({ task_id: "task_2", name: "step3" });
    const result = await storage.steps.listByTask("task_1");
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.steps.length, 2);
    assert.strictEqual(result.steps[0].name, "step1");
  });

  await t.test("steps should update existing step", async () => {
    const initialStep = { id: "step_1", task_id: "task_1", name: "test_step", status: "created" };
    await storage.steps.upsert(initialStep);
    const updatedStep = { status: "running" };
    const result = await storage.steps.update("task_1", "step_1", updatedStep);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.step.status, "running");

    const filePath = path.join(testBasePath, "steps", "step_1.json");
    const fileContent = await mockFs.readFile(filePath);
    assert.deepStrictEqual(JSON.parse(fileContent).status, "running");
  });

  await t.test("fileStorage should upload artifact", async () => {
    const bucket = "test_bucket";
    const artifactPath = "test/path/file.txt";
    const content = "file content";
    const result = await storage.fileStorage.uploadArtifact(bucket, artifactPath, content);
    assert.strictEqual(result.ok, true);
    const expectedFullPath = mockFs.normalizePath(
      path.join(testBasePath, "artifacts", bucket, artifactPath)
    );
    assert.strictEqual(result.path, expectedFullPath);

    const filePath = mockFs.normalizePath(
      path.join(testBasePath, "artifacts", bucket, artifactPath)
    );
    const fileContent = await mockFs.readFile(filePath);
    assert.strictEqual(fileContent, content);
  });

  await t.test("fileStorage should download artifact", async () => {
    const bucket = "test_bucket";
    const path = "test/path/file.txt";
    const content = "file content";
    await storage.fileStorage.uploadArtifact(bucket, path, content);
    const result = await storage.fileStorage.downloadArtifact(bucket, path);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.data, content);
  });

  await t.test("fileStorage should get public url", async () => {
    const bucket = "test_bucket";
    const artifactPath = "test/path/file.txt";
    const content = "file content";
    await storage.fileStorage.uploadArtifact(bucket, artifactPath, content);
    const result = await storage.fileStorage.getPublicUrl(bucket, artifactPath);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(
      result.url,
      `file://${mockFs.normalizePath(testBasePath)}/artifacts/${bucket}/${artifactPath}`
    );
  });

  await t.test("should clear all data", async () => {
    await storage.agentIdentities.upsert({
      agent_id: "agent_1",
      agent_name: "agent1",
      status: "active",
    });
    await storage.tasks.upsert({ id: "task_1", name: "task1", status: "pending" });
    await storage.steps.upsert({ task_id: "task_1", name: "step1" });
    await storage.fileStorage.uploadArtifact("b", "p", "c");

    // Simulate clearing the base path
    await mockFs.rm(testBasePath, { recursive: true, force: true });

    const listIdentities = await storage.agentIdentities.list();
    assert.strictEqual(listIdentities.identities.length, 0);
    const listTasks = await storage.tasks.list();
    assert.strictEqual(listTasks.tasks.length, 0);
    const listSteps = await storage.steps.listByTask("task_1");
    assert.strictEqual(listSteps.steps.length, 0);
    const downloadResult = await storage.fileStorage.downloadArtifact("b", "p");
    assert.strictEqual(downloadResult.ok, false);
  });
});
