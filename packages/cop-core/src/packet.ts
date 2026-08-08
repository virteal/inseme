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
  /** Exact decimal provisional cost estimate. */
  provisional_cost: ExactQuantity;
  /** Rate card reference used for estimation (e.g. "rate:openai:gpt-4o-mini:2026-08"). */
  rate_basis: string;
  /** ISO-8601 UTC timestamp when spending was incurred. */
  timestamp: string;
  /** Optional hash of request/response payload for evidence correlation. */
  evidence_hash?: string;
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
  /** Ordered list of routing hops travelled across Fractanet nodes. */
  hops: PacketHop[];
  /** Ordered list of provisional spending traces incurred at each hop. */
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
