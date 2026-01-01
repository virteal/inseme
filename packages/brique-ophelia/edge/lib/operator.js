/**
 * packages/brique-ophelia/edge/lib/operator.js
 * Le Cœur d'Ophélia : Boucle itérative LLM + Outils.
 * Restauration de la parité avec rag_chatbotv3.js (multi-turn, stream fallback, thinking).
 */

import { buildSystemPrompt } from "./prompts.js";
import { getAuthorizedTools, executeInternalTool } from "./tools.js";

const TOOL_TRACE_PREFIX = "__TOOL_TRACE__";
const PROVIDER_META_PREFIX = "__PROVIDER_INFO__";

async function broadcastThought(supabase, room_id, thought, type = "reasoning") {
  if (!supabase || !room_id) return;
  try {
    const channel = supabase.channel(`room:${room_id}`);
    await channel.send({
      type: "broadcast",
      event: "ephemeral_reasoning",
      payload: {
        thought,
        type,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn("[Ophelia] Broadcast failed:", e);
  }
}

function sanitizeHistory(messages) {
  return messages.map(m => {
    let content = m.text || m.content || "";
    if (m.role === "assistant" || m.sender === "assistant") {
      // Remove <Think> blocks from history sent to LLM to save tokens and avoid confusion
      content = content.replace(/<Think>[\s\S]*?<\/Think>/gi, "").trim();
    }
    return {
      role: m.role || (m.sender === "user" ? "user" : "assistant"),
      content
    };
  });
}

function isAsyncIterable(value) {
  return Boolean(value && typeof value[Symbol.asyncIterator] === "function");
}

export async function runOperator(runtime, body, options = {}) {
  const { openai, supabase, identity, role, encoder, controller } = options;
  const { messages, question, room_id, model: userModel } = body;
  const idleTimeoutMs = 30000;

  const systemMsg = buildSystemPrompt(identity, role, body);
  let fullMessages = [
    { role: "system", content: systemMsg },
    ...sanitizeHistory(messages)
  ];

  if (question) {
    fullMessages.push({ role: "user", content: question });
  }

  const tools = getAuthorizedTools(role);
  let iteration = 0;
  const maxIterations = 3;

  while (iteration < maxIterations) {
    iteration++;
    const model = userModel || "gpt-4o";
    
    // Yield thinking metadata
    const iterationThink = `<Think>Itération ${iteration}/${maxIterations} — Appel ${model}</Think>\n`;
    controller.enqueue(encoder.encode(iterationThink));
    await broadcastThought(supabase, room_id, `Réflexion (tour ${iteration})`, "llm_reasoning");

    let stream;
    try {
      stream = await openai.chat.completions.create({
        model,
        messages: fullMessages,
        tools: tools.length > 0 ? tools : undefined,
        stream: true,
      });
    } catch (err) {
      console.error("[Operator] LLM call failed:", err);
      controller.enqueue(encoder.encode(`\n⚠️ Erreur LLM: ${err.message}\n`));
      return;
    }

    let currentAiContent = "";
    let currentToolCalls = [];
    let streamTimedOut = false;

    // Stream consumption with race-timeout (parity with rag_chatbotv3)
    const iterator = stream[Symbol.asyncIterator]();
    try {
        while (true) {
            const nextPromise = iterator.next();
            let res;
            try {
                res = await Promise.race([
                    nextPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error("stream-timeout")), idleTimeoutMs))
                ]);
            } catch (err) {
                if (err.message === "stream-timeout") {
                    console.warn("[Operator] Stream timeout, switching to direct if needed.");
                    streamTimedOut = true;
                    break;
                }
                throw err;
            }

            if (res.done) break;
            const chunk = res.value;
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
                currentAiContent += delta.content;
                controller.enqueue(encoder.encode(delta.content));
            }

            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (!currentToolCalls[tc.index]) {
                        currentToolCalls[tc.index] = { id: tc.id, function: { name: "", arguments: "" } };
                    }
                    if (tc.id) currentToolCalls[tc.index].id = tc.id;
                    if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
                    if (tc.function?.arguments) currentToolCalls[tc.index].function.arguments += tc.function.arguments;
                }
            }
        }
    } finally {
        if (iterator.return) await iterator.return();
    }

    // If stream was empty or timed out, we might need a direct fallback (simplified here)
    if (streamTimedOut && currentAiContent === "" && currentToolCalls.length === 0) {
        controller.enqueue(encoder.encode(`<Think>Timeout du flux, tentative de repli direct...</Think>\n`));
        const direct = await openai.chat.completions.create({
            model,
            messages: fullMessages,
            tools: tools.length > 0 ? tools : undefined,
            stream: false,
        });
        const msg = direct.choices[0].message;
        currentAiContent = msg.content || "";
        currentToolCalls = msg.tool_calls || [];
        if (currentAiContent) controller.enqueue(encoder.encode(currentAiContent));
    }

    if (!currentToolCalls || currentToolCalls.length === 0) break;

    // Execute internal tools
    fullMessages.push({ role: "assistant", content: currentAiContent, tool_calls: currentToolCalls });

    for (const tc of currentToolCalls) {
      const name = tc.function.name;
      if (!name) continue;
      
      let args = {};
      try { args = JSON.parse(tc.function.arguments); } catch (e) {
          console.warn(`[Operator] Failed to parse tool args for ${name}`, tc.function.arguments);
      }

      // Trace & Broadcast
      const startMsg = { phase: "start", tool: name, timestamp: Date.now() };
      controller.enqueue(encoder.encode(`${TOOL_TRACE_PREFIX}${JSON.stringify(startMsg)}\n`));
      controller.enqueue(encoder.encode(`<Think>Exécution outil : ${name}</Think>\n`));
      await broadcastThought(supabase, room_id, `Outil: ${name}`, "tool_execution");

      const t0 = Date.now();
      const result = await executeInternalTool(runtime, name, args, body);
      const t1 = Date.now();
      
      if (result !== null) {
        fullMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
        const finishMsg = { phase: "finish", tool: name, durationMs: t1 - t0, timestamp: Date.now() };
        controller.enqueue(encoder.encode(`${TOOL_TRACE_PREFIX}${JSON.stringify(finishMsg)}\n`));
      } else {
        // External/Asynchronous tool (handled by frontend)
        controller.enqueue(encoder.encode(`${TOOL_TRACE_PREFIX}${JSON.stringify({ phase: "external", tool: name, args, timestamp: Date.now() })}\n`));
        controller.enqueue(encoder.encode(`<Think>Outil externe ${name} demandé — Attente réponse client.</Think>\n`));
        return; // Break multi-turn as we depend on client
      }
    }
  }
}
