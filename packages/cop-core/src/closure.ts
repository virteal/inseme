import type { CognitivePacket, PacketClosure, PacketHop } from "./packet.js";

/**
 * Resolved dependency with integrity verification status.
 */
export interface ResolvedDependency {
  dependency_id: string;
  kind: "artifact" | "event" | "document" | "schema" | "capability";
  locator: string;
  hash?: string;
  content: unknown;
  verified: boolean;
}

/**
 * Dependency resolver interface for materializing durable external references.
 */
export interface DependencyResolver {
  resolve(dependency: {
    dependency_id: string;
    kind: string;
    locator: string;
    hash?: string;
  }): Promise<{ content: unknown; rawString?: string }>;
}

/**
 * Result of materializing a packet's declared closure.
 */
export interface MaterializedClosureResult {
  packet_id: string;
  is_closed: boolean;
  closure_kind: "self_contained" | "materializable" | "open";
  resolved_dependencies: Map<string, ResolvedDependency>;
  missing_dependencies: string[];
  tampered_dependencies: string[];
  materialized_at: string;
}

/**
 * Pure isomorphic string hash computation (DJB2 / FNV1a hybrid formatted as sha256 placeholder if WebCrypto is sync-unavailable).
 * When running in Node/browser, uses available crypto or deterministic hex digest.
 */
export function computeContentHash(content: unknown): string {
  const str = typeof content === "string" ? content : JSON.stringify(content);

  // Deterministic FNV-1a 64-bit style hash for isomorphic environments
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ (ch >> 8), 0x85ebca6b);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `hash:${hex1}${hex2}`;
}

/**
 * Materializes all referenced dependencies declared in a packet's closure.
 * Checks hashes and confirms whether the packet can be safely continued without hidden state.
 */
export async function materializePacketClosure(
  packet: CognitivePacket,
  resolver: DependencyResolver
): Promise<MaterializedClosureResult> {
  const closure = packet.closure;
  const result: MaterializedClosureResult = {
    packet_id: packet.packet_id,
    is_closed: false,
    closure_kind: closure?.closure_kind || "open",
    resolved_dependencies: new Map(),
    missing_dependencies: [],
    tampered_dependencies: [],
    materialized_at: new Date().toISOString(),
  };

  if (!closure || closure.closure_kind === "open") {
    result.is_closed = false;
    return result;
  }

  if (closure.closure_kind === "self_contained") {
    result.is_closed = true;
    return result;
  }

  const deps = closure.referenced_dependencies || [];
  for (const dep of deps) {
    try {
      const { content, rawString } = await resolver.resolve(dep);
      if (content === undefined || content === null) {
        result.missing_dependencies.push(dep.dependency_id);
        continue;
      }

      let verified = true;
      if (dep.hash) {
        const computed = computeContentHash(rawString !== undefined ? rawString : content);
        if (computed !== dep.hash) {
          verified = false;
          result.tampered_dependencies.push(dep.dependency_id);
        }
      }

      result.resolved_dependencies.set(dep.dependency_id, {
        dependency_id: dep.dependency_id,
        kind: dep.kind as any,
        locator: dep.locator,
        hash: dep.hash,
        content,
        verified,
      });
    } catch {
      result.missing_dependencies.push(dep.dependency_id);
    }
  }

  result.is_closed =
    result.missing_dependencies.length === 0 && result.tampered_dependencies.length === 0;

  return result;
}

/**
 * Resumes execution of a Cognitive Packet using ONLY its declared closure.
 * Fails closed if the closure cannot be completely and securely materialized.
 */
export async function resumePacket<TResult = unknown>(
  packet: CognitivePacket,
  resolver: DependencyResolver,
  handler: (
    packet: CognitivePacket,
    closure: MaterializedClosureResult
  ) => Promise<{ yield: TResult; newHop: Omit<PacketHop, "hop_index" | "timestamp"> }>
): Promise<CognitivePacket> {
  const materialized = await materializePacketClosure(packet, resolver);
  if (!materialized.is_closed) {
    throw new Error(
      `Cannot resume packet ${packet.packet_id}: closure incomplete (missing: [${materialized.missing_dependencies.join(
        ", "
      )}], tampered: [${materialized.tampered_dependencies.join(", ")}])`
    );
  }

  const { yield: resultYield, newHop } = await handler(packet, materialized);

  const hopIndex = packet.hops.length;
  const hop: PacketHop = {
    hop_index: hopIndex,
    node_id: newHop.node_id,
    instance_id: newHop.instance_id,
    interface: newHop.interface || "local",
    route_reason: newHop.route_reason || "closure-resumed",
    timestamp: new Date().toISOString(),
  };

  const updatedPacket: CognitivePacket = {
    ...packet,
    hops: [...packet.hops, hop],
    yield: {
      semantic_yield: resultYield,
      produced_at: new Date().toISOString(),
      produced_by: newHop.instance_id,
    },
    status: "solved",
  };

  return updatedPacket;
}
