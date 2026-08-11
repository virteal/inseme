import assert from "node:assert/strict";
import test from "node:test";

import { defaultBus } from "../src/bus.js";
import { asCognitivePacket } from "../src/Cop-kerneltasks.js";

async function nextTurn() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("asCognitivePacket publishes through an explicitly supplied bus", async () => {
  const published = [];
  const bus = {
    async publish(event) {
      published.push(event);
    },
  };

  const packet = asCognitivePacket({
    kind: "continuation",
    envelope: { id: "packet-explicit-bus" },
    payload: { continuationId: "continuation-explicit-bus" },
    bus,
  });

  await nextTurn();

  assert.equal(published.length, 1);
  assert.equal(published[0].type, "cop.packet.created");
  assert.equal(published[0].data.packet, packet);
});

test("asCognitivePacket delivers concurrent fallback emissions after lazy bus loading", async () => {
  const ids = new Set(["packet-lazy-bus-a", "packet-lazy-bus-b"]);
  const received = [];
  const unsubscribe = defaultBus.subscribe("cop.packet.created", (event) => {
    if (ids.has(event.data?.packet?.envelope?.id)) received.push(event);
  });

  try {
    asCognitivePacket({
      kind: "continuation",
      envelope: { id: "packet-lazy-bus-a" },
      payload: { continuationId: "continuation-lazy-bus-a" },
    });
    asCognitivePacket({
      kind: "continuation",
      envelope: { id: "packet-lazy-bus-b" },
      payload: { continuationId: "continuation-lazy-bus-b" },
    });

    for (let attempt = 0; attempt < 20 && received.length < 2; attempt += 1) {
      await nextTurn();
    }

    assert.equal(received.length, 2);
    assert.deepEqual(new Set(received.map((event) => event.data.packet.envelope.id)), ids);
  } finally {
    unsubscribe();
  }
});
