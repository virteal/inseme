-- Migration: COP Step claim, attempts, and lease
-- Date: 2025-12-07

ALTER TABLE public.cop_step
  ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS worker_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_cop_step_task_status ON public.cop_step(task_id, status);

