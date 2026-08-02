-- COP runtime tables shared by the local SQLite validator and PostgreSQL/Supabase.
--
-- Portability profile:
-- - identifiers, timestamps and JSON documents are produced and validated by
--   the ESM runtime, not by database-specific functions or types;
-- - access decisions are made by the application mandate/capability layer;
-- - this migration intentionally contains no RLS policy, stored procedure or trigger.
--
-- PostgreSQL-specific defence in depth belongs in the following hardening
-- migration. Keep this file executable unchanged by SQLite.

CREATE TABLE IF NOT EXISTS cop_handlers (
  handler_name TEXT PRIMARY KEY,
  handler_kind TEXT NOT NULL,
  module_ref TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- The instance owns this current-state projection. Signed capabilities refer
-- to a row/version here; they do not embed permissions that outlive a change.
CREATE TABLE IF NOT EXISTS cop_mandates (
  mandate_ref TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  issuer_ref TEXT NOT NULL,
  grantee_ref TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]',
  scope TEXT NOT NULL DEFAULT '{}',
  issued_at TEXT NOT NULL,
  not_before TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cop_logical_agents (
  logical_agent_id TEXT PRIMARY KEY,
  logical_agent_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'declared' CHECK (length(status) > 0),
  twin_root_ref TEXT,
  active_mandate_ref TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cop_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (length(status) > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  input TEXT,
  output TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cop_steps (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES cop_tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (length(status) > 0),
  input TEXT,
  output TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cop_events (
  id TEXT PRIMARY KEY,
  topic_id TEXT,
  task_id TEXT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  metadata TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cop_artifacts (
  id TEXT PRIMARY KEY,
  topic_id TEXT,
  correlation_id TEXT,
  message_id TEXT,
  event_id TEXT,
  task_id TEXT,
  task_step_id TEXT,
  network_id TEXT,
  node_id TEXT,
  instance_id TEXT,
  handler_name TEXT,
  artifact_type TEXT NOT NULL,
  artifact_kind TEXT NOT NULL,
  stability_level TEXT,
  derives_from_artifact_id TEXT,
  is_compacted INTEGER NOT NULL DEFAULT 0 CHECK (is_compacted IN (0, 1)),
  media_type TEXT,
  content_ref TEXT,
  retention_policy TEXT,
  retention_expires_at TEXT,
  legal_hold INTEGER NOT NULL DEFAULT 0 CHECK (legal_hold IN (0, 1)),
  cache_key TEXT,
  content TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cop_logical_agents_status
  ON cop_logical_agents (status);
CREATE INDEX IF NOT EXISTS idx_cop_mandates_grantee_status
  ON cop_mandates (grantee_ref, status);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_status
  ON cop_tasks (status);
CREATE INDEX IF NOT EXISTS idx_cop_steps_task_id
  ON cop_steps (task_id);
CREATE INDEX IF NOT EXISTS idx_cop_events_topic_recorded
  ON cop_events (topic_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_cop_artifacts_topic
  ON cop_artifacts (topic_id);
