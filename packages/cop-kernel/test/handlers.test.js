import test from "node:test";
import assert from "node:assert/strict";

import { createHandlerContext } from "../src/handlerContext.js";
import { defineHandler, defineServiceHandler } from "../src/handlers.js";

test("handler factories expose the clean-break handler API", () => {
  const handler = defineHandler({
    name: "example-handler",
    task: { taskType: "example", workerHandlerName: "example-handler" },
    handle: async () => null,
  });
  const serviceHandler = defineServiceHandler({
    name: "example-service-handler",
    handle: async () => null,
  });

  assert.equal(handler.name, "example-handler");
  assert.equal(typeof handler.run, "function");
  assert.equal(serviceHandler.name, "example-service-handler");
  assert.equal(typeof serviceHandler.run, "function");
  assert.throws(
    () =>
      defineHandler({
        name: "legacy-task-shape",
        task: { taskType: "example", workerAgentName: "legacy" },
        handle: async () => null,
      }),
    /workerHandlerName/
  );
});

test("handler context exposes handler-oriented call helpers", () => {
  const context = createHandlerContext({
    msg: { message_id: "message-1", from: "cop://source", to: "cop://target", intent: "test" },
  });

  assert.equal(typeof context.callHandler, "function");
  assert.equal("callAgent" in context, false);
});
