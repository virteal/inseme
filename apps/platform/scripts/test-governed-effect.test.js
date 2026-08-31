import test from "node:test";
import assert from "node:assert/strict";
import {
  planEffectIntent,
  authorizeEffectIntent,
  commitGovernedEffect,
  createMemoryEffectReceiptStore,
} from "../../../packages/cop-core/dist/effect.js";

test("Governed effect reality test: planned intent undergoes mandate verification at commit boundary", async () => {
  const receiptStore = createMemoryEffectReceiptStore();
  let executionCount = 0;

  const mockExecutor = {
    executor_id: "executor:github-bot",
    async execute(action, params) {
      executionCount++;
      return {
        success: true,
        result: { issue_url: "https://github.com/JeanHuguesRobert/inseme/issues/100" },
      };
    },
  };

  const authorityChecker = {
    async verifyAuthority(mandate_id, action, target) {
      if (mandate_id === "mandate:authorized") return { authorized: true };
      return { authorized: false, reason: "Mandate revoked" };
    },
  };

  const packet = {
    packet_id: "pkt-effect-test-01",
    mandate_id: "mandate:authorized",
    created_at: new Date().toISOString(),
    hops: [],
    payload: {},
  };

  // 1. Plan Intent
  const intent = planEffectIntent(packet, {
    action_name: "create_github_issue",
    target_resource: "JeanHuguesRobert/inseme",
    parameters: { title: "Test issue from packet" },
  });

  assert.equal(intent.status, "planned");
  assert.ok(intent.idempotency_key.startsWith("idem:pkt-effect-test-01:create_github_issue:"));

  // 2. Authorize Intent at Commit Boundary
  const authorizedIntent = await authorizeEffectIntent(intent, authorityChecker);
  assert.equal(authorizedIntent.status, "authorized");

  // 3. Commit Execution
  const commit1 = await commitGovernedEffect(authorizedIntent, mockExecutor, receiptStore);
  assert.equal(commit1.receipt.status, "success");
  assert.equal(commit1.wasReplayed, false);
  assert.equal(executionCount, 1);

  // 4. Retry with identical intent: Idempotency deduplication prevents double effect
  const commit2 = await commitGovernedEffect(authorizedIntent, mockExecutor, receiptStore);
  assert.equal(commit2.receipt.status, "success");
  assert.equal(commit2.wasReplayed, true); // Replayed without duplicate side-effect!
  assert.equal(executionCount, 1); // Not incremented!
});

test("Governed effect reality test: revocation blocks mutation at commit boundary", async () => {
  const receiptStore = createMemoryEffectReceiptStore();
  let executionCount = 0;

  const mockExecutor = {
    executor_id: "executor:github-bot",
    async execute() {
      executionCount++;
      return { success: true };
    },
  };

  const revokedAuthorityChecker = {
    async verifyAuthority() {
      return { authorized: false, reason: "Permission revoked" };
    },
  };

  const packet = {
    packet_id: "pkt-effect-test-02",
    mandate_id: "mandate:revoked",
    created_at: new Date().toISOString(),
    hops: [],
    payload: {},
  };

  const intent = planEffectIntent(packet, {
    action_name: "delete_resource",
    target_resource: "public.data",
    parameters: { id: "123" },
  });

  // Authorize returns rejected
  const rejectedIntent = await authorizeEffectIntent(intent, revokedAuthorityChecker);
  assert.equal(rejectedIntent.status, "rejected");

  // Attempting to commit a rejected intent aborts without executing
  const result = await commitGovernedEffect(rejectedIntent, mockExecutor, receiptStore);
  assert.equal(result.receipt.status, "aborted");
  assert.match(result.receipt.error, /blocked at commit boundary/);
  assert.equal(executionCount, 0);
});
