/**
 * Dynamic Model Rate Cards Fetcher & Updater
 *
 * Queries live AI provider model pricing endpoints (e.g. OpenRouter API),
 * converts per-token prices into exact decimal quantities (per 1,000,000 tokens),
 * and updates the authoritative local catalog at packages/cop-core/src/model-rates.json.
 *
 * Usage:
 *   node scripts/ops/update-model-rates.js
 *   node scripts/ops/update-model-rates.js --human
 *
 * @module scripts/ops/update-model-rates
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const insemeRoot = path.resolve(__dirname, "../..");
const targetRatesFile = path.resolve(insemeRoot, "packages/cop-core/src/model-rates.json");

/** Provider Key Mapping from OpenRouter model IDs to canonical COP provider namespaces */
const PROVIDER_ALIASES = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  groq: "groq",
  mistral: "mistral",
  together: "together",
  cohere: "cohere",
  meta: "meta",
};

/**
 * Fetch live pricing from OpenRouter models API.
 *
 * @returns {Promise<object>} Map of provider -> { model_id: { input_per_m, output_per_m, scale } }
 */
export async function fetchLiveModelRates() {
  const url = "https://openrouter.ai/api/v1/models";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Failed to fetch live model pricing: HTTP ${res.status}`);
  }
  const data = await res.json();
  const models = data.data || [];

  const providers = {
    local: {
      default: { input_per_m: 0.0, output_per_m: 0.0, scale: 8 },
    },
  };

  let count = 0;
  for (const m of models) {
    if (!m.id || !m.pricing) continue;
    const parts = m.id.split("/");
    if (parts.length < 2) continue;

    const rawProvider = parts[0].toLowerCase();
    const modelId = parts.slice(1).join("/").toLowerCase();

    const providerKey = PROVIDER_ALIASES[rawProvider] || rawProvider;

    const inputPerToken = parseFloat(m.pricing.prompt || "0");
    const outputPerToken = parseFloat(m.pricing.completion || "0");
    const cachedInputPerToken = parseFloat(m.pricing.input_cache_read || "0");

    // Convert per token -> per 1,000,000 tokens
    const input_per_m = Number((inputPerToken * 1_000_000).toFixed(6));
    const output_per_m = Number((outputPerToken * 1_000_000).toFixed(6));
    const cached_input_per_m =
      cachedInputPerToken > 0 ? Number((cachedInputPerToken * 1_000_000).toFixed(6)) : undefined;

    if (!providers[providerKey]) {
      providers[providerKey] = {};
    }

    providers[providerKey][modelId] = {
      input_per_m,
      output_per_m,
      ...(cached_input_per_m !== undefined ? { cached_input_per_m } : {}),
      scale: 8,
    };

    // Alias mapping for common provider variations (e.g., groq/llama-3.3-70b-versatile -> groq/llama-3.3-70b-versatile)
    if (m.id.includes("llama-3.3-70b")) {
      if (!providers["groq"]) providers["groq"] = {};
      providers["groq"]["llama-3.3-70b-versatile"] = { input_per_m, output_per_m, scale: 8 };
    }

    count++;
  }

  return { providers, fetched_count: count };
}

/**
 * Main execution function to update packages/cop-core/src/model-rates.json.
 */
export async function updateModelRates(options = {}) {
  const { providers, fetched_count } = await fetchLiveModelRates();

  const catalog = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    version: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
    description:
      "Authoritative Model Rate Cards for Provisional COP Accounting (dynamically fetched)",
    source: "https://openrouter.ai/api/v1/models",
    fetched_models_count: fetched_count,
    providers,
    default_fallback: {
      input_per_m: 0.2,
      output_per_m: 0.8,
      scale: 8,
    },
  };

  const jsonStr = JSON.stringify(catalog, null, 2);
  fs.writeFileSync(targetRatesFile, jsonStr, "utf8");

  if (options.human) {
    console.log(`=== MODEL RATE CARDS UPDATED ===`);
    console.log(`Target: ${targetRatesFile}`);
    console.log(`Models Fetched: ${fetched_count}`);
    console.log(`Updated At: ${catalog.updated_at}`);
    console.log(`\nSample Highlights (Current Prices per 1M Tokens):`);

    const samples = [
      ["openai", "gpt-4o-mini"],
      ["openai", "gpt-4o"],
      ["openai", "o1"],
      ["openai", "o3-mini"],
      ["anthropic", "claude-3.5-sonnet"],
      ["google", "gemini-2.5-flash"],
      ["groq", "llama-3.3-70b-versatile"],
    ];

    for (const [p, m] of samples) {
      const card = catalog.providers[p]?.[m];
      if (card) {
        console.log(`  ${p}/${m}: Input $${card.input_per_m} / Output $${card.output_per_m}`);
      }
    }
  }

  return { ok: true, file: targetRatesFile, fetched_count, updated_at: catalog.updated_at };
}

if (process.argv[1] && process.argv[1].endsWith("update-model-rates.js")) {
  const isHuman = process.argv.includes("--human");
  updateModelRates({ human: isHuman })
    .then((res) => {
      if (!isHuman) console.log(JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error("Error updating model rates:", err.message);
      process.exit(1);
    });
}
