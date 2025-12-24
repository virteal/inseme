// ============================================================================
// MISTRAL PROVIDER
// ============================================================================

import { OpenAIProvider } from "./openai.js";

/**
 * Provider pour Mistral
 * Utilise le même format qu'OpenAI, donc hérite de OpenAIProvider
 */
export class MistralProvider extends OpenAIProvider {
  constructor(apiKey) {
    super(apiKey, {
      apiUrl: "https://api.mistral.ai/v1/chat/completions",
      defaultModel: "mistral-large-latest",
      toolFormat: "openai",
    });
    this.name = "mistral";
  }
}
