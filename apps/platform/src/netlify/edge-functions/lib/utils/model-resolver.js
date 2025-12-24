// ============================================================================
// UTILS - Model Resolution
// ============================================================================

/**
 * Configuration des modèles par provider et mode
 */
export const MODEL_MODES = {
  mistral: {
    fast: "mistral-small-latest",
    strong: "mistral-large-latest",
    reasoning: "magistral-medium-latest",
  },
  anthropic: {
    main: "claude-sonnet-4-5-20250929",
    cheap: "claude-3-haiku-20240307",
  },
  openai: {
    main: "gpt-4.1-mini",
    reasoning: "gpt-5.1",
    cheap: "gpt-4.1-nano",
  },
  huggingface: {
    main: "deepseek-ai/DeepSeek-V3",
    small: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
    reasoning: "deepseek-ai/DeepSeek-R1",
  },
  grok: {
    main: "grok-4-fast-reasoning",
    fast: "grok-4-fast-non-reasoning",
    reasoning: "grok-4-fast-reasoning",
  },
  gemini: {
    main: "gemini-2.5-pro",
    fast: "gemini-2.5-flash",
    reasoning: "gemini-3-pro-preview",
    cheap: "gemini-2.5-flash-lite",
  },
};

/**
 * Mode par défaut pour chaque provider
 */
export const DEFAULT_MODEL_MODE = {
  mistral: "fast",
  anthropic: "main",
  openai: "reasoning",
  huggingface: "main",
  grok: "main",
  gemini: "main",
};

/**
 * Résout le modèle à utiliser pour un provider donné
 *
 * @param {string} provider - Nom du provider
 * @param {string} overrideMode - Mode à utiliser (optionnel)
 * @returns {string|undefined} Nom du modèle à utiliser
 */
export function resolveModelForProvider(provider, overrideMode) {
  const providerModes = MODEL_MODES[provider];
  if (!providerModes) return undefined;

  const candidateMode =
    overrideMode && providerModes[overrideMode]
      ? overrideMode
      : DEFAULT_MODEL_MODE[provider] || Object.keys(providerModes)[0];

  return providerModes[candidateMode];
}
