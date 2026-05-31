/**
 * timing.js
 *
 * Lightweight, standalone helpers for capturing wall-clock time, CPU time,
 * and human reaction times in COP flows.
 *
 * These can be used independently of the agent context if needed.
 */

export function startStepTiming() {
  return {
    wallStart: Date.now(),
    cpuStart: process.cpuUsage ? process.cpuUsage() : null,
  };
}

export function endStepTiming(timing) {
  if (!timing) return null;

  const wallEnd = Date.now();
  const wallDurationMs = wallEnd - timing.wallStart;

  let cpuDuration = null;
  if (timing.cpuStart && process.cpuUsage) {
    const cpuEnd = process.cpuUsage(timing.cpuStart);
    cpuDuration = {
      user: cpuEnd.user / 1000,
      system: cpuEnd.system / 1000,
    };
  }

  return {
    wallDurationMs,
    cpu: cpuDuration,
    measuredAt: new Date().toISOString(),
  };
}

/**
 * Record that human input/decision was requested.
 */
export function recordHumanInputRequested(options = {}) {
  return {
    requestedAt: new Date().toISOString(),
    requestType: options.requestType || "decision",
  };
}

/**
 * Attach human reaction time when the decision arrives.
 */
export function attachHumanReactionTime(decision, requestedInfo) {
  if (!requestedInfo || !requestedInfo.requestedAt) return decision;

  const reactedAt = new Date().toISOString();
  const reactionTimeMs =
    new Date(reactedAt).getTime() - new Date(requestedInfo.requestedAt).getTime();

  return {
    ...decision,
    performance: {
      ...(decision.performance || {}),
      humanReactionTimeMs: reactionTimeMs,
      requestedAt: requestedInfo.requestedAt,
      reactedAt,
    },
  };
}
