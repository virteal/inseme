/**
 * Browser-safe COP kernel entry point.
 *
 * The full kernel entry point also exports Node-only facilities such as stdio,
 * persistence and GitHub webhook verification. The accounting demonstration in
 * the platform only needs deterministic, in-memory arithmetic and projections.
 */
export * from "./accounting/quantity.js";
export * from "./accounting/validator.js";
export * from "./accounting/projector.js";
