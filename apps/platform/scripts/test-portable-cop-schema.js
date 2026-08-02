import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const migrationUrl = new URL(
  "../supabase/migrations/20260801120000_cop_runtime_portable_tables.sql",
  import.meta.url
);
const migration = await readFile(migrationUrl, "utf8");
const database = new DatabaseSync(":memory:");
const now = "2026-08-01T12:00:00.000Z";

try {
  assert.doesNotMatch(
    migration,
    /\b(uuid|jsonb|timestamptz|pgcrypto|create\s+(?:or\s+replace\s+)?function|create\s+trigger|create\s+policy)\b/i,
    "portable migration must not depend on PostgreSQL-only schema features"
  );

  database.exec("PRAGMA foreign_keys = ON");
  database.exec(migration);

  const tableNames = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map(({ name }) => name);
  assert.deepEqual(tableNames, [
    "cop_artifacts",
    "cop_events",
    "cop_handlers",
    "cop_logical_agents",
    "cop_mandates",
    "cop_steps",
    "cop_tasks",
  ]);

  database
    .prepare(
      "INSERT INTO cop_handlers (handler_name, handler_kind, module_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run("handler:jhn:coordinator", "runtime", "@inseme/cop-kernel", now, now);
  database
    .prepare(
      "INSERT INTO cop_logical_agents (logical_agent_id, logical_agent_name, status, twin_root_ref, active_mandate_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      "agent:jhn:coordinator:1",
      "JHN coordinator",
      "active",
      "twin:jhn",
      "mandate:jhn:cop-mandate:1",
      now,
      now
    );
  database
    .prepare(
      "INSERT INTO cop_mandates (mandate_ref, version, status, issuer_ref, grantee_ref, permissions, issued_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      "mandate:jhn:cop-mandate:1",
      1,
      "active",
      "instance:jhn",
      "principal:jhn",
      '["cop.events.append"]',
      now,
      now,
      now
    );
  database
    .prepare(
      "INSERT INTO cop_tasks (id, name, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run("task:cop-mandate", "Specify COP/Mandate", "running", 1, now, now);
  database
    .prepare(
      "INSERT INTO cop_steps (id, task_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run("step:portable-schema", "task:cop-mandate", "Validate portable SQL", now, now);
  database
    .prepare(
      "INSERT INTO cop_events (id, topic_id, type, payload, occurred_at, recorded_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run("event:1", "topic:cop-mandate", "mission.started", "{}", now, now);
  database
    .prepare(
      "INSERT INTO cop_artifacts (id, topic_id, handler_name, artifact_type, artifact_kind, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      "artifact:mandate:1",
      "topic:cop-mandate",
      "handler:jhn:coordinator",
      "cop/mandate",
      "document",
      "{}",
      now
    );

  assert.throws(
    () =>
      database
        .prepare(
          "INSERT INTO cop_handlers (handler_name, handler_kind, created_at, updated_at) VALUES (?, ?, ?, ?)"
        )
        .run("handler:jhn:coordinator", "runtime", now, now),
    /UNIQUE constraint failed/
  );
  assert.throws(
    () =>
      database
        .prepare(
          "INSERT INTO cop_steps (id, task_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        )
        .run("step:orphan", "task:missing", "Must fail", now, now),
    /FOREIGN KEY constraint failed/
  );
  assert.throws(
    () =>
      database
        .prepare(
          "INSERT INTO cop_mandates (mandate_ref, version, status, issuer_ref, grantee_ref, issued_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run("mandate:invalid", 1, "unknown", "instance:jhn", "principal:jhn", now, now, now),
    /CHECK constraint failed/
  );

  console.log("Portable COP runtime schema: SQLite validation passed.");
} finally {
  database.close();
}
