import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { createSqliteCopEventStore } from "../cop/sqliteRuntimeStore.js";
import { createEventSourcedExecutionBudgetLedger } from "../../../../packages/cop-core/src/execution-budget.js";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260801120000_cop_runtime_portable_tables.sql",
    import.meta.url
  ),
  "utf8"
);

const limits = {
  max_steps: 2,
  max_tool_calls: 1,
  max_subagents: 0,
  max_elapsed_ms: 1000,
  max_external_effects: 0,
};

test("SQLite COP event store durably enforces the budget topic version", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(migration);
  try {
    const first = createEventSourcedExecutionBudgetLedger({
      store: createSqliteCopEventStore(database),
      budget_id: "budget:sqlite",
      limits,
    });
    const second = createEventSourcedExecutionBudgetLedger({
      store: createSqliteCopEventStore(database),
      budget_id: "budget:sqlite",
      limits,
    });
    const reserved = first.reserve({
      idempotency_key: "run:sqlite-one",
      expected_version: 0,
      demand: {
        max_steps: 1,
        max_tool_calls: 0,
        max_subagents: 0,
        max_elapsed_ms: 100,
        max_external_effects: 0,
      },
    });
    assert.equal(reserved.ok, true);
    assert.equal(reserved.snapshot.version, 1);
    const stale = second.reserve({
      idempotency_key: "run:sqlite-two",
      expected_version: 0,
      demand: {
        max_steps: 1,
        max_tool_calls: 0,
        max_subagents: 0,
        max_elapsed_ms: 100,
        max_external_effects: 0,
      },
    });
    assert.equal(stale.error, "budget_version_conflict");
    assert.equal(second.snapshot().available.max_steps, 1);

    const restarted = createEventSourcedExecutionBudgetLedger({
      store: createSqliteCopEventStore(database),
      budget_id: "budget:sqlite",
      limits,
    });
    assert.equal(restarted.snapshot().version, 1);
    assert.equal(restarted.snapshot().reserved.max_steps, 1);
    const duplicate = restarted.reserve({
      idempotency_key: "run:sqlite-one",
      expected_version: 0,
      demand: reserved.reservation.demand,
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(database.prepare("SELECT count(*) AS count FROM cop_events").get().count, 1);
  } finally {
    database.close();
  }
});
