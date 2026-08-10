import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const BRIQUE_PROFILE_SCHEMA_VERSION = 1;

function asStringArray(value, label) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item)) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return value;
}

/**
 * Loads an instance deployment profile. A profile is deliberately separate
 * from brique manifests: manifests describe what a brique can offer; a
 * profile declares the small subset an instance is allowed to deploy.
 */
export function loadBriqueProfile(profilePath) {
  const resolvedPath = resolve(profilePath);
  if (!existsSync(resolvedPath)) throw new Error(`Brique profile not found: ${resolvedPath}`);

  let profile;
  try {
    profile = JSON.parse(readFileSync(resolvedPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid brique profile JSON at ${resolvedPath}: ${error.message}`);
  }

  if (profile?.schema_version !== BRIQUE_PROFILE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported brique profile schema_version: ${profile?.schema_version ?? "missing"}`
    );
  }
  if (typeof profile.id !== "string" || !profile.id) {
    throw new Error("Brique profile id must be a non-empty string");
  }
  if (typeof profile.host_app !== "string" || !profile.host_app) {
    throw new Error("Brique profile host_app must be a non-empty string");
  }
  if (!Array.isArray(profile.briques)) throw new Error("Brique profile briques must be an array");

  const seen = new Set();
  const briques = profile.briques.map((entry) => {
    if (!entry || typeof entry.id !== "string" || !entry.id) {
      throw new Error("Every brique profile entry needs a non-empty id");
    }
    if (seen.has(entry.id)) throw new Error(`Brique profile repeats id: ${entry.id}`);
    seen.add(entry.id);
    return {
      id: entry.id,
      routes: asStringArray(entry.routes ?? [], `brique ${entry.id}.routes`),
      functions: asStringArray(entry.functions ?? [], `brique ${entry.id}.functions`),
      edge_functions: asStringArray(
        entry.edge_functions ?? [],
        `brique ${entry.id}.edge_functions`
      ),
    };
  });

  const core = profile.core ?? {};
  const runtime = core.runtime;
  if (!runtime || runtime.kind !== "cop-orchestration") {
    throw new Error("core.runtime.kind must be cop-orchestration");
  }
  const requiredPackages = asStringArray(
    runtime.required_packages,
    "core.runtime.required_packages"
  );
  const coreRoutes = asStringArray(core.routes ?? [], "core.routes");
  const coreEdgeFunctions = (core.edge_functions ?? []).map((entry) => {
    if (
      !entry ||
      typeof entry.function !== "string" ||
      typeof entry.path !== "string" ||
      typeof entry.source !== "string"
    ) {
      throw new Error("Every core.edge_functions entry needs function, path, and source strings");
    }
    return { function: entry.function, path: entry.path, source: entry.source };
  });

  return {
    ...profile,
    path: resolvedPath,
    core: {
      ...core,
      runtime: { ...runtime, required_packages: requiredPackages },
      routes: coreRoutes,
      edge_functions: coreEdgeFunctions,
    },
    briques,
  };
}

export function selectBriqueCapabilities(manifest, profile) {
  if (!profile) return manifest;
  const selected = profile.briques.find((entry) => entry.id === manifest.id);
  if (!selected) return null;

  const allowed = (collection, names) => {
    if (!collection) return undefined;
    return Object.fromEntries(Object.entries(collection).filter(([name]) => names.includes(name)));
  };

  return {
    ...manifest,
    routes: (manifest.routes ?? []).filter((route) => selected.routes.includes(route.path)),
    functions: allowed(manifest.functions, selected.functions),
    edgeFunctions: allowed(manifest.edgeFunctions, selected.edge_functions),
    tools: [],
  };
}
