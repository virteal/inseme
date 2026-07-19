-- ============================================================================
-- JHN personal instance — MINIMAL bootstrap (SQL Editor only, no CLI)
-- Project: ndiysuhzmztatpxbkezn (inseme-jhn / JHR)
-- Safe-ish to re-run: IF NOT EXISTS / ON CONFLICT
-- ============================================================================
-- Day-1 goal: users + auth trigger + instance_config vault + JHN identity seed.
-- Do NOT paste schema.sql wholesale (context dump, not executable).
-- Later: add COP / wiki / civic tables as needed (see RUNBOOK).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. public.users (profile; id matches auth.users.id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  neighborhood text,
  interests text,
  rgpd_consent_accepted boolean DEFAULT false,
  rgpd_consent_date timestamptz,
  metadata jsonb NOT NULL DEFAULT '{"schemaVersion": 1}'::jsonb,
  role text NOT NULL DEFAULT 'user'
    CHECK (role = ANY (ARRAY['user'::text, 'moderator'::text, 'admin'::text, 'ai'::text])),
  public_profile boolean NOT NULL DEFAULT true,
  avatar_url text
);

-- Align id with auth when possible (ignore if already constrained)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.users
        ADD CONSTRAINT users_id_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'users_id_fkey skipped: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read user profiles" ON public.users;
CREATE POLICY "Anyone can read user profiles"
  ON public.users FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated users can create profiles" ON public.users;
CREATE POLICY "Authenticated users can create profiles"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. Auto-create profile on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users
INSERT INTO public.users (id, email, display_name, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'display_name', split_part(COALESCE(au.email, 'user'), '@', 1)),
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. instance_config (vault)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instance_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  value_json jsonb,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_secret boolean DEFAULT false,
  is_public boolean DEFAULT false,
  version integer DEFAULT 1,
  previous_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_instance_config_category ON public.instance_config(category);
CREATE INDEX IF NOT EXISTS idx_instance_config_public
  ON public.instance_config(is_public) WHERE is_public = true;

ALTER TABLE public.instance_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read public config" ON public.instance_config;
CREATE POLICY "Public can read public config"
  ON public.instance_config FOR SELECT
  USING (is_public = true OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role full access config" ON public.instance_config;
-- Note: service_role bypasses RLS; admin policies can be tightened later.

-- ---------------------------------------------------------------------------
-- 4. JHN identity seed
-- ---------------------------------------------------------------------------
INSERT INTO public.instance_config (key, value, category, description, is_public, is_secret)
VALUES
  ('community_name', 'Jean Hugues Noël Robert — instance personnelle', 'identity',
   'Libellé affiché', true, false),
  ('community_type', 'association', 'identity',
   'Enum legacy ; sémantique = personal-twin', true, false),
  ('community_tagline', 'Communauté cognitive personnelle sous mandat', 'identity',
   'Tagline', true, false),
  ('community_code', 'jhn', 'identity', 'Code instance', true, false),
  ('region_name', 'Corse', 'identity', 'Région', true, false),
  ('region_code', 'COR', 'identity', 'Code région', true, false),
  ('country', 'FR', 'identity', 'Pays', true, false),
  ('timezone', 'Europe/Paris', 'identity', 'Fuseau', true, false),
  ('locale', 'fr-FR', 'identity', 'Locale', true, false),
  ('contact_email', 'jhr@baronsmariani.org', 'identity', 'Contact', true, false),
  ('support_email', 'jhr@baronsmariani.org', 'identity', 'Support', false, false),
  ('deployment_kind', 'personal', 'identity', 'personal | civic | …', true, false),
  ('subject_kind', 'living_person', 'identity', 'Sujet représenté', true, false),
  ('community_kind', 'cognitive', 'identity', 'Société hébergée', true, false),
  ('host_domain', 'baronsmariani.org', 'identity', 'Apex DNS', true, false),
  ('app_url', 'https://jhn.baronsmariani.org', 'identity', 'URL canonique', true, false),
  ('supabase_project_ref', 'ndiysuhzmztatpxbkezn', 'identity', 'Project ref', false, false),
  ('movement_name', 'Corpus / Cogentia', 'branding', 'Cadre', true, false),
  ('party_name', '', 'branding', 'Pas un parti', true, false),
  ('hashtag', '#PERTITELLU', 'branding', 'Hashtag optionnel', true, false),
  ('bot_name', 'Ophélia', 'branding', 'Médiateur IA', true, false),
  ('primary_color', '#3B4E6B', 'branding', 'Couleur primaire', true, false),
  ('secondary_color', '#B35A4A', 'branding', 'Couleur secondaire', true, false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

INSERT INTO public.instance_config (key, value_json, category, description, is_public, is_secret)
VALUES
  ('map_default_center', '[42.3084, 9.1505]'::jsonb, 'features',
   'Centre carte', true, false)
ON CONFLICT (key) DO UPDATE SET
  value_json = EXCLUDED.value_json,
  updated_at = now();

-- Done minimal bootstrap.
SELECT key, value, category FROM public.instance_config
WHERE key IN ('community_name', 'deployment_kind', 'app_url', 'supabase_project_ref')
ORDER BY key;
