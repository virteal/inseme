// ============================================================================
// GROK PROVIDER (xAI)
// ============================================================================

import { OpenAIProvider } from "./openai.js";

/**
 * Provider pour Grok (xAI)
 * Utilise le même format qu'OpenAI (OpenAI-compatible API)
 */
export class GrokProvider extends OpenAIProvider {
  constructor(apiKey) {
    super(apiKey, {
      apiUrl: "https://api.x.ai/v1/chat/completions",
      defaultModel: "grok-4-fast-reasoning",
      toolFormat: "openai",
    });
    this.name = "grok";
  }
}
