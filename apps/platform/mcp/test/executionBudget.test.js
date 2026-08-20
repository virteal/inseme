import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryExecutionBudgetLedger } from "../../../../packages/cop-core/src/execution-budget.js";

const limits = {
  max_steps: 2,
  max_tool_calls: 3,
  max_subagents: 1,
  max_elapsed_ms: 1000,
  max_external_effects: 0,
};

test("execution budget reserves before work and refuses overspend", () => {
  const ledger = createMemoryExecutionBudgetLedger({ budget_id: "budget:test", limits });
  const first = ledger.reserve({
    idempotency_key: "run:one",
    expected_version: 1,
    demand: {
      max_steps: 1,
      max_tool_calls: 2,
      max_subagents: 1,
      max_elapsed_ms: 500,
      max_external_effects: 0,
    },
    forecasts: [
      { status: "estimated", resource_type: "human.attention", confidence: { level: 0.4 } },
    ],
  });
  assert.equal(first.ok, true);
  assert.equal(
    ledger.reserve({
      idempotency_key: "run:one",
      expected_version: 0,
      demand: first.reservation.demand,
    }).duplicate,
    true
  );
  assert.equal(first.reservation.forecasts[0].confidence.level, 0.4);
  const refused = ledger.reserve({
    idempotency_key: "run:two",
    expected_version: first.snapshot.version,
    demand: {
      max_steps: 2,
      max_tool_calls: 0,
      max_subagents: 0,
      max_elapsed_ms: 0,
      max_external_effects: 0,
    },
  });
  assert.deepEqual(
    { ok: refused.ok, error: refused.error, dimension: refused.dimension },
    {
      ok: false,
      error: "budget_exhausted",
      dimension: "max_steps",
    }
  );
});

test("execution budget reports optimistic-version conflicts without reserving a forecast", () => {
  const ledger = createMemoryExecutionBudgetLedger({ budget_id: "budget:test", limits });
  const stale = ledger.reserve({
    idempotency_key: "run:stale",
    expected_version: 0,
    demand: {
      max_steps: 0,
      max_tool_calls: 0,
      max_subagents: 0,
      max_elapsed_ms: 0,
      max_external_effects: 0,
    },
    forecasts: [
      {
        status: "estimated",
        resource_type: "provider.subscription.quota",
        confidence: { level: 0.1 },
      },
    ],
  });
  assert.equal(stale.error, "budget_version_conflict");
  assert.equal(stale.snapshot.reserved.max_steps, 0);
  assert.equal(stale.snapshot.version, 1);
});

test("execution budget settles observed use and releases unused reservation", () => {
  const ledger = createMemoryExecutionBudgetLedger({ budget_id: "budget:test", limits });
  const reserved = ledger.reserve({
    idempotency_key: "run:one",
    expected_version: 1,
    demand: {
      max_steps: 2,
      max_tool_calls: 3,
      max_subagents: 1,
      max_elapsed_ms: 1000,
      max_external_effects: 0,
    },
  });
  const settled = ledger.settle({
    reservation_id: reserved.reservation.reservation_id,
    expected_version: reserved.snapshot.version,
    usage: {
      max_steps: 1,
      max_tool_calls: 1,
      max_subagents: 0,
      max_elapsed_ms: 200,
      max_external_effects: 0,
    },
  });
  assert.equal(settled.ok, true);
  assert.equal(settled.released.max_steps, 1);
  assert.equal(settled.snapshot.settled.max_elapsed_ms, 200);
  assert.equal(settled.snapshot.reserved.max_steps, 0);
  assert.equal(
    ledger.settle({
      reservation_id: reserved.reservation.reservation_id,
      expected_version: settled.snapshot.version,
      usage: limits,
    }).error,
    "reservation_not_active"
  );
});
