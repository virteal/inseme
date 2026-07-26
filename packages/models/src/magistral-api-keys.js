/**
 * Collect API keys for Magistral map nodes.
 *
 * Secret authority: inseme/.env (loaded by packages/models/src/ai.js via dotenv).
 * Runtime copies (e.g. /etc/cogentia/magistral.env) must match unless a local
 * override is explicitly commented at the override site.
 */

export function buildMagistralApiKeys(map = [], env = process.env) {
  const e = env || {};
  const keys = {
    GROQ_API_KEY: e.GROQ_API_KEY || "",
    TOGETHER_API_KEY: e.TOGETHER_API_KEY || "",
    OPENAI_API_KEY: e.OPENAI_API_KEY || "",
    ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY || "",
    // Coding-agent gateway (ThinkPad Agent CLI Gateway, etc.)
    AGENT_GATEWAY_TOKEN:
      e.AGENT_GATEWAY_TOKEN || e.AGENT_GATEWAY_INVOKE_TOKEN || e.AGENT_GATEWAY_ACCEPT_TOKEN || "",
  };

  if (keys.AGENT_GATEWAY_TOKEN) {
    keys.AGENT_GATEWAY_INVOKE_TOKEN = keys.AGENT_GATEWAY_TOKEN;
    keys.AGENT_GATEWAY_ACCEPT_TOKEN = keys.AGENT_GATEWAY_TOKEN;
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
