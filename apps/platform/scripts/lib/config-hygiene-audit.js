const BOOTSTRAP_ENV_NAMES = new Set([
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "VITE_SUPABASE_ANON_KEY",
]);

const WORKSTATION_ONLY_ENV_NAMES = new Set([
  "DATABASE_URL",
  "POSTGRES_URL",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "VITE_PROXY_URL",
]);

function normalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function vaultValue(row) {
  return row?.value_json ?? row?.value ?? null;
}

function metadata(row) {
  return row
    ? {
        is_secret: row.is_secret ?? null,
        is_public: row.is_public ?? null,
        version: row.version ?? null,
        updated_at: row.updated_at ?? null,
      }
    : null;
}

function invertedMapping(mapping) {
  const result = new Map();
  for (const [configKey, envNames] of Object.entries(mapping)) {
    for (const envName of envNames) result.set(envName, configKey);
  }
  return result;
}

/**
 * Compare local configuration caches with instance_config without returning
 * values, fingerprints, lengths, or other secret-derived material.
 */
export function auditConfigHygiene({
  instance,
  vaultRows,
  cacheTargets,
  envKeyMapping,
  policyRegistry = null,
}) {
  const byVaultKey = new Map((vaultRows || []).map((row) => [row.key, row]));
  const byEnvKey = invertedMapping(envKeyMapping);
  const records = [];

  for (const target of cacheTargets || []) {
    for (const [envKey, value] of Object.entries(target.values || {})) {
      const policy = policyRegistry?.env?.get(envKey) || null;
      if (policy?.classification === "local_review") {
        records.push({
          target: target.id,
          env_key: envKey,
          config_key: policy.key,
          status: "local_policy_review_required",
          policy: policy.classification,
        });
        continue;
      }
      if (BOOTSTRAP_ENV_NAMES.has(envKey)) {
        records.push({ target: target.id, env_key: envKey, status: "bootstrap_excluded" });
        continue;
      }
      if (WORKSTATION_ONLY_ENV_NAMES.has(envKey)) {
        records.push({ target: target.id, env_key: envKey, status: "workstation_only_excluded" });
        continue;
      }
      if (envKey.startsWith("VITE_")) {
        records.push({ target: target.id, env_key: envKey, status: "public_runtime_candidate" });
        continue;
      }

      const configKey = byEnvKey.get(envKey);
      if (!configKey) {
        records.push({ target: target.id, env_key: envKey, status: "unmapped_local_key" });
        continue;
      }

      const row = byVaultKey.get(configKey);
      records.push({
        target: target.id,
        env_key: envKey,
        config_key: configKey,
        status: !row
          ? "missing_in_vault"
          : normalize(vaultValue(row)) === normalize(value)
            ? "matches_vault"
            : "differs_from_vault",
        vault: metadata(row),
        policy: policy?.classification || null,
      });
    }
  }

  const metadataIssues = (vaultRows || []).flatMap((row) => {
    const policy = policyRegistry?.entries?.get(row.key) || null;
    if (!policy) return [{ key: row.key, status: "registry_missing", vault: metadata(row) }];
    if (row.is_secret === null || row.is_public === null) {
      return [
        {
          key: row.key,
          status: "unclassified_vault_key",
          vault: metadata(row),
          policy: policy.classification,
        },
      ];
    }
    if (
      row.is_secret !== policy.expected.is_secret ||
      row.is_public !== policy.expected.is_public
    ) {
      return [
        {
          key: row.key,
          status: "metadata_policy_mismatch",
          vault: metadata(row),
          policy: policy.classification,
        },
      ];
    }
    return [];
  });
  const requiredVaultIssues = policyRegistry
    ? [...policyRegistry.entries.values()].flatMap((policy) => {
        if (!policy.required) return [];
        const row = byVaultKey.get(policy.key);
        if (!row)
          return [
            {
              key: policy.key,
              status: "required_vault_key_missing",
              policy: policy.classification,
            },
          ];
        if (normalize(vaultValue(row)) === "") {
          return [
            {
              key: policy.key,
              status: "required_vault_value_missing",
              policy: policy.classification,
            },
          ];
        }
        return [];
      })
    : [];

  const summary = Object.fromEntries(
    [
      "matches_vault",
      "differs_from_vault",
      "missing_in_vault",
      "unmapped_local_key",
      "bootstrap_excluded",
      "workstation_only_excluded",
      "public_runtime_candidate",
      "local_policy_review_required",
    ].map((status) => [status, records.filter((record) => record.status === status).length])
  );

  return {
    schema: "cogentia.config_hygiene_audit.v0",
    instance,
    read_only: true,
    policy: policyRegistry
      ? { version: policyRegistry.version, instance: policyRegistry.instance }
      : null,
    summary: {
      ...summary,
      metadata_issues: metadataIssues.length,
      required_vault_issues: requiredVaultIssues.length,
      unclassified_vault_keys: metadataIssues.filter(
        (issue) => issue.status === "unclassified_vault_key"
      ).length,
      metadata_policy_mismatches: metadataIssues.filter(
        (issue) => issue.status === "metadata_policy_mismatch"
      ).length,
      registry_missing: metadataIssues.filter((issue) => issue.status === "registry_missing")
        .length,
    },
    records,
    metadata_issues: metadataIssues,
    required_vault_issues: requiredVaultIssues,
  };
}
