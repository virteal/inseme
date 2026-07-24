#!/usr/bin/env node
/**
 * Local COP Accounting Demo & Verification Script for JHN Node
 * Domain account: https://jhn.baronsmariani.org/
 */

import {
  validateAccountingEvent,
  projectAccountBalances,
  projectBudgetStatus,
  fromDecimal,
  toDecimal,
} from "@inseme/cop-kernel";

console.log("===============================================================================");
console.log("  COP/Accounting Conformance Kernel - JHN Node Demo (jhn.baronsmariani.org)");
console.log("===============================================================================\n");

const JHN_DOMAIN = "https://jhn.baronsmariani.org/";
const RESEARCH_ACCOUNT = `${JHN_DOMAIN}account/research`;
const OPS_ACCOUNT = `${JHN_DOMAIN}account/ops`;

// 1. Budget Grant Event
const budgetEvent = {
  eventType: "accounting/budget",
  schemaVersion: "1.0",
  budget_id: "bdg-jhn-research-2026",
  action: "grant",
  resource_type: "kudos",
  accounting_domain: "research",
  quantity: fromDecimal("10000"),
  governance: {
    actor_subject_id: "subject:jhn",
    principal_subject_id: "subject:jhn",
    mandate_id: "mandate:research-budget-2026",
  },
  idempotency_key: "idemp-budget-001",
};

// 2. Reservation Event
const reservationEvent = {
  eventType: "accounting/reservation",
  schemaVersion: "1.0",
  reservation_id: "res-tocqueville-paper-001",
  budget_reference: { budget_id: "bdg-jhn-research-2026" },
  action: "reserve",
  resource_type: "kudos",
  accounting_domain: "research",
  quantity: fromDecimal("500"),
  governance: {
    actor_subject_id: "subject:jhn",
    principal_subject_id: "subject:jhn",
    mandate_id: "mandate:research-budget-2026",
  },
  idempotency_key: "idemp-res-001",
};

// 3. Balanced Transaction Event
const transactionEvent = {
  eventType: "accounting/transaction",
  schemaVersion: "1.0",
  transaction_id: "txn-jhn-001",
  resource_type: "kudos",
  accounting_domain: "research",
  postings: [
    {
      account: RESEARCH_ACCOUNT,
      quantity: fromDecimal("500"),
      posting_type: "debit",
    },
    {
      account: OPS_ACCOUNT,
      quantity: fromDecimal("500"),
      posting_type: "credit",
    },
  ],
  governance: {
    actor_subject_id: "subject:jhn",
    principal_subject_id: "subject:jhn",
    mandate_id: "mandate:research-budget-2026",
  },
  idempotency_key: "idemp-tx-001",
};

const events = [budgetEvent, reservationEvent, transactionEvent];

console.log("1. Validating Accounting Events for JHN Node...");
events.forEach((evt, idx) => {
  const result = validateAccountingEvent(evt);
  if (!result.valid) {
    console.error(`❌ Validation failed for event ${idx + 1} (${evt.eventType}):`, result.errors);
    process.exit(1);
  }
  console.log(
    `   [✓] Event ${idx + 1} (${evt.eventType} - ${evt.idempotency_key}) validated successfully.`
  );
});

console.log("\n2. Projecting Account Balances...");
const balanceMap = projectAccountBalances(events);

console.log("   Account Balances Result:");
for (const [accountKey, bal] of balanceMap.entries()) {
  console.log(`   - Account: ${bal.account_id}`);
  console.log(`     Domain : ${bal.accounting_domain}`);
  console.log(`     Balance: ${toDecimal(bal.balance)} ${bal.resource_type}`);
}

console.log("\n3. Projecting Budget Status...");
const budgetMap = projectBudgetStatus(events);
for (const [budgetId, status] of budgetMap.entries()) {
  console.log(`   - Budget ID: ${budgetId}`);
  console.log(`     Domain   : ${status.accounting_domain}`);
  console.log(`     Granted  : ${toDecimal(status.granted)} ${status.resource_type}`);
  console.log(`     Reserved : ${toDecimal(status.reserved)} ${status.resource_type}`);
  console.log(`     Available: ${toDecimal(status.available)} ${status.resource_type}`);
}

console.log("\n===============================================================================");
console.log(
  "  ✅ SUCCESS: All events valid & projected deterministically for jhn.baronsmariani.org!"
);
console.log("===============================================================================\n");
