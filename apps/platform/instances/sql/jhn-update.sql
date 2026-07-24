-- ============================================
-- Script de mise à jour généré le 2026-07-23T06:23:16.893Z
-- Migrations à appliquer: 5
-- ============================================

-- ============================================
-- Migration: 20260720040000_baseline_personal_instance.sql
-- Version: 20260720
-- Checksum: 2ed05100989586f2
-- ============================================

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


-- Enregistrer la migration
SELECT register_migration('20260720', '20260720040000_baseline_personal_instance', '2ed05100989586f2', NULL);

-- ============================================
-- Migration: 20260720040100_jhn_instance_identity.sql
-- Version: 20260720
-- Checksum: 5febae74759a964f
-- ============================================

-- Instance-specific identity for dogfood project JHN (ndiysuhzmztatpxbkezn).
-- Safe to re-run semantics: UPSERT on key.
-- For other personal instances, add a dedicated migration or vault update instead of editing baseline.

INSERT INTO public.instance_config (key, value, category, description, is_public, is_secret)
VALUES
  ('community_name', 'Jean Hugues Noël Robert — instance personnelle', 'identity',
   'Display name', true, false),
  ('community_code', 'jhn', 'identity', 'Instance code', true, false),
  ('contact_email', 'jhr@baronsmariani.org', 'identity', 'Public contact', true, false),
  ('support_email', 'jhr@baronsmariani.org', 'identity', 'Support', false, false),
  ('host_domain', 'baronsmariani.org', 'identity', 'DNS apex', true, false),
  ('app_url', 'https://jhn.baronsmariani.org', 'identity', 'Canonical URL', true, false),
  ('supabase_project_ref', 'ndiysuhzmztatpxbkezn', 'identity', 'Project ref', false, false),
  ('movement_name', 'Corpus / Cogentia', 'branding', 'Frame', true, false),
  ('party_name', '', 'branding', 'Not a party instance', true, false),
  ('hashtag', '#PERTITELLU', 'branding', 'Optional hashtag', true, false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();


-- Enregistrer la migration
SELECT register_migration('20260720', '20260720040100_jhn_instance_identity', '5febae74759a964f', NULL);

-- ============================================
-- Migration: 20260720043000_jhn_instance_config_from_pertitellu_public.sql
-- Version: 20260720
-- Checksum: 444b9cc3ed2fc4ee
-- ============================================

-- Import curated public (non-secret) operational config from Pertitellu into JHN.
-- Secrets stay in inseme/.env (not vault-copied across projects).
-- Source: opnotbjrbphwcezaqgim (Pertitellu / Corte). Target: ndiysuhzmztatpxbkezn (JHN).
-- Policy: features, map, chatbot, city geography, light branding.
-- Does NOT copy API keys, OAuth secrets, Supabase URLs, Netlify, or hub national keys.

INSERT INTO public.instance_config (key, value, value_json, category, description, is_public, is_secret)
VALUES
  -- Geography / Corte context (personal instance hosted in Corte)
  ('city_name', 'Corte', NULL, 'identity', 'City of residence / map context', true, false),
  ('city_tagline', 'Instance personnelle — Corte', NULL, 'identity', 'Tagline', true, false),
  ('commune_insee', '2B096', NULL, 'identity', 'INSEE code Corte', true, false),
  ('country', 'FR', NULL, 'identity', 'Country', true, false),
  ('region_name', 'Corse', NULL, 'identity', 'Region', true, false),
  ('region_code', 'COR', NULL, 'identity', 'Region code', true, false),
  ('locale', 'fr-FR', NULL, 'identity', 'Locale', true, false),
  ('timezone', 'Europe/Paris', NULL, 'identity', 'Timezone', true, false),

  -- Branding / UX (personal-friendly overrides of Pertitellu)
  ('bot_name', 'Ophélia', NULL, 'branding', 'AI mediator name', true, false),
  ('movement_name', 'Corpus / Cogentia', NULL, 'branding', 'Frame', true, false),
  ('party_name', '', NULL, 'branding', 'Not a party instance', true, false),
  ('hashtag', '#PERTITELLU', NULL, 'branding', 'Optional civic hashtag', true, false),
  ('primary_color', '#3B4E6B', NULL, 'branding', 'Primary color', true, false),
  ('secondary_color', '#B35A4A', NULL, 'branding', 'Secondary color', true, false),
  ('favicon', NULL, '{"url":"/images/favicon.ico"}'::jsonb, 'branding', 'Favicon', true, false),
  ('logo', NULL, '{"alt":"JHN","url":"/images/logo.png"}'::jsonb, 'branding', 'Logo', true, false),

  -- Map (Corte)
  ('map_default_center', NULL, '[42.3084, 9.1505]'::jsonb, 'features', 'Default map center', true, false),
  ('map_default_lat', '42.3084', NULL, 'features', 'Default map lat', true, false),
  ('map_default_lng', '9.1505', NULL, 'features', 'Default map lng', true, false),
  ('map_default_zoom', '13', NULL, 'features', 'Default map zoom', true, false),
  ('map_style', 'osm', NULL, 'features', 'Map style', true, false),

  -- Feature flags (from Pertitellu operational set)
  ('feature_chatbot', 'true', NULL, 'features', 'Enable chatbot', true, false),
  ('feature_comments', 'true', NULL, 'features', 'Enable comments', true, false),
  ('feature_consultations', 'true', NULL, 'features', 'Enable consultations', true, false),
  ('feature_moderation', 'true', NULL, 'features', 'Enable moderation', true, false),
  ('feature_ocr', 'true', NULL, 'features', 'Enable OCR', true, false),
  ('feature_petitions', 'true', NULL, 'features', 'Enable petitions', true, false),
  ('feature_rag', 'true', NULL, 'features', 'Enable RAG', true, false),
  ('feature_social', 'true', NULL, 'features', 'Enable social', true, false),
  ('feature_transparency', 'true', NULL, 'features', 'Enable transparency', true, false),
  ('feature_wiki', 'true', NULL, 'features', 'Enable wiki', true, false),

  -- Chatbot copy (Ophélia)
  ('chatbot_welcome_message', 'Bonjour ! Je suis Ophélia. Comment puis-je vous aider ?', NULL, 'features', 'Welcome', true, false),
  ('chatbot_fallback_message', 'Désolée, je ne trouve pas de réponse. Souhaitez-vous créer une proposition ?', NULL, 'features', 'Fallback', true, false),
  ('chatbot_max_sources', '3', NULL, 'features', 'Max RAG sources', true, false),
  ('chatbot_similarity_threshold', '0.65', NULL, 'features', 'RAG similarity threshold', true, false),

  -- COP node identity (personal, not corte hub)
  ('cop_node_id', 'jhn', NULL, 'cop', 'This instance node id', true, false),
  ('cop_network_id', 'personal', NULL, 'cop', 'Network id for personal dogfood', true, false),
  ('cop_base_url', 'https://jhn.baronsmariani.org', NULL, 'cop', 'Public base URL', true, false),

  -- Storage default name (bucket may still need creation in Dashboard)
  ('supabase_storage_bucket', 'public-documents', NULL, 'storage', 'Default public bucket name', true, false),

  -- Soft federation placeholders (empty peers for personal)
  ('federation_peers', '', NULL, 'federation', 'No peers yet', true, false),
  ('global_gazette_editor_group', 'La Gazette', NULL, 'features', 'Editor group label', true, false),

  -- Model defaults (non-secret; keys stay in .env)
  ('openai_model', 'gpt-4o-mini', NULL, 'ai', 'Default chat model', false, false),
  ('openai_embedding_model', 'text-embedding-3-small', NULL, 'ai', 'Default embedding model', false, false),
  ('openai_moderation_model', 'omni-moderation-latest', NULL, 'ai', 'Moderation model', false, false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  value_json = COALESCE(EXCLUDED.value_json, public.instance_config.value_json),
  category = EXCLUDED.category,
  description = COALESCE(EXCLUDED.description, public.instance_config.description),
  is_public = EXCLUDED.is_public,
  is_secret = false,
  updated_at = now();

-- Re-assert JHN personal identity (never leave Corte civic identity on these keys)
UPDATE public.instance_config SET value = 'Jean Hugues Noël Robert — instance personnelle', updated_at = now()
WHERE key = 'community_name';
UPDATE public.instance_config SET value = 'jhn', updated_at = now()
WHERE key = 'community_code';
UPDATE public.instance_config SET value = 'Communauté cognitive personnelle sous mandat', updated_at = now()
WHERE key = 'community_tagline';
UPDATE public.instance_config SET value = 'personal', updated_at = now()
WHERE key = 'deployment_kind';
UPDATE public.instance_config SET value = 'living_person', updated_at = now()
WHERE key = 'subject_kind';
UPDATE public.instance_config SET value = 'cognitive', updated_at = now()
WHERE key = 'community_kind';
UPDATE public.instance_config SET value = 'https://jhn.baronsmariani.org', updated_at = now()
WHERE key = 'app_url';
UPDATE public.instance_config SET value = 'baronsmariani.org', updated_at = now()
WHERE key = 'host_domain';
UPDATE public.instance_config SET value = 'ndiysuhzmztatpxbkezn', updated_at = now()
WHERE key = 'supabase_project_ref';
UPDATE public.instance_config SET value = 'jhr@baronsmariani.org', updated_at = now()
WHERE key IN ('contact_email', 'support_email');


-- Enregistrer la migration
SELECT register_migration('20260720', '20260720043000_jhn_instance_config_from_pertitellu_public', '444b9cc3ed2fc4ee', NULL);

-- ============================================
-- Migration: 20260720044000_instance_config_secret_rls.sql
-- Version: 20260720
-- Checksum: 9b12abbc2a2c5b7d
-- ============================================

-- Tighten instance_config RLS so secrets are not readable by anon/authenticated clients.
-- Edge/backend use service_role (bypasses RLS) and filter is_secret in public HTTP handlers.

DROP POLICY IF EXISTS "Public can read public config" ON public.instance_config;

-- Anyone (incl. anon) may read non-secret public config
CREATE POLICY "Public can read public non-secret config"
  ON public.instance_config
  FOR SELECT
  USING (
    COALESCE(is_public, false) = true
    AND COALESCE(is_secret, false) = false
  );

-- Authenticated users may read non-secret rows (public or internal non-secret)
CREATE POLICY "Authenticated can read non-secret config"
  ON public.instance_config
  FOR SELECT
  TO authenticated
  USING (COALESCE(is_secret, false) = false);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated:
-- writes go through service_role (scripts, edge admin factory) which bypasses RLS.


-- Enregistrer la migration
SELECT register_migration('20260720', '20260720044000_instance_config_secret_rls', '9b12abbc2a2c5b7d', NULL);

-- ============================================
-- Migration: 20260723080000_cop_kernel_and_accounting_tables.sql
-- Version: 20260723
-- Checksum: 6d87c6301caa5bd5
-- ============================================

-- Migration: COP Core and Accounting Kernel Tables for Personal Instance Node (jhn.baronsmariani.org)
-- Date: 2026-07-23

CREATE EXTENSION IF NOT EXISTS pgcrypto;

--------------------------------------------------------------------------------
-- 1. COP Core Orchestration Tables (Topics, Tasks, Steps, Events, Artifacts)
--------------------------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS public.cop_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.cop_topic(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

--------------------------------------------------------------------------------
-- 2. Fractanet Network & Agent Registry (Nodes & Agents)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id text NOT NULL,
  node_id text NOT NULL,
  base_url text NOT NULL,
  cop_path text NOT NULL DEFAULT '/cop',
  events_path text NOT NULL DEFAULT '/cop-events',
  stream_path text NOT NULL DEFAULT '/cop-stream',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cop_nodes_network_node_uniq UNIQUE (network_id, node_id)
);

CREATE TABLE IF NOT EXISTS public.cop_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id text NOT NULL,
  node_id text NOT NULL,
  instance_id text NOT NULL,
  agent_name text NOT NULL,
  handler_type text NOT NULL DEFAULT 'runtime',
  handler_path text,
  intents jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cop_agents_network_node_instance_agent_uniq UNIQUE (network_id, node_id, instance_id, agent_name)
);

--------------------------------------------------------------------------------
-- 3. COP Accounting Kernel Tables (Events, Balances, Budgets)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cop_accounting_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version text NOT NULL DEFAULT '1.0',
  event_type text NOT NULL, -- budget, reservation, transaction, reversal, account
  idempotency_key text UNIQUE,
  topic_id uuid REFERENCES public.cop_topic(id) ON DELETE SET NULL,
  actor_id text NOT NULL,
  principal_id text NOT NULL,
  mandate_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cop_accounting_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  unit text NOT NULL DEFAULT 'EUR',
  domain text NOT NULL DEFAULT 'general',
  total_debit jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  total_credit jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  balance jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  last_event_id uuid REFERENCES public.cop_accounting_event(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cop_accounting_balance_account_unit_domain_uniq UNIQUE (account_id, unit, domain)
);

CREATE TABLE IF NOT EXISTS public.cop_accounting_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id text UNIQUE NOT NULL,
  account_id text NOT NULL,
  domain text NOT NULL DEFAULT 'general',
  granted jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  available jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  reserved jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  committed jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  spent jsonb NOT NULL DEFAULT '{"coefficient":"0","scale":0}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  expiration_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

--------------------------------------------------------------------------------
-- 4. Indexes & Row-Level Security
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cop_task_topic_status ON public.cop_task(topic_id, status);
CREATE INDEX IF NOT EXISTS idx_cop_event_topic_created_at ON public.cop_event(topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cop_artifact_topic ON public.cop_artifact(topic_id);
CREATE INDEX IF NOT EXISTS idx_cop_acct_event_idempotency ON public.cop_accounting_event(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_cop_acct_balance_account ON public.cop_accounting_balance(account_id);
CREATE INDEX IF NOT EXISTS idx_cop_acct_budget_account ON public.cop_accounting_budget(account_id);

ALTER TABLE public.cop_topic ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_artifact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_accounting_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_accounting_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cop_accounting_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read topics" ON public.cop_topic FOR SELECT USING (true);
CREATE POLICY "Public read cop_nodes" ON public.cop_nodes FOR SELECT USING (true);
CREATE POLICY "Public read cop_agents" ON public.cop_agents FOR SELECT USING (true);
CREATE POLICY "Public read cop_accounting_balance" ON public.cop_accounting_balance FOR SELECT USING (true);
CREATE POLICY "Public read cop_accounting_budget" ON public.cop_accounting_budget FOR SELECT USING (true);


-- Enregistrer la migration
SELECT register_migration('20260723', '20260723080000_cop_kernel_and_accounting_tables', '6d87c6301caa5bd5', NULL);

