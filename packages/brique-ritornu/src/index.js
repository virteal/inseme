/**
 * Public, dependency-free constants for the Ritornu integration boundary.
 * No platform access, capture, browser control, or Git integration belongs here.
 */
export const BRIQUE_ID = "ritornu";
export const BRIQUE_STATUS = "skeleton";

export const RETROFIT_STATES = Object.freeze([
  "capture",
  "candidate",
  "review-request",
  "handoff",
  "watch-change",
]);

export const NON_NEGOTIABLE_BOUNDARIES = Object.freeze([
  "private-capture-storage",
  "human-review-before-corpus-handoff",
  "no-direct-git-write",
  "no-recursive-collection",
  "no-authentication-or-bypass",
]);
