import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export default async (request, context) => {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // This endpoint expects a POST with the conversation context to generate an AI response
  // It streams the response back using SSE format
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const { session_id, last_utterances, system_prompt } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // const supabase = createClient(supabaseUrl, supabaseKey);
    // We might need supabase to log the final full response

    // 1. Initialize OpenAI (or other provider)
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response("Missing OPENAI_API_KEY", { status: 500 });
    }

    // 2. Prepare Payload
    const messages = [
      { role: "system", content: system_prompt || "You are Ophélia, a helpful civic facilitator." },
      ...last_utterances.map((u) => ({
        role: u.speaker_type === "ophelia" ? "assistant" : "user",
        content: `${u.speaker_type === "participant" ? (u.participant_name || "User") + ": " : ""}${u.clean_transcript}`,
      })),
    ];

    // 3. Call OpenAI with Stream
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo", // or similar
        messages,
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!completion.ok) {
      const err = await completion.text();
      return new Response(`OpenAI Error: ${err}`, { status: completion.status });
    }

    // 4. Create a TransformStream to process the chunks into SSE
    const stream = new ReadableStream({
      async start(controller) {
        const reader = completion.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.replace("data: ", "").trim();
                if (dataStr === "[DONE]") {
                  // End of stream
                  controller.enqueue(new TextEncoder().encode("event: done\ndata: [DONE]\n\n"));
                  break;
                }
                try {
                  const json = JSON.parse(dataStr);
                  const token = json.choices[0]?.delta?.content;
                  if (token) {
                    fullText += token;
                    // Send SSE event
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify({ token })}\n\n`)
                    );
                  }
                } catch (e) {
                  // ignore parse errors on partial chunks
                }
              }
            }
          }
        } catch (err) {
          controller.enqueue(new TextEncoder().encode(`event: error\ndata: ${err.message}\n\n`));
        } finally {
          controller.close();
          // TODO: Save fullText to Supabase as an utterance
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
};
