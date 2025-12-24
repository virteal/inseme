// ============================================================================
// PROVIDER METRICS - Tracking et cache des performances
// ============================================================================

/**
 * Cache des métriques par provider+model
 * Key format: "provider:model" (e.g., "openai:gpt-5.1")
 */
class ProviderMetricsCache {
  constructor() {
    this.metrics = new Map();
    this.TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Génère une clé unique pour provider+model
   */
  _key(provider, model) {
    return `${provider}:${model}`;
  }

  /**
   * Initialise les métriques pour un provider+model
   */
  _initMetrics(provider, model) {
    return {
      provider,
      model,
      status: "unknown",
      metrics: {
        // Performance
        avgResponseTime: null,
        lastResponseTime: null,
        responseTimes: [], // Dernières 10 réponses pour calculer p95

        // Usage
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        consecutiveErrors: 0,

        // État
        lastUsed: null,
        lastSuccess: null,
        lastError: null,
        lastCheck: Date.now(),
      },
    };
  }

  /**
   * Récupère les métriques (avec vérification TTL)
   */
  get(provider, model) {
    const key = this._key(provider, model);
    const cached = this.metrics.get(key);

    if (!cached) return null;

    // Vérifier TTL
    if (Date.now() - cached.metrics.lastCheck > this.TTL) {
      return null; // Expiré
    }

    return cached;
  }

  /**
   * Met à jour les métriques après un appel réussi
   */
  recordSuccess(provider, model, responseTime) {
    const key = this._key(provider, model);
    let data = this.metrics.get(key) || this._initMetrics(provider, model);

    data.status = "available";
    data.metrics.requestCount++;
    data.metrics.successCount++;
    data.metrics.consecutiveErrors = 0;
    data.metrics.lastResponseTime = responseTime;
    data.metrics.lastUsed = Date.now();
    data.metrics.lastSuccess = Date.now();
    data.metrics.lastCheck = Date.now();

    // Garder les 10 derniers temps de réponse pour stats
    data.metrics.responseTimes.push(responseTime);
    if (data.metrics.responseTimes.length > 10) {
      data.metrics.responseTimes.shift();
    }

    // Calculer moyenne
    data.metrics.avgResponseTime = Math.round(
      data.metrics.responseTimes.reduce((a, b) => a + b, 0) / data.metrics.responseTimes.length
    );

    this.metrics.set(key, data);
    return data;
  }

  /**
   * Met à jour les métriques après une erreur
   */
  recordError(provider, model, error, errorType = "error") {
    const key = this._key(provider, model);
    let data = this.metrics.get(key) || this._initMetrics(provider, model);

    data.status = errorType; // 'error', 'rate_limited', 'quota_exceeded'
    data.metrics.requestCount++;
    data.metrics.errorCount++;
    data.metrics.consecutiveErrors++;
    data.metrics.lastUsed = Date.now();
    data.metrics.lastCheck = Date.now();
    data.metrics.lastError = {
      type: errorType,
      message: error?.message || "Unknown error",
      timestamp: Date.now(),
      retryAfter: this._extractRetryAfter(error),
    };

    this.metrics.set(key, data);
    return data;
  }

  /**
   * Marque un provider+model comme non configuré
   */
  markUnconfigured(provider, model) {
    const key = this._key(provider, model);
    let data = this.metrics.get(key) || this._initMetrics(provider, model);

    data.status = "not_configured";
    data.metrics.lastCheck = Date.now();

    this.metrics.set(key, data);
    return data;
  }

  /**
   * Extrait le retry-after d'une erreur
   */
  _extractRetryAfter(error) {
    if (!error) return null;

    const msg = error.message || "";
    const match = msg.match(/try again in (\d+(?:\.\d+)?)\s*s/i);
    if (match) {
      return Math.ceil(parseFloat(match[1]));
    }

    // Retry-After header (si disponible dans l'erreur)
    if (error.retryAfter) {
      return error.retryAfter;
    }

    return null;
  }

  /**
   * Obtient toutes les métriques valides (non expirées)
   */
  getAllMetrics() {
    const now = Date.now();
    const validMetrics = [];

    for (const [key, data] of this.metrics.entries()) {
      // Skip les métriques expirées
      if (now - data.metrics.lastCheck > this.TTL) {
        continue;
      }

      validMetrics.push(data);
    }

    return validMetrics;
  }

  /**
   * Calcule le taux de succès pour un provider+model
   */
  getSuccessRate(provider, model) {
    const data = this.get(provider, model);
    if (!data || data.metrics.requestCount === 0) return null;

    return data.metrics.successCount / data.metrics.requestCount;
  }

  /**
   * Calcule p95 du temps de réponse
   */
  getP95ResponseTime(provider, model) {
    const data = this.get(provider, model);
    if (!data || data.metrics.responseTimes.length < 5) return null;

    const sorted = [...data.metrics.responseTimes].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index];
  }

  /**
   * Détermine si un provider+model devrait être skippé
   */
  shouldSkip(provider, model) {
    const data = this.get(provider, model);
    if (!data) return false;

    // Skip si pas configuré
    if (data.status === "not_configured") return true;

    // Skip si trop d'erreurs consécutives
    if (data.metrics.consecutiveErrors >= 3) return true;

    // Skip si rate limited et retry-after pas encore passé
    if (data.status === "rate_limited" && data.metrics.lastError?.retryAfter) {
      const retryTime = data.metrics.lastError.timestamp + data.metrics.lastError.retryAfter * 1000;
      if (Date.now() < retryTime) return true;
    }

    return false;
  }

  /**
   * Nettoie les métriques expirées
   */
  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.metrics.entries()) {
      if (now - data.metrics.lastCheck > this.TTL * 2) {
        this.metrics.delete(key);
      }
    }
  }
}

// Instance globale (module-level cache)
export const providerMetrics = new ProviderMetricsCache();

// Cleanup périodique (toutes les 2 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => providerMetrics.cleanup(), 2 * 60 * 1000);
}
