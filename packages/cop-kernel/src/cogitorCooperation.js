/**
 * cogitorCooperation.js
 *
 * User-friendly helper APIs for cooperation patterns between Cogitors,
 * inspired by l8's powerful parent/child Task relationships, fork/join,
 * subtasks, and flows (wait for multiple completions, merge results, etc.).
 *
 * These operate at the *Cogitor level* (using stack-call packets with attached
 * continuations for "sub-calls", result delivery via continuation-input as
 * "join callbacks", control plane for supervision, runner for orchestration).
 *
 * Unlike the core Task/Step (which is higher-level orchestration with events),
 * these are tuned for Cogitors (the active "thinkers"/processors that speak
 * the stdio packet protocol).
 *
 * Core idea: make it easy to express "fork these sub-Cogitors with return
 * continuations, wait for all (or any) to complete, collect/merge results
 * and resume the parent flow" -- without manual pending tracking or low-level
 * cont wiring every time.
 *
 * Reuses: createContinuationDescriptor, createStackCallPacket, the runner's
 * pendingContinuations + deliverResult (for the "join" delivery), waitForEvents
 * in conts, meta.parent/fork/joinId for linking.
 *
 * These are "extension" helpers on top of core (continuations, stdio, tasks).
 * Apps/briques/runners can use them to avoid reinventing Cogitor cooperation.
 */

import { createContinuationDescriptor, createStackCallPacket } from "./continuation.js"; // note: continuation.js re-exports or we import direct; adjust if needed
import { genId, nowIso } from "./Cop-kerneltasks.js"; // reuse id/time helpers if exported, else local

// Local fallbacks if not exported
function localGenId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}
function localNowIso() {
  return new Date().toISOString();
}

const _genId = typeof genId === "function" ? genId : localGenId;
const _nowIso = typeof nowIso === "function" ? nowIso : localNowIso;

/**
 * Create a "forked" continuation for a sub-Cogitor call.
 * The sub's result delivery (via runner) will carry parent link in meta/state,
 * allowing collectors/joins to know "this result is for my parent fork".
 *
 * Similar to l8: parent forks subtask, parent collects via forkResults when sub done.
 *
 * @param {Object|string} parentContOrCap - parent continuation or its cap/id
 * @param {Object} subSpec - { cap: targetCapability, stack: [...], spawn?, state?, joinId? }
 * @returns {Object} continuation descriptor (use with runner.resume or emit as stack)
 */
export function createForkedCogitorContinuation(parentContOrCap, subSpec = {}) {
  const parentId =
    typeof parentContOrCap === "string"
      ? parentContOrCap
      : parentContOrCap?.id || parentContOrCap?.envelope?.id || parentContOrCap;

  const subCap = subSpec.cap || subSpec.targetCapability || subSpec.resumeTo;
  if (!subCap) {
    throw new Error("createForkedCogitorContinuation: subSpec.cap (or targetCapability) required");
  }

  const cont = createContinuationDescriptor({
    resumeTo: subCap,
    resumeIntent: subSpec.resumeIntent,
    state: { ...(subSpec.state || {}), parentId },
    correlationId: subSpec.correlationId || _genId(),
    meta: {
      parent: parentId,
      fork: true,
      joinId: subSpec.joinId,
      spawn: subSpec.spawn || subSpec.meta?.spawn,
      ...(subSpec.meta || {}),
    },
  });

  // Also prepare a ready-to-emit stack-call packet for convenience (Cogitor "call with return cont")
  cont._stackCallPacket = createStackCallPacket({
    stack: subSpec.stack || subSpec.args || [],
    continuation: cont, // the sub cont itself carries the parent link for result delivery
    verb: subSpec.verb || "call", // or "process" for streaming sub
    targetCapability: subCap,
    meta: { parent: parentId, fork: true, joinId: subSpec.joinId },
  });

  return cont;
}

/**
 * Create a join/collector continuation for multiple sub-Cogitor results.
 * The runner (or a supervisor Cogitor) can use this to wait for N subs
 * (like l8 parent waiting for forkedTasksCount === 0 and collecting forkResults).
 *
 * Strategy: 'all' (wait all, collect array/map), 'any' (first done wins, like race), 'all-settled'.
 * Uses waitForEvents under the hood for the "sub-done" signals, or relies on
 * runner's deliverResult + joinCollectors (see cli enhancement).
 *
 * When the join completes, it resumes finalResumeTo with the collected results.
 *
 * @param {Array<string|Object>} subIdsOrSpecs - list of sub caps/ids or the fork conts
 * @param {string|Object} finalResumeTo - where to deliver the joined result (cap or cont)
 * @param {Object} [options] - { strategy: 'all'|'any'|'all-settled', timeout?, state? }
 * @returns {Object} { joinId, cont: ContinuationDescriptor, expectedCount }
 */
export function createCogitorJoin(subIdsOrSpecs, finalResumeTo, options = {}) {
  const joinId = options.joinId || _genId();
  const strategy = options.strategy || "all";
  const subs = Array.isArray(subIdsOrSpecs) ? subIdsOrSpecs : [subIdsOrSpecs];

  const expected = subs.length;

  // Build waitFor list (runner or scheduler can emit "cogitor-sub-done:<joinId>:<sub>" events,
  // or the result delivery path checks joinId in cont meta and collects).
  const waitEvents = subs.map((s, idx) => {
    const subId = typeof s === "string" ? s : s.resumeTo || s.id || s.cap || `sub${idx}`;
    return `cogitor-sub-done:${joinId}:${subId}`;
  });

  const finalCap =
    typeof finalResumeTo === "string" ? finalResumeTo : finalResumeTo.resumeTo || finalResumeTo;

  const cont = createContinuationDescriptor({
    resumeTo: finalCap,
    state: {
      joinId,
      strategy,
      collected: {},
      expected,
      subs: subs.map((s) => (typeof s === "string" ? s : s.resumeTo || s.cap || s.id)),
      ...(options.state || {}),
    },
    waitForEvents: strategy === "all" || strategy === "all-settled" ? waitEvents : [],
    meta: {
      type: "cogitor-join",
      joinId,
      strategy,
      parent: options.parent,
      timeout: options.timeout,
    },
    correlationId: options.correlationId || _genId(),
  });

  return { joinId, cont, expectedCount: expected };
}

/**
 * Helper to "attach" a join collector to a parent continuation.
 * When creating forks, pass the joinId so results know where to report for collection.
 * Useful for building l8-like "fork then join" flows at Cogitor level.
 */
export function attachJoinToParentCont(parentCont, joinId) {
  if (!parentCont.meta) parentCont.meta = {};
  parentCont.meta.joinId = joinId;
  if (parentCont.state) parentCont.state.joinId = joinId;
  return parentCont;
}

/**
 * Convenience: create a parent "supervisor" style continuation that forks
 * several subs and joins their results before resuming final.
 * Returns the join cont + array of fork conts (ready to .resume into runner).
 *
 * Example usage (in runner or supervisor code):
 *   const { joinCont, forkConts } = createForkJoinFlow( parentCap, [
 *     { cap: "analyzer1", stack: [doc1] },
 *     { cap: "analyzer2", stack: [doc2], verb: "process" }
 *   ], finalResumeTo, { strategy: "all" });
 *   // then for each forkConts: await nodeManager.resume( forkC, forkC.resumeTo )
 *   // results will be collected and final delivered when all done.
 */
export function createForkJoinFlow(parentCapOrCont, subSpecs, finalResumeTo, options = {}) {
  const parentId =
    typeof parentCapOrCont === "string" ? parentCapOrCont : parentCapOrCont.id || parentCapOrCont;
  const join = createCogitorJoin(
    subSpecs.map((s) => s.cap || s.targetCapability),
    finalResumeTo,
    {
      ...options,
      parent: parentId,
    }
  );

  const forkConts = subSpecs.map((spec) => {
    const specWithJoin = { ...spec, joinId: join.joinId, parent: parentId };
    return createForkedCogitorContinuation(parentCapOrCont, specWithJoin);
  });

  return {
    joinId: join.joinId,
    joinCont: join.cont,
    forkConts,
    expectedCount: subSpecs.length,
  };
}

/**
 * For use inside a Cogitor's onPacket (or supervisor Cogitor):
 * Emit a stack-call packet that "forks" a sub-Cogitor with result going back via a parent cont.
 * This is the "Cogitor level" equivalent of l8 parent forking a subtask.
 */
export function emitCogitorFork(emitFn, parentCont, subSpec, stream = null) {
  const forkCont = createForkedCogitorContinuation(parentCont, subSpec);
  const pkt =
    forkCont._stackCallPacket ||
    createStackCallPacket({
      stack: subSpec.stack || [],
      continuation: forkCont,
      verb: subSpec.verb || "call",
      targetCapability: subSpec.cap,
    });
  if (typeof emitFn === "function") {
    emitFn(pkt, stream);
  }
  return { forkCont, packet: pkt };
}

/**
 * Mark a sub-result as "done for join".
 * In runner or Cogitor that collects, call this (or let runner auto via result delivery + joinId in meta).
 * Emits the wait event or collects directly.
 * (In full impl, the runner's deliverResult checks cont.meta.joinId and feeds the collector.)
 */
export function reportSubCogitorDone(joinId, subId, result, emitEventFn) {
  const eventType = `cogitor-sub-done:${joinId}:${subId}`;
  if (typeof emitEventFn === "function") {
    emitEventFn({ type: eventType, data: { joinId, subId, result, at: _nowIso() } });
  }
  return { eventType, joinId, subId, result };
}

export default {
  createForkedCogitorContinuation,
  createCogitorJoin,
  attachJoinToParentCont,
  createForkJoinFlow,
  emitCogitorFork,
  reportSubCogitorDone,
};
