// ============================================================================
// ANTHROPIC PROVIDER
// ============================================================================

import { BaseProvider } from "./base.js";
import { resolveModelForProvider } from "../utils/model-resolver.js";
import { executeToolCalls, TOOLS } from "../tools/executor.js";

/**
 * Provider pour Anthropic (Claude)
 * Format différent d'OpenAI
 */
export class AnthropicProvider extends BaseProvider {
  constructor(apiKey) {
    super("anthropic", apiKey, {
      apiUrl: "https://api.anthropic.com/v1/messages",
      defaultModel: "claude-3-opus-20240229",
      toolFormat: "anthropic",
    });
  }

  /**
   * Formate les tools au format Anthropic
   */
  formatTools(tools) {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Appelle l'API Anthropic
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
      stream,
      temperature: 0.3,
      top_p: 0.95,
      max_tokens: 4096,
    };

    console.log(
      `[${this.name}] ➜ request: model=${model}, messages=${messages.length}, tools=${formattedTools.length}, stream=${stream}`
    );

    const response = await fetch(this.config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
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
        content: data.content[0].text,
        toolCalls: data.tool_uses || [],
      };
    } else {
      return this.handleStreamingResponse(response);
    }
  }

  /**
   * Parse la réponse streaming d'Anthropic (format différent d'OpenAI)
   */
  async *handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let toolCalls = [];
    let fullContent = "";

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
          const delta = data.delta;

          if (delta?.text) {
            fullContent += delta.text;
            yield delta.text;
          }

          const calls = delta?.tool_use
            ? delta.tool_use.map(this.normalizeToolCall.bind(this))
            : [];
          if (calls.length) {
            toolCalls.push(...calls);
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

            conversationMessages = [
              ...conversationMessages,
              { role: "assistant", content: accumulatedContent || null, tool_uses: validCalls },
              ...toolMessages,
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
