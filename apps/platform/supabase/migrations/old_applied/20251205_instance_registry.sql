-- Migration: Instance Registry - Registre central des instances
-- Date: 2025-12-05
-- Description: Table de mapping sous-domaine → configuration Supabase
--              Permet le routage multi-instances
--
-- NOTES :
-- - Cette table est dans le "hub central" ou chaque instance individuelle
-- - En mode fédéré, chaque hub régional a sa propre copie
-- - En mode simple, une seule instance avec cette table suffit

-- ============================================================================
-- TABLE : instance_registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.instance_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  subdomain text UNIQUE NOT NULL,           -- 'corte', 'bastia', 'universite'
  display_name text NOT NULL,               -- 'Ville de Corte'
  description text,                         -- Description optionnelle

  -- Configuration Supabase
  supabase_url text NOT NULL,               -- 'https://xxx.supabase.co'
  supabase_anon_key text NOT NULL,          -- Clé publique (exposée au frontend)
  -- Note: La service_role_key n'est JAMAIS stockée ici (trop sensible)

  -- Statut
  status text NOT NULL DEFAULT 'active'     -- 'pending', 'active', 'suspended', 'archived'
    CHECK (status IN ('pending', 'active', 'suspended', 'archived')),

  -- Métadonnées
  metadata jsonb DEFAULT '{}',              -- { insee, type, region, population, etc. }

  -- Type d'instance
  instance_type text DEFAULT 'municipality' -- 'municipality', 'epci', 'region', 'association', 'university', 'cooperative'
    CHECK (instance_type IN ('municipality', 'epci', 'region', 'national', 'association', 'university', 'cooperative', 'cse', 'copropriete', 'other')),

  -- Fédération
  is_hub boolean DEFAULT false,             -- true si c'est un hub (agrège d'autres instances)
  hub_type text,                            -- 'epci', 'region', 'national'
  parent_hub_id uuid REFERENCES public.instance_registry(id),

  -- Branding minimal (pour la page de sélection)
  logo_url text,                            -- URL du logo
  primary_color text DEFAULT '#B35A4A',     -- Couleur primaire

  -- Domaine personnalisé
  custom_domain text,                       -- 'transparence-corte.fr' (optionnel)

  -- Contact
  admin_email text,                         -- Email de l'admin de l'instance
  contact_email text,                       -- Email de contact public

  -- Statistiques (mises à jour périodiquement)
  stats jsonb DEFAULT '{}',                 -- { users_count, posts_count, last_activity, etc. }

  -- Versioning du schéma (synchronisé depuis chaque instance)
  schema_version text,                      -- Version courante du schéma de l'instance
  schema_updated_at timestamptz,            -- Dernière mise à jour du schéma
  migrations_count integer DEFAULT 0,       -- Nombre de migrations appliquées

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  activated_at timestamptz,                 -- Date d'activation
  suspended_at timestamptz                  -- Date de suspension (si applicable)
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_instance_registry_status ON public.instance_registry(status);
CREATE INDEX IF NOT EXISTS idx_instance_registry_type ON public.instance_registry(instance_type);
CREATE INDEX IF NOT EXISTS idx_instance_registry_hub ON public.instance_registry(is_hub) WHERE is_hub = true;
CREATE INDEX IF NOT EXISTS idx_instance_registry_parent ON public.instance_registry(parent_hub_id);

-- ============================================================================
-- TRIGGER : Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_instance_registry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_instance_registry_updated ON public.instance_registry;
CREATE TRIGGER trigger_instance_registry_updated
  BEFORE UPDATE ON public.instance_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_instance_registry_timestamp();

-- ============================================================================
-- RLS : Sécurité
-- ============================================================================

ALTER TABLE public.instance_registry ENABLE ROW LEVEL SECURITY;

-- Lecture publique des instances actives (pour le frontend)
CREATE POLICY "instance_registry_public_read" ON public.instance_registry
  FOR SELECT
  USING (status = 'active');

-- Lecture complète pour admins
CREATE POLICY "instance_registry_admin_read" ON public.instance_registry
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Écriture pour admins uniquement
CREATE POLICY "instance_registry_admin_write" ON public.instance_registry
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- FONCTIONS : API de lookup
-- ============================================================================

/**
 * Récupère une instance par son sous-domaine
 * Fonction publique (pas besoin d'auth)
 */
CREATE OR REPLACE FUNCTION get_instance_by_subdomain(p_subdomain text)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'subdomain', subdomain,
    'display_name', display_name,
    'supabase_url', supabase_url,
    'supabase_anon_key', supabase_anon_key,
    'instance_type', instance_type,
    'is_hub', is_hub,
    'logo_url', logo_url,
    'primary_color', primary_color,
    'metadata', metadata
  )
  INTO v_result
  FROM public.instance_registry
  WHERE subdomain = p_subdomain
    AND status = 'active';

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Liste toutes les instances actives (pour page de sélection)
 */
CREATE OR REPLACE FUNCTION list_active_instances()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'subdomain', subdomain,
      'display_name', display_name,
      'instance_type', instance_type,
      'logo_url', logo_url,
      'primary_color', primary_color,
      'description', description,
      'metadata', metadata
    )
    ORDER BY display_name
  )
  INTO v_result
  FROM public.instance_registry
  WHERE status = 'active';

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Enregistre une nouvelle instance (admin only)
 */
CREATE OR REPLACE FUNCTION register_instance(
  p_subdomain text,
  p_display_name text,
  p_supabase_url text,
  p_supabase_anon_key text,
  p_instance_type text DEFAULT 'municipality',
  p_metadata jsonb DEFAULT '{}',
  p_admin_email text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Vérifier permissions admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  INSERT INTO public.instance_registry (
    subdomain,
    display_name,
    supabase_url,
    supabase_anon_key,
    instance_type,
    metadata,
    admin_email,
    status
  ) VALUES (
    p_subdomain,
    p_display_name,
    p_supabase_url,
    p_supabase_anon_key,
    p_instance_type,
    p_metadata,
    p_admin_email,
    'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Active une instance
 */
CREATE OR REPLACE FUNCTION activate_instance(p_subdomain text)
RETURNS boolean AS $$
BEGIN
  -- Vérifier permissions admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.instance_registry
  SET status = 'active', activated_at = now()
  WHERE subdomain = p_subdomain;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VUE PUBLIQUE (safe pour le frontend)
-- ============================================================================

CREATE OR REPLACE VIEW public.instances_public AS
SELECT
  subdomain,
  display_name,
  description,
  instance_type,
  is_hub,
  logo_url,
  primary_color,
  metadata->>'region' as region,
  metadata->>'insee' as insee,
  metadata->>'population' as population
FROM public.instance_registry
WHERE status = 'active'
ORDER BY display_name;

-- ============================================================================
-- DONNÉES D'EXEMPLE
-- ============================================================================

-- Instance par défaut (Corte) - à adapter selon votre environnement
-- INSERT INTO public.instance_registry (
--   subdomain,
--   display_name,
--   supabase_url,
--   supabase_anon_key,
--   instance_type,
--   metadata,
--   status
-- ) VALUES (
--   'corte',
--   'Ville de Corte',
--   'https://your-project.supabase.co',
--   'your-anon-key',
--   'municipality',
--   '{"insee": "2B096", "region": "COR", "population": 7737}',
--   'active'
-- ) ON CONFLICT (subdomain) DO NOTHING;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE public.instance_registry IS 'Registre central des instances multi-tenants - mapping sous-domaine → Supabase';
COMMENT ON FUNCTION get_instance_by_subdomain IS 'Récupère la config d''une instance par son sous-domaine (public)';
COMMENT ON FUNCTION list_active_instances IS 'Liste toutes les instances actives (pour page de sélection)';
COMMENT ON FUNCTION register_instance IS 'Enregistre une nouvelle instance (admin only)';
COMMENT ON VIEW public.instances_public IS 'Vue publique des instances pour le frontend';
