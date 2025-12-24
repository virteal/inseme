// ============================================================================
// GEMINI PROVIDER (Google)
// ============================================================================

import { BaseProvider } from "./base.js";
import { resolveModelForProvider } from "../utils/model-resolver.js";
import { executeToolCalls, TOOLS } from "../tools/executor.js";

/**
 * Provider pour Gemini (Google)
 * Format API spécifique Google
 */
export class GeminiProvider extends BaseProvider {
  constructor(apiKey) {
    super("gemini", apiKey, {
      apiUrl: "https://generativelanguage.googleapis.com/v1beta",
      defaultModel: "gemini-2.5-pro",
      toolFormat: "gemini",
    });
  }

  /**
   * Formate les tools au format Gemini (function declarations)
   */
  formatTools(tools) {
    return tools.map((tool) => ({
      functionDeclarations: [
        {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      ],
    }));
  }

  /**
   * Convertit les messages au format Gemini
   */
  convertMessages(messages) {
    // Gemini sépare le system prompt du reste
    const systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    return { systemPrompt, contents };
  }

  /**
   * Appelle l'API Gemini
   */
  async call({ messages, tools = [], stream = true, modelMode }) {
    if (!this.apiKey) {
      throw new Error(`${this.name}: API key missing`);
    }

    const model = resolveModelForProvider(this.name, modelMode) || this.config.defaultModel;
    const { systemPrompt, contents } = this.convertMessages(messages);
    const formattedTools = this.formatTools(Object.values(tools.length ? tools : TOOLS));

    const payload = {
      contents,
      ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
      ...(formattedTools.length ? { tools: formattedTools } : {}),
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };

    console.log(
      `[${this.name}] ➜ request: model=${model}, messages=${messages.length}, tools=${formattedTools.length}, stream=${stream}`
    );

    const endpoint = stream
      ? `${this.config.apiUrl}/models/${model}:streamGenerateContent`
      : `${this.config.apiUrl}/models/${model}:generateContent`;

    const url = `${endpoint}?key=${this.apiKey}${stream ? "&alt=sse" : ""}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const functionCalls =
        data.candidates?.[0]?.content?.parts?.filter((p) => p.functionCall) || [];

      return {
        content,
        toolCalls: functionCalls.map((fc) => ({
          id: `tool-${Date.now()}`,
          type: "function",
          function: {
            name: fc.functionCall.name,
            arguments: JSON.stringify(fc.functionCall.args || {}),
          },
        })),
      };
    } else {
      return this.handleStreamingResponse(response);
    }
  }

  /**
   * Parse la réponse streaming SSE de Gemini
   */
  async *handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let toolCalls = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        const payload = trimmed.startsWith("data:")
          ? trimmed.slice(trimmed.indexOf(":") + 1).trim()
          : trimmed;
        if (!payload) continue;

        try {
          const data = JSON.parse(payload);
          const candidate = data.candidates?.[0];
          if (!candidate) continue;

          const parts = candidate.content?.parts || [];

          for (const part of parts) {
            if (part.text) {
              fullContent += part.text;
              yield part.text;
            }

            if (part.functionCall) {
              const toolCall = {
                id: `tool-${Date.now()}-${toolCalls.length}`,
                type: "function",
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args || {}),
                },
              };
              toolCalls.push(toolCall);
              yield { type: "tool_call", call: toolCall };
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
  async *chat({ messages, tools = TOOLS, maxToolCalls = 2, modelMode, question }) {
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
              `[${this.name}] 🛠 Executing ${validCalls.length} tool(s):`,
              validCalls.map((c) => c.function.name)
            );
            const toolMessages = await executeToolCalls(validCalls, this.name, {
              web_search: { query: question },
              defaultQuery: question,
            });

            // Convert tool results to Gemini format
            const geminiToolResults = toolMessages.map((tm) => ({
              role: "user",
              content: `Function ${tm.name} returned: ${tm.content}`,
            }));

            conversationMessages = [
              ...conversationMessages,
              { role: "assistant", content: accumulatedContent || null },
              ...geminiToolResults,
            ];
            continue;
          }
        }

        return;
      }
    }

    console.warn(`[${this.name}] ⚠️ Max tool calls (${maxToolCalls}) reached`);
  }
}
