import assert from "node:assert/strict";
import test from "node:test";
import { buildMagistralApiKeys } from "../src/magistral-api-keys.js";

test("buildMagistralApiKeys prefers COGENTIA_API_KEY", () => {
  const keys = buildMagistralApiKeys([], {
    OPENAI_API_KEY: "oai",
    COGENTIA_API_KEY: "cogentia-secret",
    AGENT_GATEWAY_TOKEN: "legacy",
  });
  assert.equal(keys.OPENAI_API_KEY, "oai");
  assert.equal(keys.COGENTIA_API_KEY, "cogentia-secret");
  assert.equal(keys.AGENT_GATEWAY_TOKEN, "cogentia-secret");
  assert.equal(keys.AGENT_GATEWAY_INVOKE_TOKEN, "cogentia-secret");
});

test("buildMagistralApiKeys falls back to legacy AGENT_GATEWAY_TOKEN", () => {
  const keys = buildMagistralApiKeys([], {
    AGENT_GATEWAY_TOKEN: "legacy-gw",
  });
  assert.equal(keys.COGENTIA_API_KEY, "legacy-gw");
  assert.equal(keys.AGENT_GATEWAY_TOKEN, "legacy-gw");
});

test("buildMagistralApiKeys picks up map apiKeyEnv from env", () => {
  const map = [
    { id: "n1", url: "http://x:8793/v1/chat/completions", model: "grok", apiKeyEnv: "CUSTOM_GW" },
  ];
  const keys = buildMagistralApiKeys(map, { CUSTOM_GW: "custom" });
  assert.equal(keys.CUSTOM_GW, "custom");
});
