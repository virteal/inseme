/**
 * Minimal governed Act chain for JHN usability gate (Inseme #33 / #31 Phase 4).
 *
 * CapabilityInvocation → Act → Trace → Imputation
 *
 * Backend-independent; appends to any store with .append().
 */

import { randomUUID } from "node:crypto";
import { createCopEventEnvelope } from "./cop-event-envelope.js";
import { normalizeResourceAssessments } from "./resource-assessment.js";

/**
 * @typedef {object} GovernedActInput
 * @property {string} principal_ref
 * @property {string} mandate_ref  e.g. mandate:MND-JHN-…@v1
 * @property {string} logical_agent_ref  e.g. agent:jhn
 * @property {string} handler_instance_ref  e.g. handler:openai-reasoner@local
 * @property {string} capability  e.g. coding.reply or repo.read
 * @property {object} [invocation_input]
 * @property {object} [effect] result/evidence after handler runs
 * @property {object[]} [resource_assessments] exact native measurements or explicit non-estimation records
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
      resource_assessments: normalizeResourceAssessments(input.resource_assessments || []),
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
      resource_assessments: normalizeResourceAssessments(input.resource_assessments || []),
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
      packet_id: input.packet_id || input.packet?.packet_id || null,
      provisional_cost: input.provisional_cost || null,
      resource_assessments: normalizeResourceAssessments(input.resource_assessments || []),
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

  // Token usage alone does not prove a monetary cost. This matters for
  // subscription- and quota-backed providers, whose marginal price may be
  // unknowable. Callers may provide an explicit, source-bounded valuation;
  // otherwise retain native measurements or a not_estimated assessment.
  const provisional_cost = options.provisional_cost || null;
  const resource_assessments = normalizeResourceAssessments(
    options.resource_assessments || effect?.resource_assessments || []
  );
  const packet_id = options.packet_id || options.packet?.packet_id || null;

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
    packet_id,
    provisional_cost,
    resource_assessments,
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

/**
 * U5 — record mandate or handler suspension/revocation before further Acts.
 * Stale results remain in the log; callers must check isMandateActive.
 *
 * @param {object} store
 * @param {object} input
 * @param {string} input.principal_ref
 * @param {string} input.mandate_ref
 * @param {string} [input.logical_agent_ref]
 * @param {string} [input.handler_instance_ref]
 * @param {'suspend'|'revoke'} input.action
 * @param {string} [input.reason]
 * @param {string} [input.topic_id]
 */
export function recordMandateControl(store, input) {
  require(input.principal_ref, "principal_ref");
  require(input.mandate_ref, "mandate_ref");
  const action = input.action === "suspend" ? "suspend" : "revoke";
  const controlId = randomUUID();
  const topicId = input.topic_id || `mandate-control:${input.mandate_ref}`;

  const result = store.append(
    createCopEventEnvelope({
      topic_id: topicId,
      epistemic_status: "normative",
      actor_ref: input.principal_ref,
      subject_ref: input.logical_agent_ref || input.mandate_ref,
      mandate_ref: input.mandate_ref,
      visibility: "restricted",
      payload: {
        kind: "MandateControl",
        control_id: controlId,
        action,
        principal_ref: input.principal_ref,
        mandate_ref: input.mandate_ref,
        logical_agent_ref: input.logical_agent_ref || null,
        handler_instance_ref: input.handler_instance_ref || null,
        reason: input.reason || null,
        effective_at: new Date().toISOString(),
      },
      idempotency_key: `mandate-control:${input.mandate_ref}:${action}:${controlId}`,
    })
  );

  if (!result.ok) {
    throw new Error(`mandate_control_append_failed:${result.error}`);
  }

  return {
    ok: true,
    control_id: controlId,
    action,
    mandate_ref: input.mandate_ref,
    event: result.event,
    receipt: {
      schema: "cop.mandate-control.receipt.v1",
      control_id: controlId,
      action,
      mandate_ref: input.mandate_ref,
      principal_ref: input.principal_ref,
      event_id: result.event.event_id,
    },
  };
}

/**
 * Whether a mandate is still active given append-only control events.
 * Latest MandateControl for the mandate_ref wins (revoke/suspend → inactive).
 *
 * @param {object} store
 * @param {string} mandateRef
 */
export function isMandateActive(store, mandateRef) {
  require(mandateRef, "mandateRef");
  const events =
    typeof store.replay === "function" ? store.replay() : Array.isArray(store) ? store : [];
  const controls = events
    .filter(
      (e) =>
        e.payload?.kind === "MandateControl" &&
        (e.payload.mandate_ref === mandateRef || e.mandate_ref === mandateRef)
    )
    .sort((a, b) => {
      const ta = a.time?.recorded_at || a.payload?.effective_at || "";
      const tb = b.time?.recorded_at || b.payload?.effective_at || "";
      return ta.localeCompare(tb);
    });
  if (controls.length === 0) return true;
  const last = controls[controls.length - 1];
  const action = last.payload?.action;
  return action !== "revoke" && action !== "suspend";
}

/**
 * Refuse to record a governed Act if mandate is suspended/revoked.
 */
export function recordGovernedActIfActive(store, input) {
  if (!isMandateActive(store, input.mandate_ref)) {
    return {
      ok: false,
      error: "mandate_inactive",
      act_id: null,
      events: [],
      receipt: null,
    };
  }
  return recordGovernedAct(store, input);
}
