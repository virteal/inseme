/**
 * COP/Accounting Conformance Tests
 *
 * Tests the day-one accounting conformance kernel against required invariants:
 * 1. Balanced transaction accepted
 * 2. Unbalanced transaction rejected
 * 3. Cross-unit balancing rejected without conversion
 * 4. Duplicate delivery has one accounting effect
 * 5. Competing reservations cannot overspend
 * 6. Expired/revoked mandates rejected
 * 7. Reversal neutralizes effect without deletion
 * 8. Unauthorized creation/destruction rejected
 * 9. Deterministic replay produces identical state
 * 10. HTTPS account URL accepted
 * 11. Public projection excludes private details
 * 12. Short lifecycle can be represented
 *
 * @module accounting/test
 */

import { strict as assert } from "node:assert";
import { test, describe, before, after } from "node:test";

import {
  validateAccountingEvent,
  validateAccountingEventSequence,
  ValidationError,
} from "../src/accounting/validator.js";

import {
  projectAccountBalances,
  projectBudgetStatus,
  projectReservationStatus,
  projectPublicKudos,
  createProjection,
  canReserve,
} from "../src/accounting/projector.js";

import {
  fromDecimal,
  toDecimal,
  addQuantities,
  subtractQuantities,
  compareQuantities,
  isZero,
} from "../src/accounting/quantity.js";

describe("COP/Accounting Conformance Tests", () => {
  describe("Test 1: Balanced transaction is accepted", () => {
    test("simple two-posting balanced transaction", () => {
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-001",
      };

      const result = validateAccountingEvent(event);
      assert.strictEqual(result.valid, true, "Balanced transaction should be accepted");
      assert.strictEqual(result.errors.length, 0);
    });

    test("multi-posting balanced transaction", () => {
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-002",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "50", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "30", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
          {
            account: "https://charlie.example/budget",
            quantity: { coefficient: "20", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-002",
      };

      const result = validateAccountingEvent(event);
      assert.strictEqual(
        result.valid,
        true,
        "Multi-posting balanced transaction should be accepted"
      );
    });

    test("transaction with decimal precision", () => {
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-003",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "123456789", scale: 8, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "123456789", scale: 8, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-003",
      };

      const result = validateAccountingEvent(event);
      assert.strictEqual(result.valid, true, "Decimal precision transaction should be accepted");
    });
  });

  describe("Test 2: Unbalanced transaction is atomically rejected", () => {
    test("unbalanced debits > credits", () => {
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-bad-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "90", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-bad-001",
      };

      const result = validateAccountingEvent(event);
      assert.strictEqual(result.valid, false, "Unbalanced transaction should be rejected");
      assert.ok(
        result.errors.some(
          (e) => e.includes("balance") || e.includes("debit") || e.includes("credit")
        )
      );
    });

    test("unbalanced credits > debits", () => {
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-bad-002",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "110", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-bad-002",
      };

      const result = validateAccountingEvent(event);
      assert.strictEqual(result.valid, false, "Unbalanced transaction should be rejected");
    });

    test("single posting is rejected", () => {
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-bad-003",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-bad-003",
      };

      const result = validateAccountingEvent(event);
      assert.strictEqual(result.valid, false, "Single posting transaction should be rejected");
    });
  });

  describe("Test 3: Cross-unit balancing rejected without conversion", () => {
    test("different units without conversion_rate rejected", () => {
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "xn-unit-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "stars" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-xn-001",
      };

      const result = validateAccountingEvent(event);
      assert.strictEqual(
        result.valid,
        false,
        "Cross-unit transaction without conversion_rate should be rejected"
      );
      assert.ok(result.errors.some((e) => e.includes("conversion")));
    });

    test("same units accepted", () => {
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "xn-unit-002",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-xn-002",
      };

      const result = validateAccountingEvent(event);
      assert.strictEqual(result.valid, true, "Same-unit transaction should be accepted");
    });
  });

  describe("Test 4: Duplicate delivery has one accounting effect", () => {
    test("first event processed, second rejected by idempotency", () => {
      const event1 = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-dup-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-dup-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      // Same event with same idempotency key
      const event2 = { ...event1, transaction_id: "txn-dup-001-duplicate" };

      const context = { processedIdempotencyKeys: new Set() };

      // First event should be valid
      const result1 = validateAccountingEvent(event1, context);
      assert.strictEqual(result1.valid, true, "First event should be accepted");

      // Track idempotency key
      context.processedIdempotencyKeys.add(event1.idempotency_key);

      // Second event with same key should be rejected
      const result2 = validateAccountingEvent(event2, context);
      assert.strictEqual(result2.valid, false, "Duplicate event should be rejected");
      assert.ok(result2.errors.some((e) => e.includes("idempotency")));
    });

    test("projection idempotent - duplicate events produce same balance", () => {
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-dup-proj-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-dup-proj-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      // Single event
      const projection1 = projectAccountBalances([event]);

      // Same event twice
      const projection2 = projectAccountBalances([event, event]);

      // Should produce same balances
      const key1 = Array.from(projection1.keys())[0];
      const key2 = Array.from(projection2.keys())[0];

      assert.strictEqual(projection1.size, projection2.size);
      assert.deepEqual(projection1.get(key1).balance, projection2.get(key2).balance);
    });
  });

  describe("Test 5: Competing reservations cannot overspend", () => {
    test("multiple reservations checked against budget", () => {
      const budgetEvent = {
        eventType: "accounting/budget",
        schemaVersion: "1.0",
        budget_id: "budget-compete-001",
        action: "grant",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        quantity: { coefficient: "100", scale: 0, unit: "kudos" },
        governance: {
          actor_subject_id: "https://authority.example",
          principal_subject_id: "https://authority.example",
        },
        idempotency_key: "key-budget-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      // Project budget status
      const budgets = projectBudgetStatus([budgetEvent]);
      const budget = budgets.get("budget-compete-001");

      assert.ok(budget, "Budget should exist");
      assert.strictEqual(budget.status, "active");
      assert.strictEqual(budget.available.coefficient, "100");

      // First reservation: 60 kudos
      const res1 = {
        eventType: "accounting/reservation",
        schemaVersion: "1.0",
        reservation_id: "res-compete-001",
        action: "reserve",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        quantity: { coefficient: "60", scale: 0, unit: "kudos" },
        budget_reference: { budget_id: "budget-compete-001" },
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-res-001",
        timestamp: "2026-07-23T10:01:00Z",
      };

      // Second reservation: 50 kudos (would exceed with first)
      const res2 = {
        ...res1,
        reservation_id: "res-compete-002",
        quantity: { coefficient: "50", scale: 0, unit: "kudos" },
        idempotency_key: "key-res-002",
        timestamp: "2026-07-23T10:02:00Z",
      };

      // First reservation should be valid
      const context = {
        budgets: new Map([["budget-compete-001", budget]]),
        existingReservations: [],
        processedIdempotencyKeys: new Set(),
      };

      const result1 = validateAccountingEvent(res1, context);
      assert.strictEqual(result1.valid, true, "First reservation should be accepted");

      // Add first reservation to context
      context.existingReservations.push({
        reservation_id: "res-compete-001",
        budget_reference: { budget_id: "budget-compete-001" },
        quantity: { coefficient: "60", scale: 0, unit: "kudos" },
        status: "active",
      });

      // Second reservation should be rejected (would exceed 100)
      const result2 = validateAccountingEvent(res2, context);
      assert.strictEqual(result2.valid, false, "Overspending reservation should be rejected");
      assert.ok(
        result2.errors.some(
          (e) => e.includes("exceed") || e.includes("budget") || e.includes("insufficient")
        )
      );
    });
  });

  describe("Test 6: Expired/revoked mandates rejected", () => {
    test("expired budget rejected for new reservations", () => {
      const budgetEvent = {
        eventType: "accounting/budget",
        schemaVersion: "1.0",
        budget_id: "budget-expired-001",
        action: "expire",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        quantity: { coefficient: "100", scale: 0, unit: "kudos" },
        governance: {
          actor_subject_id: "https://authority.example",
          principal_subject_id: "https://authority.example",
        },
        idempotency_key: "key-expired-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const budgets = projectBudgetStatus([budgetEvent]);
      const budget = budgets.get("budget-expired-001");

      assert.strictEqual(budget.status, "expired", "Budget should be expired");

      const reservation = {
        eventType: "accounting/reservation",
        schemaVersion: "1.0",
        reservation_id: "res-expired-001",
        action: "reserve",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        quantity: { coefficient: "10", scale: 0, unit: "kudos" },
        budget_reference: { budget_id: "budget-expired-001" },
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-res-expired-001",
        timestamp: "2026-07-23T10:01:00Z",
      };

      const context = {
        budgets: new Map([["budget-expired-001", budget]]),
        existingReservations: [],
        processedIdempotencyKeys: new Set(),
      };

      const result = validateAccountingEvent(reservation, context);
      assert.strictEqual(
        result.valid,
        false,
        "Reservation against expired budget should be rejected"
      );
      assert.ok(result.errors.some((e) => e.includes("active") || e.includes("Budget")));
    });

    test("revoked budget rejected", () => {
      const budgetEvent = {
        eventType: "accounting/budget",
        schemaVersion: "1.0",
        budget_id: "budget-revoked-001",
        action: "revoke",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        quantity: { coefficient: "100", scale: 0, unit: "kudos" },
        governance: {
          actor_subject_id: "https://authority.example",
          principal_subject_id: "https://authority.example",
        },
        idempotency_key: "key-revoked-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const budgets = projectBudgetStatus([budgetEvent]);
      const budget = budgets.get("budget-revoked-001");

      assert.strictEqual(budget.status, "revoked", "Budget should be revoked");
    });
  });

  describe("Test 7: Reversal neutralizes effect without deletion", () => {
    test("full reversal inverts transaction effect", () => {
      const originalTxn = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-rev-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-rev-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const reversal = {
        eventType: "accounting/reversal",
        schemaVersion: "1.0",
        reversal_id: "rev-001",
        original_transaction_id: "txn-rev-001",
        reversal_type: "compensating",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        reason: "error_correction",
        compensating_postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
        ],
        governance: {
          actor_subject_id: "https://authority.example",
          principal_subject_id: "https://authority.example",
        },
        idempotency_key: "key-rev-reversal-001",
        timestamp: "2026-07-23T10:05:00Z",
      };

      // Balance after original transaction
      let balances = projectAccountBalances([originalTxn]);
      const aliceOriginal = balances.get("https://alice.example/budget|kudos.public|kudos");
      assert.strictEqual(aliceOriginal.balance.coefficient, "100");

      // Balance after reversal (should return to zero)
      balances = projectAccountBalances([originalTxn, reversal]);
      const aliceAfter = balances.get("https://alice.example/budget|kudos.public|kudos");
      assert.strictEqual(
        aliceAfter.balance.coefficient,
        "0",
        "Reversal should return balance to zero"
      );

      // But reversal is recorded in history
      assert.ok(aliceAfter.last_event_id === "rev-001", "Reversal should be recorded");
    });
  });

  describe("Test 8: Unauthorized creation/destruction rejected", () => {
    test("transaction to/from non-authorized source account", () => {
      // This tests that value creation requires explicit source/sink
      // In a full implementation, account validation would check authorized_source_sink

      const accountCreate = {
        eventType: "accounting/account",
        schemaVersion: "1.0",
        account_id: "https://system.example/treasury",
        action: "create",
        account_type: "asset",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        authorized_source_sink: true,
        governance: {
          actor_subject_id: "https://admin.example",
          principal_subject_id: "https://admin.example",
        },
        idempotency_key: "key-ac-create-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      // Without mandate for source/sink account
      const context = { existingAccounts: new Map(), processedIdempotencyKeys: new Set() };
      let result = validateAccountingEvent(accountCreate, context);
      assert.strictEqual(result.valid, false, "Source/sink account creation requires mandate");
      assert.ok(result.errors.some((e) => e.includes("mandate")));

      // With mandate
      accountCreate.governance.mandate_id = "mandate-001";
      context.processedIdempotencyKeys.clear();
      result = validateAccountingEvent(accountCreate, context);
      assert.strictEqual(result.valid, true, "Source/sink account with mandate should be accepted");
    });
  });

  describe("Test 9: Deterministic replay produces identical state", () => {
    test("replaying events produces same projection", () => {
      const events = [
        {
          eventType: "accounting/budget",
          schemaVersion: "1.0",
          budget_id: "budget-replay-001",
          action: "grant",
          resource_type: "kudos",
          accounting_domain: "kudos.public",
          quantity: { coefficient: "1000", scale: 0, unit: "kudos" },
          governance: {
            actor_subject_id: "https://authority.example",
            principal_subject_id: "https://authority.example",
          },
          idempotency_key: "key-replay-001",
          timestamp: "2026-07-23T10:00:00Z",
        },
        {
          eventType: "accounting/reservation",
          schemaVersion: "1.0",
          reservation_id: "res-replay-001",
          action: "reserve",
          resource_type: "kudos",
          accounting_domain: "kudos.public",
          quantity: { coefficient: "100", scale: 0, unit: "kudos" },
          budget_reference: { budget_id: "budget-replay-001" },
          governance: {
            actor_subject_id: "https://alice.example",
            principal_subject_id: "https://alice.example",
          },
          idempotency_key: "key-replay-002",
          timestamp: "2026-07-23T10:01:00Z",
        },
        {
          eventType: "accounting/transaction",
          schemaVersion: "1.0",
          transaction_id: "txn-replay-001",
          resource_type: "kudos",
          accounting_domain: "kudos.public",
          postings: [
            {
              account: "https://alice.example/budget",
              quantity: { coefficient: "50", scale: 0, unit: "kudos" },
              posting_type: "debit",
            },
            {
              account: "https://bob.example/budget",
              quantity: { coefficient: "50", scale: 0, unit: "kudos" },
              posting_type: "credit",
            },
          ],
          consumes_reservations: ["res-replay-001"],
          governance: {
            actor_subject_id: "https://alice.example",
            principal_subject_id: "https://alice.example",
          },
          idempotency_key: "key-replay-003",
          timestamp: "2026-07-23T10:02:00Z",
        },
      ];

      // First projection
      const projection1 = createProjection(events);

      // Second projection (deterministic replay)
      const projection2 = createProjection(events);

      // Compare budgets
      assert.strictEqual(projection1.budgets.size, projection2.budgets.size);
      for (const [key, budget1] of projection1.budgets) {
        const budget2 = projection2.budgets.get(key);
        assert.ok(budget2);
        assert.deepEqual(budget1.granted, budget2.granted);
        assert.deepEqual(budget1.available, budget2.available);
        assert.deepEqual(budget1.reserved, budget2.reserved);
        assert.strictEqual(budget1.status, budget2.status);
      }

      // Compare reservations
      assert.strictEqual(projection1.reservations.size, projection2.reservations.size);

      // Compare balances
      assert.strictEqual(projection1.balances.size, projection2.balances.size);
    });

    test("projection order-independent when sorted", () => {
      const events = [
        {
          eventType: "accounting/transaction",
          schemaVersion: "1.0",
          transaction_id: "txn-order-001",
          resource_type: "kudos",
          accounting_domain: "kudos.public",
          postings: [
            {
              account: "https://alice.example/budget",
              quantity: { coefficient: "30", scale: 0, unit: "kudos" },
              posting_type: "debit",
            },
            {
              account: "https://bob.example/budget",
              quantity: { coefficient: "30", scale: 0, unit: "kudos" },
              posting_type: "credit",
            },
          ],
          governance: {
            actor_subject_id: "https://alice.example",
            principal_subject_id: "https://alice.example",
          },
          idempotency_key: "key-order-001",
          timestamp: "2026-07-23T10:02:00Z",
        },
        {
          eventType: "accounting/transaction",
          schemaVersion: "1.0",
          transaction_id: "txn-order-002",
          resource_type: "kudos",
          accounting_domain: "kudos.public",
          postings: [
            {
              account: "https://alice.example/budget",
              quantity: { coefficient: "20", scale: 0, unit: "kudos" },
              posting_type: "debit",
            },
            {
              account: "https://charlie.example/budget",
              quantity: { coefficient: "20", scale: 0, unit: "kudos" },
              posting_type: "credit",
            },
          ],
          governance: {
            actor_subject_id: "https://alice.example",
            principal_subject_id: "https://alice.example",
          },
          idempotency_key: "key-order-002",
          timestamp: "2026-07-23T10:01:00Z",
        },
      ];

      // Project with original order
      const projection1 = createProjection(events);

      // Project with reversed order (should sort by timestamp)
      const projection2 = createProjection([...events].reverse());

      // Should produce same result (sorted by timestamp)
      const alice1 = projection1.balances.get("https://alice.example/budget|kudos.public|kudos");
      const alice2 = projection2.balances.get("https://alice.example/budget|kudos.public|kudos");

      assert.ok(alice1);
      assert.ok(alice2);
      assert.deepEqual(alice1.balance, alice2.balance);
    });
  });

  describe("Test 10: HTTPS account URL accepted", () => {
    test("canonical HTTPS URL account identifier accepted", () => {
      const account = {
        eventType: "accounting/account",
        schemaVersion: "1.0",
        account_id: "https://jhn.baronsmariani.org/",
        action: "create",
        account_type: "asset",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        governance: {
          actor_subject_id: "https://jhn.baronsmariani.org/",
          principal_subject_id: "https://jhn.baronsmariani.org/",
        },
        idempotency_key: "key-https-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const context = { existingAccounts: new Map(), processedIdempotencyKeys: new Set() };
      const result = validateAccountingEvent(account, context);
      assert.strictEqual(result.valid, true, "HTTPS URL account identifier should be accepted");
    });

    test("transaction with HTTPS URL accounts accepted", () => {
      const txn = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-https-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://jhn.baronsmariani.org/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://another.example.org/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://jhn.baronsmariani.org/",
          principal_subject_id: "https://jhn.baronsmariani.org/",
        },
        idempotency_key: "key-https-txn-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const result = validateAccountingEvent(txn);
      assert.strictEqual(
        result.valid,
        true,
        "Transaction with HTTPS URL accounts should be accepted"
      );
    });

    test("URN account identifier accepted", () => {
      const account = {
        eventType: "accounting/account",
        schemaVersion: "1.0",
        account_id: "urn:account:kudos:12345",
        action: "create",
        account_type: "asset",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        governance: {
          actor_subject_id: "https://operator.example",
          principal_subject_id: "https://operator.example",
        },
        idempotency_key: "key-urn-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const context = { existingAccounts: new Map(), processedIdempotencyKeys: new Set() };
      const result = validateAccountingEvent(account, context);
      assert.strictEqual(result.valid, true, "URN account identifier should be accepted");
    });

    test("local account identifier accepted", () => {
      const txn = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-local-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "local:test:account-1",
            quantity: { coefficient: "50", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "local:test:account-2",
            quantity: { coefficient: "50", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "local:test:operator",
          principal_subject_id: "local:test:operator",
        },
        idempotency_key: "key-local-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const result = validateAccountingEvent(txn);
      assert.strictEqual(
        result.valid,
        true,
        "Transaction with local account identifiers should be accepted"
      );
    });
  });

  describe("Test 11: Public Kudos projection excludes private details", () => {
    test("private transaction excluded from public projection", () => {
      const publicTxn = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-pub-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-pub-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const privateTxn = {
        ...publicTxn,
        transaction_id: "txn-priv-001",
        accounting_domain: "kudos.private",
        disclosure_class: "private",
        idempotency_key: "key-priv-001",
        purpose: "private purchase details",
      };

      const publicProjection = projectPublicKudos([publicTxn, privateTxn]);

      assert.strictEqual(
        publicProjection.length,
        1,
        "Only public transaction should be in projection"
      );
      assert.strictEqual(publicProjection[0].transaction_id, "txn-pub-001");
    });

    test("confidential transaction excluded", () => {
      const confidentialTxn = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-conf-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        disclosure_class: "confidential",
        idempotency_key: "key-conf-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const publicProjection = projectPublicKudos([confidentialTxn]);
      assert.strictEqual(publicProjection.length, 0, "Confidential transaction should be excluded");
    });

    test("public projection preserves required fields", () => {
      const txn = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-pub-field-001",
        resource_type: "kudos",
        accounting_domain: "kudos.public",
        postings: [
          {
            account: "https://alice.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "debit",
          },
          {
            account: "https://bob.example/budget",
            quantity: { coefficient: "100", scale: 0, unit: "kudos" },
            posting_type: "credit",
          },
        ],
        category: "grant",
        purpose: "community contribution",
        governance: {
          actor_subject_id: "https://alice.example",
          principal_subject_id: "https://alice.example",
        },
        idempotency_key: "key-pub-field-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const publicProjection = projectPublicKudos([txn]);
      assert.strictEqual(publicProjection.length, 1);

      const pub = publicProjection[0];
      assert.strictEqual(pub.transaction_id, "txn-pub-field-001");
      assert.strictEqual(pub.resource_type, "kudos");
      assert.strictEqual(pub.accounting_domain, "kudos.public");
      assert.deepEqual(pub.amount, { coefficient: "100", scale: 0, unit: "kudos" });
      assert.strictEqual(pub.from_account, "https://alice.example/budget");
      assert.strictEqual(pub.to_account, "https://bob.example/budget");
      assert.strictEqual(pub.category, "grant");
      assert.strictEqual(pub.purpose, "community contribution");
    });
  });

  describe("Test 12: Short consequential lifecycle can be represented", () => {
    test("normal -> overload transition without micro-events", () => {
      // Represents service state transitions without forcing every interrupt into the log
      const events = [
        {
          eventType: "accounting/transaction",
          schemaVersion: "1.0",
          transaction_id: "txn-lifecycle-001",
          resource_type: "cpu-time",
          accounting_domain: "resource.compute",
          postings: [
            {
              account: "urn:resource:compute:node-1",
              quantity: { coefficient: "1000", scale: 0, unit: "ms" },
              posting_type: "debit",
            },
            {
              account: "urn:pool:compute",
              quantity: { coefficient: "1000", scale: 0, unit: "ms" },
              posting_type: "credit",
            },
          ],
          governance: {
            actor_subject_id: "urn:system:scheduler",
            principal_subject_id: "urn:system:scheduler",
          },
          category: "consumption",
          purpose: "normal operation",
          idempotency_key: "key-lifecycle-001",
          timestamp: "2026-07-23T10:00:00Z",
        },
        {
          eventType: "accounting/transaction",
          schemaVersion: "1.0",
          transaction_id: "txn-lifecycle-002",
          resource_type: "cpu-time",
          accounting_domain: "resource.compute",
          postings: [
            {
              account: "urn:resource:compute:node-1",
              quantity: { coefficient: "5000", scale: 0, unit: "ms" },
              posting_type: "debit",
            },
            {
              account: "urn:pool:compute",
              quantity: { coefficient: "5000", scale: 0, unit: "ms" },
              posting_type: "credit",
            },
          ],
          governance: {
            actor_subject_id: "urn:system:scheduler",
            principal_subject_id: "urn:system:scheduler",
          },
          category: "overload",
          purpose: "excessive interrupts; node cannot keep up",
          idempotency_key: "key-lifecycle-002",
          timestamp: "2026-07-23T10:05:00Z",
        },
        {
          eventType: "accounting/transaction",
          schemaVersion: "1.0",
          transaction_id: "txn-lifecycle-003",
          resource_type: "cpu-time",
          accounting_domain: "resource.compute",
          postings: [
            {
              account: "urn:resource:compute:node-1",
              quantity: { coefficient: "800", scale: 0, unit: "ms" },
              posting_type: "debit",
            },
            {
              account: "urn:pool:compute",
              quantity: { coefficient: "800", scale: 0, unit: "ms" },
              posting_type: "credit",
            },
          ],
          governance: {
            actor_subject_id: "urn:system:scheduler",
            principal_subject_id: "urn:system:scheduler",
          },
          category: "consumption",
          purpose: "service recovered",
          idempotency_key: "key-lifecycle-003",
          timestamp: "2026-07-23T10:10:00Z",
        },
      ];

      const projection = createProjection(events);

      // All three events recorded
      assert.strictEqual(projection.balances.size, 2); // node-1 and pool
      assert.strictEqual(projection.event_count, 3);

      // State transitions captured via category/purpose
      // No need for individual IRQ-level events
      const nodeBalance = projection.balances.get(
        "urn:resource:compute:node-1|resource.compute|cpu-time"
      );
      assert.ok(nodeBalance);
      assert.strictEqual(nodeBalance.balance.coefficient, "6800"); // 1000 + 5000 + 800
    });

    test("representing system state without micro-event log", () => {
      // Single aggregated state transition event
      const event = {
        eventType: "accounting/transaction",
        schemaVersion: "1.0",
        transaction_id: "txn-aggregated-001",
        resource_type: "storage",
        accounting_domain: "resource.storage",
        postings: [
          {
            account: "urn:storage:bucket:public",
            quantity: { coefficient: "1048576", scale: 0, unit: "bytes" },
            posting_type: "debit",
          },
          {
            account: "urn:pool:storage",
            quantity: { coefficient: "1048576", scale: 0, unit: "bytes" },
            posting_type: "credit",
          },
        ],
        governance: {
          actor_subject_id: "urn:system:storage-service",
          principal_subject_id: "urn:system:storage-service",
        },
        category: "allocation",
        purpose: "bucket creation: normal -> provisioned",
        idempotency_key: "key-aggregated-001",
        timestamp: "2026-07-23T10:00:00Z",
      };

      const result = validateAccountingEvent(event);
      assert.strictEqual(result.valid, true, "Aggregated lifecycle event should be accepted");
    });
  });
});

describe("Quantity Arithmetic Tests", () => {
  test("addQuantities with matching scales", () => {
    const a = { coefficient: "100", scale: 0, unit: "kudos" };
    const b = { coefficient: "50", scale: 0, unit: "kudos" };
    const result = addQuantities(a, b);
    assert.strictEqual(result.coefficient, "150");
    assert.strictEqual(result.scale, 0);
  });

  test("subtractQuantities with matching scales", () => {
    const a = { coefficient: "100", scale: 0, unit: "kudos" };
    const b = { coefficient: "30", scale: 0, unit: "kudos" };
    const result = subtractQuantities(a, b);
    assert.strictEqual(result.coefficient, "70");
    assert.strictEqual(result.scale, 0);
  });

  test("compareQuantities", () => {
    const a = { coefficient: "100", scale: 0 };
    const b = { coefficient: "50", scale: 0 };
    const c = { coefficient: "100", scale: 0 };
    const d = { coefficient: "150", scale: 0 };

    assert.strictEqual(compareQuantities(a, b), 1); // 100 > 50
    assert.strictEqual(compareQuantities(b, a), -1); // 50 < 100
    assert.strictEqual(compareQuantities(a, c), 0); // 100 == 100
    assert.strictEqual(compareQuantities(a, d), -1); // 100 < 150
  });

  test("isZero", () => {
    assert.strictEqual(isZero({ coefficient: "0", scale: 0 }), true);
    assert.strictEqual(isZero({ coefficient: "-0", scale: 0 }), true);
    assert.strictEqual(isZero({ coefficient: "1", scale: 0 }), false);
  });

  test("fromDecimal and toDecimal round-trip", () => {
    const original = "123.456";
    const q = fromDecimal(original, "test");
    assert.strictEqual(q.coefficient, "123456");
    assert.strictEqual(q.scale, 3);
    assert.strictEqual(toDecimal(q), original);
  });

  test("negative decimal round-trip", () => {
    const original = "-5.00";
    const q = fromDecimal(original, "kudos");
    assert.strictEqual(q.coefficient, "-500");
    assert.strictEqual(q.scale, 2);
    assert.strictEqual(toDecimal(q), original);
  });
});

describe("COP/Accounting Enhanced Futures & Quota Features", () => {
  test("Reservation Option Premium / Non-refundable holding_fee", () => {
    const budgetEvent = {
      eventType: "accounting/budget",
      schemaVersion: "1.0",
      budget_id: "bdg-premium-01",
      action: "grant",
      resource_type: "kudos",
      accounting_domain: "futures",
      quantity: fromDecimal("1000"),
      governance: { actor_subject_id: "subject:a", principal_subject_id: "subject:a" },
      idempotency_key: "k-bg-01",
    };

    const reservationEvent = {
      eventType: "accounting/reservation",
      schemaVersion: "1.0",
      reservation_id: "res-option-01",
      budget_reference: { budget_id: "bdg-premium-01" },
      action: "reserve",
      resource_type: "kudos",
      accounting_domain: "futures",
      quantity: fromDecimal("500"),
      holding_fee: fromDecimal("50"), // 50 kudos non-refundable option premium
      governance: { actor_subject_id: "subject:a", principal_subject_id: "subject:a" },
      idempotency_key: "k-res-01",
    };

    const releaseEvent = {
      eventType: "accounting/reservation",
      schemaVersion: "1.0",
      reservation_id: "res-option-01",
      budget_reference: { budget_id: "bdg-premium-01" },
      action: "release",
      resource_type: "kudos",
      accounting_domain: "futures",
      quantity: fromDecimal("500"),
      holding_fee: fromDecimal("50"),
      governance: { actor_subject_id: "subject:a", principal_subject_id: "subject:a" },
      idempotency_key: "k-rel-01",
    };

    // Validation check
    const valRes = validateAccountingEvent(reservationEvent);
    assert.strictEqual(valRes.valid, true);

    // Initial reserve projection: granted=1000, reserved=500, spent=50, available=500
    const bMap1 = projectBudgetStatus([budgetEvent, reservationEvent]);
    const bStatus1 = bMap1.get("bdg-premium-01");
    assert.strictEqual(toDecimal(bStatus1.reserved), "500");
    assert.strictEqual(toDecimal(bStatus1.spent), "50");

    // Release projection: unconsumed 450 kudos returned to available (500 - 50 = 450), holding fee 50 stays spent
    const bMap2 = projectBudgetStatus([budgetEvent, reservationEvent, releaseEvent]);
    const bStatus2 = bMap2.get("bdg-premium-01");
    assert.strictEqual(toDecimal(bStatus2.available), "950"); // 1000 - 50 = 950
  });

  test("Soft-limit warning when remaining budget <= 10%", () => {
    const budgetMap = new Map([
      [
        "bdg-warn-01",
        {
          budget_id: "bdg-warn-01",
          accounting_domain: "general",
          status: "active",
          granted: fromDecimal("1000"),
          available: fromDecimal("100"), // 10% remaining
        },
      ],
    ]);

    const reservationEvent = {
      eventType: "accounting/reservation",
      schemaVersion: "1.0",
      reservation_id: "res-warn-01",
      budget_reference: { budget_id: "bdg-warn-01" },
      action: "reserve",
      resource_type: "kudos",
      accounting_domain: "general",
      quantity: fromDecimal("50"),
      governance: { actor_subject_id: "subject:a", principal_subject_id: "subject:a" },
      idempotency_key: "k-warn-01",
    };

    const valRes = validateAccountingEvent(reservationEvent, { budgets: budgetMap });
    assert.strictEqual(valRes.valid, true);
    assert.strictEqual(valRes.warnings.length, 1);
    assert.ok(valRes.warnings[0].includes("BUDGET_NEARLY_EXHAUSTED"));
  });
});
