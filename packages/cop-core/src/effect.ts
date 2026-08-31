import type { CognitivePacket, EffectIntent, EffectReceipt } from "./packet.js";
import { computeContentHash } from "./closure.js";

/**
 * Mandate authority verification interface.
 */
export interface MandateAuthorityChecker {
  verifyAuthority(
    mandate_id: string,
    action_name: string,
    target_resource: string
  ): Promise<{ authorized: boolean; reason?: string }>;
}

/**
 * Governed effect executor interface.
 */
export interface EffectExecutor {
  readonly executor_id: string;
  execute(
    action_name: string,
    parameters: Record<string, unknown>
  ): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }>;
}

/**
 * In-memory or persistent store for Effect Receipts (idempotency enforcement).
 */
export interface EffectReceiptStore {
  getReceiptByIdempotencyKey(idempotency_key: string): Promise<EffectReceipt | null>;
  saveReceipt(receipt: EffectReceipt): Promise<void>;
}

/**
 * In-memory receipt store implementation.
 */
export function createMemoryEffectReceiptStore(): EffectReceiptStore {
  const store = new Map<string, EffectReceipt>();
  return {
    async getReceiptByIdempotencyKey(key: string) {
      return store.get(key) || null;
    },
    async saveReceipt(receipt: EffectReceipt) {
      store.set(receipt.idempotency_key, receipt);
    },
  };
}

/**
 * Plans a governed effect intent before commitment.
 */
export function planEffectIntent(
  packet: CognitivePacket,
  input: {
    action_name: string;
    target_resource: string;
    parameters: Record<string, unknown>;
    mandate_id?: string;
    custom_idempotency_key?: string;
  }
): EffectIntent {
  const paramHash = computeContentHash(input.parameters);
  const idempotency_key =
    input.custom_idempotency_key || `idem:${packet.packet_id}:${input.action_name}:${paramHash}`;
  const intent_id = `intent:${packet.packet_id}:${Date.now()}`;

  return {
    intent_id,
    packet_id: packet.packet_id,
    mandate_id: input.mandate_id || packet.mandate_id,
    action_name: input.action_name,
    target_resource: input.target_resource,
    idempotency_key,
    parameters: input.parameters,
    planned_at: new Date().toISOString(),
    status: "planned",
  };
}

/**
 * Evaluates and authorizes an effect intent against a mandate at the commit boundary.
 */
export async function authorizeEffectIntent(
  intent: EffectIntent,
  authorityChecker: MandateAuthorityChecker
): Promise<EffectIntent> {
  if (!intent.mandate_id) {
    return {
      ...intent,
      status: "rejected",
    };
  }

  const check = await authorityChecker.verifyAuthority(
    intent.mandate_id,
    intent.action_name,
    intent.target_resource
  );

  return {
    ...intent,
    status: check.authorized ? "authorized" : "rejected",
  };
}

/**
 * Commits and executes an authorized effect intent with idempotency deduplication.
 */
export async function commitGovernedEffect(
  intent: EffectIntent,
  executor: EffectExecutor,
  receiptStore: EffectReceiptStore
): Promise<{ receipt: EffectReceipt; wasReplayed: boolean }> {
  // 1. Idempotency Check: if already executed, return previous receipt without re-executing
  const existing = await receiptStore.getReceiptByIdempotencyKey(intent.idempotency_key);
  if (existing) {
    return { receipt: existing, wasReplayed: true };
  }

  // 2. Commit Boundary Enforcement: must be explicitly authorized
  if (intent.status !== "authorized") {
    const rejectedReceipt: EffectReceipt = {
      receipt_id: `rcpt:rejected:${Date.now()}`,
      intent_id: intent.intent_id,
      packet_id: intent.packet_id,
      idempotency_key: intent.idempotency_key,
      status: "aborted",
      executor: executor.executor_id,
      executed_at: new Date().toISOString(),
      error: `Effect blocked at commit boundary: intent status is '${intent.status}' (expected 'authorized')`,
    };
    await receiptStore.saveReceipt(rejectedReceipt);
    return { receipt: rejectedReceipt, wasReplayed: false };
  }

  // 3. Execution
  const execResult = await executor.execute(intent.action_name, intent.parameters);
  const receipt: EffectReceipt = {
    receipt_id: `rcpt:${Date.now()}`,
    intent_id: intent.intent_id,
    packet_id: intent.packet_id,
    idempotency_key: intent.idempotency_key,
    status: execResult.success ? "success" : "failure",
    executor: executor.executor_id,
    executed_at: new Date().toISOString(),
    result: execResult.result,
    error: execResult.error,
  };

  // 4. Save Receipt
  await receiptStore.saveReceipt(receipt);
  return { receipt, wasReplayed: false };
}
