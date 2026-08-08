/**
 * Cognitive Packet Strict Accounting Kernel
 *
 * Implements strict provisional spending accounting and Fractanet hop tracing
 * directly on Cognitive Packets.
 *
 * All amounts use ExactQuantity decimal arithmetic (no binary floating-point rounding errors).
 *
 * @module accounting/packetAccounting
 */

import { addQuantities, fromDecimal, toDecimal } from "./quantity.js";
import { getModelRateCard } from "@inseme/cop-core";

/**
 * Calculate exact provisional cost in USD decimal format.
 *
 * @param {object} params
 * @param {string} params.provider Provider name (e.g. "openai")
 * @param {string} params.model Model name (e.g. "gpt-4o-mini")
 * @param {number} [params.prompt_tokens=0]
 * @param {number} [params.completion_tokens=0]
 * @returns {{ cost: import("@inseme/cop-core").ExactQuantity, rate_basis: string }}
 */
export function calculateProvisionalCost({
  provider,
  model,
  prompt_tokens = 0,
  completion_tokens = 0,
}) {
  const card = getModelRateCard(provider, model);

  const inputCost = (prompt_tokens / 1_000_000) * card.input_per_m;
  const outputCost = (completion_tokens / 1_000_000) * card.output_per_m;
  const totalCost = inputCost + outputCost;

  const decimalStr = totalCost.toFixed(card.scale || 8);
  const costQuantity = fromDecimal(decimalStr, "USD");
  return { cost: costQuantity, rate_basis: card.rate_basis };
}

/**
 * Create and initialize a new Cognitive Packet with Hop 0.
 *
 * @param {object} params
 * @param {string} [params.packet_id] Unique URN (auto-generated if omitted)
 * @param {string} params.mandate_id Mandate authorization URN
 * @param {string} params.treatment_id Governed treatment scope ID
 * @param {string} params.account_id Account URN (e.g. "https://jhn.baronsmariani.org/")
 * @param {string} [params.initial_node_id="node:fracta:main"]
 * @param {string} [params.initial_instance_id="agent:jhn:main"]
 * @param {object} [params.governance]
 * @param {string} [params.disclosure_class="public"]
 * @param {object} [params.payload]
 * @returns {import("@inseme/cop-core").CognitivePacket}
 */
export function createCognitivePacket(params) {
  const timestamp = new Date().toISOString();
  const packet_id =
    params.packet_id || `urn:cop:packet:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const initialHop = {
    hop_index: 0,
    node_id: params.initial_node_id || "node:fracta:main",
    instance_id: params.initial_instance_id || "agent:jhn:main",
    interface: "local",
    timestamp,
    route_reason: "treatment_ingress",
  };

  return {
    packet_id,
    mandate_id: params.mandate_id,
    treatment_id: params.treatment_id,
    account_id: params.account_id,
    budget_reservation_id: params.budget_reservation_id,
    hops: [initialHop],
    spending: [],
    governance: params.governance || {
      actor_subject_id: "agent:jhn:main",
      principal_subject_id: params.account_id,
      mandate_id: params.mandate_id,
    },
    disclosure_class: params.disclosure_class || "public",
    created_at: timestamp,
    payload: params.payload || {},
  };
}

/**
 * Append a new Fractanet routing hop to the Cognitive Packet.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @param {object} hopInfo
 * @param {string} hopInfo.node_id Fractanet node ID
 * @param {string} hopInfo.instance_id Agent instance ID
 * @param {string} [hopInfo.interface_type="http"]
 * @param {string} [hopInfo.route_reason="relay"]
 * @param {string} [hopInfo.signature]
 * @returns {import("@inseme/cop-core").PacketHop}
 */
export function appendPacketHop(packet, hopInfo) {
  const hop_index = packet.hops.length;
  const newHop = {
    hop_index,
    node_id: hopInfo.node_id,
    instance_id: hopInfo.instance_id,
    interface: hopInfo.interface_type || "http",
    timestamp: new Date().toISOString(),
    route_reason: hopInfo.route_reason || "relay",
    signature: hopInfo.signature,
  };
  packet.hops.push(newHop);
  return newHop;
}

/**
 * Append a provisional spending trace to the current hop of the Cognitive Packet
 * and generate a balanced COP accounting/transaction event.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @param {object} spendingDetails
 * @param {string} [spendingDetails.capability="ai/chat-completion"]
 * @param {string} spendingDetails.provider Provider name (e.g. "openai")
 * @param {string} spendingDetails.model Model name (e.g. "gpt-4o-mini")
 * @param {number} [spendingDetails.prompt_tokens=0]
 * @param {number} [spendingDetails.completion_tokens=0]
 * @param {string} [spendingDetails.evidence_hash]
 * @returns {{ spendingEntry: import("@inseme/cop-core").ProvisionalSpending, transactionEvent: object }}
 */
export function appendPacketSpending(packet, spendingDetails) {
  const currentHopIndex = Math.max(0, packet.hops.length - 1);
  const currentHop = packet.hops[currentHopIndex];
  const timestamp = new Date().toISOString();

  const { cost, rate_basis } = calculateProvisionalCost({
    provider: spendingDetails.provider,
    model: spendingDetails.model,
    prompt_tokens: spendingDetails.prompt_tokens || 0,
    completion_tokens: spendingDetails.completion_tokens || 0,
  });

  const spendingEntry = {
    hop_index: currentHopIndex,
    node_id: currentHop ? currentHop.node_id : "node:fracta:main",
    capability: spendingDetails.capability || "ai/chat-completion",
    provider: spendingDetails.provider,
    model: spendingDetails.model,
    prompt_tokens: spendingDetails.prompt_tokens || 0,
    completion_tokens: spendingDetails.completion_tokens || 0,
    provisional_cost: cost,
    rate_basis,
    timestamp,
    evidence_hash: spendingDetails.evidence_hash,
  };

  packet.spending.push(spendingEntry);

  // Generate balanced COP transaction event for provisional expense
  const expenseAccount = `urn:account:expense:${spendingDetails.provider}:${spendingDetails.model}`;
  const transactionEvent = {
    eventType: "accounting/transaction",
    schemaVersion: "1.0",
    transaction_id: `txn:provisional:${packet.packet_id}:hop-${currentHopIndex}:${packet.spending.length}`,
    resource_type: "fiat",
    accounting_domain: "provisional_execution_spending",
    postings: [
      {
        account: expenseAccount,
        quantity: cost,
        posting_type: "debit",
        description: `Provisional expense: ${spendingDetails.provider}/${spendingDetails.model} (${spendingDetails.prompt_tokens}+${spendingDetails.completion_tokens} tokens)`,
      },
      {
        account: packet.account_id,
        quantity: cost,
        posting_type: "credit",
        description: `Treatment payment debit: packet ${packet.packet_id}`,
      },
    ],
    governance: packet.governance,
    disclosure_class: packet.disclosure_class,
    idempotency_key: `idemp:${packet.packet_id}:spend:${packet.spending.length}`,
    timestamp,
    metadata: {
      packet_id: packet.packet_id,
      treatment_id: packet.treatment_id,
      hop_index: currentHopIndex,
      provider: spendingDetails.provider,
      model: spendingDetails.model,
      rate_basis,
    },
  };

  return { spendingEntry, transactionEvent };
}

/**
 * Calculate the total provisional spending across all hops for a Cognitive Packet.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @returns {import("@inseme/cop-core").ExactQuantity} Total cost in USD
 */
export function calculatePacketTotalSpending(packet) {
  let total = fromDecimal("0.00000000", "USD");
  for (const s of packet.spending || []) {
    if (s.provisional_cost) {
      total = addQuantities(total, s.provisional_cost);
    }
  }
  return total;
}

/**
 * Persist an accounting transaction event using a persist pipeline with degraded NDJSON spool fallback.
 *
 * @param {object} transactionEvent
 * @param {object} pipeline - cop_event_persist_pipeline instance
 * @returns {Promise<object>}
 */
export async function persistPacketAccountingTransaction(transactionEvent, pipeline) {
  if (!pipeline || typeof pipeline.persistAccountingEvent !== "function") {
    throw new Error("Invalid persist pipeline: persistAccountingEvent required");
  }
  return pipeline.persistAccountingEvent({ transactionEvent });
}

/**
 * Replay spooled accounting transaction events from an NDJSON spool into a store.
 *
 * @param {object} pipeline - cop_event_persist_pipeline instance
 * @param {object} [opts]
 * @returns {object} Replay report
 */
export function replayPacketAccountingSpool(pipeline, opts = {}) {
  if (!pipeline || typeof pipeline.replaySpool !== "function") {
    return { ok: false, error: "no_spool_pipeline" };
  }
  return pipeline.replaySpool(opts);
}
