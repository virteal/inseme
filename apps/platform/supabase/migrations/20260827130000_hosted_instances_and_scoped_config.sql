-- ============================================================================
-- Migration: 20260827130000_hosted_instances_and_scoped_config.sql
-- Description: Introduction of UUID-keyed instances registry, alias resolution table,
--              instance_id scoped instance_config, and initial hosted provisional twins
--              for Frédéric Lecourtois (Aréopage) and Marie-Cornélie Lenglet.
-- References: JeanHuguesRobert/inseme#57, #17, #34, #35
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Table public.instances (Canonical UUID instance registry)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_instance_id uuid REFERENCES public.instances(id) ON DELETE SET NULL,
  canonical_slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  bot_name text NOT NULL DEFAULT 'Ophélia',
  subject_ref text NOT NULL,
  twin_root_ref text NOT NULL,
  principal_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'provisional'
    CHECK (status IN ('provisional', 'claimed', 'autonomous', 'archived')),
  deployment_kind text NOT NULL DEFAULT 'personal',
  subject_kind text NOT NULL DEFAULT 'living_person',
  is_claimable boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instances_host_instance_id ON public.instances(host_instance_id);
CREATE INDEX IF NOT EXISTS idx_instances_canonical_slug ON public.instances(canonical_slug);
CREATE INDEX IF NOT EXISTS idx_instances_status ON public.instances(status);

-- ----------------------------------------------------------------------------
-- 2. Seed founding root instance (JHN) and hosted provisional twins
-- ----------------------------------------------------------------------------
INSERT INTO public.instances (
  id, host_instance_id, canonical_slug, display_name, bot_name,
  subject_ref, twin_root_ref, status, deployment_kind, subject_kind, is_claimable, metadata
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    NULL,
    'jhn',
    'Jean Hugues Noël Robert',
    'John',
    'subject:jhn',
    'twin:jhn',
    'autonomous',
    'personal',
    'living_person',
    false,
    '{"role": "root_host", "notes": "Founding personal TwinRoot JHN", "historical_anchors": {"twitter_x": "jhr", "notes": "Early 3-letter handle acquisition"}}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'frederic-lecourtois',
    'Frédéric Lecourtois',
    'Aréopage',
    'subject:frederic-lecourtois',
    'twin:frederic-lecourtois',
    'provisional',
    'personal',
    'living_person',
    true,
    '{"location": "Ghisonaccia", "specialty": "Lettres classiques (Français, Latin, Grec)", "persona": "Aréopage"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'marie-cornelie-lenglet',
    'Marie-Cornélie Lenglet',
    'Ophélia',
    'subject:marie-cornelie-lenglet',
    'twin:marie-cornelie-lenglet',
    'provisional',
    'personal',
    'living_person',
    true,
    '{"role": "provisional_twin"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'marie-louise-robert',
    'Marie-Louise Robert',
    'Marie-Louise',
    'subject:marie-louise-robert',
    'twin:marie-louise-robert',
    'provisional',
    'personal',
    'deceased_person',
    false,
    '{"relation": "daughter", "father": "jhn", "regime": "posthumous_patrimonial"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  canonical_slug = EXCLUDED.canonical_slug,
  display_name = EXCLUDED.display_name,
  bot_name = EXCLUDED.bot_name,
  updated_at = now();

-- ----------------------------------------------------------------------------
-- 3. Table public.instance_aliases (Multi-alias and persona mapping)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instance_aliases (
  alias text PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  alias_kind text NOT NULL DEFAULT 'slug'
    CHECK (alias_kind IN ('canonical_slug', 'bot_name', 'short_name', 'name_variant', 'subdomain', 'alternative', 'legacy')),
  allocated_at timestamptz NOT NULL DEFAULT now(),
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instance_aliases_instance_id ON public.instance_aliases(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_aliases_allocated_at ON public.instance_aliases(allocated_at);

-- Monotone Allocation & Anti-Usurpation Trigger (Strict First Come, First Served)
CREATE OR REPLACE FUNCTION public.enforce_instance_alias_monotonicity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent altering the historical allocation timestamp
  IF NEW.allocated_at IS DISTINCT FROM OLD.allocated_at THEN
    NEW.allocated_at := OLD.allocated_at;
  END IF;

  -- Prevent silent usurpation: an alias bound to instance A cannot be rebound to instance B without explicit release
  IF NEW.instance_id <> OLD.instance_id THEN
    RAISE EXCEPTION 'Alias "%" is already allocated to instance % at %. Usurpation forbidden.',
      OLD.alias, OLD.instance_id, OLD.allocated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_instance_aliases_monotonicity ON public.instance_aliases;
CREATE TRIGGER trigger_instance_aliases_monotonicity
  BEFORE UPDATE ON public.instance_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_instance_alias_monotonicity();

-- Seed aliases (First come, first served reservations)
INSERT INTO public.instance_aliases (alias, instance_id, is_primary, alias_kind, description, allocated_at)
VALUES
  -- JHN Aliases (First come, first served reservations)
  ('jhn', '00000000-0000-0000-0000-000000000001'::uuid, true, 'canonical_slug', 'Primary canonical slug for JHN', now()),
  ('john', '00000000-0000-0000-0000-000000000001'::uuid, false, 'bot_name', 'Bot name John', now()),
  ('jean', '00000000-0000-0000-0000-000000000001'::uuid, false, 'short_name', 'Short given name Jean', now()),
  ('jean-hugues', '00000000-0000-0000-0000-000000000001'::uuid, false, 'name_variant', 'Compound name Jean-Hugues', now()),
  ('jean-hugues-noel', '00000000-0000-0000-0000-000000000001'::uuid, false, 'name_variant', 'Full given name without accent', now()),
  ('jean-hugues-noël', '00000000-0000-0000-0000-000000000001'::uuid, false, 'name_variant', 'Full given name with accent', now()),
  ('jean-hugues-noel-robert', '00000000-0000-0000-0000-000000000001'::uuid, false, 'alternative', 'Full name without accent', now()),
  ('jean-hugues-noël-robert', '00000000-0000-0000-0000-000000000001'::uuid, false, 'alternative', 'Full name with accent', now()),
  ('jhr', '00000000-0000-0000-0000-000000000001'::uuid, false, 'alternative', 'Initials JHR & early Twitter/X 3-letter handle @jhr', now()),
  ('baron-mariani', '00000000-0000-0000-0000-000000000001'::uuid, false, 'alternative', 'Baron Mariani reference', now()),
  ('barons-mariani', '00000000-0000-0000-0000-000000000001'::uuid, false, 'alternative', 'Barons Mariani reference', now()),
  ('mariani', '00000000-0000-0000-0000-000000000001'::uuid, false, 'alternative', 'Mariani family name', now()),
  ('robert', '00000000-0000-0000-0000-000000000001'::uuid, false, 'alternative', 'Robert family name', now()),

  -- Frédéric Lecourtois / Aréopage Aliases
  ('frederic-lecourtois', '00000000-0000-0000-0000-000000000002'::uuid, true, 'canonical_slug', 'Primary slug for Frédéric Lecourtois', now()),
  ('areopage', '00000000-0000-0000-0000-000000000002'::uuid, false, 'bot_name', 'Chosen twin name Aréopage (sans accent)', now()),
  ('aréopage', '00000000-0000-0000-0000-000000000002'::uuid, false, 'bot_name', 'Chosen twin name Aréopage (avec accent)', now()),
  ('frederic', '00000000-0000-0000-0000-000000000002'::uuid, false, 'short_name', 'Short given name', now()),
  ('frédéric', '00000000-0000-0000-0000-000000000002'::uuid, false, 'short_name', 'Short given name accented', now()),
  ('lecourtois', '00000000-0000-0000-0000-000000000002'::uuid, false, 'alternative', 'Family name', now()),
  ('f-lecourtois', '00000000-0000-0000-0000-000000000002'::uuid, false, 'alternative', 'Short initial slug', now()),

  -- Marie-Cornélie Lenglet Aliases
  ('marie-cornelie-lenglet', '00000000-0000-0000-0000-000000000003'::uuid, true, 'canonical_slug', 'Primary slug for Marie-Cornélie Lenglet', now()),
  ('marie-cornelie', '00000000-0000-0000-0000-000000000003'::uuid, false, 'name_variant', 'Compound given name', now()),
  ('marie-cornélie', '00000000-0000-0000-0000-000000000003'::uuid, false, 'name_variant', 'Compound given name accented', now()),
  ('cornelie', '00000000-0000-0000-0000-000000000003'::uuid, false, 'short_name', 'Short given name', now()),
  ('cornélie', '00000000-0000-0000-0000-000000000003'::uuid, false, 'short_name', 'Short given name accented', now()),
  ('mc-lenglet', '00000000-0000-0000-0000-000000000003'::uuid, false, 'alternative', 'Initials slug', now()),
  ('lenglet', '00000000-0000-0000-0000-000000000003'::uuid, false, 'alternative', 'Family name', now()),

  -- Marie-Louise Robert Aliases (Reserved for deceased daughter Marie-Louise Robert)
  ('marie-louise-robert', '00000000-0000-0000-0000-000000000004'::uuid, true, 'canonical_slug', 'Primary slug for Marie-Louise Robert', now()),
  ('marie-louise', '00000000-0000-0000-0000-000000000004'::uuid, false, 'name_variant', 'Compound given name Marie-Louise', now()),
  ('marie', '00000000-0000-0000-0000-000000000004'::uuid, false, 'short_name', 'Short given name Marie', now()),
  ('mary', '00000000-0000-0000-0000-000000000004'::uuid, false, 'short_name', 'Short name variant Mary', now()),
  ('mlr', '00000000-0000-0000-0000-000000000004'::uuid, false, 'alternative', 'Initials MLR', now()),
  ('ml-robert', '00000000-0000-0000-0000-000000000004'::uuid, false, 'alternative', 'Short initial slug', now()),
  ('marie-robert', '00000000-0000-0000-0000-000000000004'::uuid, false, 'alternative', 'Name variant Marie Robert', now())
ON CONFLICT (alias) DO UPDATE SET
  instance_id = EXCLUDED.instance_id,
  is_primary = EXCLUDED.is_primary,
  alias_kind = EXCLUDED.alias_kind,
  allocated_at = EXCLUDED.allocated_at;

-- ----------------------------------------------------------------------------
-- 4. Update public.instance_config with instance_id scoping
-- ----------------------------------------------------------------------------
ALTER TABLE public.instance_config
  ADD COLUMN IF NOT EXISTS instance_id uuid REFERENCES public.instances(id) ON DELETE CASCADE;

-- Backfill existing rows with root JHN UUID
UPDATE public.instance_config
SET instance_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE instance_id IS NULL;

ALTER TABLE public.instance_config
  ALTER COLUMN instance_id SET NOT NULL;

ALTER TABLE public.instance_config
  ALTER COLUMN instance_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Drop legacy single-key uniqueness and enforce composite (instance_id, key) uniqueness
ALTER TABLE public.instance_config DROP CONSTRAINT IF EXISTS instance_config_key_key;
ALTER TABLE public.instance_config DROP CONSTRAINT IF EXISTS instance_config_instance_id_key_key;
ALTER TABLE public.instance_config ADD CONSTRAINT instance_config_instance_id_key_key UNIQUE (instance_id, key);

CREATE INDEX IF NOT EXISTS idx_instance_config_instance_id ON public.instance_config(instance_id);

-- ----------------------------------------------------------------------------
-- 5. Seed hosted twins specific instance_config (Identity & Personalization)
-- ----------------------------------------------------------------------------
-- Infrastructure keys (OpenAI, Anthropic, embeddings, database, etc.) remain in JHN and are inherited.

-- Frédéric Lecourtois (Aréopage)
INSERT INTO public.instance_config (instance_id, key, value, category, description, is_public, is_secret)
VALUES
  ('00000000-0000-0000-0000-000000000002'::uuid, 'community_name', 'Frédéric Lecourtois — Aréopage', 'identity', 'Display name', true, false),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'community_code', 'frederic-lecourtois', 'identity', 'Instance code', true, false),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'bot_name', 'Aréopage', 'branding', 'Bot / Twin persona name', true, false),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'app_url', 'https://frederic-lecourtois.jhn.baronsmariani.org', 'identity', 'Canonical URL', true, false),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'host_domain', 'baronsmariani.org', 'identity', 'DNS apex', true, false),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'twin_root_ref', 'twin:frederic-lecourtois', 'identity', 'TwinRoot reference', true, false),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'represented_subject_ref', 'subject:frederic-lecourtois', 'identity', 'Subject reference', true, false),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'community_tagline', 'Twin personnel sous mandat — Aréopage', 'identity', 'Tagline', true, false)
ON CONFLICT (instance_id, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- Marie-Cornélie Lenglet
INSERT INTO public.instance_config (instance_id, key, value, category, description, is_public, is_secret)
VALUES
  ('00000000-0000-0000-0000-000000000003'::uuid, 'community_name', 'Marie-Cornélie Lenglet — Twin Personnel', 'identity', 'Display name', true, false),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'community_code', 'marie-cornelie-lenglet', 'identity', 'Instance code', true, false),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'bot_name', 'Ophélia', 'branding', 'Bot / Twin persona name', true, false),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'app_url', 'https://marie-cornelie-lenglet.jhn.baronsmariani.org', 'identity', 'Canonical URL', true, false),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'host_domain', 'baronsmariani.org', 'identity', 'DNS apex', true, false),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'twin_root_ref', 'twin:marie-cornelie-lenglet', 'identity', 'TwinRoot reference', true, false),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'represented_subject_ref', 'subject:marie-cornelie-lenglet', 'identity', 'Subject reference', true, false),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'community_tagline', 'Twin personnel sous mandat', 'identity', 'Tagline', true, false)
ON CONFLICT (instance_id, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- Marie-Louise Robert (Twin Posthume & Mémoriel)
INSERT INTO public.instance_config (instance_id, key, value, category, description, is_public, is_secret)
VALUES
  ('00000000-0000-0000-0000-000000000004'::uuid, 'community_name', 'Marie-Louise Robert — Twin Mémoriel', 'identity', 'Display name', true, false),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'community_code', 'marie-louise-robert', 'identity', 'Instance code', true, false),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'bot_name', 'Marie-Louise', 'branding', 'Bot / Twin persona name', true, false),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'app_url', 'https://marie-louise.jhn.baronsmariani.org', 'identity', 'Canonical URL', true, false),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'host_domain', 'baronsmariani.org', 'identity', 'DNS apex', true, false),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'twin_root_ref', 'twin:marie-louise-robert', 'identity', 'TwinRoot reference', true, false),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'represented_subject_ref', 'subject:marie-louise-robert', 'identity', 'Subject reference', true, false),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'community_tagline', 'Twin personnel mémoriel sous mandat familial', 'identity', 'Tagline', true, false),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'subject_kind', 'deceased_person', 'identity', 'Posthumous regime', true, false)
ON CONFLICT (instance_id, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- ----------------------------------------------------------------------------
-- 6. Helper Functions for Alias Resolution and Config Inheritance
-- ----------------------------------------------------------------------------

-- Resolve any alias, slug, bot_name or UUID string to canonical instance_id
CREATE OR REPLACE FUNCTION public.resolve_instance_id(p_identifier text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance_id uuid;
  v_cleaned text;
BEGIN
  IF p_identifier IS NULL OR TRIM(p_identifier) = '' THEN
    RETURN '00000000-0000-0000-0000-000000000001'::uuid; -- Default to root JHN
  END IF;

  v_cleaned := LOWER(TRIM(p_identifier));

  -- 1. If it is already a valid UUID and matches an instance
  BEGIN
    v_instance_id := v_cleaned::uuid;
    IF EXISTS (SELECT 1 FROM public.instances WHERE id = v_instance_id) THEN
      RETURN v_instance_id;
    END IF;
  EXCEPTION WHEN others THEN
    -- Not a UUID format, proceed to lookup
  END;

  -- 2. Lookup in instance_aliases
  SELECT instance_id INTO v_instance_id
  FROM public.instance_aliases
  WHERE alias = v_cleaned;

  IF v_instance_id IS NOT NULL THEN
    RETURN v_instance_id;
  END IF;

  -- 3. Lookup in canonical_slug
  SELECT id INTO v_instance_id
  FROM public.instances
  WHERE canonical_slug = v_cleaned;

  IF v_instance_id IS NOT NULL THEN
    RETURN v_instance_id;
  END IF;

  -- Fallback to root JHN if not found
  RETURN '00000000-0000-0000-0000-000000000001'::uuid;
END;
$$;

-- Get effective configuration key with fallback to host_instance_id
CREATE OR REPLACE FUNCTION public.get_effective_instance_config(p_instance_id uuid, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val jsonb;
  v_host_id uuid;
  v_k text := LOWER(TRIM(p_key));
BEGIN
  -- 1. Try local instance_config
  SELECT COALESCE(value_json, to_jsonb(value)) INTO v_val
  FROM public.instance_config
  WHERE instance_id = p_instance_id AND LOWER(key) = v_k;

  IF v_val IS NOT NULL THEN
    RETURN v_val;
  END IF;

  -- 2. Try host_instance_id (inheritance)
  SELECT host_instance_id INTO v_host_id
  FROM public.instances
  WHERE id = p_instance_id;

  IF v_host_id IS NOT NULL THEN
    SELECT COALESCE(value_json, to_jsonb(value)) INTO v_val
    FROM public.instance_config
    WHERE instance_id = v_host_id AND LOWER(key) = v_k;
  END IF;

  RETURN v_val;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read public instances" ON public.instances;
CREATE POLICY "Anyone can read public instances"
  ON public.instances FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can read instance aliases" ON public.instance_aliases;
CREATE POLICY "Anyone can read instance aliases"
  ON public.instance_aliases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can read public non-secret config" ON public.instance_config;
CREATE POLICY "Public can read public non-secret config"
  ON public.instance_config FOR SELECT
  USING (
    COALESCE(is_public, false) = true
    AND COALESCE(is_secret, false) = false
  );

DROP POLICY IF EXISTS "Authenticated can read non-secret config" ON public.instance_config;
CREATE POLICY "Authenticated can read non-secret config"
  ON public.instance_config FOR SELECT
  TO authenticated
  USING (COALESCE(is_secret, false) = false);
