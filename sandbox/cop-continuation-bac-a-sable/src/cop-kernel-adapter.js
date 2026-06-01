/**
 * cop-kernel-adapter.js
 *
 * Pont vers le vrai cop-kernel.
 *
 * Philosophie : on essaie d'utiliser le maximum de code réel dès que possible
 * pour faire converger COP et Cogentia et faciliter l'implémentation réelle.
 * Quand quelque chose ne marche pas encore dans cop-kernel, on le signale clairement.
 */

import { COPBus, defaultBus, createFractanetBus } from "../../../packages/cop-kernel/src/bus.js";

import { COPScheduler, defaultScheduler } from "../../../packages/cop-kernel/src/scheduler.js";

import { COPJobScheduler } from "../../../packages/cop-kernel/src/jobScheduler.js";

let realCall, realResume;

try {
  const mod = await import("../../../packages/cop-kernel/src/call.js");
  realCall = mod.callAgentWithContinuation;
  realResume = mod.resumeContinuationAndSend;
  console.log(
    "[ADAPTER] Vrai code cop-kernel chargé avec succès (bus + scheduler + jobScheduler inclus)."
  );
} catch (e) {
  console.warn("[ADAPTER] Impossible de charger certains modules de cop-kernel :", e.message);
}

// Create a default higher-level JobScheduler wired to the low-level components.
// This is the main stable entry point for scheduling resumable work with backoff/obsolescence.
const defaultJobScheduler = new COPJobScheduler({
  scheduler: defaultScheduler,
  bus: defaultBus,
  // store is intentionally left undefined for now (in-memory only).
  // When persistence is added to the kernel, it can be injected here.
});

export {
  COPBus,
  defaultBus,
  createFractanetBus,
  COPScheduler,
  defaultScheduler,
  COPJobScheduler,
  defaultJobScheduler,
};

// Helper so scenarios can easily get per-topic buses from the default scheduler
export function getBusForTopic(topicId) {
  return defaultScheduler.getBusForTopic(topicId);
}

export async function callAgentWithContinuationInSandbox(params) {
  const hasEndpoint = params.endpoint || params.baseUrl;

  if (realCall && hasEndpoint) {
    console.log(
      "[ADAPTER] Utilisation de callAgentWithContinuation (vrai cop-kernel + transport réel)"
    );
    return realCall(params);
  }

  if (realCall && !hasEndpoint) {
    console.log(
      "[ADAPTER] Vrai code cop-kernel disponible, mais mode bac-à-sable (pas de endpoint) → création du descriptor seulement via logique interne"
    );
    // On peut quand même créer le descriptor pour tester la convergence
    const { createContinuationDescriptor } =
      await import("../../../packages/cop-kernel/src/continuation.js");
    const cont = createContinuationDescriptor(params);
    return {
      ok: true,
      continuation: cont,
      note: "descriptor créé via vrai cop-kernel (sans envoi réseau)",
    };
  }

  console.log("[ADAPTER] Fallback local complet");
  return {
    ok: true,
    continuation: {
      continuationId: "cont-fallback-" + Date.now(),
      resumeTo: params.resumeTo,
      resumeIntent: params.resumeIntent,
      correlationId: params.correlationId,
      state: params.payload || {},
    },
  };
}

export async function resumeContinuationInSandbox(params) {
  if (realResume) {
    console.log("[ADAPTER] Utilisation de resumeContinuationAndSend (vrai cop-kernel)");
    return realResume(params);
  }

  console.log("[ADAPTER] Fallback local pour reprise");
  return { ok: true };
}
