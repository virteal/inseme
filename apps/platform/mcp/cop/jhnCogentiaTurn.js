/**
 * Vertical slice: Principal → John → Cogentia MCP (attested) → COP-shaped trace.
 * Step 1 of the JHN convergence path (Inseme #33).
 *
 * Does not require OpenAI. Corpus evidence comes from Cogentia MCP only.
 */

import { conversationTopic } from "./jhnConversationState.js";
import { createCogentiaMcpClient } from "./cogentiaMcpClient.js";

function requireText(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required`);
  return value.trim();
}

/**
 * @param {object} options
 * @param {object} options.store  { append(event) } memory or COP store
 * @param {object} [options.cogentia]  createCogentiaMcpClient()
 * @param {object} options.identity  principal_ref, mandate_ref, logical_agent_ref
 */
export function createJhnCogentiaTurn(options = {}) {
  const { store, identity } = options;
  if (!store || typeof store.append !== "function") {
    throw new TypeError("store.append is required");
  }
  requireText(identity?.principal_ref, "identity.principal_ref");
  requireText(identity?.mandate_ref, "identity.mandate_ref");
  requireText(identity?.logical_agent_ref, "identity.logical_agent_ref");

  const cogentia =
    options.cogentia ||
    createCogentiaMcpClient({
      actor: identity.logical_agent_ref.startsWith("agent:jhn")
        ? identity.logical_agent_ref
        : "agent:jhn",
      mandate_ref: identity.mandate_ref,
      principal_ref: identity.principal_ref,
    });

  return {
    identity: {
      conversational: "John",
      logical_agent_ref: identity.logical_agent_ref,
      principal_ref: identity.principal_ref,
      mandate_ref: identity.mandate_ref,
    },
    cogentia,

    /**
     * One dogfood turn: user message → Cogentia evidence → John reply + COP events.
     * @param {{ message: string, conversationId?: string, subagentId?: string, skill?: string }} input
     */
    async turn(input = {}) {
      const message = requireText(input.message, "message");
      const conversationId = input.conversationId || "john";
      const topicId = conversationTopic(conversationId);
      const subagentId = input.subagentId || null;
      const skill = input.skill || "corpus-evidence-retrieval";
      const client = subagentId ? cogentia.forSubagent(subagentId) : cogentia;
      const now = () => new Date().toISOString();

      store.append({
        topic_id: topicId,
        epistemic_status: "observed",
        actor_ref: identity.principal_ref,
        subject_ref: identity.logical_agent_ref,
        visibility: "restricted",
        at: now(),
        payload: {
          kind: "conversation.user_message",
          message,
          conversationId,
          conversational_identity: "John",
        },
      });

      // Bounded context: skill method + one search (not full corpus dump) — U2 intent
      let skillMeta = null;
      let evidence = null;
      let listAuth = null;
      let error = null;

      try {
        listAuth = await client.listTools();
        skillMeta = await client.callTool("cogentia_skill_get", {
          id: skill,
          meta_only: true,
        });
        evidence = await client.search(message, { limit: 5, mode: "keyword" });
      } catch (e) {
        error = { message: e.message, class: e.error_class || "cogentia_call_failed" };
      }

      store.append({
        topic_id: topicId,
        epistemic_status: "observed",
        actor_ref: identity.logical_agent_ref,
        visibility: "restricted",
        at: now(),
        payload: {
          kind: "capability.invocation",
          capability: "cogentia.mcp",
          conversational_identity: "John",
          executor: subagentId ? `agent:jhn.subagent:${subagentId}` : identity.logical_agent_ref,
          mandate_ref: identity.mandate_ref,
          auth: listAuth?.auth || null,
          allowMutate: listAuth?.allowMutate === true,
          skill,
          skill_ok: skillMeta?.ok === true,
          evidence_ok: evidence?.ok === true,
          citation_count: Array.isArray(evidence?.citations)
            ? evidence.citations.length
            : Array.isArray(evidence?.data?.results)
              ? evidence.data.results.length
              : 0,
          envelope_kind: evidence?.envelope?.kind || skillMeta?.envelope?.kind || null,
          error,
        },
      });

      const citations =
        evidence?.citations ||
        (evidence?.data?.results || []).map((r) => ({
          source_id: r.id || r.source_id,
          repo: r.repo,
          path: r.path,
        })) ||
        [];

      const lines = [
        "John — réponse d’intégration (dogfood Cogentia, sans modèle LLM requis).",
        "",
        `Question: ${message}`,
        `Auth Cogentia: ${listAuth?.auth || "unknown"} (mutate=${listAuth?.allowMutate === true})`,
        `Skill: ${skill}${skillMeta?.ok ? " (chargé)" : " (indisponible)"}`,
      ];
      if (error) {
        lines.push(`Erreur Cogentia: ${error.message}`);
      } else if (!citations.length) {
        lines.push("Aucune citation publique trouvée pour cette requête.");
      } else {
        lines.push("Preuves (bornées):");
        for (const c of citations.slice(0, 5)) {
          lines.push(
            `- ${c.source_id || `${c.repo}:${c.path}`}${c.repo && c.path && !c.source_id ? "" : ""}`
          );
        }
      }
      lines.push("");
      lines.push(
        "Identité conversationnelle: John. Le runtime Cogentia MCP est un Handler/capability, pas John."
      );

      const text = lines.join("\n");

      store.append({
        topic_id: topicId,
        epistemic_status: "observed",
        actor_ref: identity.logical_agent_ref,
        visibility: "restricted",
        at: now(),
        payload: {
          kind: "conversation.assistant_message",
          conversationId,
          conversational_identity: "John",
          message: text,
          citations,
          cogentia_auth: listAuth?.auth || null,
        },
      });

      return {
        conversational_identity: "John",
        text,
        citations,
        cogentia: {
          auth: listAuth?.auth || null,
          allowMutate: listAuth?.allowMutate === true,
          skill,
          skill_ok: skillMeta?.ok === true,
          evidence_ok: evidence?.ok !== false && !error,
          envelope_kind: evidence?.envelope?.kind || null,
          error,
        },
        topic_id: topicId,
      };
    },
  };
}

/** Minimal in-memory COP-like store for dogfood / tests. */
export function createMemoryCopStore() {
  const events = [];
  return {
    events,
    append(event) {
      const row = { ...event, seq: events.length + 1 };
      events.push(row);
      return row;
    },
  };
}
