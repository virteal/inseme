-- Migration: COP Core v0.1
-- Adds COP tables for topics, tasks, steps, events, artifacts with task leasing fields
-- Date: 2025-12-06

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Topics
CREATE TABLE IF NOT EXISTS public.cop_topic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'open',
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  title text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.cop_task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.cop_topic(id) ON DELETE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  worker_id text DEFAULT NULL,
  lease_expires_at timestamptz DEFAULT NULL,
  last_error text DEFAULT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Steps
CREATE TABLE IF NOT EXISTS public.cop_step (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.cop_task(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Events
CREATE TABLE IF NOT EXISTS public.cop_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.cop_topic(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Artifacts
CREATE TABLE IF NOT EXISTS public.cop_artifact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.cop_topic(id) ON DELETE CASCADE,
  source_task_id uuid REFERENCES public.cop_task(id) ON DELETE SET NULL,
  source_step_id uuid REFERENCES public.cop_step(id) ON DELETE SET NULL,
  type text NOT NULL,
  format text,
  payload jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cop_task_topic_status ON public.cop_task(topic_id, status);
CREATE INDEX IF NOT EXISTS idx_cop_event_topic_created_at ON public.cop_event(topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cop_artifact_topic ON public.cop_artifact(topic_id);

-- RLS: enable and provide example policies
ALTER TABLE public.cop_topic ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_artifact ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read topics" ON public.cop_topic FOR SELECT USING (true);
CREATE POLICY "Task insert service" ON public.cop_task FOR INSERT TO authenticated USING (true) WITH CHECK (true);

