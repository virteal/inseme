import { conversationTopic } from "./jhnConversationState.js";

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} is required`);
  return value;
}

async function append(runtimeUrl, capability, topicId, type, payload, fetchImpl) {
  const response = await fetchImpl(`${runtimeUrl}/cop/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${capability}`, "content-type": "application/json" },
    body: JSON.stringify({ topic_id: topicId, type, payload }),
  });
  if (!response.ok) throw new Error(`COP event write failed with HTTP ${response.status}`);
}

/** Local conversational turn: persist intent and result through the COP boundary. */
export function createJhnLocalAgent({ runtimeUrl, capability, reasoner, fetchImpl = fetch } = {}) {
  requireText(runtimeUrl, "runtimeUrl");
  requireText(capability, "capability");
  if (!reasoner || typeof reasoner.respond !== "function")
    throw new TypeError("reasoner.respond is required");

  return {
    async turn({ message, conversationId, history } = {}) {
      requireText(message, "message");
      const topicId = conversationTopic(conversationId);
      await append(
        runtimeUrl,
        capability,
        topicId,
        "conversation.user_message",
        { message, conversationId },
        fetchImpl
      );
      const result = await reasoner.respond({ message, history });
      await append(
        runtimeUrl,
        capability,
        topicId,
        "conversation.assistant_message",
        {
          conversationId,
          responseId: result.responseId,
          message: result.text,
        },
        fetchImpl
      );
      return result;
    },
  };
}
