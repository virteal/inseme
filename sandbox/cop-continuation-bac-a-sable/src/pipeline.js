/**
 * pipeline.js
 *
 * Moteur de pipeline style Cogentia pour le bac à sable COP.
 * Chaque scénario est une suite d'étapes claires.
 * Chaque étape peut :
 *   - émettre des événements COP
 *   - créer/suspendre une continuation
 *   - reprendre une continuation
 *
 * Tout est tracé de façon structurée pour reproductibilité et testabilité.
 */

import { createEvent } from "./cop-simulator.js";
import { loadScenario } from "./scenario-loader.js";
import {
  callAgentWithContinuationInSandbox,
  resumeContinuationInSandbox,
  COPBus,
  defaultBus,
  createFractanetBus,
  COPScheduler,
  defaultScheduler,
  getBusForTopic,
  COPJobScheduler,
  defaultJobScheduler,
} from "./cop-kernel-adapter.js";

// Re-export for scenarios that import directly from pipeline
export { createFractanetBus } from "./cop-kernel-adapter.js";

/**
 * Exécute un scénario de test de continuations.
 * @param {string} scenarioName
 * @param {{ scenariosDir: string }} options
 */
export async function runScenario(scenarioName, { scenariosDir }) {
  console.log(`\n=== BAC À SABLE COP — Exécution du scénario : ${scenarioName} ===\n`);

  const scenario = await loadScenario(scenarioName, scenariosDir);
  if (!scenario) {
    console.error(`Scénario introuvable : ${scenarioName}`);
    process.exit(1);
  }

  const trace = [];
  const activeContinuations = new Map();

  // Automatically set currentTopicId if the scenario declares a default
  const autoTopicId = scenario.defaultTopicId || scenario.topicId || null;

  // Contexte partagé du pipeline (similaire à Cogentia)
  const context = {
    scenario: scenarioName,
    trace,
    activeContinuations,

    // Auto-populated for convenience in Fractanet-style scenarios
    currentTopicId: autoTopicId,

    // Real COP primitives now available in scenarios
    bus: defaultBus,
    // Fractanet / federation primitives
    createSubBus: (namespace) => defaultBus.sub(namespace),
    createFractanetBus: (name) => (createFractanetBus ? createFractanetBus(name) : defaultBus),
    getBusForTopic: (topicId) =>
      getBusForTopic ? getBusForTopic(topicId) : defaultBus.forTopic(topicId),

    scheduler: defaultScheduler,
    jobScheduler: defaultJobScheduler, // Higher-level COPJobScheduler (with backoff + obsolescence)

    emit: (event) => {
      trace.push(event);
      console.log(`[EVENT] ${event.type} @ ${event.timestamp || event.time}`);
    },

    // Smart helper: returns a per-topic sub-bus if context.currentTopicId is set
    busForCurrentTopic: () => {
      const tid = context.currentTopicId || context.topicId;
      if (tid && getBusForTopic) return getBusForTopic(tid);
      if (tid) return defaultBus.forTopic(tid);
      return defaultBus;
    },

    // === Federation helpers (Fractanet) ===
    createFederatedBusPair: (nameA = "node-a", nameB = "node-b") => {
      const busA = createFractanetBus ? createFractanetBus(nameA) : defaultBus;
      const busB = createFractanetBus ? createFractanetBus(nameB) : defaultBus;
      busA.federate(busB);
      return { busA, busB };
    },

    // Very convenient for Fractanet demos: returns two already-federated topic-scoped buses
    createFederatedTopicBusPair: (topicId = null) => {
      const tid = topicId || context.currentTopicId;
      if (!tid)
        throw new Error(
          "createFederatedTopicBusPair requires a topicId (or set context.currentTopicId)"
        );

      const { busA, busB } = createFractanetBus
        ? { busA: createFractanetBus("node-a"), busB: createFractanetBus("node-b") }
        : { busA: defaultBus, busB: defaultBus };

      busA.federate(busB);

      return {
        topicBusA: busA.forTopic(tid),
        topicBusB: busB.forTopic(tid),
        busA,
        busB,
        topicId: tid,
      };
    },

    federateBuses: (bus1, bus2) => {
      if (bus1 && typeof bus1.federate === "function") bus1.federate(bus2);
      return { bus1, bus2 };
    },

    propagateInterest: (pattern) => {
      if (defaultBus && typeof defaultBus.propagateInterest === "function") {
        defaultBus.propagateInterest(pattern);
      }
    },

    // Version qui utilise le vrai code de cop-kernel
    callWithContinuation: async (params) => {
      const result = await callAgentWithContinuationInSandbox(params);
      // On trace aussi l'événement localement pour la traçabilité du bac à sable
      const event = createEvent("cop.call_with_continuation", {
        from: params.from,
        to: params.to,
        intent: params.intent,
        continuation: result.continuation,
      });
      trace.push(event);
      return result;
    },

    resumeContinuation: async (params) => {
      const result = await resumeContinuationInSandbox(params);
      const event = createEvent("cop.resume_continuation", {
        continuationId: params.continuation?.id,
        payload: params.payload,
      });
      trace.push(event);
      return result;
    },

    // Helpers legacy pour les scénarios simples (à migrer progressivement)
    suspend: (continuation) => {
      activeContinuations.set(continuation.id || continuation.continuationId, continuation);
      const event = createEvent("continuation.suspended", {
        continuationId: continuation.id || continuation.continuationId,
      });
      trace.push(event);
      console.log(`[SUSPEND] Continuation ${continuation.id || continuation.continuationId} créée`);
    },

    resume: (continuationId, payload = {}) => {
      const cont = activeContinuations.get(continuationId);
      if (!cont) {
        console.warn(`Continuation ${continuationId} introuvable`);
        return;
      }
      const event = createEvent("continuation.resumed", { continuationId, payload });
      trace.push(event);
      activeContinuations.delete(continuationId);
      console.log(`[RESUME] Continuation ${continuationId} reprise`);
      return cont;
    },
  };

  // Exécution du pipeline d'étapes (style Cogentia)
  for (const step of scenario.steps) {
    console.log(`\n--- Étape : ${step.name} ---`);
    const event = createEvent("step.started", { step: step.name });
    trace.push(event);

    try {
      if (typeof step.run === "function") {
        await step.run(context);
      } else {
        console.log(`  (étape déclarative : ${step.description || "aucune action"})`);
      }
    } catch (err) {
      const errorEvent = createEvent("step.error", { step: step.name, error: err.message });
      trace.push(errorEvent);
      console.error(`Erreur dans l'étape ${step.name}:`, err.message);
      throw err;
    }

    const endEvent = createEvent("step.completed", { step: step.name });
    trace.push(endEvent);
  }

  console.log("\n=== Exécution terminée ===");
  console.log(`Événements générés : ${trace.length}`);
  console.log(`Continuations actives en fin de run : ${activeContinuations.size}`);

  // Sauvegarde automatique de la trace (traçabilité forte)
  const traceFile = `trace-${scenarioName}-${Date.now()}.jsonl`;
  // Pour l'instant on log juste — on ajoutera l'écriture fichier dans une prochaine passe
  console.log(
    `\nTrace complète disponible en mémoire (à sauvegarder dans ${traceFile} dans les prochaines itérations).`
  );

  return { trace, activeContinuations };
}
