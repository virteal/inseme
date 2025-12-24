// File: src/agents/SqlAgent.js
// Description: Skeleton Agent logic that utilizes the AgentExecutorService for database interaction.
// This serves as the foundation for AI-driven SQL generation and execution.

import { AgentExecutorService } from "../services/AgentExecutorService.js";

export class SqlAgent {
  constructor() {
    this.executor = new AgentExecutorService();
  }

  /**
   * Retrieves the database schema to understand available tables and columns.
   * @returns {Promise<Object>} The schema context (Table -> Columns).
   */
  async getContext() {
    // In a real agent, this would be injected into the System Prompt.
    return this.executor.getSchemaContext();
  }

  /**
   * Executes a task by running a generated SQL query.
   * For this skeleton, it takes the raw query directly (simulating the LLM's output).
   *
   * @param {string} query - The SQL query to execute.
   * @returns {Promise<any>} The query results.
   */
  async run(query) {
    console.log(`🤖 Agent executing query: ${query}`);
    try {
      const results = await this.executor.executeReadOnly(query);
      return {
        status: "success",
        count: results.length,
        data: results,
      };
    } catch (error) {
      console.error("🤖 Agent execution error:", error.message);
      return {
        status: "error",
        message: error.message,
      };
    }
  }
}
