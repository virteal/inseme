/**
 * packages/brique-ophelia/edge/lib/operator.js
 * Le Cœur d'Ophélia : Boucle itérative LLM + Outils.
 */

import { buildSystemPrompt } from "./prompts.js";
import { getAuthorizedTools, executeInternalTool } from "./tools.js";

// Use COP from now on for Ophelia's agent orchestration
import {
  cogentiaRoutePacket,
  CapabilityRegistry,
  asCognitivePacket,
  createTask,
  startStep,
  completeStep,
  completeTask,
} from "@inseme/cop-kernel";

import { defaultBus as copDefaultBus } from "@inseme/cop-kernel";

const TOOL_TRACE_PREFIX = "__TOOL_TRACE__";
const PROVIDER_META_PREFIX = "__PROVIDER_INFO__";

async function broadcastVocal(supabase, room_id, vocal_payload) {
  if (!supabase || !room_id || !vocal_payload) return;
  try {
    const channel = supabase.channel(`room:${room_id}`);
    await channel.send({
      type: "broadcast",
      event: "vocal",
      payload: {
        vocal_payload,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn("[Ophelia] Vocal broadcast failed:", e);
  }
}

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

function sanitizeHistoryV2(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => {
    let content = m.text || m.content || "";
    if (m.role === "assistant" || m.sender === "assistant") {
      // Remove <Think> blocks from history sent to LLM to save tokens and avoid confusion
      content = content.replace(/<Think>[\s\S]*?<\/Think>/gi, "").trim();
    }
    return {
      role: m.role || (m.sender === "user" ? "user" : "assistant"),
      content,
    };
  });
}

function isAsyncIterable(value) {
  return Boolean(value && typeof value[Symbol.asyncIterator] === "function");
}

async function compressHistoryWithAI(messages, runtime) {
  // Seuil pour déclencher la compression (ex: 50 messages)
  const THRESHOLD = 50;
  if (messages.length <= THRESHOLD) return messages;

  const activeContextCount = 20; // On garde les 20 derniers messages intacts
  const toCompress = messages.slice(0, messages.length - activeContextCount);
  const activeContext = messages.slice(messages.length - activeContextCount);

  // On préserve le message système s'il est au début
  const systemMsg = toCompress[0]?.role === "system" ? toCompress[0] : null;
  const contentToCompress = systemMsg ? toCompress.slice(1) : toCompress;

  console.log(`[Ophelia] 🧠 Compressing history: ${contentToCompress.length} messages`);

  try {
    let ai;
    let model;

    if (runtime.openai) {
      ai = runtime.openai;
      model = "gpt-3.5-turbo"; // Default fast model for compression if using generic client
    } else {
      const { createAIClient, buildProviderOrder, resolveModel } = await import("./providers.js");
      const providers = buildProviderOrder(runtime);
      const provider = providers[0];
      model = resolveModel(provider, "fast");
      ai = createAIClient(runtime, provider);
    }

    const prompt = `Tu es le module de Mémoire d'Ophélia.
Résume de manière très concise mais fidèle les échanges passés suivants.
Conserve les décisions prises, les thèmes abordés, les questions en suspens et les points de tension.

Échanges à résumer :
${JSON.stringify(contentToCompress, null, 2)}

Ton résumé sera utilisé comme contexte pour la suite de la conversation.`;

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "Tu es un expert en synthèse de conversation.",
        },
        { role: "user", content: prompt },
      ],
    });

    const summary = completion.choices[0].message.content;

    const compressedHistory = [];
    if (systemMsg) compressedHistory.push(systemMsg);
    compressedHistory.push({
      role: "system",
      content: `[MÉMOIRE DES ÉCHANGES PASSÉS] : ${summary}`,
    });
    compressedHistory.push(...activeContext);

    return compressedHistory;
  } catch (err) {
    console.warn("[Ophelia] History compression failed:", err);
    return messages;
  }
}

export async function runOperator(runtime, body, options = {}) {
  const { openai, supabase, sql, identity, role, encoder, controller } = options;
  const isDebug = runtime.getConfig ? runtime.getConfig("DEBUG") === "true" : false;

  // COP integration for the agent itself (hybrid: policy on bus-style + scheduler consult).
  // Ophelia now uses COP "from now on" for its own orchestration: each turn consults
  // cogentiaRoutePacket over a CapabilityRegistry populated from brique ROLES (mediator etc.),
  // emits via asCognitivePacket (cop.packet.created), tracks the session as a COP Task,
  // and each iteration as a COP Step (completeStep at end of turn). Policy decisions
  // are envelope-only; payload is for the final LLM/handler. See cogentiaRouter + jobScheduler
  // for the full hybrid (router agent on bus OR direct consult + routingPolicy inside scheduler).
  const opheliaRegistry = new CapabilityRegistry();
  // Populate from the brique's roles (mediator, analyst, etc.) -- these become "capabilities"
  try {
    const { ROLES: BRIOLES_ROLES } = await import("../roles/registry.js");
    Object.values(BRIOLES_ROLES || {}).forEach((r) => {
      if (r && r.id) {
        opheliaRegistry.register(r.id, {
          providers: [identity?.name || "ophelia"],
          metadata: { description: r.description || r.name },
        });
      }
    });
  } catch (e) {
    console.warn("[Operator] Could not load brique roles for COP registry:", e.message);
    // Fallback minimal
    opheliaRegistry.register("mediator", { providers: [identity?.name || "ophelia"] });
  }

  // Session-level packet (overwritten/refined per-iteration inside the loop)
  let currentPolicyPacket = {
    envelope: {
      packetKind: "ophelia-turn",
      requiredCapability: role?.id || "mediator",
      riskLevel: "low",
      provenance: { origin: "user-question", room: body?.room_id },
    },
    payload: { question: body?.question || "", historySummary: "compressed" },
  };

  // Use COP Task for the agent's reasoning session (Ophelia now uses COP for its own orchestration)
  let opheliaSessionTask = null;
  try {
    opheliaSessionTask = await createTask({
      taskType: "ophelia-reasoning",
      workerAgentName: identity?.name || "ophelia",
      rootCorrelationId: body?.room_id || null,
      metadata: { room_id: body?.room_id, role: role?.id, question: body?.question?.slice(0, 100) },
    });
    if (isDebug)
      console.log(
        "[DEBUG][Operator] COP Task created for Ophelia session:",
        opheliaSessionTask?.id
      );
  } catch (taskErr) {
    console.warn("[Operator] Could not create COP task for session (continuing):", taskErr.message);
  }

  if (isDebug) {
    console.log("[DEBUG][Operator] Starting runOperator");
    console.log("[DEBUG][Operator] Identity:", identity.name);
    console.log("[DEBUG][Operator] Role:", role.id);
  }

  // On enrichit le runtime avec les outils nécessaires
  const fullRuntime = {
    ...runtime,
    supabase: options.supabase || runtime.supabase,
    sql: options.sql || runtime.sql,
    openai: options.openai,
  };

  const { messages, question, room_id, model: userModel } = body;
  const idleTimeoutMs = 30000;

  // Compression de l'historique si nécessaire
  const originalMessagesCount = messages?.length || 0;
  const processedMessages = await compressHistoryWithAI(messages || [], fullRuntime);
  if (processedMessages.length < originalMessagesCount) {
    controller.enqueue(
      encoder.encode(
        `<Think>Mémoire optimisée : ${originalMessagesCount} messages compressés.</Think>\n`
      )
    );
  }

  const systemMsg = await buildSystemPrompt(identity, role, body, runtime);
  if (isDebug) console.log("[DEBUG][Operator] Prompt built. Length:", systemMsg.length);

  let fullMessages = [
    { role: "system", content: systemMsg },
    ...sanitizeHistoryV2(processedMessages),
  ];

  if (question) {
    let instruction = question;
    if (Array.isArray(body.brique_tools) && body.brique_tools.length > 0) {
      const toolList = body.brique_tools
        .map((t) =>
          typeof t === "string" ? t : t.function?.name || t.name || t.briqueId || "unknown"
        )
        .join(", ");
      instruction += `\n\n(IMPORTANT: Tu as accès aux outils des briques suivantes : ${toolList}. Utilise-les si nécessaire pour répondre à la demande.)`;
    } else {
      instruction +=
        "\n\n(CONSEIL: Utilise l'outil 'vector_search' pour rechercher des informations dans la base de connaissances ou 'web_search' pour Internet. 'sql_query' est réservé aux données structurées si disponibles.)";
    }

    fullMessages.push({
      role: "user",
      content: instruction,
    });
  }

  const tools = await getAuthorizedTools(fullRuntime, role, identity, body.brique_tools);
  console.log(
    "[Operator] Authorized tools for role",
    role.id,
    ":",
    tools.map((t) => t.function.name)
  );

  // Note: COP per-iteration policy consult + packet emission (with asCognitivePacket + cogentiaRoutePacket)
  // + step lifecycle now live *inside* the while loop (see below). This ensures each reasoning turn
  // is a first-class cognitive packet, policy can react to role evolution, and we complete steps cleanly.
  // Pre-loop setup (registry, task, initial currentPolicyPacket) remains above for the session.
  let iteration = 0;
  const maxIterations = 3;

  while (iteration < maxIterations) {
    iteration++;
    if (isDebug) console.log(`[DEBUG][Operator] Iteration ${iteration}/${maxIterations}`);

    // === COP per-turn policy for Ophelia's agent (using COP "from now on") ===
    // Each iteration is treated as a cognitive packet turn: envelope-only inspection
    // of requiredCapability (current role), consult the opheliaRegistry (populated from brique ROLES),
    // potentially switch/confirm via cogentiaRoutePacket (hybrid: direct consult here; could also
    // be driven by a bus agent publishing cop.packet.routed that a scheduler listens to).
    // We use asCognitivePacket so we get auto id/createdAt + canonical cop.packet.created emission.
    let turnPacket;
    try {
      turnPacket = {
        envelope: {
          packetKind: "ophelia-turn",
          requiredCapability: role?.id || "mediator",
          riskLevel: "low",
          provenance: { origin: "ophelia-iteration", room: room_id, iteration },
          iteration,
        },
        payload: {
          question: question || "",
          historySummary: "compressed",
          currentRole: role?.id,
        },
      };

      const decision = await cogentiaRoutePacket(turnPacket, {
        registry: opheliaRegistry,
        // no forwardToBus: pure decision mode inside agent loop (hybrid consult)
      });

      if (decision && decision.action === "forwarded-to-handler" && decision.chosenCapability) {
        const oldCap = turnPacket.envelope.requiredCapability;
        if (decision.chosenCapability !== oldCap) {
          turnPacket.envelope.requiredCapability = decision.chosenCapability;
          turnPacket.envelope.lastRoutingDecision = decision;
          if (isDebug) {
            controller.enqueue(
              encoder.encode(
                `<Think>COOP policy (iter ${iteration}): switched capability ${decision.chosenCapability} (was ${oldCap})</Think>\n`
              )
            );
          }
        } else {
          turnPacket.envelope.lastRoutingDecision = decision;
        }
      }

      // Emit using asCognitivePacket: gets envelope hygiene + publishes cop.packet.created on the bus
      const emitBus = fullRuntime.bus || copDefaultBus;
      asCognitivePacket(turnPacket, { bus: emitBus, emit: true });

      // Keep a ref for any post-loop or tool influence
      currentPolicyPacket = turnPacket;
    } catch (policyErr) {
      console.warn(
        "[Operator] COP policy consult failed for iter",
        iteration,
        ":",
        policyErr.message
      );
    }

    // COP Step for this reasoning turn (lifecycle tracked in cop-kernel storage)
    let currentStep = null;
    if (opheliaSessionTask) {
      try {
        currentStep = await startStep(opheliaSessionTask, {
          name: `ophelia-turn-${iteration}`,
          indexInTask: iteration,
          inputHash: null,
        });
      } catch (stepErr) {
        console.warn("[Operator] COP step creation failed:", stepErr.message);
      }
    }

    const model = userModel || "gpt-4o";
    if (isDebug) console.log("[DEBUG][Operator] Calling LLM with model:", model);

    // Yield thinking metadata
    const iterationThink = `<Think>Itération ${iteration}/${maxIterations} — Appel ${model}</Think>\n`;
    controller.enqueue(encoder.encode(iterationThink));
    await broadcastThought(supabase, room_id, `Réflexion (tour ${iteration})`, "llm_reasoning");

    // Nettoyage des outils pour ne garder que ce que l'API LLM attend (type, function)
    const cleanedTools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));

    let stream;
    try {
      const completionOptions = {
        model,
        messages: fullMessages,
        tools: cleanedTools.length > 0 ? cleanedTools : undefined,
        stream: options.provider !== "groq" && options.provider !== "sovereign", // Disable stream for Groq and Sovereign to get reliable tool calls
      };

      // Groq and Sovereign do not support parallel tool calls reliably yet
      if (options.provider === "groq" || options.provider === "sovereign") {
        completionOptions.parallel_tool_calls = false;
      }

      stream = await openai.chat.completions.create(completionOptions);
    } catch (err) {
      console.error("[Operator] LLM call failed:", err);
      // On ne renvoie pas l'erreur directement au client ici si on veut que le gateway puisse réessayer
      // Mais on doit signaler l'échec pour sortir de la boucle et laisser le gateway gérer.
      throw err;
    }

    let currentAiContent = "";
    let sentenceBuffer = "";
    const sentenceEndings = /[.!?\n]+/;
    let currentToolCalls = [];
    let streamTimedOut = false;

    if (isAsyncIterable(stream)) {
      // Stream consumption with race-timeout
      const iterator = stream[Symbol.asyncIterator]();
      try {
        while (true) {
          const nextPromise = iterator.next();
          let res;
          try {
            res = await Promise.race([
              nextPromise,
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("stream-timeout")), idleTimeoutMs)
              ),
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
            sentenceBuffer += delta.content;
            controller.enqueue(encoder.encode(delta.content));

            // Prosody: Concaténation des tokens pour le mode vocal
            if (body.is_vocal_input && sentenceEndings.test(sentenceBuffer)) {
              const match = sentenceBuffer.match(/^([\s\S]*[.!?\n])([\s\S]*)$/);
              if (match) {
                const completeSentence = match[1];
                sentenceBuffer = match[2];

                if (completeSentence.trim()) {
                  // Déclenchement TTS asynchrone pour ne pas bloquer le flux de texte
                  (async () => {
                    try {
                      const ttsResult = await executeInternalTool(
                        fullRuntime,
                        "speak",
                        { text: completeSentence.trim() },
                        body
                      );
                      if (ttsResult && ttsResult.vocal_payload) {
                        await broadcastVocal(supabase, room_id, ttsResult.vocal_payload);
                      }
                    } catch (e) {
                      console.error("[Ophelia] Streaming TTS Error:", e);
                    }
                  })();
                }
              }
            }
          }

          if (delta.reasoning_content) {
            const thinkChunk = `<Think>${delta.reasoning_content}</Think>`;
            controller.enqueue(encoder.encode(thinkChunk));
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!currentToolCalls[tc.index]) {
                currentToolCalls[tc.index] = {
                  id: tc.id,
                  type: "function",
                  function: { name: "", arguments: "" },
                };
              }
              if (tc.id) currentToolCalls[tc.index].id = tc.id;
              if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments)
                currentToolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }
      } finally {
        if (iterator.return) await iterator.return();
        // Traiter le reliquat du buffer de phrases à la fin du flux
        if (body.is_vocal_input && sentenceBuffer.trim()) {
          const finalSentence = sentenceBuffer.trim();
          (async () => {
            try {
              const ttsResult = await executeInternalTool(
                fullRuntime,
                "speak",
                { text: finalSentence },
                body
              );
              if (ttsResult && ttsResult.vocal_payload) {
                await broadcastVocal(supabase, room_id, ttsResult.vocal_payload);
              }
            } catch (e) {
              console.error("[Ophelia] Final Streaming TTS Error:", e);
            }
          })();
        }
      }
    } else {
      // Direct response (non-streaming)
      const msg = stream.choices[0].message;
      currentAiContent = msg.content || "";
      currentToolCalls = msg.tool_calls || [];

      const reasoning = msg.reasoning_content || msg.thought || "";
      if (reasoning) {
        controller.enqueue(encoder.encode(`<Think>${reasoning}</Think>\n`));
      }

      if (currentAiContent) {
        controller.enqueue(encoder.encode(currentAiContent));
      }
    }

    // If stream was empty or timed out, we might need a direct fallback (simplified here)
    if (streamTimedOut && currentAiContent === "" && currentToolCalls.length === 0) {
      controller.enqueue(
        encoder.encode(`<Think>Timeout du flux, tentative de repli direct...</Think>\n`)
      );
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

    // Filter out any holes in the array and ensure each tool call is complete
    const validToolCalls = currentToolCalls.filter((tc) => tc && tc.id);

    // DEBUG: Send tool calls structure to client
    controller.enqueue(
      encoder.encode(`<Think>DEBUG ToolCalls: ${JSON.stringify(validToolCalls)}</Think>\n`)
    );

    // Execute internal tools
    fullMessages.push({
      role: "assistant",
      content: currentAiContent || null,
      tool_calls: validToolCalls,
    });

    for (const tc of validToolCalls) {
      const name = tc.function.name;
      if (!name) continue;

      let args = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch (e) {
        console.warn(`[Operator] Failed to parse tool args for ${name}`, tc.function.arguments);
      }

      // Trace & Broadcast
      const startMsg = { phase: "start", tool: name, timestamp: Date.now() };
      controller.enqueue(encoder.encode(`${TOOL_TRACE_PREFIX}${JSON.stringify(startMsg)}\n`));
      controller.enqueue(encoder.encode(`<Think>Exécution outil : ${name}</Think>\n`));
      await broadcastThought(supabase, room_id, `Outil: ${name}`, "tool_execution");

      const t0 = Date.now();
      console.log(`[DEBUG][Operator] Tool: ${name}, SQL: ${!!sql}`);

      let result = await executeInternalTool(
        {
          ...runtime,
          supabase: runtime.supabase || supabase,
          openai,
          sql: sql,
        },
        name,
        args,
        body
      );

      let vocalPayload = null;
      if (result && typeof result === "object" && result.vocal_payload) {
        vocalPayload = result.vocal_payload;
        result = result.result;
        await broadcastVocal(supabase, room_id, vocalPayload);
      }

      // --- DELEGATION TO DYNAMIC BRIQUE TOOLS ---
      if (!result || (typeof result === "string" && result.startsWith("Outil inconnu"))) {
        const briqueTool = tools.find((t) => t.function.name === name);

        if (briqueTool && briqueTool.briqueId) {
          try {
            const briqueId = briqueTool.briqueId;
            const toolUrl = `${runtime.url.origin}/api/tools/${briqueId}/${name}`;
            console.log(`[Ophelia] Delegating to brique tool: ${toolUrl}`);

            const toolResponse = await fetch(toolUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args),
            });

            if (toolResponse.ok) {
              result = await toolResponse.text();
            } else {
              result = `Erreur lors de l'appel à l'outil brique ${name}: ${toolResponse.statusText}`;
            }
          } catch (e) {
            result = `Erreur d'exécution de l'outil brique ${name}: ${e.message}`;
          }
        }
      }
      const t1 = Date.now();

      if (result !== null) {
        fullMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
        const finishMsg = {
          phase: "finish",
          tool: name,
          durationMs: t1 - t0,
          timestamp: Date.now(),
          vocal_payload: vocalPayload,
        };
        controller.enqueue(encoder.encode(`${TOOL_TRACE_PREFIX}${JSON.stringify(finishMsg)}\n`));
      } else {
        // External/Asynchronous tool (handled by frontend)
        controller.enqueue(
          encoder.encode(
            `${TOOL_TRACE_PREFIX}${JSON.stringify({
              phase: "action",
              action: name,
              tool: name,
              args,
              timestamp: Date.now(),
            })}\n`
          )
        );
        controller.enqueue(
          encoder.encode(
            `<Think>Action externe ${name} demandée — Attente réponse client.</Think>\n`
          )
        );
        return; // Break multi-turn as we depend on client
      }
    }

    // COP: complete the step for this turn (lifecycle + projection via emitTaskEvent inside mark)
    if (currentStep) {
      try {
        await completeStep(currentStep.id || currentStep);
        if (isDebug) console.log(`[DEBUG][Operator] COP step completed for iteration ${iteration}`);
      } catch (compErr) {
        console.warn("[Operator] completeStep failed for iter", iteration, ":", compErr.message);
      }
    }
  }

  // End of reasoning session: mark the COP task complete if we created one
  if (opheliaSessionTask) {
    try {
      await completeTask(opheliaSessionTask.id || opheliaSessionTask);
      if (isDebug) console.log("[DEBUG][Operator] COP task completed for Ophelia session");
    } catch (taskCompErr) {
      console.warn("[Operator] completeTask for session failed (non-fatal):", taskCompErr.message);
    }
  }
}
