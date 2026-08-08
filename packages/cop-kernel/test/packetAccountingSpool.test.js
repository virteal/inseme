import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  createCopEventPersistPipeline,
  createMemoryCopEventStore,
  createNdjsonCopEventSpool,
} from "@inseme/cop-core";
import {
  createCognitivePacket,
  appendPacketSpending,
  persistPacketAccountingTransaction,
  replayPacketAccountingSpool,
} from "../src/accounting/packetAccounting.js";

test("Cognitive Packet Accounting Transaction Persistence & Spool Replay (#28)", async (t) => {
  await t.test("1. Online persistence to memory store", async () => {
    const store = createMemoryCopEventStore();
    const pipeline = createCopEventPersistPipeline({ store });

    const packet = createCognitivePacket({
      mandate_id: "mandate:test:online",
      treatment_id: "treat:online-1",
      account_id: "https://jhn.baronsmariani.org/",
    });

    const { transactionEvent } = appendPacketSpending(packet, {
      provider: "openai",
      model: "gpt-5.4-nano",
      prompt_tokens: 50_000,
      completion_tokens: 20_000,
    });

    const result = await persistPacketAccountingTransaction(transactionEvent, pipeline);
    assert.equal(result.ok, true);
    assert.equal(result.spooled, false);
    assert.equal(store.replay().length, 1);

    const storedEvent = store.replay()[0];
    assert.equal(storedEvent.event_type, "accounting/transaction");
    assert.equal(storedEvent.topic.id, "cop/accounting");
    assert.equal(storedEvent.payload.transaction_id, transactionEvent.transaction_id);
  });

  await t.test("2. Degraded mode: fallback to NDJSON spool when store fails", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cop-acct-spool-"));
    const spoolFile = path.join(tmpDir, "accounting-spool.ndjson");
    const spool = createNdjsonCopEventSpool({ filePath: spoolFile });

    // Mock failing store
    const failingStore = {
      append() {
        return { ok: false, error: "store_connection_failed" };
      },
    };

    const pipeline = createCopEventPersistPipeline({ store: failingStore, spool });

    const packet = createCognitivePacket({
      mandate_id: "mandate:test:degraded",
      treatment_id: "treat:degraded-1",
      account_id: "https://jhn.baronsmariani.org/",
    });

    const { transactionEvent } = appendPacketSpending(packet, {
      provider: "openai",
      model: "gpt-5.6-terra",
      prompt_tokens: 10_000,
      completion_tokens: 5_000,
    });

    const result = await persistPacketAccountingTransaction(transactionEvent, pipeline);
    assert.equal(result.ok, false);
    assert.equal(result.spooled, true);

    // Verify event written to spool file on disk
    const { events: spooledEnvelopes } = spool.readAll();
    assert.equal(spooledEnvelopes.length, 1);
    assert.equal(spooledEnvelopes[0].payload.transaction_id, transactionEvent.transaction_id);

    // Now test Replay into healthy store
    const healthyStore = createMemoryCopEventStore();
    const replayReport = spool.replayInto(healthyStore);
    assert.equal(replayReport.ok, true);
    assert.equal(replayReport.appended, 1);
    assert.equal(healthyStore.replay().length, 1);

    // Cleanup temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
