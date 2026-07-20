-- Baseline schema for Inseme platform personal-instance dogfooding (blank cloud project).
-- Applied via: supabase db push (linked project)
-- Intentionally minimal: users + auth trigger + instance_config vault + generic seed keys.
-- Civic/COP bulk schema lives in migrations_legacy/ until reintroduced as ordered migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- public.users (profile; id matches auth.users.id)
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
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

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_email ON public.users(email);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user profiles"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can create profiles"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- instance_config (vault)
-- ---------------------------------------------------------------------------
CREATE TABLE public.instance_config (
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

CREATE INDEX idx_instance_config_category ON public.instance_config(category);
CREATE INDEX idx_instance_config_public
  ON public.instance_config(is_public) WHERE is_public = true;

ALTER TABLE public.instance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read public config"
  ON public.instance_config FOR SELECT
  USING (is_public = true OR auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Generic identity seed (overridable per instance; not Corte-specific)
-- ---------------------------------------------------------------------------
INSERT INTO public.instance_config (key, value, category, description, is_public, is_secret)
VALUES
  ('community_name', 'Personal instance', 'identity', 'Display name', true, false),
  ('community_type', 'association', 'identity', 'Legacy enum; personal-twin uses deployment_kind', true, false),
  ('community_tagline', 'Communauté cognitive personnelle sous mandat', 'identity', 'Tagline', true, false),
  ('community_code', 'personal', 'identity', 'Instance code', true, false),
  ('region_name', 'Corse', 'identity', 'Region', true, false),
  ('region_code', 'COR', 'identity', 'Region code', true, false),
  ('country', 'FR', 'identity', 'Country', true, false),
  ('timezone', 'Europe/Paris', 'identity', 'Timezone', true, false),
  ('locale', 'fr-FR', 'identity', 'Locale', true, false),
  ('contact_email', '', 'identity', 'Public contact', true, false),
  ('deployment_kind', 'personal', 'identity', 'personal | civic | institutional | …', true, false),
  ('subject_kind', 'living_person', 'identity', 'Represented subject', true, false),
  ('community_kind', 'cognitive', 'identity', 'Hosted society kind', true, false),
  ('host_domain', '', 'identity', 'DNS apex', true, false),
  ('app_url', '', 'identity', 'Canonical URL', true, false),
  ('bot_name', 'Ophélia', 'branding', 'AI mediator name', true, false),
  ('primary_color', '#3B4E6B', 'branding', 'Primary color', true, false),
  ('secondary_color', '#B35A4A', 'branding', 'Secondary color', true, false);

INSERT INTO public.instance_config (key, value_json, category, description, is_public, is_secret)
VALUES
  ('map_default_center', '[42.3084, 9.1505]'::jsonb, 'features', 'Default map center', true, false);
