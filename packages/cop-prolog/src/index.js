import { TauPrologAdapter } from "./TauPrologAdapter.js";

/**
 * Detects the current environment.
 */
export function detectEnvironment() {
  if (typeof window !== "undefined" && typeof window.document !== "undefined") {
    return "browser";
  }
  if (typeof Deno !== "undefined") {
    return "deno";
  }
  if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node
  ) {
    return "node";
  }
  return "unknown";
}

/**
 * Factory function to create a Prolog engine based on environment.
 */
export async function createPrologEngine(options = {}) {
  const env = detectEnvironment();

  let pl;
  if (env === "deno") {
    // Deno/Edge environment
    const mod = await import("https://esm.sh/tau-prolog@0.3.4");
    pl = mod.default || mod;
  } else if (env === "node") {
    // Node.js environment
    const mod = await import("tau-prolog");
    pl = mod.default || mod;
  } else {
    // Browser or fallback
    if (typeof window !== "undefined" && window.pl) {
      pl = window.pl;
    } else {
      const mod = await import("https://esm.sh/tau-prolog@0.3.4");
      pl = mod.default || mod;
    }
  }

  return new TauPrologAdapter(pl);
}

export { PrologEngineAdapter } from "./PrologEngineAdapter.js";
export { TauPrologAdapter } from "./TauPrologAdapter.js";
