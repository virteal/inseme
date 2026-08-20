/**
 * Reference in-memory execution-budget reservation ledger.
 *
 * This is intentionally a small, provider-neutral reference implementation.
 * Production stores must offer the same reserve/settle/release atomicity over
 * durable COP events before consequential handlers are connected.
 */

const DIMENSIONS = Object.freeze([
  "max_steps",
  "max_tool_calls",
  "max_subagents",
  "max_elapsed_ms",
  "max_external_effects",
]);

function normalizeForecasts(value = []) {
  if (!Array.isArray(value)) throw new TypeError("forecasts must be an array");
  return structuredClone(value);
}

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

function normalizeLimits(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${name} is required`);
  const out = {};
  for (const dimension of DIMENSIONS) {
    const amount = value[dimension];
    if (!Number.isInteger(amount) || amount < 0) {
      throw new TypeError(`${name}.${dimension} must be a non-negative integer`);
    }
    out[dimension] = amount;
  }
  return out;
}

function zero() {
  return Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 0]));
}

function add(left, right) {
  return Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, left[dimension] + right[dimension]])
  );
}

function subtract(left, right) {
  return Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, left[dimension] - right[dimension]])
  );
}

function exceeds(left, right) {
  return DIMENSIONS.find((dimension) => left[dimension] > right[dimension]) || null;
}

/**
 * Create one budget ledger. Calls are synchronous so reserve is atomic within
 * this reference process; a persistent adapter must preserve that invariant.
 */
export function createMemoryExecutionBudgetLedger({ budget_id, limits } = {}) {
  requireText(budget_id, "budget_id");
  const maximum = normalizeLimits(limits, "limits");
  const reservations = new Map();
  const idempotency = new Map();
  let reserved = zero();
  let settled = zero();
  let version = 1;

  function snapshot() {
    return {
      budget_id,
      version,
      limits: { ...maximum },
      reserved: { ...reserved },
      settled: { ...settled },
      available: subtract(maximum, add(reserved, settled)),
    };
  }

  return {
    reserve({ idempotency_key, expected_version, demand, forecasts = [] } = {}) {
      requireText(idempotency_key, "idempotency_key");
      const requested = normalizeLimits(demand, "demand");
      const existingId = idempotency.get(idempotency_key);
      if (existingId)
        return {
          ok: true,
          duplicate: true,
          reservation: structuredClone(reservations.get(existingId)),
          snapshot: snapshot(),
        };
      if (!Number.isInteger(expected_version) || expected_version !== version) {
        return { ok: false, error: "budget_version_conflict", snapshot: snapshot() };
      }

      const next = add(add(reserved, settled), requested);
      const exceeded = exceeds(next, maximum);
      if (exceeded) {
        return { ok: false, error: "budget_exhausted", dimension: exceeded, snapshot: snapshot() };
      }
      const reservation = {
        reservation_id: `reservation:${budget_id}:${reservations.size + 1}`,
        budget_id,
        idempotency_key,
        demand: requested,
        forecasts: normalizeForecasts(forecasts),
        status: "reserved",
        settled: zero(),
      };
      reservations.set(reservation.reservation_id, reservation);
      idempotency.set(idempotency_key, reservation.reservation_id);
      reserved = add(reserved, requested);
      version += 1;
      return {
        ok: true,
        duplicate: false,
        reservation: structuredClone(reservation),
        snapshot: snapshot(),
      };
    },

    settle({ reservation_id, expected_version, usage } = {}) {
      requireText(reservation_id, "reservation_id");
      const reservation = reservations.get(reservation_id);
      if (!reservation) return { ok: false, error: "unknown_reservation", snapshot: snapshot() };
      if (reservation.status !== "reserved")
        return { ok: false, error: "reservation_not_active", snapshot: snapshot() };
      if (!Number.isInteger(expected_version) || expected_version !== version) {
        return { ok: false, error: "budget_version_conflict", snapshot: snapshot() };
      }
      const observed = normalizeLimits(usage, "usage");
      const exceeded = exceeds(observed, reservation.demand);
      if (exceeded)
        return {
          ok: false,
          error: "usage_exceeds_reservation",
          dimension: exceeded,
          snapshot: snapshot(),
        };
      reservation.status = "settled";
      reservation.settled = observed;
      reserved = subtract(reserved, reservation.demand);
      settled = add(settled, observed);
      version += 1;
      return {
        ok: true,
        reservation: structuredClone(reservation),
        released: subtract(reservation.demand, observed),
        snapshot: snapshot(),
      };
    },

    release({ reservation_id, expected_version } = {}) {
      requireText(reservation_id, "reservation_id");
      const reservation = reservations.get(reservation_id);
      if (!reservation) return { ok: false, error: "unknown_reservation", snapshot: snapshot() };
      if (reservation.status !== "reserved")
        return { ok: false, error: "reservation_not_active", snapshot: snapshot() };
      if (!Number.isInteger(expected_version) || expected_version !== version) {
        return { ok: false, error: "budget_version_conflict", snapshot: snapshot() };
      }
      reservation.status = "released";
      reserved = subtract(reserved, reservation.demand);
      version += 1;
      return { ok: true, reservation: structuredClone(reservation), snapshot: snapshot() };
    },

    snapshot,
  };
}

function executionBudgetTopic(budgetId) {
  return `execution-budget:${budgetId}`;
}

function listTopicEvents(store, topic) {
  if (typeof store?.listTopic === "function") return store.listTopic(topic);
  if (typeof store?.replay === "function") {
    return store.replay().filter((event) => event?.topic?.id === topic);
  }
  throw new TypeError("COP event store must provide listTopic() or replay()");
}

function projectEventLedger({ budget_id, limits, events }) {
  const reservations = new Map();
  let reserved = zero();
  let settled = zero();
  let version = 0;

  for (const event of events) {
    version = Math.max(version, event.topic?.seq || 0);
    const payload = event.payload || {};
    if (payload.budget_id !== budget_id) continue;
    if (event.event_type === "ExecutionBudgetReservation") {
      if (reservations.has(payload.reservation?.reservation_id)) continue;
      const reservation = structuredClone(payload.reservation);
      reservations.set(reservation.reservation_id, reservation);
      reserved = add(reserved, reservation.demand);
      continue;
    }
    const reservation = reservations.get(payload.reservation_id);
    if (!reservation || reservation.status !== "reserved") continue;
    if (event.event_type === "ExecutionBudgetSettlement") {
      reservation.status = "settled";
      reservation.settled = structuredClone(payload.usage);
      reserved = subtract(reserved, reservation.demand);
      settled = add(settled, payload.usage);
    } else if (event.event_type === "ExecutionBudgetRelease") {
      reservation.status = "released";
      reserved = subtract(reserved, reservation.demand);
    }
  }

  return {
    reservations,
    snapshot: {
      budget_id,
      version,
      limits: { ...limits },
      reserved,
      settled,
      available: subtract(limits, add(reserved, settled)),
    },
  };
}

/**
 * Project an execution-budget ledger from append-only COP events.
 *
 * The event store's topic sequence is the optimistic-lock version. A stale
 * writer therefore records nothing and receives the current snapshot; an
 * uncertain forecast stays evidence on a reservation, never a capacity claim.
 * The supplied store must durably make `append()` and the expected topic
 * sequence atomic before this adapter is used for consequential work.
 */
export function createEventSourcedExecutionBudgetLedger({
  store,
  budget_id,
  limits,
  event_context = {},
} = {}) {
  requireText(budget_id, "budget_id");
  const maximum = normalizeLimits(limits, "limits");
  if (!store || typeof store.append !== "function") {
    throw new TypeError("COP event store must provide append()");
  }
  const topic = executionBudgetTopic(budget_id);

  function current() {
    return projectEventLedger({
      budget_id,
      limits: maximum,
      events: listTopicEvents(store, topic),
    });
  }

  function append(event_type, expected_version, idempotency_key, payload) {
    return store.append({
      ...event_context,
      event_type,
      topic: { id: topic, seq: expected_version + 1 },
      idempotency_key,
      epistemic_status: "observed",
      visibility: "restricted",
      payload: { budget_id, ...payload },
    });
  }

  function conflict(snapshot) {
    return { ok: false, error: "budget_version_conflict", snapshot };
  }

  return {
    reserve({ idempotency_key, expected_version, demand, forecasts = [] } = {}) {
      requireText(idempotency_key, "idempotency_key");
      const requested = normalizeLimits(demand, "demand");
      const state = current();
      const existing = [...state.reservations.values()].find(
        (reservation) => reservation.idempotency_key === idempotency_key
      );
      if (existing)
        return {
          ok: true,
          duplicate: true,
          reservation: structuredClone(existing),
          snapshot: state.snapshot,
        };
      if (!Number.isInteger(expected_version) || expected_version !== state.snapshot.version)
        return conflict(state.snapshot);
      const next = add(add(state.snapshot.reserved, state.snapshot.settled), requested);
      const dimension = exceeds(next, maximum);
      if (dimension)
        return { ok: false, error: "budget_exhausted", dimension, snapshot: state.snapshot };

      const reservation = {
        reservation_id: `reservation:${budget_id}:${idempotency_key}`,
        budget_id,
        idempotency_key,
        demand: requested,
        forecasts: normalizeForecasts(forecasts),
        status: "reserved",
        settled: zero(),
      };
      const result = append(
        "ExecutionBudgetReservation",
        expected_version,
        `execution-budget:reserve:${budget_id}:${idempotency_key}`,
        { reservation }
      );
      if (!result.ok) return conflict(current().snapshot);
      const after = current();
      return {
        ok: true,
        duplicate: Boolean(result.duplicate),
        reservation: structuredClone(after.reservations.get(reservation.reservation_id)),
        snapshot: after.snapshot,
      };
    },

    settle({ reservation_id, expected_version, usage, idempotency_key } = {}) {
      requireText(reservation_id, "reservation_id");
      const observed = normalizeLimits(usage, "usage");
      const key = idempotency_key || `settle:${reservation_id}`;
      const appendKey = `execution-budget:settle:${budget_id}:${key}`;
      const state = current();
      const reservation = state.reservations.get(reservation_id);
      if (!reservation)
        return { ok: false, error: "unknown_reservation", snapshot: state.snapshot };
      const prior = listTopicEvents(store, topic).find(
        (event) => event.idempotency_key === appendKey
      );
      if (prior) {
        const priorUsage = prior.payload.usage;
        return {
          ok: true,
          duplicate: true,
          reservation: structuredClone(reservation),
          released: subtract(reservation.demand, priorUsage),
          snapshot: state.snapshot,
        };
      }
      if (reservation.status !== "reserved")
        return { ok: false, error: "reservation_not_active", snapshot: state.snapshot };
      if (!Number.isInteger(expected_version) || expected_version !== state.snapshot.version)
        return conflict(state.snapshot);
      const dimension = exceeds(observed, reservation.demand);
      if (dimension)
        return {
          ok: false,
          error: "usage_exceeds_reservation",
          dimension,
          snapshot: state.snapshot,
        };
      const result = append("ExecutionBudgetSettlement", expected_version, appendKey, {
        reservation_id,
        usage: observed,
      });
      if (!result.ok) return conflict(current().snapshot);
      const after = current();
      const settledReservation = after.reservations.get(reservation_id);
      return {
        ok: true,
        duplicate: Boolean(result.duplicate),
        reservation: structuredClone(settledReservation),
        released: subtract(reservation.demand, observed),
        snapshot: after.snapshot,
      };
    },

    release({ reservation_id, expected_version, idempotency_key } = {}) {
      requireText(reservation_id, "reservation_id");
      const key = idempotency_key || `release:${reservation_id}`;
      const appendKey = `execution-budget:release:${budget_id}:${key}`;
      const state = current();
      const reservation = state.reservations.get(reservation_id);
      if (!reservation)
        return { ok: false, error: "unknown_reservation", snapshot: state.snapshot };
      if (listTopicEvents(store, topic).some((event) => event.idempotency_key === appendKey)) {
        return {
          ok: true,
          duplicate: true,
          reservation: structuredClone(reservation),
          snapshot: state.snapshot,
        };
      }
      if (reservation.status !== "reserved")
        return { ok: false, error: "reservation_not_active", snapshot: state.snapshot };
      if (!Number.isInteger(expected_version) || expected_version !== state.snapshot.version)
        return conflict(state.snapshot);
      const result = append("ExecutionBudgetRelease", expected_version, appendKey, {
        reservation_id,
      });
      if (!result.ok) return conflict(current().snapshot);
      const after = current();
      return {
        ok: true,
        duplicate: Boolean(result.duplicate),
        reservation: structuredClone(after.reservations.get(reservation_id)),
        snapshot: after.snapshot,
      };
    },

    snapshot() {
      return current().snapshot;
    },
  };
}

export { DIMENSIONS };
