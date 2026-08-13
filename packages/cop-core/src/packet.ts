/**
 * Cognitive Packet Protocol & Tracing Types
 *
 * The Cognitive Packet is the authoritative execution and transport envelope in Fractanet.
 * It traces both the sequence of hops travelled across nodes/instances and the provisional
 * spending incurred at each step.
 *
 * FractaBlog and other UI feeds are pure projections (views) derived from these packets.
 *
 * @module packet
 * @since 1.0
 */

import { ExactQuantity, AccountIdentifier, DisclosureClass, GovernanceContext } from "./accounting";

/**
 * Single routing hop entry recorded on the Cognitive Packet.
 */
export interface PacketHop {
  /** Sequential hop index (0, 1, 2...). */
  hop_index: number;
  /** Fractanet node identifier (e.g. "node:fracta:main" or "node:workstation:win"). */
  node_id: string;
  /** Instance/agent identity handling the packet at this hop. */
  instance_id: string;
  /** Transport interface used to enter/exit this hop (e.g. "http", "mcp", "local"). */
  interface?: string;
  /** ISO-8601 UTC timestamp of the hop execution. */
  timestamp: string;
  /** Routing rationale or handler operation for this hop. */
  route_reason?: string;
  /** Optional cryptographic signature or token proving hop authenticity. */
  signature?: string;
}

/**
 * Provisional spending record for a single execution step/hop.
 */
export interface ProvisionalSpending {
  /**
   * Stable id of this spend line, unique within the owning packet
   * (e.g. "spend:0", "spend:1"). Owning packet_id + spend_id is globally unique.
   */
  spend_id?: string;
  /** Hop index to which this spending applies. */
  hop_index: number;
  /** Fractanet node identifier where spending occurred. */
  node_id: string;
  /** High-level COP capability invoked (e.g. "ai/chat-completion", "ai/embeddings"). */
  capability: string;
  /** LLM/Compute provider (e.g. "openai", "groq", "mistral", "local"). */
  provider: string;
  /** Model or resource SKU name (e.g. "gpt-4o-mini", "llama-3.3-70b-versatile"). */
  model: string;
  /** Number of prompt/input tokens processed. */
  prompt_tokens: number;
  /** Number of completion/output tokens generated. */
  completion_tokens: number;
  /** Exact decimal provisional cost estimate (default unit USD). */
  provisional_cost: ExactQuantity;
  /** Rate card reference used for estimation (e.g. "rate:openai:gpt-4o-mini:2026-08"). */
  rate_basis: string;
  /** ISO-8601 UTC timestamp when spending was incurred. */
  timestamp: string;
  /** Optional hash of request/response payload for evidence correlation. */
  evidence_hash?: string;
}

/**
 * Lineage relation for cascade accounting (spawn / split / delegate).
 *
 * Preferred vocabulary (network / packet, less anthropocentric than parent/child):
 *   - upstream_packet_id  — packet that authorized or spawned this work
 *   - downstream_packet_ids — packets spawned from this one
 *
 * Accepted aliases in prose (not preferred in schema):
 *   parent ≈ upstream, child ≈ downstream, root ≈ top of cascade, leaf ≈ no downstream.
 *
 * Other candidates considered: source/derived, origin/spawned, superordinate/subordinate.
 * "Upstream/downstream" fits Fractanet routing and avoids family metaphors.
 */
export interface PacketLineage {
  /** Packet that spawned or authorized this packet (none for cascade root). */
  upstream_packet_id?: string;
  /** Packets spawned from this packet (ids only — never copy their spending lines here). */
  downstream_packet_ids?: string[];
  /** Why this packet was spawned (split, subagent, hop_delegate, continuation, …). */
  spawn_reason?: string;
}

/**
 * Authoritative Cognitive Packet Structure.
 */
export interface CognitivePacket {
  /** Unique URN for this packet (e.g. "urn:cop:packet:12345678-1234-..."). */
  packet_id: string;
  /** Mandate authorizing this packet's processing. */
  mandate_id: string;
  /** Governed treatment ID scope. */
  treatment_id: string;
  /** Primary debtor account paying for execution. */
  account_id: AccountIdentifier;
  /** Budget reservation ID linked to this packet. */
  budget_reservation_id?: string;
  /**
   * Default monetary unit for provisional valuation (providers bill in USD today).
   * Non-USD resources use their own unit on ExactQuantity; fiat default remains USD.
   */
  monetary_unit_default?: string;
  /** Cascade lineage (upstream/downstream). */
  lineage?: PacketLineage;
  /** Ordered list of routing hops travelled across Fractanet nodes. */
  hops: PacketHop[];
  /**
   * Ordered list of provisional spending traces incurred on *this* packet only (own spend).
   * Never duplicate downstream packets' spending lines here (anti double-count).
   */
  spending: ProvisionalSpending[];
  /** Governance context governing this packet's treatment. */
  governance: GovernanceContext;
  /** Visibility disclosure class for projections ("public" | "restricted" | "private"). */
  disclosure_class: DisclosureClass;
  /** Creation timestamp (ISO-8601 UTC). */
  created_at: string;
  /** Packet payload content or reference. */
  payload: Record<string, unknown>;
}

/**
 * FractaBlog Projected Entry derived from Cognitive Packet Truth.
 */
export interface FractaBlogPostProjection {
  /** Derived post ID. */
  post_id: string;
  /** Source packet URN. */
  packet_id: string;
  /** Post title/headline. */
  title: string;
  /** Summary markdown description of treatment. */
  summary: string;
  /** Actor/Principal governance metadata. */
  actor_subject_id: string;
  principal_subject_id: string;
  /** Trace of Fractanet node hops. */
  hop_chain: Array<{
    hop_index: number;
    node_id: string;
    instance_id: string;
    timestamp: string;
  }>;
  /** Provisional spending breakdown per hop. */
  spending_breakdown: Array<{
    hop_index: number;
    provider: string;
    model: string;
    total_tokens: number;
    provisional_cost_usd: string;
  }>;
  /** Total provisional cost formatted as decimal USD string. */
  total_provisional_cost_usd: string;
  /** Disclosure class of the projection. */
  disclosure_class: DisclosureClass;
  /** ISO-8601 UTC timestamp of projection. */
  published_at: string;
}
