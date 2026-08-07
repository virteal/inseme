/**
 * John as primary conversational surface with optional governed handler
 * delegation (Inseme #33 P1/P3).
 *
 * Provider/handler is never the conversational identity.
 */

import { conversationTopic } from "./jhnConversationState.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

/**
 * @param {object} options
 * @param {object} options.store  local append-only COP store (memory)
 * @param {object} options.reasoner  { respond({message,history}) }
 * @param {object} [options.handler]  optional external capability { id, invoke }
 * @param {object} options.identity  principal/mandate/logical_agent refs
 * @param {(input: object) => boolean} [options.shouldDelegate]
 */
export function createJhnDelegatingAgent(options = {}) {
  const { store, reasoner, handler, identity, shouldDelegate } = options;
  if (!store || typeof store.append !== "function") {
    throw new TypeError("store.append is required");
  }
  if (!reasoner || typeof reasoner.respond !== "function") {
    throw new TypeError("reasoner.respond is required");
  }
  requireText(identity?.principal_ref, "identity.principal_ref");
  requireText(identity?.mandate_ref, "identity.mandate_ref");
  requireText(identity?.logical_agent_ref, "identity.logical_agent_ref");

  return {
    identity: {
      conversational: "John",
      logical_agent_ref: identity.logical_agent_ref,
      principal_ref: identity.principal_ref,
      mandate_ref: identity.mandate_ref,
    },

    /**
     * Principal → John turn. Optional handler delegation under mandate.
     */
    async turn({ message, conversationId = "john", history = [] } = {}) {
      requireText(message, "message");
      const topicId = conversationTopic(conversationId);

      store.append({
        topic_id: topicId,
        epistemic_status: "observed",
        actor_ref: identity.principal_ref,
        subject_ref: identity.logical_agent_ref,
        visibility: "restricted",
        payload: {
          kind: "conversation.user_message",
          message,
          conversationId,
          conversational_identity: "John",
        },
        idempotency_key: `conv:${conversationId}:user:${Date.now()}`,
      });

      let handlerReceipt = null;
      let handlerText = null;
      const wantsDelegate =
        typeof shouldDelegate === "function"
          ? shouldDelegate({ message, history })
          : Boolean(handler && /code|implement|fix|review/i.test(message));

      if (wantsDelegate && handler) {
        const { jhnDelegateToHandler } =
          await import("../../../../packages/cop-core/src/governed-act.js");
        handlerReceipt = await jhnDelegateToHandler({
          store,
          handler,
          identity: { ...identity, topic_id: topicId },
          capability: handler.capability || "reasoning.assist",
          input: { message, history },
        });
        handlerText =
          handlerReceipt.events?.find((e) => e.payload?.kind === "Trace")?.payload?.effect?.text ||
          handlerReceipt.events?.find((e) => e.payload?.kind === "Trace")?.payload?.effect
            ?.summary ||
          null;
      }

      const result = await reasoner.respond({
        message,
        history,
        handlerAssist: handlerText,
        identity: "John",
      });

      store.append({
        topic_id: topicId,
        epistemic_status: "observed",
        actor_ref: identity.logical_agent_ref,
        subject_ref: identity.principal_ref,
        visibility: "restricted",
        payload: {
          kind: "conversation.assistant_message",
          conversationId,
          responseId: result.responseId || null,
          message: result.text,
          conversational_identity: "John",
          handler_instance_ref: handler?.id || null,
          governed_act_id: handlerReceipt?.act_id || null,
        },
        idempotency_key: `conv:${conversationId}:assistant:${Date.now()}`,
      });

      return {
        text: result.text,
        responseId: result.responseId || null,
        conversational_identity: "John",
        handler_instance_ref: handler?.id || null,
        governed_act: handlerReceipt?.receipt || null,
      };
    },
  };
}
