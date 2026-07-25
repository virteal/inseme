import { sha256Fingerprint } from "./hash.js";

/**
 * Build an inspectable raw→normalized diff report.
 * Uses a simple LCS line diff so the result is deterministic and free of deps.
 *
 * @param {string} rawText
 * @param {string} normalizedText
 * @param {string[]} [removedNoiseKinds]
 */
export function buildNormalizationDiff(rawText, normalizedText, removedNoiseKinds = []) {
  const rawLines = splitLines(rawText);
  const normLines = splitLines(normalizedText);
  const lineOps = lcsLineOps(rawLines, normLines);

  return {
    algorithm: "lcs-line-ops-v1",
    raw_fingerprint: sha256Fingerprint(rawText),
    normalized_fingerprint: sha256Fingerprint(normalizedText),
    stats: {
      raw_bytes: byteLength(rawText),
      normalized_bytes: byteLength(normalizedText),
      raw_lines: rawLines.length,
      normalized_lines: normLines.length,
      ops_equal: lineOps.filter((op) => op.op === "equal").length,
      ops_remove: lineOps.filter((op) => op.op === "remove").length,
      ops_add: lineOps.filter((op) => op.op === "add").length,
    },
    removed_noise_kinds: [...removedNoiseKinds].sort(),
    line_ops: lineOps,
  };
}

/**
 * @param {string} text
 */
function splitLines(text) {
  if (text === "") return [];
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

/**
 * @param {string} text
 */
function byteLength(text) {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Classic LCS backtrace as equal / remove / add ops.
 * @param {string[]} a
 * @param {string[]} b
 */
function lcsLineOps(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ op: "equal", text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: "remove", text: a[i] });
      i += 1;
    } else {
      ops.push({ op: "add", text: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ op: "remove", text: a[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ op: "add", text: b[j] });
    j += 1;
  }
  return ops;
}
