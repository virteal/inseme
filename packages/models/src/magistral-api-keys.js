/**
 * Collect API keys for Magistral map nodes.
 *
 * Secret authority: inseme/.env (loaded by packages/models/src/ai.js via dotenv).
 * Runtime copies (e.g. /etc/cogentia/magistral.env) must match unless a local
 * override is explicitly commented at the override site.
 *
 * Naming: Cogentia is the system name; FractaVolta is a commercial deployment face.
 * The shared bearer for OpenAI-compatible Cogentia surfaces (including Agent CLI
 * Gateway) is COGENTIA_API_KEY. Legacy AGENT_GATEWAY_* token names remain as
 * fallbacks during migration.
 */

export function buildMagistralApiKeys(map = [], env = process.env) {
  const e = env || {};
  const cogentiaApiKey =
    e.COGENTIA_API_KEY ||
    e.AGENT_GATEWAY_TOKEN ||
    e.AGENT_GATEWAY_INVOKE_TOKEN ||
    e.AGENT_GATEWAY_ACCEPT_TOKEN ||
    "";

  const keys = {
    GROQ_API_KEY: e.GROQ_API_KEY || e.GROC_API_KEY || "",
    TOGETHER_API_KEY: e.TOGETHER_API_KEY || "",
    OPENAI_API_KEY: e.OPENAI_API_KEY || "",
    ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY || "",
    MISTRAL_API_KEY: e.MISTRAL_API_KEY || "",
    GEMINI_API_KEY: e.GEMINI_API_KEY || "",
    // Primary system bearer (Guide / Magistral / Agent CLI Gateway)
    COGENTIA_API_KEY: cogentiaApiKey,
  };

  // Legacy aliases (same value) so older map nodes and drop-ins keep working
  if (cogentiaApiKey) {
    keys.AGENT_GATEWAY_TOKEN = cogentiaApiKey;
    keys.AGENT_GATEWAY_INVOKE_TOKEN = cogentiaApiKey;
    keys.AGENT_GATEWAY_ACCEPT_TOKEN = cogentiaApiKey;
  }

  for (const node of Array.isArray(map) ? map : []) {
    for (const field of ["apiKeyEnv", "api_key_env"]) {
      const name = node?.[field];
      if (!name || typeof name !== "string") continue;
      if (keys[name]) continue;
      const value = e[name];
      if (value != null && String(value).trim() !== "") {
        keys[name] = String(value);
      }
    }
  }

  return keys;
}
