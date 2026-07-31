-- Migration: Append-Only COP Event Log, GitHub Webhook Deliveries & Spool Queue
-- Date: 2026-07-31
-- Issue: https://github.com/JeanHuguesRobert/inseme/issues/28 & https://github.com/JeanHuguesRobert/inseme/issues/29

CREATE EXTENSION IF NOT EXISTS pgcrypto;

--------------------------------------------------------------------------------
-- 1. Inbound Webhook Deliveries Table (Provider-Native Raw Evidence)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.github_webhook_deliveries (
  delivery_id text PRIMARY KEY,                       -- GitHub X-GitHub-Delivery header
  event_name text NOT NULL,                          -- GitHub X-GitHub-Event header
  action text,                                       -- Payload action field
  repository_name text,                              -- Repository full_name (e.g. JeanHuguesRobert/pertitellu)
  installation_id bigint,                            -- GitHub App installation ID
  sender_login text,                                 -- GitHub user who triggered event
  signature_sha256 text,                             -- X-Hub-Signature-256 header hash
  payload_sha256 text NOT NULL,                      -- Canonical SHA-256 of raw JSON body
  raw_artifact_ref text,                             -- Reference to heavy raw payload storage
  processing_state text NOT NULL DEFAULT 'received', -- 'received', 'normalized', 'failed', 'ignored'
  processing_error text,                             -- Processing error message if failed
  received_at timestamptz NOT NULL DEFAULT now(),
  normalized_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_github_deliveries_repo ON public.github_webhook_deliveries (repository_name);
CREATE INDEX IF NOT EXISTS idx_github_deliveries_state ON public.github_webhook_deliveries (processing_state);

--------------------------------------------------------------------------------
-- 2. Append-Only COP Event Log Table (cop.event/v1 Normalized Durable Facts)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id text NOT NULL,                            -- Stream/Topic identifier
  topic_seq bigint NOT NULL CHECK (topic_seq > 0),   -- Strict sequence number within topic_id
  event_type text NOT NULL DEFAULT 'cop.event/v1',   -- Schema event type identifier
  actor_id text,                                     -- Resolved actor identity (or GitHub actor)
  epistemic_status text NOT NULL DEFAULT 'observed', -- 'observed', 'proposed', 'decided', 'published'
  origin_ref text,                                   -- Source delivery ID or external reference
  causal_refs jsonb NOT NULL DEFAULT '[]'::jsonb,    -- Array of cross-topic causal event references
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,        -- Structured normalized event body
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,           -- Event metadata & trace provenance
  idempotency_key text UNIQUE,                       -- Deduplication key (delivery_id + event_type)
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cop_event_log_topic_seq_uniq UNIQUE (topic_id, topic_seq)
);

CREATE INDEX IF NOT EXISTS idx_cop_event_log_topic ON public.cop_event_log (topic_id, topic_seq);
CREATE INDEX IF NOT EXISTS idx_cop_event_log_type ON public.cop_event_log (event_type);

--------------------------------------------------------------------------------
-- 3. Immutability Trigger (Strict Append-Only Enforcement)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_cop_event_log_immutability()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'COP Event Log is strictly append-only. UPDATE and DELETE operations are forbidden (id: %).', OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cop_event_log_immutability ON public.cop_event_log;
CREATE TRIGGER trg_cop_event_log_immutability
  BEFORE UPDATE OR DELETE ON public.cop_event_log
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cop_event_log_immutability();

--------------------------------------------------------------------------------
-- 4. Local Spool & Retry Queue Table
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_spool_queue (
  spool_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id text NOT NULL,
  event_type text NOT NULL DEFAULT 'cop.event/v1',
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cop_spool_status ON public.cop_spool_queue (status);

--------------------------------------------------------------------------------
-- 5. Row Level Security (RLS) & Access Policies
--------------------------------------------------------------------------------

ALTER TABLE public.github_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_spool_queue ENABLE ROW LEVEL SECURITY;

-- Allow service_role full read-write access
CREATE POLICY service_role_all_github_deliveries ON public.github_webhook_deliveries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_cop_event_log ON public.cop_event_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_cop_spool_queue ON public.cop_spool_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users (instance principal) read-only access
CREATE POLICY auth_read_github_deliveries ON public.github_webhook_deliveries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY auth_read_cop_event_log ON public.cop_event_log
  FOR SELECT TO authenticated USING (true);
