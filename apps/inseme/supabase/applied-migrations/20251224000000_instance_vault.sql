-- Migration: Instance Vault - Configuration centralisée en base pour Inseme
-- Date: 2025-12-24
-- Description: Coffre-fort pour stocker les secrets et configurations de l'instance

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
  updated_by uuid REFERENCES auth.users(id)
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_instance_config_category ON public.instance_config(category);
CREATE INDEX IF NOT EXISTS idx_instance_config_public ON public.instance_config(is_public) WHERE is_public = true;

-- Trigger pour l'audit trail
CREATE OR REPLACE FUNCTION update_instance_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = OLD.version + 1;
  NEW.previous_value = OLD.value;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_instance_config_updated ON public.instance_config;
CREATE TRIGGER trigger_instance_config_updated
  BEFORE UPDATE ON public.instance_config
  FOR EACH ROW
  EXECUTE FUNCTION update_instance_config_timestamp();

-- RLS
ALTER TABLE public.instance_config ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les configs publiques
CREATE POLICY "instance_config_public_read" ON public.instance_config
  FOR SELECT
  USING (is_public = true AND is_secret = false);

-- Lecture pour les utilisateurs authentifiés (sauf secrets)
CREATE POLICY "instance_config_auth_read" ON public.instance_config
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_secret = false
  );
