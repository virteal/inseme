import { test } from "node:test";
import assert from "node:assert";
import { createSupabaseStorage } from "../supabaseStorage.js";

// Mock the Supabase client
const mockData = {
  cop_agent_identities: new Map(),
  cop_tasks: new Map(),
  cop_steps: new Map(),
};

const createMockSupabaseClient = () => {
  return {
    from: (tableName) => ({
      select: () => ({
        eq: (column, value) => ({
          maybeSingle: () => {
            const table = mockData[tableName];
            if (table) {
              console.log(
                `[MOCK SELECT maybeSingle] Searching ${tableName} for ${column} = ${value}. Current table content:`,
                Array.from(table.values())
              );
              for (const record of table.values()) {
                console.log(`[MOCK SELECT maybeSingle] Checking record:`, record);
                if (record[column] === value) {
                  console.log(
                    `[MOCK SELECT maybeSingle] Found matching record in ${tableName}:`,
                    record
                  );
                  return { data: record, error: null, status: 200 };
                }
              }
              console.log(
                `[MOCK SELECT maybeSingle] No matching record found in ${tableName} for ${column} = ${value}`
              );
            }
            return { data: null, error: null, status: 200 };
          },
          single: () => {
            const table = mockData[tableName];
            if (table) {
              console.log(
                `[MOCK SELECT single] Searching ${tableName} for ${column} = ${value} (single). Current table content:`,
                Array.from(table.values())
              );
              for (const record of table.values()) {
                console.log(`[MOCK SELECT single] Checking record:`, record);
                if (record[column] === value) {
                  console.log(
                    `[MOCK SELECT single] Found matching record in ${tableName} (single):`,
                    record
                  );
                  return { data: record, error: null, status: 200 };
                }
              }
              console.log(
                `[MOCK SELECT single] No matching record found in ${tableName} for ${column} = ${value} (single)`
              );
            }
            return { data: null, error: null, status: 200 };
          },
          get data() {
            const table = mockData[tableName];
            if (table) {
              const matchingRecords = [];
              for (const record of table.values()) {
                if (record[column] === value) {
                  matchingRecords.push(record);
                }
              }
              return matchingRecords;
            }
            return [];
          },
          get error() {
            return null;
          },
        }),
        limit: () => ({
          get data() {
            const table = mockData[tableName];
            return table ? Array.from(table.values()) : [];
          },
          get error() {
            return null;
          },
        }),
      }),
      upsert: (record, options) => {
        console.log(
          `[MOCK UPSERT] Called for table: ${tableName} with record:`,
          record,
          `and options:`,
          options
        );
        return {
          select: () => ({
            maybeSingle: () => {
              const table = mockData[tableName];
              if (table) {
                console.log(
                  `[MOCK UPSERT maybeSingle] Table ${tableName} content before upsert:`,
                  Array.from(table.values())
                );
                const idKey =
                  options && options.onConflict
                    ? options.onConflict
                    : tableName === "cop_agent_identities"
                      ? "agent_id"
                      : "id";
                table.set(record[idKey], record);
                console.log(`Mock upserted to ${tableName}:`, record);
                console.log(
                  `[MOCK UPSERT maybeSingle] Table ${tableName} content after upsert:`,
                  Array.from(table.values())
                );
                return { data: record, error: null, status: 200 };
              }
              return { data: null, error: new Error("Table not found"), status: 500 };
            },
            get data() {
              const table = mockData[tableName];
              if (table) {
                console.log(
                  `[MOCK UPSERT data accessor] Table ${tableName} content before upsert:`,
                  Array.from(table.values())
                );
                const idKey =
                  options && options.onConflict
                    ? options.onConflict
                    : tableName === "cop_agent_identities"
                      ? "agent_id"
                      : "id";
                table.set(record[idKey], record);
                console.log(`Mock upserted to ${tableName} (data accessor):`, record);
                console.log(
                  `[MOCK UPSERT data accessor] Table ${tableName} content after upsert:`,
                  Array.from(table.values())
                );
                return [record]; // Return an array for data accessor
              }
              return []; // Return empty array if table not found
            },
            get error() {
              return null;
            },
          }),
        };
      },
      update: (record) => ({
        eq: (column, value) => ({
          select: () => ({
            maybeSingle: () => {
              const table = mockData[tableName];
              if (table) {
                console.log(
                  `[MOCK UPDATE maybeSingle] Searching ${tableName} for ${column} = ${value}`
                );
                for (const [key, existingRecord] of table.entries()) {
                  if (existingRecord[column] === value) {
                    const updatedRecord = { ...existingRecord, ...record };
                    if (updatedRecord.version !== undefined) {
                      updatedRecord.version++;
                    }
                    table.set(key, updatedRecord);
                    console.log(
                      `[MOCK UPDATE maybeSingle] Found and updated record in ${tableName}:`,
                      updatedRecord
                    );
                    return { data: updatedRecord, error: null, status: 200 };
                  }
                }
                console.log(
                  `[MOCK UPDATE maybeSingle] Record not found for update in ${tableName} where ${column} = ${value}`
                );
              }
              return { data: null, error: new Error("Record not found"), status: 404 };
            },
            single: () => {
              const table = mockData[tableName];
              if (table) {
                console.log(`[MOCK UPDATE single] Searching ${tableName} for ${column} = ${value}`);
                for (const [key, existingRecord] of table.entries()) {
                  if (existingRecord[column] === value) {
                    const updatedRecord = { ...existingRecord, ...record };
                    if (updatedRecord.version !== undefined) {
                      updatedRecord.version++;
                    }
                    table.set(key, updatedRecord);
                    console.log(
                      `[MOCK UPDATE single] Found and updated record in ${tableName}:`,
                      updatedRecord
                    );
                    return { data: updatedRecord, error: null, status: 200 };
                  }
                }
                console.log(
                  `[MOCK UPDATE single] Record not found for update in ${tableName} where ${column} = ${value}`
                );
              }
              return { data: null, error: new Error("Record not found"), status: 404 };
            },
            get data() {
              const table = mockData[tableName];
              if (table) {
                console.log(
                  `Updating ${tableName} where ${column} = ${value} (data accessor) with:`,
                  record
                );
                for (const [key, existingRecord] of table.entries()) {
                  if (existingRecord[column] === value) {
                    const updatedRecord = { ...existingRecord, ...record };
                    if (updatedRecord.version !== undefined) {
                      updatedRecord.version++;
                    }
                    table.set(key, updatedRecord);
                    console.log(`Record updated in ${tableName} (data accessor):`, updatedRecord);
                    return [updatedRecord];
                  }
                }
                console.log(
                  `Record not found for update in ${tableName} where ${column} = ${value} (data accessor)`
                );
              }
              return [];
            },
            get error() {
              return null;
            },
          }),
        }),
      }),
      storage: {
        from: (bucketName) => ({
          upload: async (path, fileBody, options) => {
            // Mock upload logic
            console.log(`Mock uploading to ${bucketName}/${path}`);
            return { data: { path: `public/${path}` }, error: null, status: 200 };
          },
          download: async (path) => {
            // Mock download logic
            console.log(`Mock downloading from ${bucketName}/${path}`);
            return { data: new Blob([`mock content for ${path}`]), error: null, status: 200 };
          },
          getPublicUrl: (path) => {
            console.log(`Mock getting public URL for ${bucketName}/${path}`);
            return {
              data: {
                publicUrl: `http://mock.supabase.co/storage/v1/object/public/${bucketName}/${path}`,
              },
              error: null,
              status: 200,
            };
          },
        }),
      },
    }),
    debugLogs: {
      insert: async (logRecord) => {
        return { data: logRecord, error: null, status: 200 };
      },
    },
  };
};

test("supabaseStorage", async (t) => {
  let currentMockSupabaseClient;
  let storage;

  const clearMockData = () => {
    console.log("Clearing mock data...");
    mockData.cop_agent_identities.clear();
    mockData.cop_tasks.clear();
    mockData.cop_steps.clear();
  };

  t.beforeEach(() => {
    clearMockData();
    currentMockSupabaseClient = createMockSupabaseClient();
    storage = createSupabaseStorage({
      supabaseClient: currentMockSupabaseClient,
      supabaseUrl: "http://mock.supabase.url",
      supabaseServiceKey: "mock-service-key",
    });

    // Populate mockData with initial values using the same client instance
    currentMockSupabaseClient
      .from("cop_agent_identities")
      .upsert({ agent_id: "agent1", agent_name: "Test Agent" })
      .select()
      .maybeSingle();
    currentMockSupabaseClient
      .from("cop_agent_identities")
      .upsert({ agent_id: "agent2", agent_name: "Another Agent" })
      .select()
      .maybeSingle();
    currentMockSupabaseClient
      .from("cop_tasks")
      .upsert({ id: "task1", name: "Test Task", version: 1 })
      .select()
      .maybeSingle();
    currentMockSupabaseClient
      .from("cop_tasks")
      .upsert({ id: "task2", name: "Another Task" })
      .select()
      .maybeSingle();
    currentMockSupabaseClient
      .from("cop_steps")
      .upsert({ id: "step1", task_id: "task1", name: "Test Step" })
      .select()
      .maybeSingle();
    currentMockSupabaseClient
      .from("cop_steps")
      .upsert({ id: "step2", task_id: "task1", name: "Another Step" })
      .select()
      .maybeSingle();
  });

  await t.test("should return an object with expected properties", () => {
    assert.ok(storage.agentIdentities, "should have agentIdentities property");
    assert.ok(storage.tasks, "should have tasks property");
    assert.ok(storage.steps, "should have steps property");
    assert.ok(storage.fileStorage, "should have fileStorage property");
    assert.ok(storage.getCacheContents, "should have getCacheContents property");
    assert.ok(storage.clearCache, "should have clearCache property");
  });

  await t.test("agentIdentities", async (t) => {
    await t.test("should upsert an agent identity", async () => {
      const identity = { agent_id: "agent1", agent_name: "Test Agent" };
      const result = await storage.agentIdentities.upsert(identity);
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result, { ok: true, data: identity });
    });

    await t.test("should get an agent identity by id", async () => {
      const identity = { agent_id: "agent1", agent_name: "Test Agent" };

      const result = await storage.agentIdentities.getById("agent1");
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result, { ok: true, data: identity });
    });

    await t.test("should get an agent identity by name", async () => {
      const identity = { agent_id: "agent1", agent_name: "Test Agent" };

      const result = await storage.agentIdentities.getByName("Test Agent");
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, identity);
    });

    await t.test("should list agent identities", async () => {
      const identities = [
        { agent_id: "agent1", agent_name: "Test Agent" },
        { agent_id: "agent2", agent_name: "Another Agent" },
      ];

      const result = await storage.agentIdentities.list();
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, identities);
    });

    await t.test("should update agent status", async () => {
      const identity = { agent_id: "agent1", agent_name: "Test Agent", status: "active" };
      const updatedIdentity = { ...identity, status: "inactive" };
      const result = await storage.agentIdentities.updateStatus("agent1", "inactive");
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, updatedIdentity);
    });
  });

  await t.test("tasks", async (t) => {
    await t.test("should upsert a task", async () => {
      const task = { id: "task1", name: "Test Task", version: 1 };
      const result = await storage.tasks.upsert(task);
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result, { ok: true, data: { ...task, version: 1 } });
    });

    await t.test("should get a task by id", async () => {
      const task = { id: "task1", name: "Test Task", version: 1 };
      const result = await storage.tasks.get("task1");
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result, { ok: true, data: { ...task, version: 1 } });
    });

    await t.test("should list tasks", async () => {
      const tasks = [
        { id: "task1", name: "Test Task", version: 1 },
        { id: "task2", name: "Another Task" },
      ];
      const result = await storage.tasks.list();
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result, { ok: true, data: tasks });
    });

    await t.test("should update a task", async () => {
      const task = { id: "task1", name: "Test Task", version: 1 };
      const updatedTask = { ...task, status: "completed", version: 2 };
      const result = await storage.tasks.update("task1", { status: "completed", version: 1 });
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, updatedTask);
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
      const steps = [
        { id: "step1", task_id: "task1", name: "Test Step" },
        { id: "step2", task_id: "task1", name: "Another Step" },
      ];
      await storage.steps.upsert(steps[0]);
      await storage.steps.upsert(steps[1]);

      const result = await storage.steps.listByTask("task1");
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, [steps[0], steps[1]]);
    });

    await t.test("should update a step", async () => {
      const step = { id: "step1", task_id: "task1", name: "Test Step" };
      const updatedStep = { ...step, status: "completed" };

      const result = await storage.steps.update("task1", "step1", { status: "completed" });
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.data, updatedStep);
    });
  });

  await t.test("cache", async (t) => {
    await t.test("should return cache contents", async () => {
      const cacheContents = storage.getCacheContents();
      assert.ok(cacheContents.agentIdentities);
      assert.ok(cacheContents.tasks);
      assert.ok(cacheContents.steps);
    });

    await t.test("should clear cache", async () => {
      // Populate cache first
      await storage.agentIdentities.upsert({ agent_id: "agent1", agent_name: "Test Agent" });
      await storage.tasks.upsert({ id: "task1", name: "Test Task" });
      await storage.steps.upsert({ id: "step1", task_id: "task1", name: "Test Step" });

      storage.clearCache();

      const cacheContents = storage.getCacheContents();
      assert.strictEqual(cacheContents.agentIdentities.length, 0);
      assert.strictEqual(cacheContents.tasks.length, 0);
      assert.strictEqual(cacheContents.steps.length, 0);
    });
  });
});
