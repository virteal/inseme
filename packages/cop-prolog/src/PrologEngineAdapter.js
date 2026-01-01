/**
 * PrologEngineAdapter (Abstract)
 * ----------------------------
 * Unified interface for Prolog engines across different runtimes.
 */
export class PrologEngineAdapter {
  /**
   * Loads Prolog facts or rules.
   * @param {string | string[]} facts - Prolog facts as string or array of strings.
   * @returns {Promise<void>}
   */
  async consult(facts) {
    throw new Error("consult() not implemented");
  }

  /**
   * Prepares a query.
   * @param {string} goal - Prolog goal (e.g., "member(X, [1,2,3]).").
   * @returns {Promise<void>}
   */
  async query(goal) {
    throw new Error("query() not implemented");
  }

  /**
   * Iterates over answers asynchronously.
   * @param {function(object): void} callback - Function called for each answer.
   */
  answers(callback) {
    throw new Error("answers() not implemented");
  }

  /**
   * Run a query and return all answers as an array.
   */
  async findAllAnswers() {
    return new Promise((resolve) => {
      const results = [];
      this.answers((ans) => {
        results.push(ans);
      });
      // We need a way to know when it's finished.
      // Since answers() is recursive and calls fail(), we should handle it.
      // For now, let's assume we can add a completion callback to answers().
      setTimeout(() => resolve(results), 200); // Temporary hack
    });
  }

  /**
   * Stops the current query.
   */
  abortQuery() {
    throw new Error("abortQuery() not implemented");
  }

  /**
   * Limits the number of answers.
   * @param {number} n - Maximum number of answers.
   */
  limitResults(n) {
    this._limit = n;
  }
}
