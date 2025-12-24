// ============================================================================
// OPENAI PROVIDER
// ============================================================================

import { BaseProvider } from "./base.js";
import { resolveModelForProvider } from "../utils/model-resolver.js";
import { executeToolCalls, TOOLS } from "../tools/executor.js";

/**
 * Provider pour OpenAI (et Mistral qui utilise le même format)
 */
export class OpenAIProvider extends BaseProvider {
  constructor(apiKey, config = {}) {
    super("openai", apiKey, {
      apiUrl: "https://api.openai.com/v1/chat/completions",
      defaultModel: "gpt-4o-mini",
      toolFormat: "openai",
      ...config,
    });
  }

  /**
   * Formate les tools au format OpenAI
   */
  formatTools(tools) {
    return tools.map((tool) => ({
      type: "function",
      function: tool,
    }));
  }

  /**
   * Appelle l'API OpenAI
   */
  async call({ messages, tools = [], stream = true, modelMode }) {
    if (!this.apiKey) {
      throw new Error(`${this.name}: API key missing`);
    }

    const model = resolveModelForProvider(this.name, modelMode) || this.config.defaultModel;
    const formattedTools = this.formatTools(Object.values(tools.length ? tools : TOOLS));

    const payload = {
      model,
      messages,
      ...(formattedTools.length ? { tools: formattedTools } : {}),
      tool_choice: "auto",
      stream,
      temperature: 0.3,
      top_p: 0.95,
    };

    console.log(
      `[${this.name}] ➜ request: model=${model}, messages=${messages.length}, tools=${formattedTools.length}, stream=${stream}`
    );

    const response = await fetch(this.config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[${this.name}] ⬅ response status=${response.status}`);

    if (!response.ok) {
      const body = await response.text();
      console.error(`[${this.name}] ❌ error: ${body.slice(0, 400)}`);
      throw new Error(this.formatApiError(response.status, body));
    }

    if (!stream) {
      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        toolCalls: data.choices[0].message.tool_calls || [],
      };
    } else {
      return this.handleStreamingResponse(response);
    }
  }

  /**
   * Parse la réponse streaming SSE d'OpenAI
   */
  async *handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let toolCalls = [];
    let fullContent = "";

    // Buffering for tool call fragments
    const pendingToolArgs = new Map();
    const pushedToolIds = new Set();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const payload = trimmed.startsWith("data:")
          ? trimmed.slice(trimmed.indexOf(":") + 1).trim()
          : trimmed;
        if (!payload || payload === "[DONE]") continue;

        try {
          const data = JSON.parse(payload);
          const delta = data.choices?.[0]?.delta;

          if (delta?.content) {
            fullContent += delta.content;
            yield delta.content;
          }

          const rawToolCalls = delta?.tool_calls || [];
          if (rawToolCalls.length) {
            for (const raw of rawToolCalls) {
              const id = raw.id || raw.tool_call_id || `tool-${Date.now()}`;
              const fn = raw.function || raw;
              let name = fn?.name || "";
              let argsFragment = fn?.arguments ?? "";

              if (typeof argsFragment !== "string") {
                argsFragment = JSON.stringify(argsFragment);
              }

              const existing = pendingToolArgs.get(id) || { name: "", argsStr: "" };
              const combinedName = existing.name || name;
              const combinedArgsStr = existing.argsStr + argsFragment;

              pendingToolArgs.set(id, { name: combinedName, argsStr: combinedArgsStr });

              // Try to parse combined args
              let parsedArgs;
              try {
                const trimmedArgs = combinedArgsStr.trim();
                if (trimmedArgs.startsWith("{") || trimmedArgs.startsWith("[")) {
                  parsedArgs = JSON.parse(trimmedArgs);
                }
              } catch {
                parsedArgs = null;
              }

              // If complete and not already pushed
              if (parsedArgs && !pushedToolIds.has(id)) {
                const fullCall = {
                  id,
                  type: "function",
                  function: {
                    name: combinedName,
                    arguments: JSON.stringify(parsedArgs),
                  },
                };
                toolCalls.push(fullCall);
                pushedToolIds.add(id);
                pendingToolArgs.delete(id);
                yield { type: "tool_call", call: fullCall };
              }
            }
          }
        } catch (err) {
          console.error(`[${this.name}] ❌ SSE parse error: ${err.message}`);
        }
      }
    }

    return {
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Conversation complète avec gestion des tool calls
   */
  async *chat({
    messages,
    tools = TOOLS,
    maxToolCalls = 2,
    modelMode,
    question,
    supabase = null,
    openai = null,
    debugMode = false,
    user = null,
    context = {},
  }) {
    let toolCallCount = 0;
    let conversationMessages = [...messages];

    console.log(`[${this.name}] ✅ chat initialized (maxToolCalls=${maxToolCalls})`);

    while (toolCallCount < maxToolCalls) {
      console.log(`[${this.name}] 🔁 LLM call - messages:${conversationMessages.length}`);

      const model = resolveModelForProvider(this.name, modelMode) || this.config.defaultModel;

      const streamOrDirect = await this._trackCall(model, async () => {
        return await this.call({
          messages: conversationMessages,
          tools,
          stream: true,
          modelMode,
        });
      });

      // Handle streaming
      if (this.isAsyncIterable(streamOrDirect)) {
        const iterator = streamOrDirect[Symbol.asyncIterator]();
        let accumulatedContent = "";
        let streamToolCalls = [];

        while (true) {
          const { done, value } = await iterator.next();
          if (done) {
            if (value?.toolCalls?.length) {
              streamToolCalls = value.toolCalls;
            }
            break;
          }

          if (typeof value === "string") {
            accumulatedContent += value;
            yield value;
          } else if (value?.type === "tool_call") {
            streamToolCalls.push(value.call);
          }
        }

        // Execute any tool calls found
        if (streamToolCalls.length > 0) {
          const validCalls = streamToolCalls.filter((c) => c.function?.name);
          if (validCalls.length > 0) {
            toolCallCount++;
            console.log(
              `[${this.name}] 🛠 Executing ${validCalls.length} tool(s) in parallel:`,
              validCalls.map((c) => c.function.name)
            );
            const toolMessages = await executeToolCalls(
              validCalls,
              this.name,
              {
                web_search: { query: question },
                defaultQuery: question,
              },
              supabase,
              openai,
              null, // metaCollector
              null, // toolEventEmitter
              debugMode,
              user,
              context
            );

            conversationMessages = [
              ...conversationMessages,
              { role: "assistant", content: accumulatedContent || null, tool_calls: validCalls },
              ...toolMessages,
            ];
            continue; // Re-run LLM with tool results
          }
        }

        // No more tools, done
        return;
      }
    }

    console.warn(`[${this.name}] ⚠️ Max tool calls (${maxToolCalls}) reached`);
  }
}
