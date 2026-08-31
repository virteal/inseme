import test from "node:test";
import assert from "node:assert/strict";

test("CognitivePacket can represent self-contained and materializable closure", () => {
  const packet = {
    packet_id: "pkt-reality-test-001",
    created_at: new Date().toISOString(),
    hops: [
      {
        hop_index: 0,
        node_id: "node:fracta:main",
        instance_id: "jhn",
        timestamp: new Date().toISOString(),
      },
    ],
    payload: { question: "What is the capital of Corsica?" },
    closure: {
      closure_kind: "materializable",
      admissible_handlers: ["agent:jhn", "agent:ophelia", "handler:codex-acp"],
      required_environment: { node_version: ">=20.0.0", cop_schema: "1.1" },
      referenced_dependencies: [
        {
          dependency_id: "dep:wiki:corte",
          kind: "document",
          locator: "https://github.com/JeanHuguesRobert/inseme/wiki/Corte.md",
          hash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      ],
    },
    placements: [
      {
        store_id: "sqlite:local",
        store_kind: "sqlite",
        locator: "cop_packets/pkt-reality-test-001",
        is_primary: true,
      },
      {
        store_id: "supabase:ndiysuhzmztatpxbkezn",
        store_kind: "postgres",
        locator: "public.cop_packets.id:pkt-reality-test-001",
        is_primary: false,
      },
    ],
    causal_frontier: {
      frontier_events: [
        {
          event_id: "evt-001",
          topic_id: "topic:corte",
          sequence_number: 1,
          observed_at: new Date().toISOString(),
        },
      ],
      frontier_hash: "sha256:causalfrontier001",
    },
  };

  // 1. Serialization / Deserialization Round-trip
  const jsonStr = JSON.stringify(packet);
  const deserialized = JSON.parse(jsonStr);

  assert.equal(deserialized.packet_id, packet.packet_id);
  assert.equal(deserialized.closure.closure_kind, "materializable");
  assert.equal(deserialized.closure.referenced_dependencies.length, 1);
  assert.equal(deserialized.placements.length, 2);
  assert.equal(deserialized.placements[0].store_kind, "sqlite");
  assert.equal(deserialized.placements[1].store_kind, "postgres");
  assert.equal(deserialized.causal_frontier.frontier_events[0].event_id, "evt-001");
});

test("Governed effect intent and receipt maintain stable idempotency key", () => {
  const intent = {
    intent_id: "intent-create-vote-001",
    packet_id: "pkt-reality-test-001",
    mandate_id: "mandate:civic:pertitellu",
    action_name: "create_proposition",
    target_resource: "public.propositions",
    idempotency_key: "idem:pkt-001:action-01",
    parameters: { title: "Aménagement de la place Paoli" },
    planned_at: new Date().toISOString(),
    status: "authorized",
  };

  const receipt = {
    receipt_id: "rcpt-create-vote-001",
    intent_id: intent.intent_id,
    packet_id: intent.packet_id,
    idempotency_key: intent.idempotency_key,
    status: "success",
    executor: "agent:ophelia",
    executed_at: new Date().toISOString(),
    result: { proposition_id: "00000000-0000-0000-0000-000000000100" },
  };

  assert.equal(receipt.intent_id, intent.intent_id);
  assert.equal(receipt.idempotency_key, intent.idempotency_key);
  assert.equal(receipt.status, "success");
});
