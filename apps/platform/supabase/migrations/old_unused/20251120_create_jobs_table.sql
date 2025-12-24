-- Create tasks table for tracking long-running operations with realtime broadcasts
-- This enables progress monitoring and reliable state persistence

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- e.g., 'data_import', 'report_generation', 'ai_processing'
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  message text, -- Human-readable status message
  payload jsonb DEFAULT '{}', -- Task-specific data
  result jsonb, -- Task result data
  error_details jsonb, -- Error information if failed
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = owner);

CREATE POLICY "Users can create their own tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON public.tasks(owner);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON public.tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.tasks_updated_at_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update updated_at
CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_updated_at_trigger();

-- Function to broadcast task changes via realtime
CREATE OR REPLACE FUNCTION public.tasks_broadcast_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  channel_name text;
  operation_type text;
BEGIN
  -- Create channel name: task:{task_id}
  channel_name := 'task:' || COALESCE(NEW.id::text, OLD.id::text);
  operation_type := TG_OP;

  -- Broadcast the change
  PERFORM realtime.broadcast_changes(
    channel_name,
    operation_type,
    operation_type,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to broadcast changes
CREATE TRIGGER trg_tasks_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_broadcast_trigger();

-- Function to update task progress (convenience function)
CREATE OR REPLACE FUNCTION public.update_task_progress(
  task_id uuid,
  new_progress integer DEFAULT NULL,
  new_message text DEFAULT NULL,
  new_status text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.tasks
  SET
    progress = COALESCE(new_progress, progress),
    message = COALESCE(new_message, message),
    status = COALESCE(new_status, status),
    updated_at = now(),
    started_at = CASE WHEN new_status = 'running' AND started_at IS NULL THEN now() ELSE started_at END,
    completed_at = CASE WHEN new_status IN ('completed', 'failed', 'cancelled') THEN now() ELSE completed_at END
  WHERE id = task_id;
END;
$$;
