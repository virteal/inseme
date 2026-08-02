import { DatabaseSync } from "node:sqlite";
import path from "node:path";

export function conversationTopic(conversationId) {
  if (typeof conversationId !== "string" || !/^[A-Za-z0-9:_-]+$/.test(conversationId)) {
    throw new TypeError(
      "conversationId must contain only letters, digits, colon, underscore or hyphen"
    );
  }
  return `topic:jhn:conversation:${conversationId}`;
}

/** Read the locally persisted conversation; no provider-side session is required. */
export function readJhnConversationState({ stateDirectory, conversationId }) {
  const database = new DatabaseSync(path.join(stateDirectory, "cop-runtime.sqlite"));
  try {
    const rows = database
      .prepare(
        "SELECT type, payload FROM cop_events WHERE topic_id = ? AND type IN (?, ?) ORDER BY rowid ASC"
      )
      .all(
        conversationTopic(conversationId),
        "conversation.user_message",
        "conversation.assistant_message"
      );
    return {
      topicId: conversationTopic(conversationId),
      history: rows.map((row) => {
        const payload = JSON.parse(row.payload);
        return {
          role: row.type === "conversation.user_message" ? "user" : "assistant",
          message: payload.message,
        };
      }),
    };
  } finally {
    database.close();
  }
}
