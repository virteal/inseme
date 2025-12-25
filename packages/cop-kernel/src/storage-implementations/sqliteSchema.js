export const SQLITE_SCHEMA = {
  agentIdentities: `
    CREATE TABLE IF NOT EXISTS agentIdentities (
      agent_id TEXT PRIMARY KEY,
      agent_name TEXT,
      status TEXT
    )
  `,
  tasks: `
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      status TEXT,
      version INTEGER
    )
  `,
  steps: `
    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      status TEXT,
      output TEXT
    )
  `,
  debugLogs: `
    CREATE TABLE IF NOT EXISTS debugLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT,
      level TEXT,
      timestamp TEXT
    )
  `,
  events: `
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      payload TEXT,
      timestamp TEXT
    )
  `,
  schemaVersion: `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT
    )
  `,
};

export const CURRENT_SCHEMA_VERSION = 1;

export function checkTableSchema(db, tableName, expectedColumns) {
  const tableInfo = db.query(`PRAGMA table_info(${tableName})`);
  const actualColumns = new Set(tableInfo.map((row) => row[1])); // row[1] is the column name

  for (const col of expectedColumns) {
    if (!actualColumns.has(col)) {
      console.warn(`Schema mismatch in table ${tableName}: Expected column '${col}' not found.`);
      return false;
    }
  }
  return true;
}
