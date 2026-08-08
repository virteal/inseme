/**
 * Dynamic Model Rate Cards Resolver
 *
 * Provides dynamic rate card lookups from the live updated catalog in model-rates.json.
 * Supports provider/model alias normalization (e.g. `gpt-4o-2024-08-06` -> `gpt-4o`).
 *
 * @module modelPricing
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultCatalogPath = path.resolve(__dirname, "model-rates.json");

let cachedCatalog = null;

/**
 * Load the model rate cards catalog.
 *
 * @param {string} [customPath] Optional custom catalog file path
 * @returns {object} The parsed rate card catalog
 */
export function loadModelRateCatalog(customPath) {
  const candidates = [
    customPath,
    process.env.OPERIUM_RATE_CARDS_FILE,
    process.env.INSEME_RATE_CARDS_FILE,
    defaultCatalogPath,
    path.resolve(__dirname, "../src/model-rates.json"),
    path.resolve(__dirname, "../model-rates.json"),
  ].filter(Boolean);

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf8");
        cachedCatalog = JSON.parse(data);
        return cachedCatalog;
      }
    } catch {
      // Continue to next candidate
    }
  }

  if (cachedCatalog) return cachedCatalog;

  return {
    providers: {
      openai: {
        "gpt-4o-mini": { input_per_m: 0.15, output_per_m: 0.6, scale: 8 },
        "gpt-4o": { input_per_m: 2.5, output_per_m: 10.0, scale: 8 },
        o1: { input_per_m: 15.0, output_per_m: 60.0, scale: 8 },
        "o3-mini": { input_per_m: 1.1, output_per_m: 4.4, scale: 8 },
      },
    },
    default_fallback: { input_per_m: 0.2, output_per_m: 0.8, scale: 8 },
  };
}

/**
 * Get rate card for a given provider and model.
 *
 * @param {string} provider Provider name (e.g. "openai")
 * @param {string} model Model name (e.g. "gpt-4o-mini")
 * @returns {{ input_per_m: number, output_per_m: number, cached_input_per_m?: number, scale: number, rate_basis: string }}
 */
export function getModelRateCard(provider, model) {
  const catalog = loadModelRateCatalog();
  const normProvider = String(provider || "openai").toLowerCase();
  const rawModel = String(model || "gpt-4o-mini").toLowerCase();

  // Strip date snapshots (e.g. gpt-4o-2024-08-06 -> gpt-4o) if direct match fails
  const normModel = rawModel.replace(/-\d{4}-\d{2}-\d{2}$/, "");

  const providerObj = catalog.providers?.[normProvider] || {};
  const card = providerObj[rawModel] || providerObj[normModel];

  if (card) {
    return {
      input_per_m: card.input_per_m,
      output_per_m: card.output_per_m,
      cached_input_per_m: card.cached_input_per_m,
      scale: card.scale || 8,
      rate_basis: `rate:${normProvider}:${normModel}:${catalog.version || "live"}`,
    };
  }

  // Fallback
  const fb = catalog.default_fallback || { input_per_m: 0.2, output_per_m: 0.8, scale: 8 };
  return {
    input_per_m: fb.input_per_m,
    output_per_m: fb.output_per_m,
    scale: fb.scale || 8,
    rate_basis: `rate:fallback:default:${catalog.version || "live"}`,
  };
}
