-- Migration: COP Core v0.1 - Idempotency & checkpoints
-- Adds source_event_id to tasks and unique constraints for deduplication
-- Date: 2025-12-06

ALTER TABLE public.cop_task
  ADD COLUMN IF NOT EXISTS source_event_id uuid DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cop_task_topic_type_source_event ON public.cop_task(topic_id, type, source_event_id) WHERE (source_event_id IS NOT NULL);

-- Ensure each task has unique step names to support idempotent step upserts
CREATE UNIQUE INDEX IF NOT EXISTS ux_cop_step_taskid_name ON public.cop_step(task_id, name);

-- Deduplicate artifacts created by the same task/step/type
CREATE UNIQUE INDEX IF NOT EXISTS ux_cop_artifact_task_step_type ON public.cop_artifact(source_task_id, source_step_id, type) WHERE (source_task_id IS NOT NULL AND source_step_id IS NOT NULL);

-- Add a checkpoint field to steps to allow incrementally resumed processing
ALTER TABLE public.cop_step
  ADD COLUMN IF NOT EXISTS checkpoint jsonb DEFAULT '{}'::jsonb;

-- Add a `status_reason` for tasks for better observability
ALTER TABLE public.cop_task
  ADD COLUMN IF NOT EXISTS status_reason text DEFAULT NULL;

COMMENT ON INDEX ux_cop_task_topic_type_source_event IS 'Unique task per event (topic,type,source_event) to support idempotent task creation';
COMMENT ON INDEX ux_cop_step_taskid_name IS 'Unique step name per task to support idempotent step upserts';
COMMENT ON INDEX ux_cop_artifact_task_step_type IS 'Unique artifact identity per task/step/type to avoid duplicates';
