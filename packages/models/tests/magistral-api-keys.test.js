import assert from "node:assert/strict";
import test from "node:test";
import { buildMagistralApiKeys } from "../src/magistral-api-keys.js";

test("buildMagistralApiKeys includes AGENT_GATEWAY_TOKEN and aliases", () => {
  const keys = buildMagistralApiKeys([], {
    OPENAI_API_KEY: "oai",
    AGENT_GATEWAY_TOKEN: "gw-secret",
  });
  assert.equal(keys.OPENAI_API_KEY, "oai");
  assert.equal(keys.AGENT_GATEWAY_TOKEN, "gw-secret");
  assert.equal(keys.AGENT_GATEWAY_INVOKE_TOKEN, "gw-secret");
});

test("buildMagistralApiKeys falls back to AGENT_GATEWAY_INVOKE_TOKEN", () => {
  const keys = buildMagistralApiKeys([], {
    AGENT_GATEWAY_INVOKE_TOKEN: "invoke-only",
  });
  assert.equal(keys.AGENT_GATEWAY_TOKEN, "invoke-only");
});

test("buildMagistralApiKeys picks up map apiKeyEnv from env", () => {
  const map = [
    { id: "n1", url: "http://x:8793/v1/chat/completions", model: "grok", apiKeyEnv: "CUSTOM_GW" },
  ];
  const keys = buildMagistralApiKeys(map, { CUSTOM_GW: "custom" });
  assert.equal(keys.CUSTOM_GW, "custom");
});
