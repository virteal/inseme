// @file: TODO
// @description: TODO

// Note: this is not an implementation of a storage, just a helper to log messages

import * as fs from "node:fs/promises";
import * as path from "node:path";

export function createAuditLogger(options = {}) {
  const { auditLogPath = "./audit_logs.jsonl" } = options;
  const fullPath = path.isAbsolute(auditLogPath)
    ? auditLogPath
    : path.join(process.cwd(), auditLogPath);

  async function logEvent(event) {
    const logEntry = JSON.stringify({ ...event, timestamp: new Date().toISOString() }) + "\n";
    await fs.appendFile(fullPath, logEntry);
  }

  return {
    logEvent,
  };
}
