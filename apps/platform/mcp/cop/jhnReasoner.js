/** A replaceable text-reasoning adapter; no COP or storage dependency. */
export function createOpenAIJhnReasoner({ client, model = "gpt-5.6-luna" } = {}) {
  if (!client?.responses?.create) throw new TypeError("an OpenAI Responses client is required");

  return {
    async respond({ message, history = [] } = {}) {
      if (typeof message !== "string" || message.trim().length === 0)
        throw new TypeError("message is required");
      const response = await client.responses.create({
        model,
        input: [...history, { role: "user", message }]
          .map((entry) => `${entry.role === "assistant" ? "John" : "User"}: ${entry.message}`)
          .join("\n"),
        instructions:
          "You are John, a personal digital twin in an early local-only test. Answer concisely in French unless the user writes in another language. Do not claim external actions were performed.",
        max_output_tokens: 256,
        reasoning: { effort: "none" },
        store: false,
      });
      return {
        responseId: response.id,
        text: response.output_text,
        usage: response.usage,
      };
    },
  };
}
