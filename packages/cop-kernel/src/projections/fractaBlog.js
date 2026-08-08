/**
 * FractaBlog Projections Module
 *
 * Derives pure, deterministic FractaBlog view projections from Cognitive Packets
 * (the Ground Truth stream).
 *
 * Ground Truth: Cognitive Packets (Hops + Provisional Spending Traces)
 * Views: FractaBlog activity feed, hop trace graphs, spending summaries.
 *
 * @module projections/fractaBlog
 */

import { calculatePacketTotalSpending } from "../accounting/packetAccounting.js";
import { toDecimal } from "../accounting/quantity.js";

/**
 * Project a single Cognitive Packet into a FractaBlog Post Entry.
 *
 * Respects disclosure classes:
 * - "public": Full public projection with sanitized payloads.
 * - "restricted": Public metadata, hidden internal payload details.
 * - "private" / "confidential": Null/excluded from public views.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @param {object} [options]
 * @param {boolean} [options.allowRestricted=false] Include restricted packets with redacted payload
 * @returns {import("@inseme/cop-core").FractaBlogPostProjection | null}
 */
export function projectFractaBlogPost(packet, options = {}) {
  if (!packet) return null;

  const disclosure = packet.disclosure_class || "public";
  if (disclosure === "private" || disclosure === "confidential") {
    return null; // Excluded from public FractaBlog view
  }
  if (disclosure === "restricted" && !options.allowRestricted) {
    return null;
  }

  const totalCostQuantity = calculatePacketTotalSpending(packet);
  const totalCostDecimal = toDecimal(totalCostQuantity);

  const hopChain = (packet.hops || []).map((h) => ({
    hop_index: h.hop_index,
    node_id: h.node_id,
    instance_id: h.instance_id,
    timestamp: h.timestamp,
  }));

  const spendingBreakdown = (packet.spending || []).map((s) => ({
    hop_index: s.hop_index,
    provider: s.provider,
    model: s.model,
    total_tokens: (s.prompt_tokens || 0) + (s.completion_tokens || 0),
    provisional_cost_usd: toDecimal(s.provisional_cost),
  }));

  const payloadTitle =
    packet.payload?.title || packet.payload?.subject || `Treatment ${packet.treatment_id}`;
  const payloadSummary =
    packet.payload?.summary ||
    packet.payload?.description ||
    `Governed execution on mandate ${packet.mandate_id}`;

  return {
    post_id: `blog:${packet.packet_id.replace(/^urn:cop:packet:/, "")}`,
    packet_id: packet.packet_id,
    title: String(payloadTitle),
    summary: String(payloadSummary),
    actor_subject_id: packet.governance?.actor_subject_id || "agent:jhn:main",
    principal_subject_id: packet.governance?.principal_subject_id || packet.account_id,
    hop_chain: hopChain,
    spending_breakdown: spendingBreakdown,
    total_provisional_cost_usd: totalCostDecimal,
    disclosure_class: disclosure,
    published_at: packet.created_at || new Date().toISOString(),
  };
}

/**
 * Project an array of Cognitive Packets into a FractaBlog Activity Feed.
 *
 * @param {import("@inseme/cop-core").CognitivePacket[]} packets
 * @param {object} [options]
 * @param {boolean} [options.allowRestricted=false]
 * @returns {import("@inseme/cop-core").FractaBlogPostProjection[]}
 */
export function projectFractaBlogFeed(packets, options = {}) {
  if (!Array.isArray(packets)) return [];

  const feed = [];
  for (const packet of packets) {
    const post = projectFractaBlogPost(packet, options);
    if (post) {
      feed.push(post);
    }
  }

  // Sort by published_at descending (latest first)
  return feed.sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}

/**
 * Generate a textual/visual hop graph and spending trace summary for a Cognitive Packet.
 *
 * @param {import("@inseme/cop-core").CognitivePacket} packet
 * @returns {string} Human-readable ASCII/Markdown report
 */
export function projectPacketTraceView(packet) {
  if (!packet) return "No packet provided.";

  const totalCost = toDecimal(calculatePacketTotalSpending(packet));
  const lines = [
    `=== COGNITIVE PACKET TRACE ===`,
    `Packet ID:   ${packet.packet_id}`,
    `Mandate ID:  ${packet.mandate_id}`,
    `Account ID:  ${packet.account_id}`,
    `Disclosure:  ${packet.disclosure_class}`,
    `Total Cost:  $${totalCost} USD (provisional)`,
    ``,
    `--- Fractanet Hops Chain ---`,
  ];

  for (const h of packet.hops || []) {
    lines.push(
      `  [Hop ${h.hop_index}] Node: ${h.node_id} | Instance: ${h.instance_id} | Interface: ${h.interface || "local"} (${h.timestamp})`
    );
  }

  lines.push(``, `--- Provisional Spending Log ---`);
  if (!packet.spending || packet.spending.length === 0) {
    lines.push(`  (No spending entries recorded)`);
  } else {
    for (const s of packet.spending) {
      const costUsd = toDecimal(s.provisional_cost);
      lines.push(
        `  [Hop ${s.hop_index}] ${s.provider}/${s.model} - ${s.prompt_tokens} in / ${s.completion_tokens} out -> $${costUsd} USD (${s.rate_basis})`
      );
    }
  }

  return lines.join("\n");
}
