/**
 * Typed error for Ritornu boundary violations and validation failures.
 */
export class RitornuError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RitornuError";
    this.code = code;
    this.details = details;
  }
}
