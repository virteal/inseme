-- Migration: Système de fédération des consultations
-- Date: 2025-12-04
-- Description: Permet l'import/export de consultations entre instances
--              Une commune peut héberger ou importer des consultations
--              Les réponses sont synchronisées vers l'instance source

-- ============================================================================
-- EXTENSION DE LA TABLE consultations
-- Ajout des champs pour la fédération
-- ============================================================================

-- Portée de la consultation
ALTER TABLE public.consultations
ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'local';

-- Ajouter contrainte CHECK pour scope
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'consultations_scope_check'
  ) THEN
    ALTER TABLE public.consultations
    ADD CONSTRAINT consultations_scope_check
    CHECK (scope IN ('local', 'regional', 'national', 'custom'));
  END IF;
END $$;

COMMENT ON COLUMN public.consultations.scope IS
  'Portée: local (commune), regional (ex: Corse), national (France), custom (réseau personnalisé)';

-- Instance source (pour les consultations importées)
ALTER TABLE public.consultations
ADD COLUMN IF NOT EXISTS source_instance text;

COMMENT ON COLUMN public.consultations.source_instance IS
  'URL de l''instance source si importée. NULL = hébergée localement';

-- ID de la consultation sur l'instance source
ALTER TABLE public.consultations
ADD COLUMN IF NOT EXISTS source_consultation_id uuid;

COMMENT ON COLUMN public.consultations.source_consultation_id IS
  'ID original sur l''instance source (pour la synchronisation)';

-- URL de l'API pour synchroniser les réponses
ALTER TABLE public.consultations
ADD COLUMN IF NOT EXISTS sync_endpoint text;

COMMENT ON COLUMN public.consultations.sync_endpoint IS
  'Endpoint API pour synchroniser les réponses vers la source';

-- Clé API pour la synchronisation (chiffrée en prod)
ALTER TABLE public.consultations
ADD COLUMN IF NOT EXISTS sync_api_key text;

COMMENT ON COLUMN public.consultations.sync_api_key IS
  'Clé API pour l''authentification lors de la synchronisation';

-- Configuration de fédération (métadonnées)
ALTER TABLE public.consultations
ADD COLUMN IF NOT EXISTS federation_config jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.consultations.federation_config IS
  'Configuration avancée: {"allow_import": true, "auto_sync": true, "regions": ["COR"], ...}';

-- Dernier sync
ALTER TABLE public.consultations
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;

COMMENT ON COLUMN public.consultations.last_synced_at IS
  'Dernière synchronisation réussie avec l''instance source';

-- Compteur de réponses synchronisées
ALTER TABLE public.consultations
ADD COLUMN IF NOT EXISTS synced_response_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.consultations.synced_response_count IS
  'Nombre de réponses synchronisées vers la source';

-- ============================================================================
-- EXTENSION DE LA TABLE consultation_responses
-- Ajout des champs pour le suivi de synchronisation
-- ============================================================================

-- Statut de synchronisation
ALTER TABLE public.consultation_responses
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'consultation_responses_sync_status_check'
  ) THEN
    ALTER TABLE public.consultation_responses
    ADD CONSTRAINT consultation_responses_sync_status_check
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'not_applicable'));
  END IF;
END $$;

COMMENT ON COLUMN public.consultation_responses.sync_status IS
  'Statut sync: pending (à synchroniser), synced (ok), failed (échec), not_applicable (consultation locale)';

-- Date de synchronisation
ALTER TABLE public.consultation_responses
ADD COLUMN IF NOT EXISTS synced_at timestamp with time zone;

-- ID de la réponse sur l'instance source (après sync)
ALTER TABLE public.consultation_responses
ADD COLUMN IF NOT EXISTS source_response_id uuid;

-- Nombre de tentatives de sync
ALTER TABLE public.consultation_responses
ADD COLUMN IF NOT EXISTS sync_attempts integer NOT NULL DEFAULT 0;

-- Dernière erreur de sync
ALTER TABLE public.consultation_responses
ADD COLUMN IF NOT EXISTS sync_error text;

-- ============================================================================
-- TABLE: federation_registry
-- Registre des instances connues dans le réseau fédéré
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.federation_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Identification de l'instance
  instance_url text NOT NULL UNIQUE,
  instance_name text NOT NULL,
  instance_type text NOT NULL DEFAULT 'commune',

  -- Métadonnées géographiques
  commune_name text,
  commune_insee text,
  region_name text,
  region_code text,

  -- Configuration
  api_endpoint text,
  api_key_hash text,                    -- Hash de la clé API (pas la clé en clair)
  is_hub boolean NOT NULL DEFAULT false, -- Instance hub régional/national

  -- Statut
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamp with time zone,
  last_seen_at timestamp with time zone,

  -- Métadonnées
  federation_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT federation_registry_pkey PRIMARY KEY (id),
  CONSTRAINT federation_registry_type_check CHECK (instance_type IN ('commune', 'region', 'national', 'custom')),
  CONSTRAINT federation_registry_status_check CHECK (status IN ('pending', 'active', 'suspended', 'revoked'))
);

-- Index
CREATE INDEX IF NOT EXISTS idx_federation_registry_status ON public.federation_registry(status);
CREATE INDEX IF NOT EXISTS idx_federation_registry_region ON public.federation_registry(region_code);
CREATE INDEX IF NOT EXISTS idx_federation_registry_hub ON public.federation_registry(is_hub) WHERE is_hub = true;

COMMENT ON TABLE public.federation_registry IS
  'Registre des instances participantes au réseau fédéré';

-- ============================================================================
-- TABLE: consultation_imports
-- Journal des imports de consultations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consultation_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Consultation locale créée par l'import
  local_consultation_id uuid NOT NULL,

  -- Source
  source_instance text NOT NULL,
  source_consultation_id uuid NOT NULL,
  source_slug text NOT NULL,

  -- Métadonnées d'import
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  imported_by uuid,

  -- Configuration d'import
  auto_sync boolean NOT NULL DEFAULT true,
  sync_interval_hours integer DEFAULT 1,

  -- Statut
  status text NOT NULL DEFAULT 'active',
  last_check_at timestamp with time zone,

  CONSTRAINT consultation_imports_pkey PRIMARY KEY (id),
  CONSTRAINT consultation_imports_local_fkey
    FOREIGN KEY (local_consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE,
  CONSTRAINT consultation_imports_status_check CHECK (status IN ('active', 'paused', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_consultation_imports_local
  ON public.consultation_imports(local_consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_imports_source
  ON public.consultation_imports(source_instance, source_consultation_id);

COMMENT ON TABLE public.consultation_imports IS
  'Journal des consultations importées depuis d''autres instances';

-- ============================================================================
-- RLS pour les nouvelles tables
-- ============================================================================

ALTER TABLE public.federation_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_imports ENABLE ROW LEVEL SECURITY;

-- Federation registry: lecture publique, écriture admin
DROP POLICY IF EXISTS "Public can view federation registry" ON public.federation_registry;
CREATE POLICY "Public can view federation registry" ON public.federation_registry
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Admins can manage federation registry" ON public.federation_registry;
CREATE POLICY "Admins can manage federation registry" ON public.federation_registry
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

-- Consultation imports: admins seulement
DROP POLICY IF EXISTS "Admins can manage consultation imports" ON public.consultation_imports;
CREATE POLICY "Admins can manage consultation imports" ON public.consultation_imports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- Mise à jour des consultations existantes
-- ============================================================================

-- Marquer quasquara comme locale
UPDATE public.consultations
SET scope = 'local',
    federation_config = '{"allow_import": false}'::jsonb
WHERE slug = 'quasquara-2024';

-- Marquer democratie-locale comme nationale et fédérée
UPDATE public.consultations
SET scope = 'national',
    federation_config = '{
      "allow_import": true,
      "auto_sync": true,
      "sync_interval_hours": 1,
      "collect_commune_data": true,
      "anonymize_for_export": false
    }'::jsonb
WHERE slug = 'democratie-locale-2024';

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE public.federation_registry IS
  'Registre des instances du réseau fédéré de consultations citoyennes';

COMMENT ON TABLE public.consultation_imports IS
  'Suivi des consultations importées depuis d''autres instances';
