// File: src/services/UserService.js
// Description: Service for managing User entities, extending BaseService with user-specific lookups.

import { eq } from "drizzle-orm";
import { BaseService } from "./BaseService.js";
import { users } from "../common/schema/tables.js";

export class UserService extends BaseService {
  constructor() {
    super(users);
  }

  /**
   * Find a user by their display name (since email is in auth schema)
   * @param {string} displayName
   */
  async getByDisplayName(displayName) {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.display_name, displayName))
      .limit(1);
    return result[0];
  }
}
