-- Migration: Tables pour la gestion des instances communales
-- Date: 2025-12-05
-- Description: Gestion du provisioning des instances (modèle 100% gratuit, association C.O.R.S.I.C.A.)

-- Table principale des instances
CREATE TABLE IF NOT EXISTS public.saas_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification de la commune
  commune_name text NOT NULL,
  commune_insee text,                    -- Code INSEE (ex: '2B096')
  region_code text,                      -- Code région INSEE (ex: '94' pour Corse)
  epci_siren text,                       -- SIREN de l'EPCI si applicable

  -- Type d'instance
  is_hub boolean DEFAULT false,          -- true si hub régional/EPCI
  hub_type text CHECK (hub_type IN ('commune', 'epci', 'region', 'national')),

  -- Infrastructure
  instance_url text,                     -- URL du frontend (Netlify)
  supabase_project_id text,              -- ID du projet Supabase
  supabase_url text,                     -- URL Supabase
  netlify_site_id text,                  -- ID du site Netlify

  -- Statut (pas de plans payants, tout est gratuit)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'provisioning', 'active', 'suspended', 'error')),

  -- Admin de l'instance
  admin_email text NOT NULL,
  admin_user_id uuid,

  -- Métriques d'usage (pour monitoring, pas facturation)
  storage_used_bytes bigint DEFAULT 0,
  api_calls_month integer DEFAULT 0,
  users_count integer DEFAULT 0,
  last_activity_at timestamptz,

  -- Métadonnées
  metadata jsonb DEFAULT '{}',
  provisioning_log jsonb DEFAULT '[]',   -- Historique des étapes de provisioning

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Contraintes
  CONSTRAINT unique_commune_insee UNIQUE (commune_insee)
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_saas_instances_status ON public.saas_instances(status);
CREATE INDEX IF NOT EXISTS idx_saas_instances_region ON public.saas_instances(region_code);
CREATE INDEX IF NOT EXISTS idx_saas_instances_epci ON public.saas_instances(epci_siren);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_saas_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_saas_instances_updated_at ON public.saas_instances;
CREATE TRIGGER trigger_saas_instances_updated_at
  BEFORE UPDATE ON public.saas_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_saas_instances_updated_at();

-- Table pour les logs de provisioning détaillés
CREATE TABLE IF NOT EXISTS public.saas_provisioning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.saas_instances(id) ON DELETE CASCADE,

  step text NOT NULL,                    -- 'supabase', 'migrations', 'netlify', 'env', 'federation', 'admin'
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error', 'skipped')),

  started_at timestamptz,
  completed_at timestamptz,

  details jsonb DEFAULT '{}',            -- Détails de l'étape (IDs créés, erreurs, etc.)
  error_message text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_logs_instance ON public.saas_provisioning_logs(instance_id);

-- Table pour stocker les configurations de provisioning (tokens, etc.)
-- Note: Les tokens sensibles doivent être stockés de manière sécurisée (vault, env vars)
CREATE TABLE IF NOT EXISTS public.saas_config (
  key text PRIMARY KEY,
  value text,
  is_secret boolean DEFAULT false,       -- Si true, ne pas exposer via API
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Insérer les clés de config par défaut (valeurs à remplir)
-- Note: Pas de Stripe, modèle 100% gratuit
INSERT INTO public.saas_config (key, value, is_secret, description) VALUES
  ('supabase_org_id', '', true, 'Organization ID Supabase pour créer les projets'),
  ('supabase_access_token', '', true, 'Token API Supabase Management'),
  ('supabase_region', 'eu-west-3', false, 'Région par défaut pour les nouveaux projets'),
  ('netlify_access_token', '', true, 'Token API Netlify'),
  ('netlify_team_slug', '', false, 'Slug de l''équipe Netlify'),
  ('default_domain', 'transparence-commune.fr', false, 'Domaine par défaut pour les sous-domaines'),
  ('helloasso_url', 'https://www.helloasso.com/associations/corsica', false, 'URL page dons HelloAsso')
ON CONFLICT (key) DO NOTHING;

-- Vue pour les stats dashboard (modèle gratuit, pas de MRR)
CREATE OR REPLACE VIEW public.saas_dashboard_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'active') as active_instances,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_instances,
  COUNT(*) FILTER (WHERE status = 'error') as error_instances,
  COUNT(*) FILTER (WHERE hub_type = 'commune') as commune_count,
  COUNT(*) FILTER (WHERE hub_type = 'epci') as epci_count,
  COUNT(*) FILTER (WHERE hub_type = 'region') as region_count,
  -- Totaux
  COUNT(*) as total_instances,
  SUM(users_count) as total_users,
  SUM(storage_used_bytes) as total_storage_bytes
FROM public.saas_instances;

-- RLS policies
ALTER TABLE public.saas_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_provisioning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_config ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent voir/modifier les instances SaaS
CREATE POLICY "saas_instances_admin_only" ON public.saas_instances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND (role = 'admin' )
    )
  );

CREATE POLICY "saas_provisioning_logs_admin_only" ON public.saas_provisioning_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND (role = 'admin' )
    )
  );

-- Config: lecture pour admins, écriture restreinte
CREATE POLICY "saas_config_admin_read" ON public.saas_config
  FOR SELECT
  USING (
    -- Ne pas exposer les secrets via l'API standard
    is_secret = false OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "saas_config_admin_write" ON public.saas_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Fonction pour ajouter un log de provisioning
CREATE OR REPLACE FUNCTION log_provisioning_step(
  p_instance_id uuid,
  p_step text,
  p_status text,
  p_details jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.saas_provisioning_logs (instance_id, step, status, details, started_at)
  VALUES (p_instance_id, p_step, p_status, p_details,
          CASE WHEN p_status = 'running' THEN now() ELSE NULL END)
  RETURNING id INTO v_log_id;

  -- Mettre à jour le provisioning_log de l'instance
  UPDATE public.saas_instances
  SET provisioning_log = provisioning_log || jsonb_build_object(
    'step', p_step,
    'status', p_status,
    'timestamp', now(),
    'details', p_details
  )
  WHERE id = p_instance_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.saas_instances IS 'Instances SaaS des communes - gestion du provisioning et facturation';
COMMENT ON TABLE public.saas_provisioning_logs IS 'Logs détaillés des étapes de provisioning';
COMMENT ON TABLE public.saas_config IS 'Configuration du système SaaS (tokens, paramètres)';
