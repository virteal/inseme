// File: src/services/BaseService.js
// Description: Abstract base class providing generic CRUD operations (getById, create, update, delete) using Drizzle ORM.

import { eq } from "drizzle-orm";
import { db } from "../common/db/client.js";

export class BaseService {
  /**
   * @param {import('drizzle-orm/pg-core').PgTable} table - The Drizzle table definition
   */
  constructor(table) {
    this.table = table;
    this.db = db;
  }

  async getById(id) {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    return result[0];
  }

  async create(data) {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.insert(this.table).values(data).returning();
    return result[0];
  }

  async update(id, data) {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db
      .update(this.table)
      .set(data)
      .where(eq(this.table.id, id))
      .returning();
    return result[0];
  }

  async delete(id) {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.delete(this.table).where(eq(this.table.id, id)).returning();
    return result[0];
  }

  // Helper for agent introspection (Phase 2)
  getTableName() {
    return this.table._.name;
  }
}
