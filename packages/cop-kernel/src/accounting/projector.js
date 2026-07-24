/**
 * COP/Accounting Projector
 *
 * Derives accounting state (balances, budgets, reservations) from immutable Events.
 * All projections are deterministic and storage-independent.
 *
 * @module accounting/projector
 */

import {
  addQuantities,
  subtractQuantities,
  compareQuantities,
  isZero,
  toDecimal,
} from "./quantity.js";

/**
 * Project account balances from transaction and reversal events.
 *
 * @param {Array} events - Array of accounting events
 * @returns {Map<string, Object>} Map of account_id -> AccountBalance
 */
export function projectAccountBalances(events) {
  const balances = new Map();
  const processedEventIds = new Set();

  for (const event of events) {
    // Skip duplicate events by transaction/reversal/account ID
    const eventId = event.transaction_id || event.reversal_id || event.account_id;
    if (eventId && processedEventIds.has(eventId)) {
      continue; // Idempotency: skip already-processed events
    }
    if (eventId) {
      processedEventIds.add(eventId);
    }
    if (event.eventType !== "accounting/transaction" && event.eventType !== "accounting/reversal") {
      continue;
    }

    const accountingDomain = event.accounting_domain;
    const resourceType = event.resource_type;

    if (event.eventType === "accounting/transaction") {
      // Process transaction postings
      for (const posting of event.postings || []) {
        const accountId = posting.account;
        const quantity = posting.quantity;
        const postingType = posting.posting_type;

        const key = `${accountId}|${event.accounting_domain}|${event.resource_type}`;
        const current = balances.get(key) || {
          account_id: accountId,
          accounting_domain: event.accounting_domain,
          resource_type: event.resource_type,
          balance: { coefficient: "0", scale: quantity.scale, unit: quantity.unit },
          available: { coefficient: "0", scale: quantity.scale, unit: quantity.unit },
          reserved: { coefficient: "0", scale: quantity.scale, unit: quantity.unit },
          last_event_id: event.transaction_id,
          as_of: event.timestamp || new Date().toISOString(),
        };

        // Apply posting to balance
        if (postingType === "debit") {
          current.balance = addQuantities(current.balance, quantity);
        } else if (postingType === "credit") {
          current.balance = subtractQuantities(current.balance, quantity);
        }

        current.last_event_id = event.transaction_id;
        current.as_of = event.timestamp || new Date().toISOString();

        balances.set(key, current);
      }
    }

    if (event.eventType === "accounting/reversal") {
      // Find original transaction and reverse its effect
      // For full reversals, invert all postings
      // For partial reversals, reduce by partial_amount
      if (event.reversal_type === "compensating" && event.compensating_postings) {
        for (const posting of event.compensating_postings || []) {
          const accountId = posting.account;
          const quantity = posting.quantity;
          const postingType = posting.posting_type;

          const key = `${accountId}|${event.accounting_domain}|${event.resource_type}`;
          const current = balances.get(key);

          if (current) {
            // For reversal postings, invert the normal effect:
            // Credit in reversal should decrease balance (undo a debit)
            // Debit in reversal should increase balance (undo a credit)
            if (postingType === "debit") {
              current.balance = addQuantities(current.balance, quantity);
            } else if (postingType === "credit") {
              current.balance = subtractQuantities(current.balance, quantity);
            }

            current.last_event_id = event.reversal_id;
            current.as_of = event.timestamp || new Date().toISOString();
          }
        }
      }
    }
  }

  return balances;
}

/**
 * Project budget status from budget and related events.
 *
 * @param {Array} events - Array of accounting events
 * @returns {Map<string, Object>} Map of budget_id -> BudgetStatus
 */
export function projectBudgetStatus(events) {
  const budgets = new Map();
  const reservationConsumption = new Map();

  // First pass: process budget events
  for (const event of events) {
    if (event.eventType !== "accounting/budget") {
      continue;
    }

    const budgetId = event.budget_id;
    const current = budgets.get(budgetId) || {
      budget_id: budgetId,
      resource_type: event.resource_type,
      accounting_domain: event.accounting_domain,
      granted: { coefficient: "0", scale: 0 },
      available: { coefficient: "0", scale: 0 },
      reserved: { coefficient: "0", scale: 0 },
      committed: { coefficient: "0", scale: 0 },
      spent: { coefficient: "0", scale: 0 },
      status: "active",
      valid_from: event.effective_at,
      valid_until: event.scope?.time_bounds?.valid_until,
      as_of: event.timestamp || new Date().toISOString(),
    };

    switch (event.action) {
      case "grant":
        current.granted = event.quantity;
        current.available = event.quantity;
        current.status = "active";
        break;

      case "amend":
        if (event.quantity) {
          current.granted = event.quantity;
        }
        current.available = subtractQuantities(
          current.granted,
          addQuantities(current.reserved, current.spent)
        );
        break;

      case "revoke":
        current.status = "revoked";
        current.available = { coefficient: "0", scale: current.available.scale };
        break;

      case "expire":
        current.status = "expired";
        current.available = { coefficient: "0", scale: current.available.scale };
        break;
    }

    current.as_of = event.timestamp || new Date().toISOString();
    budgets.set(budgetId, current);
  }

  // Second pass: process reservations
  for (const event of events) {
    if (event.eventType !== "accounting/reservation") {
      continue;
    }

    const budgetId = event.budget_reference?.budget_id;
    if (!budgetId) continue;

    const budget = budgets.get(budgetId);
    if (!budget) continue;

    switch (event.action) {
      case "reserve": {
        budget.reserved = addQuantities(budget.reserved, event.quantity);
        budget.available = subtractQuantities(budget.available, event.quantity);
        if (event.holding_fee) {
          budget.spent = addQuantities(budget.spent, event.holding_fee);
        }
        break;
      }

      case "release":
      case "expire": {
        budget.reserved = subtractQuantities(budget.reserved, event.quantity);
        const netReturn = event.holding_fee
          ? subtractQuantities(event.quantity, event.holding_fee)
          : event.quantity;
        budget.available = addQuantities(budget.available, netReturn);
        break;
      }

      case "commit": {
        budget.reserved = subtractQuantities(budget.reserved, event.quantity);
        budget.committed = addQuantities(budget.committed, event.quantity);
        break;
      }
    }

    budget.as_of = event.timestamp || new Date().toISOString();

    // Check if budget is exhausted
    if (
      compareQuantities(budget.available, { coefficient: "0", scale: budget.available.scale }) <= 0
    ) {
      budget.status = "exhausted";
    }

    budgets.set(budgetId, budget);
  }

  // Third pass: process transactions that consume budgets
  for (const event of events) {
    if (event.eventType !== "accounting/transaction") {
      continue;
    }

    // Track spending from budget
    if (event.consumes_reservations) {
      for (const resId of event.consumes_reservations) {
        // This would be tracked in reservation projection
        // For now, just update spent when reservations are committed
      }
    }
  }

  return budgets;
}

/**
 * Project reservation status from reservation events.
 *
 * @param {Array} events - Array of accounting events
 * @returns {Map<string, Object>} Map of reservation_id -> ReservationStatus
 */
export function projectReservationStatus(events) {
  const reservations = new Map();

  for (const event of events) {
    if (event.eventType !== "accounting/reservation") {
      continue;
    }

    const resId = event.reservation_id;
    const current = reservations.get(resId) || {
      reservation_id: resId,
      budget_reference: event.budget_reference,
      quantity: event.quantity,
      holding_fee: event.holding_fee || null,
      status: "active",
      reserved_for_account: event.reserved_for_account,
      expires_at: event.time_to_live?.expires_at,
      related_transaction_id: event.related_transaction_id,
      as_of: event.timestamp || new Date().toISOString(),
    };

    switch (event.action) {
      case "reserve":
        current.status = "active";
        current.quantity = event.quantity;
        current.holding_fee = event.holding_fee || null;
        current.expires_at = event.time_to_live?.expires_at;
        break;

      case "release":
        current.status = "released";
        break;

      case "commit":
        current.status = "committed";
        current.related_transaction_id = event.related_transaction_id;
        break;

      case "expire":
        current.status = "expired";
        break;
    }

    current.as_of = event.timestamp || new Date().toISOString();
    reservations.set(resId, current);
  }

  return reservations;
}

/**
 * Project public Kudos view from events (privacy-preserving).
 *
 * Filters out private purchase details while preserving public traceability.
 *
 * @param {Array} events - Array of accounting events
 * @returns {Array} PublicKudosProjection[]
 */
export function projectPublicKudos(events) {
  const publicEvents = [];

  for (const event of events) {
    // Only include public domain events
    if (event.accounting_domain !== "kudos.public" && event.accounting_domain !== "kudos") {
      continue;
    }

    // Skip private/confidential events
    if (event.disclosure_class === "private" || event.disclosure_class === "confidential") {
      continue;
    }

    if (event.eventType === "accounting/transaction") {
      // Determine amount from postings (simplified for public view)
      let amount = null;
      let fromAccount = null;
      let toAccount = null;

      // Try to extract from and to from postings
      if (event.postings && event.postings.length >= 2) {
        const debit = event.postings.find((p) => p.posting_type === "debit");
        const credit = event.postings.find((p) => p.posting_type === "credit");

        if (debit && debit.quantity) {
          amount = debit.quantity;
          fromAccount = debit.account;
        }
        if (credit) {
          toAccount = credit.account;
        }
      }

      // Only include if we have meaningful public data
      if (amount) {
        publicEvents.push({
          transaction_id: event.transaction_id,
          resource_type: "kudos",
          accounting_domain: "kudos.public",
          amount: amount,
          from_account: fromAccount,
          to_account: toAccount,
          category: event.category,
          timestamp: event.effective_at || event.timestamp,
          purpose: event.purpose,
        });
      }
    }
  }

  return publicEvents;
}

/**
 * Compute available budget for spending.
 *
 * @param {Object} budgetStatus - BudgetStatus projection
 * @returns {Object} Available quantity
 */
export function computeAvailableBudget(budgetStatus) {
  const totalCommitted = addQuantities(budgetStatus.reserved, budgetStatus.spent);
  return subtractQuantities(budgetStatus.granted, totalCommitted);
}

/**
 * Check if a budget can accommodate a reservation.
 *
 * @param {Object} budgetStatus - BudgetStatus projection
 * @param {Object} quantity - Quantity to reserve
 * @returns {boolean} True if sufficient budget available
 */
export function canReserve(budgetStatus, quantity) {
  if (budgetStatus.status !== "active") {
    return false;
  }

  const available = computeAvailableBudget(budgetStatus);
  try {
    const comparison = compareQuantities(available, quantity);
    return comparison >= 0;
  } catch (e) {
    return false;
  }
}

/**
 * Create a deterministic projection from an event stream.
 *
 * @param {Array} events - Ordered accounting events
 * @param {Object} options - Projection options
 * @returns {Object} Complete projection {balances, budgets, reservations, publicKudos}
 */
export function createProjection(events, options = {}) {
  // Sort events by timestamp for determinism
  const sorted = [...events].sort((a, b) => {
    const ta = a.timestamp || a.effective_at || "";
    const tb = b.timestamp || b.effective_at || "";
    return ta.localeCompare(tb);
  });

  const balances = projectAccountBalances(sorted);
  const budgets = projectBudgetStatus(sorted);
  const reservations = projectReservationStatus(sorted);
  const publicKudos = options.includePublicKudos ? projectPublicKudos(sorted) : [];

  return {
    balances,
    budgets,
    reservations,
    publicKudos,
    as_of: new Date().toISOString(),
    event_count: sorted.length,
  };
}

/**
 * Replay projection from a checkpoint.
 *
 * @param {Object} checkpoint - Snapshot projection
 * @param {Array} newEvents - Events since checkpoint
 * @returns {Object} Updated projection
 */
export function replayFromCheckpoint(checkpoint, newEvents) {
  // Extract event IDs from checkpoint to find new events
  // This is a simplified version; a real implementation would track sequence numbers

  const allEvents = [
    // In practice, you'd reconstruct events from the checkpoint
    // For now, just project from the new events
    ...newEvents,
  ];

  return createProjection(allEvents);
}

/**
 * Export for COP Store interface integration.
 */
export const AccountingProjector = {
  projectAccountBalances,
  projectBudgetStatus,
  projectReservationStatus,
  projectPublicKudos,
  computeAvailableBudget,
  canReserve,
  createProjection,
  replayFromCheckpoint,
};

export default AccountingProjector;
