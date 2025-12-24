// File: src/services/AgentExecutorService.js
// Description: Service for AI agents to execute read-only SQL queries with security guardrails and schema introspection.

import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import * as schema from "../schema/tables.js";

export class AgentExecutorService {
  constructor() {
    this.db = db;
  }

  /**
   * Executes a raw SQL query ensuring it is strictly read-only.
   * @param {string} query - The raw SQL query string.
   * @returns {Promise<Array>} - The query results.
   */
  async executeReadOnly(query) {
    if (!this.db) throw new Error("Database not initialized");

    // 1. Sanitize and Validate
    const trimmedQuery = query.trim();

    // Forbidden keywords regex (case insensitive)
    // Matches if the query contains these words as distinct tokens
    const forbiddenPattern =
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE|REPLACE)\b/i;

    if (forbiddenPattern.test(trimmedQuery)) {
      throw new Error("Security Violation: Only READ-ONLY queries (SELECT) are allowed.");
    }

    // Ensure it starts with SELECT or WITH (for CTEs)
    if (!/^(SELECT|WITH)/i.test(trimmedQuery)) {
      throw new Error("Invalid Query: Query must start with SELECT or WITH.");
    }

    try {
      // 2. Execute
      const result = await this.db.execute(sql.raw(trimmedQuery));
      return result;
    } catch (error) {
      throw new Error(`Query Execution Failed: ${error.message}`);
    }
  }

  /**
   * Returns a simplified schema representation for the AI context.
   * Maps Drizzle schema objects to a JSON structure of Table -> Columns.
   * @returns {Object} - { tableName: { columnName: dataType, ... } }
   */
  getSchemaContext() {
    const context = {};

    for (const [key, table] of Object.entries(schema)) {
      // Drizzle 0.45.0+ stores metadata in symbols
      const nameSymbol = Object.getOwnPropertySymbols(table).find(
        (s) => s.toString() === "Symbol(drizzle:Name)"
      );
      const columnsSymbol = Object.getOwnPropertySymbols(table).find(
        (s) => s.toString() === "Symbol(drizzle:Columns)"
      );

      if (!nameSymbol || !table[nameSymbol]) continue;

      const tableName = table[nameSymbol];
      const columns = {};
      const columnsObj = table[columnsSymbol] || table; // Fallback to direct object iteration if symbol missing

      for (const [colName, colConfig] of Object.entries(columnsObj)) {
        if (colConfig && colConfig.name && colConfig.getSQLType) {
          columns[colConfig.name] = colConfig.getSQLType();
        }
      }

      context[tableName] = columns;
    }

    return context;
  }
}
