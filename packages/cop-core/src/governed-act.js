/**
 * Minimal governed Act chain for JHN usability gate (Inseme #33 / #31 Phase 4).
 *
 * CapabilityInvocation → Act → Trace → Imputation
 *
 * Backend-independent; appends to any store with .append().
 */

import { randomUUID } from "node:crypto";
import { createCopEventEnvelope } from "./cop-event-envelope.js";

/**
 * @typedef {object} GovernedActInput
 * @property {string} principal_ref
 * @property {string} mandate_ref  e.g. mandate:MND-JHN-…@v1
 * @property {string} logical_agent_ref  e.g. agent:jhn
 * @property {string} handler_instance_ref  e.g. handler:openai-reasoner@local
 * @property {string} capability  e.g. coding.reply or repo.read
 * @property {object} [invocation_input]
 * @property {object} [effect] result/evidence after handler runs
 * @property {string} [topic_id]
 * @property {'ok'|'failed'|'refused'} [outcome]
 */

/**
 * Record a full governed act chain as four append-only COP events.
 * Returns all events + composite receipt.
 *
 * @param {object} store
 * @param {GovernedActInput} input
 */
export function recordGovernedAct(store, input) {
  require(input.principal_ref, "principal_ref");
  require(input.mandate_ref, "mandate_ref");
  require(input.logical_agent_ref, "logical_agent_ref");
  require(input.handler_instance_ref, "handler_instance_ref");
  require(input.capability, "capability");

  const actId = randomUUID();
  const topicId = input.topic_id || `act:${actId}`;
  const outcome = input.outcome || "ok";
  const correlation = `governed-act:${actId}`;
  const recorded = [];

  const base = {
    subject_ref: input.logical_agent_ref,
    actor_ref: input.logical_agent_ref,
    mandate_ref: input.mandate_ref,
    visibility: "restricted",
    correlation_id: correlation,
  };

  const inv = appendOne(store, {
    ...base,
    topic_id: topicId,
    epistemic_status: "declared",
    origin_ref: `capability:${input.capability}`,
    payload: {
      kind: "CapabilityInvocation",
      act_id: actId,
      principal_ref: input.principal_ref,
      mandate_ref: input.mandate_ref,
      logical_agent_ref: input.logical_agent_ref,
      handler_instance_ref: input.handler_instance_ref,
      capability: input.capability,
      input: input.invocation_input || {},
    },
    idempotency_key: `${correlation}:invocation`,
  });
  recorded.push(inv);

  const act = appendOne(store, {
    ...base,
    topic_id: topicId,
    epistemic_status: "decided",
    origin_ref: inv.event.event_id,
    causation_id: inv.event.event_id,
    payload: {
      kind: "Act",
      act_id: actId,
      principal_ref: input.principal_ref,
      mandate_ref: input.mandate_ref,
      logical_agent_ref: input.logical_agent_ref,
      handler_instance_ref: input.handler_instance_ref,
      capability: input.capability,
      outcome,
    },
    idempotency_key: `${correlation}:act`,
  });
  recorded.push(act);

  const trace = appendOne(store, {
    ...base,
    topic_id: topicId,
    epistemic_status: "observed",
    origin_ref: act.event.event_id,
    causation_id: act.event.event_id,
    payload: {
      kind: "Trace",
      act_id: actId,
      effect: input.effect || null,
      outcome,
    },
    idempotency_key: `${correlation}:trace`,
  });
  recorded.push(trace);

  const imputation = appendOne(store, {
    ...base,
    topic_id: topicId,
    epistemic_status: "normative",
    origin_ref: act.event.event_id,
    causation_id: act.event.event_id,
    payload: {
      kind: "Imputation",
      act_id: actId,
      principal_ref: input.principal_ref,
      logical_agent_ref: input.logical_agent_ref,
      handler_instance_ref: input.handler_instance_ref,
      // responsibility remains with LogicalAgent under Principal mandate;
      // handler is material executor only
      responsibility: "logical_agent_under_mandate",
      material_executor: input.handler_instance_ref,
    },
    idempotency_key: `${correlation}:imputation`,
  });
  recorded.push(imputation);

  return {
    ok: recorded.every((r) => r.ok),
    act_id: actId,
    topic_id: topicId,
    correlation,
    events: recorded.map((r) => r.event),
    receipt: {
      schema: "cop.governed-act.receipt.v1",
      act_id: actId,
      principal_ref: input.principal_ref,
      mandate_ref: input.mandate_ref,
      logical_agent_ref: input.logical_agent_ref,
      handler_instance_ref: input.handler_instance_ref,
      capability: input.capability,
      outcome,
      event_ids: recorded.map((r) => r.event?.event_id).filter(Boolean),
    },
  };
}

/**
 * John delegates to a replaceable handler, then records governed act.
 *
 * @param {object} options
 * @param {object} options.store
 * @param {object} options.handler  { id, invoke(input) => Promise|object }
 * @param {object} options.identity principal/mandate/logical_agent refs
 * @param {string} options.capability
 * @param {object} [options.input]
 */
export async function jhnDelegateToHandler(options) {
  const { store, handler, identity, capability, input } = options;
  if (!handler || typeof handler.invoke !== "function") {
    throw new TypeError("handler.invoke required");
  }
  require(identity?.principal_ref, "identity.principal_ref");
  require(identity?.mandate_ref, "identity.mandate_ref");
  require(identity?.logical_agent_ref, "identity.logical_agent_ref");

  let effect = null;
  let outcome = "ok";
  try {
    effect = await handler.invoke(input || {});
  } catch (err) {
    outcome = "failed";
    effect = { error: String(err.message || err) };
  }

  return recordGovernedAct(store, {
    principal_ref: identity.principal_ref,
    mandate_ref: identity.mandate_ref,
    logical_agent_ref: identity.logical_agent_ref,
    handler_instance_ref: handler.id || "handler:anonymous",
    capability,
    invocation_input: input || {},
    effect,
    outcome,
    topic_id: identity.topic_id,
  });
}

function appendOne(store, partial) {
  const envelope = createCopEventEnvelope(partial);
  const result = store.append(envelope);
  if (!result.ok) {
    throw new Error(`governed_act_append_failed:${result.error}`);
  }
  return result;
}

function require(value, name) {
  if (value == null || value === "") throw new TypeError(`${name} is required`);
}
