import test from "node:test";
import assert from "node:assert/strict";

import {
  createCognitivePacket,
  appendPacketHop,
  appendPacketSpending,
  calculatePacketTotalSpending,
  calculatePacketOwnSpending,
  calculatePacketConsolidatedSpending,
  spawnDownstreamPacket,
  auditPacketSpendNoDoubleCount,
  summarizePacketSpending,
  listOwnSpendKeys,
  calculateProvisionalCost,
  DEFAULT_MONETARY_UNIT,
  PACKET_LINEAGE_VOCABULARY,
  projectFractaBlogPost,
  projectFractaBlogFeed,
  projectPacketTraceView,
} from "../src/index.js";

test("Strict Packet Accounting & FractaBlog Projections", async (t) => {
  await t.test("1. Cognitive Packet initialization with Hop 0", () => {
    const packet = createCognitivePacket({
      mandate_id: "mandate:jhn:governance-2026",
      treatment_id: "treatment:fbf:fix-bugs-first",
      account_id: "https://jhn.baronsmariani.org/",
      initial_node_id: "node:fracta:main",
      initial_instance_id: "agent:jhn:main",
      payload: {
        title: "FBF Governance Review",
        summary: "Execution packet tracing hops and provisional spending across nodes",
      },
    });

    assert.ok(packet.packet_id.startsWith("urn:cop:packet:"));
    assert.equal(packet.mandate_id, "mandate:jhn:governance-2026");
    assert.equal(packet.account_id, "https://jhn.baronsmariani.org/");
    assert.equal(packet.hops.length, 1);
    assert.equal(packet.hops[0].hop_index, 0);
    assert.equal(packet.hops[0].node_id, "node:fracta:main");
    assert.equal(packet.hops[0].instance_id, "agent:jhn:main");
    assert.equal(packet.spending.length, 0);
    assert.equal(packet.disclosure_class, "public");
  });

  await t.test("2. Fractanet Hop Tracing across nodes", () => {
    const packet = createCognitivePacket({
      mandate_id: "mandate:jhn:governance-2026",
      treatment_id: "treatment:multi-hop:demo",
      account_id: "https://jhn.baronsmariani.org/",
      initial_node_id: "node:fracta:main",
      initial_instance_id: "agent:jhn:main",
    });

    // Hop 1: Relayed to Workstation PC
    const hop1 = appendPacketHop(packet, {
      node_id: "node:workstation:win",
      instance_id: "agent:coding:local",
      interface_type: "mcp",
      route_reason: "delegate_code_analysis",
    });

    // Hop 2: Relayed to Termux Node
    const hop2 = appendPacketHop(packet, {
      node_id: "node:poco:android",
      instance_id: "agent:termux:remote",
      interface_type: "ssh",
      route_reason: "tmux_execution",
    });

    assert.equal(packet.hops.length, 3);
    assert.equal(hop1.hop_index, 1);
    assert.equal(hop1.node_id, "node:workstation:win");
    assert.equal(hop2.hop_index, 2);
    assert.equal(hop2.node_id, "node:poco:android");
  });

  await t.test("3. Exact Provisional Cost Calculation (Decimal Math)", () => {
    // Test gpt-4o-mini (1,000,000 prompt @ 0.15, 500,000 completion @ 0.60 => $0.15 + $0.30 = $0.45)
    const { cost: costMini } = calculateProvisionalCost({
      provider: "openai",
      model: "gpt-4o-mini",
      prompt_tokens: 1_000_000,
      completion_tokens: 500_000,
    });
    assert.equal(costMini.scale, 8);
    assert.equal(costMini.coefficient, "45000000"); // 0.45000000
    assert.equal(costMini.unit, "USD");

    // Test groq/llama-3.3-70b-versatile with dynamic rate card
    const { cost: costLlama } = calculateProvisionalCost({
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      prompt_tokens: 100_000,
      completion_tokens: 100_000,
    });
    assert.equal(costLlama.scale, 8);
    assert.ok(BigInt(costLlama.coefficient) > 0n);
  });

  await t.test("4. Append Provisional Spending & Emit Balanced COP Accounting Events", () => {
    const packet = createCognitivePacket({
      mandate_id: "mandate:jhn:governance-2026",
      treatment_id: "treatment:spending:test",
      account_id: "https://jhn.baronsmariani.org/",
      initial_node_id: "node:fracta:main",
      initial_instance_id: "agent:jhn:main",
    });

    // Spending on Hop 0 (Fracta)
    const { spendingEntry: s1, transactionEvent: txn1 } = appendPacketSpending(packet, {
      capability: "ai/chat-completion",
      provider: "openai",
      model: "gpt-4o-mini",
      prompt_tokens: 1000,
      completion_tokens: 200,
    });

    assert.equal(s1.hop_index, 0);
    assert.equal(s1.node_id, "node:fracta:main");
    assert.equal(s1.provider, "openai");
    assert.equal(s1.model, "gpt-4o-mini");
    assert.equal(packet.spending.length, 1);

    // Verify balanced transaction event
    assert.equal(txn1.eventType, "accounting/transaction");
    assert.equal(txn1.postings.length, 2);
    assert.equal(txn1.postings[0].posting_type, "debit");
    assert.equal(txn1.postings[0].account, "urn:account:expense:openai:gpt-4o-mini");
    assert.equal(txn1.postings[1].posting_type, "credit");
    assert.equal(txn1.postings[1].account, "https://jhn.baronsmariani.org/");
    assert.deepEqual(txn1.postings[0].quantity, txn1.postings[1].quantity);

    // Hop to workstation and add second spending
    appendPacketHop(packet, { node_id: "node:workstation:win", instance_id: "agent:coding:local" });

    const { spendingEntry: s2 } = appendPacketSpending(packet, {
      capability: "ai/chat-completion",
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      prompt_tokens: 5000,
      completion_tokens: 1000,
    });

    assert.equal(s2.hop_index, 1);
    assert.equal(s2.node_id, "node:workstation:win");
    assert.equal(packet.spending.length, 2);

    // Verify total packet spending aggregation
    const totalCost = calculatePacketTotalSpending(packet);
    assert.equal(totalCost.unit, "USD");
    assert.ok(BigInt(totalCost.coefficient) > 0n);
  });

  await t.test("5. FractaBlog Projections (Ground Truth -> Public Views)", () => {
    const packet1 = createCognitivePacket({
      packet_id: "urn:cop:packet:public-demo-1001",
      mandate_id: "mandate:jhn:governance-2026",
      treatment_id: "treatment:public:feed",
      account_id: "https://jhn.baronsmariani.org/",
      initial_node_id: "node:fracta:main",
      initial_instance_id: "agent:jhn:main",
      disclosure_class: "public",
      payload: {
        title: "Autonomous Code Governance Verification",
        summary: "Verified FixBugsFirst hygiene and propagated runtime OpenAI keys to Fracta",
      },
    });

    appendPacketSpending(packet1, {
      provider: "openai",
      model: "gpt-4o-mini",
      prompt_tokens: 2500,
      completion_tokens: 450,
    });

    const packet2 = createCognitivePacket({
      packet_id: "urn:cop:packet:private-secret-2002",
      mandate_id: "mandate:jhn:internal",
      treatment_id: "treatment:private:vault",
      account_id: "https://jhn.baronsmariani.org/",
      disclosure_class: "private",
      payload: { title: "Internal Vault Rotation" },
    });

    // Feed projection
    const feed = projectFractaBlogFeed([packet1, packet2]);

    // Private packet2 must be excluded from public FractaBlog feed
    assert.equal(feed.length, 1);
    assert.equal(feed[0].post_id, "blog:public-demo-1001");
    assert.equal(feed[0].title, "Autonomous Code Governance Verification");
    assert.equal(feed[0].hop_chain.length, 1);
    assert.equal(feed[0].spending_breakdown.length, 1);
    assert.equal(feed[0].spending_breakdown[0].provider, "openai");
    assert.equal(feed[0].spending_breakdown[0].total_tokens, 2950);
    assert.ok(feed[0].total_provisional_cost_usd.length > 0);
  });

  await t.test("6. Graph & Spending Trace View Projection", () => {
    const packet = createCognitivePacket({
      packet_id: "urn:cop:packet:trace-view-3003",
      mandate_id: "mandate:jhn:governance-2026",
      treatment_id: "treatment:trace:demo",
      account_id: "https://jhn.baronsmariani.org/",
      initial_node_id: "node:fracta:main",
    });

    appendPacketHop(packet, { node_id: "node:workstation:win", instance_id: "agent:coding:local" });

    appendPacketSpending(packet, {
      provider: "openai",
      model: "gpt-4o",
      prompt_tokens: 1200,
      completion_tokens: 300,
    });

    const textTrace = projectPacketTraceView(packet);
    assert.ok(textTrace.includes("COGNITIVE PACKET TRACE"));
    assert.ok(textTrace.includes("urn:cop:packet:trace-view-3003"));
    assert.ok(textTrace.includes("node:fracta:main"));
    assert.ok(textTrace.includes("node:workstation:win"));
    assert.ok(textTrace.includes("openai/gpt-4o"));
    assert.ok(textTrace.includes("Provisional Spending Log"));
  });

  await t.test("7. Own vs consolidated cascade (upstream/downstream) — no double-count", () => {
    assert.equal(DEFAULT_MONETARY_UNIT, "USD");
    assert.equal(PACKET_LINEAGE_VOCABULARY.preferred.upstream, "upstream_packet_id");

    const root = createCognitivePacket({
      packet_id: "urn:cop:packet:root-cascade",
      mandate_id: "mandate:jhn:governance-2026",
      treatment_id: "treatment:cascade:demo",
      account_id: "https://jhn.baronsmariani.org/",
    });
    assert.equal(root.monetary_unit_default, "USD");

    // Root own spend (hop 0)
    appendPacketSpending(root, {
      provider: "openai",
      model: "gpt-4o-mini",
      prompt_tokens: 1_000_000,
      completion_tokens: 0,
      evidence_hash: "ev:root-1",
    });
    // 1M input @ 0.15 / M = $0.15
    const rootOwn = calculatePacketOwnSpending(root);
    assert.equal(rootOwn.coefficient, "15000000"); // 0.15000000

    const mid = spawnDownstreamPacket(root, {
      packet_id: "urn:cop:packet:mid-cascade",
      spawn_reason: "subagent_delegate",
    });
    assert.equal(mid.lineage.upstream_packet_id, root.packet_id);
    assert.ok(root.lineage.downstream_packet_ids.includes(mid.packet_id));

    appendPacketSpending(mid, {
      provider: "openai",
      model: "gpt-4o-mini",
      prompt_tokens: 0,
      completion_tokens: 500_000,
      evidence_hash: "ev:mid-1",
    });
    // 0.5M out @ 0.60 / M = $0.30

    const leaf = spawnDownstreamPacket(mid, {
      packet_id: "urn:cop:packet:leaf-cascade",
      spawn_reason: "tool_subtask",
    });
    appendPacketSpending(leaf, {
      provider: "openai",
      model: "gpt-4o-mini",
      prompt_tokens: 100_000,
      completion_tokens: 0,
      evidence_hash: "ev:leaf-1",
    });
    // 0.1M in @ 0.15 / M = $0.015

    const store = {
      [root.packet_id]: root,
      [mid.packet_id]: mid,
      [leaf.packet_id]: leaf,
    };
    const resolve = (id) => store[id];

    const roll = calculatePacketConsolidatedSpending(root, resolve);
    // own root 0.15 + mid 0.30 + leaf 0.015 = 0.465
    assert.equal(roll.own.coefficient, "15000000");
    assert.equal(roll.consolidated.coefficient, "46500000");
    assert.equal(roll.downstream_count, 1); // direct downstream only (mid)
    assert.equal(roll.spend_keys.length, 3);

    // own(root) + own(mid) + own(leaf) == consolidated(root); no double-count
    const sumOwn = ["15000000", "30000000", "1500000"].reduce((a, b) => a + BigInt(b), 0n);
    assert.equal(BigInt(roll.consolidated.coefficient), sumOwn);

    const audit = auditPacketSpendNoDoubleCount([root, mid, leaf]);
    assert.equal(audit.ok, true);
    assert.equal(audit.duplicate_keys.length, 0);

    // calculatePacketTotalSpending remains own-only (compat)
    assert.equal(calculatePacketTotalSpending(root).coefficient, rootOwn.coefficient);

    const summary = summarizePacketSpending(root, resolve);
    assert.equal(summary.own_spend, "0.15000000");
    assert.equal(summary.consolidated_spend, "0.46500000");
    assert.equal(summary.downstream_count, 1);

    // Anti double-count: same evidence_hash twice on one packet
    assert.throws(() => {
      appendPacketSpending(root, {
        provider: "openai",
        model: "gpt-4o-mini",
        prompt_tokens: 10,
        completion_tokens: 0,
        evidence_hash: "ev:root-1",
      });
    }, /double-count|evidence_hash/);

    // Anti double-count: same spend_id twice
    assert.throws(() => {
      appendPacketSpending(leaf, {
        spend_id: listOwnSpendKeys(leaf)[0].split("::")[1],
        provider: "openai",
        model: "gpt-4o-mini",
        prompt_tokens: 10,
        completion_tokens: 0,
      });
    }, /duplicate spend_id/);
  });
});
