import assert from "node:assert/strict";
import test from "node:test";
import { createAcpProviderQueue } from "../pilots/reference-js/src/acp-executor.js";

test("ACP provider queue grants one FIFO slot at a time per installed agent", async () => {
  const queue = createAcpProviderQueue();
  const node = { id: "local-codex-acp" };
  const first = await queue.acquire(node);
  const secondPromise = queue.acquire(node);
  let secondGranted = false;
  secondPromise.then(() => {
    secondGranted = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(
    secondGranted,
    false,
    "second client must wait for the provider slot",
  );
  first.release();
  const second = await secondPromise;
  assert.equal(second.queue_position, 1);
  assert.ok(second.waited_ms >= 15);
  second.release();
});

test("ACP provider queues remain independent across installed agents", async () => {
  const queue = createAcpProviderQueue();
  const first = await queue.acquire({ id: "codex-a" });
  const other = await queue.acquire({ id: "codex-b" });
  assert.equal(other.queue_position, 0);
  first.release();
  other.release();
});
