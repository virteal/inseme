import assert from "node:assert/strict";
import { test } from "node:test";
import { createPortableCopRuntimeGateway } from "../cop/portableRuntimeGateway.js";
import { createPortableCopRuntimeHandlers } from "../cop/portableRuntimeHandlers.js";

function fullMandate() {
  return {
    status: "active",
    granteeRef: "principal:jhn",
    permissions: ["cop.events.append"],
  };
}

test("portable runtime handlers require a resolved identity and write only through the gateway", async () => {
  const writes = [];
  const gateway = createPortableCopRuntimeGateway({
    executor: { insert: async (table, row) => (writes.push({ table, row }), row) },
    idFactory: (prefix) => `${prefix}:test`,
  });
  const handlers = createPortableCopRuntimeHandlers({
    gateway,
    resolveContext: async (request) =>
      request.identity === "jhn"
        ? { principal: { id: "principal:jhn" }, mandate: fullMandate() }
        : null,
  });

  const unauthenticated = await handlers.appendEvent({ body: { type: "mission.started" } });
  assert.equal(unauthenticated.status, 401);

  const accepted = await handlers.appendEvent({
    identity: "jhn",
    body: { type: "mission.started" },
  });
  assert.equal(accepted.status, 201);

  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, "cop_events");
});
