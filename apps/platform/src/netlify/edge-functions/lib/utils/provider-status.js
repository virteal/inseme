// ============================================================================
// PROVIDER STATUS - Génération du statut pour frontend
// ============================================================================

import { providerMetrics } from "./provider-metrics.js";
import { MODEL_MODES } from "./model-resolver.js";

/**
 * Génère le statut complet de tous les providers pour le frontend
 *
 * @param {Object} providers - Map des providers initialisés
 * @returns {Array} Liste des statuts de providers
 */
export function generateProvidersStatus(providers) {
  const statuses = [];

  for (const [providerName, provider] of Object.entries(providers)) {
    // Vérifier si le provider est configuré
    if (!provider.isAvailable()) {
      statuses.push({
        name: providerName,
        status: "not_configured",
        models: [],
      });
      continue;
    }

    // Récupérer les modèles disponibles pour ce provider
    const availableModels = MODEL_MODES[providerName] || {};
    const modelsList = [];

    for (const [mode, modelName] of Object.entries(availableModels)) {
      // Récupérer les métriques pour ce model spécifique
      const metrics = providerMetrics.get(providerName, modelName);

      const modelStatus = {
        name: modelName,
        mode,
        status: metrics?.status || "unknown",
      };

      // Ajouter les métriques de performance si disponibles
      if (metrics?.metrics) {
        const m = metrics.metrics;

        if (m.lastResponseTime !== null) {
          modelStatus.lastResponseTime = m.lastResponseTime;
        }

        if (m.avgResponseTime !== null) {
          modelStatus.avgResponseTime = m.avgResponseTime;
        }

        if (m.requestCount > 0) {
          modelStatus.successRate = Math.round((m.successCount / m.requestCount) * 100);
        }

        // Info sur l'état
        if (m.consecutiveErrors > 0) {
          modelStatus.consecutiveErrors = m.consecutiveErrors;
        }

        // Info sur le retry (si rate limited)
        if (metrics.status === "rate_limited" && m.lastError?.retryAfter) {
          const retryTime = m.lastError.timestamp + m.lastError.retryAfter * 1000;
          const secondsUntilRetry = Math.max(0, Math.ceil((retryTime - Date.now()) / 1000));
          if (secondsUntilRetry > 0) {
            modelStatus.retryAfter = secondsUntilRetry;
          }
        }

        // Marquer le model utilisé récemment
        if (m.lastUsed && Date.now() - m.lastUsed < 30000) {
          modelStatus.recentlyUsed = true;
        }
      }

      modelsList.push(modelStatus);
    }

    // Déterminer le statut global du provider
    let providerStatus = "available";

    if (modelsList.length === 0 || modelsList.every((m) => m.status === "unknown")) {
      providerStatus = "unknown";
    } else if (modelsList.some((m) => m.status === "error" || m.status === "quota_exceeded")) {
      providerStatus = "degraded";
    } else if (modelsList.every((m) => m.status === "rate_limited")) {
      providerStatus = "rate_limited";
    }

    statuses.push({
      name: providerName,
      status: providerStatus,
      models: modelsList,
    });
  }

  return statuses;
}

/**
 * Formate le statut en ligne SSE pour le stream
 * @param {Object} providers - Map des providers
 * @returns {string} Ligne SSE formatée
 */
export function formatProvidersStatusSSE(providers) {
  const PROVIDERS_STATUS_PREFIX = "__PROVIDERS_STATUS__";
  const status = generateProvidersStatus(providers);
  return `${PROVIDERS_STATUS_PREFIX}${JSON.stringify({ providers: status })}\n`;
}
