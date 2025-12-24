// ============================================================================
// HUGGINGFACE PROVIDER
// ============================================================================

import { BaseProvider } from "./base.js";
import { resolveModelForProvider } from "../utils/model-resolver.js";

/**
 * Provider pour HuggingFace
 * N'a pas de support des tools, donc plus simple
 */
export class HuggingFaceProvider extends BaseProvider {
  constructor(apiKey) {
    super("huggingface", apiKey, {
      apiUrl: "https://router.huggingface.co/v1/chat/completions",
      defaultModel: "mistralai/Mixtral-8x22B-Instruct-v0.1",
      toolFormat: null,
    });
  }

  /**
   * Appelle l'API HuggingFace (sans streaming)
   */
  async call({ messages, modelMode }) {
    if (!this.apiKey) {
      throw new Error(`${this.name}: API key missing`);
    }

    const model = resolveModelForProvider(this.name, modelMode) || this.config.defaultModel;

    const payload = {
      model,
      messages,
      temperature: 0.3,
      top_p: 0.95,
      stream: false,
    };

    console.log(`[${this.name}] ➜ request model=${model}`);

    const response = await fetch(this.config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log(`[${this.name}] ⬅ status=${response.status}`);

    if (!response.ok) {
      const body = await response.text();
      console.error(`[${this.name}] ❌ error: ${body.slice(0, 400)}`);
      throw new Error(this.formatApiError(response.status, body));
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";

    return {
      content: String(text || "").trim(),
      toolCalls: [],
    };
  }

  /**
   * Chat simple sans tool support
   */
  async *chat({ messages, modelMode }) {
    console.log(`[${this.name}] ✅ chat initialized (no tool support)`);

    const model = resolveModelForProvider(this.name, modelMode) || this.config.defaultModel;

    const result = await this._trackCall(model, async () => {
      return await this.call({ messages, modelMode });
    });

    if (result.content) {
      yield result.content;
    }
  }
}
