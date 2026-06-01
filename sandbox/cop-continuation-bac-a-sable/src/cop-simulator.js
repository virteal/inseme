/**
 * cop-simulator.js
 *
 * Simulation minimale des concepts COP pour le bac à sable.
 * But : tester "à blanc" le comportement des continuations et de la causalité
 * sans dépendre (pour l'instant) du vrai cop-kernel.
 *
 * Inspiré de l'esprit Cogentia : structures simples, JSON-first, traçabilité maximale.
 */

let eventCounter = 0;

/**
 * Crée un événement COP minimal (style CloudEvents + extensions COP).
 */
export function createEvent(type, payload = {}, metadata = {}) {
  eventCounter++;
  const now = new Date().toISOString();
  return {
    specversion: "1.0",
    type,
    source: "cop-continuation-bac-a-sable",
    id: `evt-${Date.now()}-${eventCounter}`,
    time: now,
    timestamp: now,
    datacontenttype: "application/json",
    data: payload,
    cop: {
      topicSeq: eventCounter,
      correlationId: metadata.correlationId || null,
      parentEventIds: metadata.parentEventIds || [],
      ...metadata.copExtensions,
    },
  };
}

/**
 * Crée un descripteur de continuation COP (cf. Architecture.md §2.7).
 */
export function createContinuation(params = {}) {
  const id = `cont-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return {
    id,
    type: "cop/continuation",
    resumeTo: params.resumeTo || "unknown-agent",
    resumeIntent: params.resumeIntent || "continue",
    correlationId: params.correlationId || id,
    taskId: params.taskId || null,
    stepId: params.stepId || null,
    state: params.state || {},
    createdAt: new Date().toISOString(),
    conditions: {
      resumeAfter: params.resumeAfter || null,
      resumeBefore: params.resumeBefore || null,
      waitForEvents: params.waitForEvents || [],
    },
  };
}
