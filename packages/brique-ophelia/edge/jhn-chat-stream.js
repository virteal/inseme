const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const STREAM_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function loadVaultConfig() {
  const config = await import("@inseme/cop-host/config/instanceConfig.edge.js");
  await config.loadInstanceConfig();
  return config;
}

function conversationId(body) {
  if (typeof body.conversation_id === "string" && body.conversation_id) return body.conversation_id;
  if (typeof body.user_id === "string" && body.user_id) return `user:${body.user_id}`;
  return `anonymous:${crypto.randomUUID()}`;
}

function textFromResponse(response) {
  if (typeof response.output_text === "string" && response.output_text) return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("");
}

async function appendCopEvent({ endpoint, capability, topicId, type, payload }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${capability}`, "content-type": "application/json" },
    body: JSON.stringify({ topic_id: topicId, type, payload }),
  });
  if (!response.ok) throw new Error(`COP event write failed with HTTP ${response.status}`);
}

function streamText({ provider, model, text }) {
  /* global Deno */

  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `__PROVIDER_INFO__${JSON.stringify({ provider, model, orchestration: "cop" })}\n`
          )
        );
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
    { headers: STREAM_HEADERS }
  );
}

/**
 * Edge-native JHN conversation adapter.
 *
 * It intentionally contains no Node persistence, collective-room, pricing, or provider-routing
 * imports. The COP service remains the orchestration authority: both sides of each turn are
 * appended through its capability-protected event boundary.
 */
export default async function jhnChatStream(request) {
  if (request.method === "GET" && new URL(request.url).searchParams.get("healthcheck") === "true") {
    return json({ status: "ok", profile: "jhn", orchestration: "cop" });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let vault;
  try {
    vault = await loadVaultConfig();
  } catch (error) {
    console.error("JHN vault configuration failed", { message: error?.message });
    return json({ error: "jhn_vault_unavailable" }, 503);
  }

  const config = (name) => String(vault.getConfig(name) || "").trim();
  const copEndpoint =
    config("JHN_COP_EVENT_URL") || new URL("/api/jhn-cop-events", request.url).toString();
  const copCapability = config("JHN_COP_CAPABILITY");
  const openaiKey = config("OPENAI_API_KEY");
  if (!copCapability) return json({ error: "cop_orchestrator_unconfigured" }, 503);
  if (!openaiKey) return json({ error: "openai_unconfigured" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const message = String(body.question || "").trim();
  if (!message) return json({ error: "question_required" }, 400);

  const topicId = conversationId(body);
  const model = config("JHN_OPENAI_MODEL") || "gpt-4o-mini";
  const history = Array.isArray(body.conversation_history)
    ? body.conversation_history.slice(-24)
    : [];
  const input = [...history, { role: "user", content: message }]
    .map((entry) => `${entry.role === "assistant" ? "John" : "User"}: ${entry.content || ""}`)
    .join("\n");

  try {
    await appendCopEvent({
      endpoint: copEndpoint,
      capability: copCapability,
      topicId,
      type: "conversation.user_message",
      payload: { message, conversationId: topicId, source: "jhn-edge" },
    });

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${openaiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        input,
        instructions:
          "You are John, a personal digital twin. Answer concisely in French unless the user writes in another language. Do not claim external actions were performed.",
        max_output_tokens: 512,
        store: false,
      }),
    });
    if (!openaiResponse.ok) {
      console.error("JHN Responses request failed", { status: openaiResponse.status });
      return json({ error: "provider_request_failed", status: openaiResponse.status }, 502);
    }
    const result = await openaiResponse.json();
    const text = textFromResponse(result);
    if (!text) return json({ error: "provider_empty_response" }, 502);

    await appendCopEvent({
      endpoint: copEndpoint,
      capability: copCapability,
      topicId,
      type: "conversation.assistant_message",
      payload: {
        conversationId: topicId,
        responseId: result.id || null,
        message: text,
        source: "jhn-edge",
      },
    });
    return streamText({ provider: "openai", model, text });
  } catch (error) {
    console.error("JHN COP chat adapter failed", { message: error?.message });
    return json({ error: "jhn_chat_unavailable" }, 502);
  }
}

export const config = { path: "/api/chat-stream" };
