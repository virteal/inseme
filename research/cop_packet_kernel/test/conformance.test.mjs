import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(
  await readFile(path.join(root, "schema", "cop-packet-kernel.schema.json"), "utf8"),
);
const vectorDirectory = path.join(root, "vectors");
const vectorFiles = (await readdir(vectorDirectory)).filter((name) => name.endsWith(".json")).sort();
const vectors = await Promise.all(
  vectorFiles.map(async (name) => ({
    name,
    value: JSON.parse(await readFile(path.join(vectorDirectory, name), "utf8")),
  })),
);

function clone(value) {
  return structuredClone(value);
}

function resolveReference(reference) {
  if (!reference.startsWith("#/$defs/")) throw new Error(`Unsupported reference: ${reference}`);
  const name = reference.slice("#/$defs/".length);
  const resolved = schema.$defs[name];
  if (!resolved) throw new Error(`Unresolved schema reference: ${reference}`);
  return resolved;
}

function isType(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "null") return value === null;
  return typeof value === type;
}

function validateNode(node, value, location = "$") {
  if (node.$ref) return validateNode(resolveReference(node.$ref), value, location);

  if (node.oneOf) {
    const branches = node.oneOf.map((branch) => validateNode(branch, value, location));
    const passing = branches.filter((errors) => errors.length === 0).length;
    return passing === 1 ? [] : [`${location}: expected exactly one oneOf branch, got ${passing}`];
  }
  if (node.anyOf) {
    const passing = node.anyOf.some((branch) => validateNode(branch, value, location).length === 0);
    return passing ? [] : [`${location}: expected at least one anyOf branch`];
  }

  const errors = [];
  if (node.type && !isType(value, node.type)) {
    return [`${location}: expected ${node.type}`];
  }
  if (Object.hasOwn(node, "const") && value !== node.const) {
    errors.push(`${location}: expected constant ${JSON.stringify(node.const)}`);
  }
  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${location}: value is outside enum`);
  }

  if (typeof value === "string") {
    if (node.minLength !== undefined && value.length < node.minLength) {
      errors.push(`${location}: shorter than minLength ${node.minLength}`);
    }
    if (node.pattern && !new RegExp(node.pattern).test(value)) {
      errors.push(`${location}: does not match ${node.pattern}`);
    }
  }

  if (typeof value === "number" && node.minimum !== undefined && value < node.minimum) {
    errors.push(`${location}: smaller than minimum ${node.minimum}`);
  }

  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) {
      errors.push(`${location}: has fewer than ${node.minItems} items`);
    }
    if (node.uniqueItems) {
      const encoded = value.map((item) => JSON.stringify(item));
      if (new Set(encoded).size !== encoded.length) errors.push(`${location}: items are not unique`);
    }
    if (node.items) {
      value.forEach((item, index) => errors.push(...validateNode(node.items, item, `${location}[${index}]`)));
    }
  }

  if (isType(value, "object")) {
    const properties = node.properties ?? {};
    for (const required of node.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${location}: missing required property ${required}`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) errors.push(...validateNode(properties[key], child, `${location}.${key}`));
      else if (node.additionalProperties === false) errors.push(`${location}: unexpected property ${key}`);
    }
  }

  return errors;
}

function indexBy(items, property) {
  return new Map(items.map((item) => [item[property], item]));
}

function missingFrom(subset, superset) {
  const allowed = new Set(superset);
  return subset.filter((item) => !allowed.has(item));
}

function checkCausalParentage(vector) {
  const errors = [];
  const packets = indexBy(vector.packets, "packetId");
  if (packets.size !== vector.packets.length) errors.push("packet identifiers are not unique");
  for (const packet of vector.packets) {
    if (packet.relation === "emit" && packet.parentPacketIds.length !== 0) {
      errors.push(`${packet.packetId}: emitted packet has a parent`);
    }
    if (packet.relation !== "emit" && packet.parentPacketIds.length === 0) {
      errors.push(`${packet.packetId}: successor has no parent`);
    }
    for (const parent of packet.parentPacketIds) {
      if (!packets.has(parent)) errors.push(`${packet.packetId}: unknown parent ${parent}`);
    }
  }
  return errors;
}

function checkTraceableDisposition(vector) {
  const errors = [];
  for (const outcome of vector.outcomes) {
    if (!outcome.traceRef?.trim()) errors.push(`${outcome.outcomeId}: missing trace`);
  }
  for (const route of vector.routingDecisions.filter((item) => item.disposition === "accepted")) {
    const dispositions = vector.outcomes.filter(
      (outcome) => outcome.packetId === route.packetId && !["refused", "timed-out"].includes(outcome.disposition),
    );
    if (!dispositions.some((outcome) => outcome.traceRef?.trim())) {
      errors.push(`${route.decisionId}: accepted packet has no traceable disposition`);
    }
  }
  return errors;
}

function checkMandateNonAmplification(vector) {
  const errors = [];
  const mandates = indexBy(vector.mandates, "mandateId");
  const packets = indexBy(vector.packets, "packetId");
  for (const packet of vector.packets) {
    const mandate = mandates.get(packet.envelope.mandateId);
    if (!mandate) {
      errors.push(`${packet.packetId}: unknown mandate`);
      continue;
    }
    if (!mandate.missionIds.includes(packet.mission.missionId)) {
      errors.push(`${packet.packetId}: mission is outside mandate`);
    }
    const excess = missingFrom(packet.envelope.requiredCapabilities, mandate.allowedCapabilities);
    if (excess.length) errors.push(`${packet.packetId}: envelope amplifies ${excess.join(", ")}`);
    if (packet.kind === "control" && !mandate.allowedActions.includes("control")) {
      errors.push(`${packet.packetId}: control is outside mandate`);
    }
    if (packet.kind === "return" && !mandate.allowedActions.includes("return")) {
      errors.push(`${packet.packetId}: return is outside mandate`);
    }
  }
  for (const outcome of vector.outcomes) {
    const mandate = mandates.get(outcome.mandateId);
    if (!mandate) {
      errors.push(`${outcome.outcomeId}: unknown mandate`);
      continue;
    }
    const packet = packets.get(outcome.packetId);
    if (!packet) errors.push(`${outcome.outcomeId}: unknown packet`);
    if (packet && packet.envelope.mandateId !== outcome.mandateId) {
      errors.push(`${outcome.outcomeId}: changed mandate during handling`);
    }
    const excess = missingFrom(outcome.usedCapabilities, mandate.allowedCapabilities);
    if (excess.length) errors.push(`${outcome.outcomeId}: handler amplifies ${excess.join(", ")}`);
  }
  return errors;
}

function checkExplicitMissionMutation(vector) {
  const errors = [];
  const packets = indexBy(vector.packets, "packetId");
  const missionVersions = new Map(
    vector.missions.map((mission) => [`${mission.missionId}@${mission.version}`, mission]),
  );
  if (missionVersions.size !== vector.missions.length) errors.push("mission versions are not unique");
  for (const mission of vector.missions.filter((item) => item.version > 1)) {
    if (mission.previousVersion !== mission.version - 1) {
      errors.push(`${mission.missionId}@${mission.version}: previous version is not explicit`);
    }
    const control = packets.get(mission.changedByControlPacketId);
    if (!control || control.kind !== "control" || control.relation !== "control") {
      errors.push(`${mission.missionId}@${mission.version}: missing control packet`);
    } else if (
      control.control?.fromVersion !== mission.previousVersion ||
      control.control?.toVersion !== mission.version
    ) {
      errors.push(`${mission.missionId}@${mission.version}: control version transition differs`);
    }
  }
  for (const packet of vector.packets) {
    if (!missionVersions.has(`${packet.mission.missionId}@${packet.mission.version}`)) {
      errors.push(`${packet.packetId}: references an unknown mission version`);
    }
    if (
      packet.envelope.missionId !== packet.mission.missionId ||
      packet.envelope.missionVersion !== packet.mission.version ||
      packet.kind !== packet.envelope.kind
    ) {
      errors.push(`${packet.packetId}: envelope silently changes mission or kind`);
    }
  }
  return errors;
}

function checkAccessibleContinuation(vector) {
  const errors = [];
  for (const packet of vector.packets.filter((item) => item.relation === "continue")) {
    if (!packet.continuation) errors.push(`${packet.packetId}: missing continuation context`);
    if (packet.continuation?.accessibleToNextHandler !== true) {
      errors.push(`${packet.packetId}: continuation is inaccessible to the next handler`);
    }
    if (packet.continuation?.stateRef?.accessibleToHandlers !== true) {
      errors.push(`${packet.packetId}: continuation state reference is inaccessible`);
    }
    if (packet.content.accessibleToHandlers !== true) {
      errors.push(`${packet.packetId}: continued content is inaccessible`);
    }
  }
  return errors;
}

function checkEnvelopeOnlyRouting(vector) {
  const errors = [];
  const packets = indexBy(vector.packets, "packetId");
  for (const route of vector.routingDecisions) {
    if (route.payloadInspected !== false) errors.push(`${route.decisionId}: payload was inspected`);
    const packet = packets.get(route.packetId);
    if (!packet) {
      errors.push(`${route.decisionId}: unknown packet`);
      continue;
    }
    if (route.disposition === "accepted") {
      const missing = missingFrom(packet.envelope.requiredCapabilities, route.advertisedCapabilities);
      if (missing.length) errors.push(`${route.decisionId}: accepted without ${missing.join(", ")}`);
    }
  }
  return errors;
}

function checkExplicitTransitionSemantics(vector) {
  const errors = [];
  const packets = indexBy(vector.packets, "packetId");
  const transitionIds = new Set();
  for (const packet of vector.packets) {
    if (["copy", "fork", "replica"].includes(packet.relation) && packet.parentPacketIds.length !== 1) {
      errors.push(`${packet.packetId}: ${packet.relation} does not identify exactly one source`);
    }
  }
  for (const transition of vector.custodyTransitions) {
    if (transitionIds.has(transition.transitionId)) errors.push(`${transition.transitionId}: duplicate transition`);
    transitionIds.add(transition.transitionId);
    if (transition.fromCustodianId === transition.toCustodianId) {
      errors.push(`${transition.transitionId}: custody source and destination are identical`);
    }
    const packet = packets.get(transition.packetId);
    if (!packet) errors.push(`${transition.transitionId}: unknown packet`);
    if (packet?.content.mode !== "physical" || packet.content.carrierId !== transition.carrierId) {
      errors.push(`${transition.transitionId}: transition is not correlated to its physical carrier packet`);
    }
    if (!transition.evidenceRef?.trim()) errors.push(`${transition.transitionId}: missing custody evidence`);
  }
  return errors;
}

function checkCorrelatedReturn(vector) {
  const errors = [];
  const packets = indexBy(vector.packets, "packetId");
  const missionVersions = new Map(
    vector.missions.map((mission) => [`${mission.missionId}@${mission.version}`, mission]),
  );
  const terminal = vector.outcomes.filter((outcome) => ["returned", "completed"].includes(outcome.disposition));
  for (const outcome of terminal) {
    const packet = packets.get(outcome.packetId);
    if (!packet?.correlationId) errors.push(`${outcome.outcomeId}: missing correlation`);
    if (!outcome.returnDisposition) errors.push(`${outcome.outcomeId}: missing return disposition`);
    const mission = packet
      ? missionVersions.get(`${packet.mission.missionId}@${packet.mission.version}`)
      : undefined;
    if (
      mission &&
      outcome.returnDisposition &&
      outcome.returnDisposition.recipientId !== mission.returnPolicy.recipientId
    ) {
      errors.push(`${outcome.outcomeId}: returned to a recipient outside mission policy`);
    }
  }
  for (const mission of vector.missions.filter((item) => item.status === "satisfied")) {
    const returned = terminal.some((outcome) => {
      const packet = packets.get(outcome.packetId);
      return packet?.mission.missionId === mission.missionId && packet.mission.version === mission.version;
    });
    if (!returned) errors.push(`${mission.missionId}@${mission.version}: satisfied without explicit return`);
  }
  return errors;
}

const lawChecks = {
  "accessible-continuation": checkAccessibleContinuation,
  "causal-parentage": checkCausalParentage,
  "correlated-return": checkCorrelatedReturn,
  "envelope-only-routing": checkEnvelopeOnlyRouting,
  "explicit-mission-mutation": checkExplicitMissionMutation,
  "explicit-transition-semantics": checkExplicitTransitionSemantics,
  "mandate-non-amplification": checkMandateNonAmplification,
  "traceable-disposition": checkTraceableDisposition,
};

function scenarioErrors(vector) {
  const errors = [];
  if (vector.scenario === "immortelle-bottle") {
    if (!vector.packets.some((packet) => packet.content.mode === "physical")) errors.push("missing physical carrier");
    if (vector.custodyTransitions.length < 3) errors.push("journey has too few custody transitions");
    if (!vector.missions.some((mission) => mission.version > 1)) errors.push("missing mission update");
    if (!vector.packets.some((packet) => packet.kind === "control")) errors.push("missing control packet");
    if (!vector.packets.some((packet) => packet.kind === "return")) errors.push("missing return packet");
  }
  if (vector.scenario === "cli-llm-continuation") {
    const handlers = new Set(
      vector.outcomes.filter((outcome) => !["returned", "completed"].includes(outcome.disposition)).map(
        (outcome) => outcome.handlerId,
      ),
    );
    if (handlers.size < 2) errors.push("handler replacement is not demonstrated");
    if (!vector.packets.some((packet) => packet.relation === "continue")) errors.push("missing continuation");
  }
  if (vector.scenario === "intermittent-fractanet-node") {
    if (!vector.routingDecisions.some((route) => ["refused", "timed-out"].includes(route.disposition))) {
      errors.push("missing refusal or timeout");
    }
    if (!vector.routingDecisions.some((route) => route.disposition === "fallback" && route.nextNodeId)) {
      errors.push("missing explicit fallback");
    }
    const outboundNodes = new Set(
      vector.routingDecisions
        .filter((route) => route.disposition === "accepted")
        .filter((route) => vector.packets.find((packet) => packet.packetId === route.packetId)?.kind === "work")
        .map((route) => route.nodeId),
    );
    const returnNodes = vector.routingDecisions
      .filter((route) => vector.packets.find((packet) => packet.packetId === route.packetId)?.kind === "return")
      .map((route) => route.nodeId);
    if (!returnNodes.some((node) => !outboundNodes.has(node))) errors.push("return path is not distinct");
  }
  return errors;
}

test("the corpus contains exactly the three mandated vectors", () => {
  assert.deepEqual(
    vectors.map(({ value }) => value.scenario).sort(),
    ["cli-llm-continuation", "immortelle-bottle", "intermittent-fractanet-node"],
  );
});

for (const { name, value } of vectors) {
  test(`${name} satisfies the canonical schema`, () => {
    assert.deepEqual(validateNode(schema, value), []);
  });

  test(`${name} satisfies every declared executable law`, () => {
    assert.deepEqual([...value.expected.executableLaws].sort(), Object.keys(lawChecks).sort());
    for (const [law, check] of Object.entries(lawChecks)) {
      assert.deepEqual(check(value), [], `${law} failed`);
    }
  });

  test(`${name} satisfies its concrete scenario obligations`, () => {
    assert.deepEqual(scenarioErrors(value), []);
  });
}

const vectorByScenario = new Map(vectors.map(({ value }) => [value.scenario, value]));
const negativeCases = [
  {
    law: "causal-parentage",
    scenario: "cli-llm-continuation",
    mutate(vector) {
      vector.packets.find((packet) => packet.relation === "continue").parentPacketIds = [];
    },
  },
  {
    law: "traceable-disposition",
    scenario: "cli-llm-continuation",
    mutate(vector) {
      vector.outcomes[0].traceRef = "";
    },
  },
  {
    law: "mandate-non-amplification",
    scenario: "intermittent-fractanet-node",
    mutate(vector) {
      vector.outcomes[1].usedCapabilities.push("unmandated-superpower");
    },
  },
  {
    law: "explicit-mission-mutation",
    scenario: "immortelle-bottle",
    mutate(vector) {
      delete vector.missions.find((mission) => mission.version === 2).changedByControlPacketId;
    },
  },
  {
    law: "accessible-continuation",
    scenario: "cli-llm-continuation",
    mutate(vector) {
      vector.packets.find((packet) => packet.relation === "continue").continuation.accessibleToNextHandler = false;
    },
  },
  {
    law: "envelope-only-routing",
    scenario: "intermittent-fractanet-node",
    mutate(vector) {
      vector.routingDecisions[0].payloadInspected = true;
    },
  },
  {
    law: "explicit-transition-semantics",
    scenario: "immortelle-bottle",
    mutate(vector) {
      vector.custodyTransitions[0].toCustodianId = vector.custodyTransitions[0].fromCustodianId;
    },
  },
  {
    law: "correlated-return",
    scenario: "cli-llm-continuation",
    mutate(vector) {
      delete vector.outcomes.find((outcome) => outcome.disposition === "returned").returnDisposition;
    },
  },
];

for (const { law, scenario, mutate } of negativeCases) {
  test(`negative mutation is rejected by ${law}`, () => {
    const vector = clone(vectorByScenario.get(scenario));
    mutate(vector);
    assert.notDeepEqual(lawChecks[law](vector), []);
  });
}
