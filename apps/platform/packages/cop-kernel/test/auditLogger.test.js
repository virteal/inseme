import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { createAuditLogger } from "../src/storage-implementations/auditLogger.js";
import { createFileBasedStorage } from "../src/storage-implementations/fileBasedStorage.js";

describe("AuditLogger Module", () => {
  let auditLogger;
  let testAuditLogPath;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(process.cwd(), "test_audit_logger_data-"));
    testAuditLogPath = path.join(tempDir, "audit_logs.jsonl");
    auditLogger = createAuditLogger({ auditLogPath: testAuditLogPath });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should log events to a JSONL file", async () => {
    const event1 = {
      eventType: "TestEvent1",
      entityType: "test",
      entityId: "1",
      payload: { key: "value1" },
    };
    const event2 = {
      eventType: "TestEvent2",
      entityType: "test",
      entityId: "2",
      payload: { key: "value2" },
    };

    await auditLogger.logEvent(event1);
    await auditLogger.logEvent(event2);

    const content = await fs.readFile(testAuditLogPath, "utf8");
    const lines = content.trim().split("\n");

    assert.strictEqual(lines.length, 2);

    const parsedEvent1 = JSON.parse(lines[0]);
    assert.strictEqual(parsedEvent1.eventType, event1.eventType);
    assert.strictEqual(parsedEvent1.entityId, event1.entityId);
    assert.deepStrictEqual(parsedEvent1.payload, event1.payload);
    assert.ok(parsedEvent1.timestamp);

    const parsedEvent2 = JSON.parse(lines[1]);
    assert.strictEqual(parsedEvent2.eventType, event2.eventType);
    assert.strictEqual(parsedEvent2.entityId, event2.entityId);
    assert.deepStrictEqual(parsedEvent2.payload, event2.payload);
    assert.ok(parsedEvent2.timestamp);
  });

  it("should append new events to the log file", async () => {
    const event1 = { eventType: "InitialEvent", entityType: "test", entityId: "1", payload: {} };
    await auditLogger.logEvent(event1);

    const event2 = { eventType: "SecondEvent", entityType: "test", entityId: "2", payload: {} };
    await auditLogger.logEvent(event2);

    const content = await fs.readFile(testAuditLogPath, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 2);
  });
});

describe("FileBasedStorage Audit Integration", () => {
  let storage;
  let testAuditLogPath;
  let testBasePath;
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(process.cwd(), "test_file_storage_audit_data-"));
    testAuditLogPath = path.join(tempDir, "audit_logs.jsonl");
    testBasePath = path.join(tempDir, "file_storage_data");
    storage = await createFileBasedStorage({
      basePath: testBasePath,
      auditLogPath: testAuditLogPath,
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should log AgentIdentityUpserted event on agentIdentities.upsert", async () => {
    const identity = { agent_id: "agent1", agent_name: "Agent One", status: "active" };
    await storage.agentIdentities.upsert(identity);

    const content = await fs.readFile(testAuditLogPath, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 1);

    const loggedEvent = JSON.parse(lines[0]);
    assert.strictEqual(loggedEvent.eventType, "AgentIdentityUpserted");
    assert.strictEqual(loggedEvent.entityType, "agentIdentity");
    assert.strictEqual(loggedEvent.entityId, "agent1");
    assert.deepStrictEqual(loggedEvent.payload, identity);
  });

  it("should log AgentIdentityStatusUpdated event on agentIdentities.updateStatus", async () => {
    const identity = { agent_id: "agent2", agent_name: "Agent Two", status: "active" };
    await storage.agentIdentities.upsert(identity);
    await storage.agentIdentities.updateStatus("agent2", "inactive");

    const content = await fs.readFile(testAuditLogPath, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 2); // upsert + updateStatus

    const loggedEvent = JSON.parse(lines[1]); // Second event
    assert.strictEqual(loggedEvent.eventType, "AgentIdentityStatusUpdated");
    assert.strictEqual(loggedEvent.entityType, "agentIdentity");
    assert.strictEqual(loggedEvent.entityId, "agent2");
    assert.deepStrictEqual(loggedEvent.payload, { oldStatus: "active", newStatus: "inactive" });
  });

  it("should log TaskUpserted event on tasks.upsert", async () => {
    const task = { id: "task1", name: "Test Task", status: "pending" };
    await storage.tasks.upsert(task);

    const content = await fs.readFile(testAuditLogPath, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 1);

    const loggedEvent = JSON.parse(lines[0]);
    assert.strictEqual(loggedEvent.eventType, "TaskUpserted");
    assert.strictEqual(loggedEvent.entityType, "task");
    assert.strictEqual(loggedEvent.entityId, "task1");
    assert.ok(loggedEvent.payload.version); // Version should be incremented
    assert.strictEqual(loggedEvent.payload.name, task.name);
  });

  it("should log TaskUpdated event on tasks.update", async () => {
    const task = { id: "task2", name: "Test Task 2", status: "pending", version: 0 };
    await storage.tasks.upsert(task);
    await storage.tasks.update("task2", { status: "running", version: 1 });

    const content = await fs.readFile(testAuditLogPath, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 2); // upsert + update

    const loggedEvent = JSON.parse(lines[1]); // Second event
    assert.strictEqual(loggedEvent.eventType, "TaskUpdated");
    assert.strictEqual(loggedEvent.entityType, "task");
    assert.strictEqual(loggedEvent.entityId, "task2");
    assert.deepStrictEqual(loggedEvent.payload.patch, { status: "running", version: 1 });
    assert.strictEqual(loggedEvent.payload.newTask.status, "running");
    assert.strictEqual(loggedEvent.payload.newTask.version, 2); // Original version 0 + 1 (upsert) + 1 (update)
  });

  it("should log StepUpserted event on steps.upsert", async () => {
    const step = { id: "step1", task_id: "task1", name: "Step One", status: "created" };
    await storage.steps.upsert(step);

    const content = await fs.readFile(testAuditLogPath, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 1);

    const loggedEvent = JSON.parse(lines[0]);
    assert.strictEqual(loggedEvent.eventType, "StepUpserted");
    assert.strictEqual(loggedEvent.entityType, "step");
    assert.strictEqual(loggedEvent.entityId, "step1");
    assert.deepStrictEqual(loggedEvent.payload, step);
  });

  it("should log StepUpdated event on steps.update", async () => {
    const step = { id: "step2", task_id: "task2", name: "Step Two", status: "created" };
    await storage.steps.upsert(step);
    await storage.steps.update("task2", "step2", { status: "running" });

    const content = await fs.readFile(testAuditLogPath, "utf8");
    const lines = content.trim().split("\n");
    assert.strictEqual(lines.length, 2); // upsert + update

    const loggedEvent = JSON.parse(lines[1]); // Second event
    assert.strictEqual(loggedEvent.eventType, "StepUpdated");
    assert.strictEqual(loggedEvent.entityType, "step");
    assert.strictEqual(loggedEvent.entityId, "step2");
    assert.deepStrictEqual(loggedEvent.payload.patch, { status: "running" });
    assert.strictEqual(loggedEvent.payload.newStep.status, "running");
  });
});
