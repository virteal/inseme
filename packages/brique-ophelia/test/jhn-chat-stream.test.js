import assert from "node:assert/strict";
import test from "node:test";
import jhnChatStream from "../edge/jhn-chat-stream.js";

test("JHN chat adapter exposes a secret-free COP health check", async () => {
  const response = await jhnChatStream(
    new Request("https://jhn.example/api/chat-stream?healthcheck=true")
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    profile: "jhn",
    orchestration: "cop",
  });
});
