const WRITABLE_TABLES = new Set([
  "cop_handlers",
  "cop_logical_agents",
  "cop_tasks",
  "cop_steps",
  "cop_events",
  "cop_artifacts",
]);

function requireDatabase(database) {
  if (!database || typeof database.prepare !== "function") {
    throw new TypeError("a DatabaseSync-compatible database is required");
  }
}

function validColumn(column) {
  return /^[a-z][a-z0-9_]*$/.test(column);
}

function parsePermissions(value) {
  try {
    const permissions = JSON.parse(value);
    return Array.isArray(permissions) &&
      permissions.every((permission) => typeof permission === "string")
      ? permissions
      : null;
  } catch {
    return null;
  }
}

/**
 * A local SQLite adapter for the portable COP runtime.
 *
 * It deliberately has no mandate-mutation method: mandate issuance, renewal,
 * suspension and revocation are separate, explicitly authorised administrative
 * operations. The runtime only reads their current state and fails closed when
 * a row is malformed or absent.
 */
export function createSqliteCopRuntimeStore(database) {
  requireDatabase(database);

  return {
    executor: {
      insert(table, row) {
        if (!WRITABLE_TABLES.has(table)) throw new TypeError(`COP table is not writable: ${table}`);
        const columns = Object.keys(row);
        if (columns.length === 0 || !columns.every(validColumn))
          throw new TypeError("COP row has invalid columns");
        const placeholders = columns.map(() => "?").join(", ");
        database
          .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`)
          .run(...Object.values(row));
        return row;
      },
    },

    async resolveMandate(mandateRef) {
      if (typeof mandateRef !== "string" || mandateRef.length === 0) return null;
      const row = database
        .prepare(
          "SELECT mandate_ref, version, status, issuer_ref, grantee_ref, permissions, scope, issued_at, not_before, expires_at, revoked_at, metadata FROM cop_mandates WHERE mandate_ref = ?"
        )
        .get(mandateRef);
      const permissions = row && parsePermissions(row.permissions);
      if (!row || !permissions) return null;
      return {
        ref: row.mandate_ref,
        version: row.version,
        status: row.status,
        issuerRef: row.issuer_ref,
        granteeRef: row.grantee_ref,
        permissions,
        scope: row.scope,
        issuedAt: row.issued_at,
        notBefore: row.not_before,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        metadata: row.metadata,
      };
    },
  };
}
