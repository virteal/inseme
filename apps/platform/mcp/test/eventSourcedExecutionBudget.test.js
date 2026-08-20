import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryCopEventStore } from "../../../../packages/cop-core/src/cop-event-spool.js";
import { createEventSourcedExecutionBudgetLedger } from "../../../../packages/cop-core/src/execution-budget.js";

const limits = {
  max_steps: 2,
  max_tool_calls: 3,
  max_subagents: 1,
  max_elapsed_ms: 1000,
  max_external_effects: 0,
};

test("event-sourced execution budget is an append-only projection", () => {
  const store = createMemoryCopEventStore();
  const ledger = createEventSourcedExecutionBudgetLedger({
    store,
    budget_id: "budget:event",
    limits,
  });
  const reserved = ledger.reserve({
    idempotency_key: "run:one",
    expected_version: 0,
    demand: {
      max_steps: 2,
      max_tool_calls: 1,
      max_subagents: 0,
      max_elapsed_ms: 200,
      max_external_effects: 0,
    },
    forecasts: [
      {
        status: "estimated",
        resource_type: "human.attention",
        confidence: { level: 0.3, basis: "operator estimate" },
      },
    ],
  });
  assert.equal(reserved.ok, true);
  assert.equal(reserved.snapshot.version, 1);
  assert.equal(
    store.listTopic("execution-budget:budget:event")[0].event_type,
    "ExecutionBudgetReservation"
  );
  assert.equal(reserved.reservation.forecasts[0].confidence.level, 0.3);

  const settled = ledger.settle({
    reservation_id: reserved.reservation.reservation_id,
    expected_version: 1,
    usage: {
      max_steps: 1,
      max_tool_calls: 1,
      max_subagents: 0,
      max_elapsed_ms: 100,
      max_external_effects: 0,
    },
  });
  assert.equal(settled.ok, true);
  assert.equal(settled.snapshot.version, 2);
  assert.equal(settled.snapshot.reserved.max_steps, 0);
  assert.equal(settled.snapshot.settled.max_steps, 1);
  assert.equal(
    store.listTopic("execution-budget:budget:event")[1].event_type,
    "ExecutionBudgetSettlement"
  );
  const repeated = ledger.settle({
    reservation_id: reserved.reservation.reservation_id,
    expected_version: 0,
    usage: {
      max_steps: 1,
      max_tool_calls: 1,
      max_subagents: 0,
      max_elapsed_ms: 100,
      max_external_effects: 0,
    },
  });
  assert.equal(repeated.ok, true);
  assert.equal(repeated.duplicate, true);
  assert.equal(store.listTopic("execution-budget:budget:event").length, 2);
});

test("event-sourced execution budget rejects stale writers without consuming capacity", () => {
  const store = createMemoryCopEventStore();
  const first = createEventSourcedExecutionBudgetLedger({
    store,
    budget_id: "budget:race",
    limits,
  });
  const stale = createEventSourcedExecutionBudgetLedger({
    store,
    budget_id: "budget:race",
    limits,
  });
  const one = first.reserve({
    idempotency_key: "run:one",
    expected_version: 0,
    demand: {
      max_steps: 1,
      max_tool_calls: 0,
      max_subagents: 0,
      max_elapsed_ms: 0,
      max_external_effects: 0,
    },
  });
  assert.equal(one.ok, true);
  const rejected = stale.reserve({
    idempotency_key: "run:two",
    expected_version: 0,
    demand: {
      max_steps: 1,
      max_tool_calls: 0,
      max_subagents: 0,
      max_elapsed_ms: 0,
      max_external_effects: 0,
    },
    forecasts: [
      {
        status: "estimated",
        resource_type: "provider.subscription.quota",
        confidence: { level: 0.1, basis: "opaque" },
      },
    ],
  });
  assert.equal(rejected.error, "budget_version_conflict");
  assert.equal(rejected.snapshot.available.max_steps, 1);
  assert.equal(store.listTopic("execution-budget:budget:race").length, 1);
});
