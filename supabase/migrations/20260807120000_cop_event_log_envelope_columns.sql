-- Migration: COP event log envelope columns + atomic topic_seq append (Inseme #28)
-- Date: 2026-08-07
-- Depends on: 20260731180000_cop_append_only_event_log.sql

--------------------------------------------------------------------------------
-- 1. Envelope columns on cop_event_log
--------------------------------------------------------------------------------

ALTER TABLE public.cop_event_log
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS artifact_ref text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'restricted'
    CHECK (visibility IN (
      'open', 'redacted', 'restricted', 'sealed', 'opaque_but_escrowed'
    ));

-- Backfill event_id from id when null
UPDATE public.cop_event_log
SET event_id = id
WHERE event_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cop_event_log_event_id
  ON public.cop_event_log (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cop_event_log_visibility
  ON public.cop_event_log (visibility);

--------------------------------------------------------------------------------
-- 2. Atomic next topic_seq
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cop_event_next_topic_seq(p_topic_id text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  next_seq bigint;
BEGIN
  SELECT COALESCE(MAX(topic_seq), 0) + 1
    INTO next_seq
    FROM public.cop_event_log
   WHERE topic_id = p_topic_id;
  RETURN next_seq;
END;
$$;

--------------------------------------------------------------------------------
-- 3. Append helper (service_role): assigns topic_seq, rejects updates via insert only
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cop_event_append(
  p_topic_id text,
  p_event_type text DEFAULT 'cop.event/v1',
  p_actor_id text DEFAULT NULL,
  p_epistemic_status text DEFAULT 'observed',
  p_origin_ref text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL,
  p_payload_hash text DEFAULT NULL,
  p_artifact_ref text DEFAULT NULL,
  p_visibility text DEFAULT 'restricted',
  p_event_id uuid DEFAULT NULL
)
RETURNS public.cop_event_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.cop_event_log;
  inserted public.cop_event_log;
  next_seq bigint;
  eid uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO existing
      FROM public.cop_event_log
     WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN existing;
    END IF;
  END IF;

  next_seq := public.cop_event_next_topic_seq(p_topic_id);
  eid := COALESCE(p_event_id, gen_random_uuid());

  INSERT INTO public.cop_event_log (
    id,
    event_id,
    topic_id,
    topic_seq,
    event_type,
    actor_id,
    epistemic_status,
    origin_ref,
    payload,
    meta,
    idempotency_key,
    payload_hash,
    artifact_ref,
    visibility
  ) VALUES (
    eid,
    eid,
    p_topic_id,
    next_seq,
    COALESCE(p_event_type, 'cop.event/v1'),
    p_actor_id,
    COALESCE(p_epistemic_status, 'observed'),
    p_origin_ref,
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_meta, '{}'::jsonb),
    p_idempotency_key,
    p_payload_hash,
    p_artifact_ref,
    COALESCE(p_visibility, 'restricted')
  )
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.cop_event_append FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cop_event_append TO service_role;

COMMENT ON FUNCTION public.cop_event_append IS
  'Append-only COP event insert with atomic topic_seq and idempotency (Inseme #28).';
