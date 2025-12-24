-- Migration: Instance Vault - Configuration centralisée en base
-- Date: 2025-12-05
-- Description: Coffre-fort pour stocker les secrets et configurations de l'instance
--              Remplace les variables d'environnement par une configuration DB-first

-- ============================================================================
-- TABLE PRINCIPALE : instance_config
-- ============================================================================
-- Stocke TOUTE la configuration de l'instance en base
-- Les secrets sont chiffrés via pgcrypto (si besoin de chiffrement at-rest)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.instance_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Clé unique de configuration
  key text NOT NULL UNIQUE,

  -- Valeur (texte ou JSON)
  value text,
  value_json jsonb,

  -- Métadonnées
  category text NOT NULL DEFAULT 'general',  -- 'identity', 'secrets', 'branding', 'federation', 'features', 'integrations'
  description text,
  is_secret boolean DEFAULT false,           -- Si true, masqué dans les API publiques
  is_public boolean DEFAULT false,           -- Si true, accessible sans auth

  -- Versioning
  version integer DEFAULT 1,
  previous_value text,                       -- Pour audit trail

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_instance_config_category ON public.instance_config(category);
CREATE INDEX IF NOT EXISTS idx_instance_config_public ON public.instance_config(is_public) WHERE is_public = true;

-- ============================================================================
-- DONNÉES PAR DÉFAUT : Configuration d'instance
-- ============================================================================

-- === IDENTITÉ DE L'INSTANCE ===
INSERT INTO public.instance_config (key, value, category, description, is_public) VALUES
  -- Identité
  ('community_name', 'Corte', 'identity', 'Nom de la communauté (ville, asso, etc.)', true),
  ('community_type', 'municipality', 'identity', 'Type: municipality, association, university, cooperative, cse, copropriete...', true),
  ('community_tagline', 'CAPITALE', 'identity', 'Slogan/surnom (CAPITALE, UNIVERSITÉ, etc.)', true),
  ('community_code', '2B096', 'identity', 'Code INSEE, SIRET, ou identifiant unique', true),

  -- Localisation
  ('region_name', 'Corse', 'identity', 'Nom de la région', true),
  ('region_code', 'COR', 'identity', 'Code région', true),
  ('country', 'FR', 'identity', 'Code pays ISO', true),
  ('timezone', 'Europe/Paris', 'identity', 'Fuseau horaire', true),
  ('locale', 'fr-FR', 'identity', 'Langue/locale par défaut', true),

  -- Contact
  ('contact_email', 'jean_hugues_robert@yahoo.com', 'identity', 'Email de contact public', true),
  ('support_email', 'jean_hugues_robert@yahoo.com', 'identity', 'Email support technique', false)
ON CONFLICT (key) DO NOTHING;

-- === BRANDING ===
INSERT INTO public.instance_config (key, value, category, description, is_public) VALUES
  ('movement_name', 'Pertitellu', 'branding', 'Nom du mouvement/collectif', true),
  ('party_name', 'Petit Parti', 'branding', 'Nom du parti (si applicable)', true),
  ('hashtag', '#PERTITELLU', 'branding', 'Hashtag principal', true),
  ('bot_name', 'Ophélia', 'branding', 'Nom de l''assistant IA', true),
  ('primary_color', '#B35A4A', 'branding', 'Couleur primaire (hex)', true),
  ('secondary_color', '#3B4E6B', 'branding', 'Couleur secondaire (hex)', true),
  ('global_gazette_editor_group', 'La Gazette', 'branding', 'Nom du groupe éditeur de la gazette globale', true),
  ('facebook_page_url', '', 'branding', 'URL de la page Facebook', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.instance_config (key, value_json, category, description, is_public) VALUES
  ('logo', '{"url": "/images/logo.png", "alt": "Logo Corte"}', 'branding', 'Logo de l''instance', true),
  ('favicon', '{"url": "/favicon.ico"}', 'branding', 'Favicon', true)
ON CONFLICT (key) DO NOTHING;

-- === SECRETS (tokens, clés API) ===
INSERT INTO public.instance_config (key, value, category, description, is_secret) VALUES
  -- Supabase (cette instance)
  ('supabase_url', '', 'secrets', 'URL Supabase de cette instance', true),
  ('supabase_anon_key', '', 'secrets', 'Clé anonyme Supabase', true),
  ('supabase_service_role_key', '', 'secrets', 'Clé service role (DANGER)', true),

  -- Fédération
  ('national_api_url', '', 'secrets', 'URL du hub national pour fédération', true),
  ('national_api_key', '', 'secrets', 'Clé API pour fédération', true),

  -- IA
  ('openai_api_key', '', 'secrets', 'Clé API OpenAI', true),
  ('anthropic_api_key', '', 'secrets', 'Clé API Anthropic', true),
  ('huggingface_api_key', '', 'secrets', 'Clé API Hugging Face (frontend)', true),

  -- Social OAuth
  ('google_client_id', '', 'secrets', 'Google OAuth Client ID', true),
  ('google_client_secret', '', 'secrets', 'Google OAuth Secret', true),
  ('facebook_app_id', '', 'secrets', 'Facebook App ID', true),
  ('facebook_app_secret', '', 'secrets', 'Facebook App Secret', true),

  -- Email (SMTP ou service)
  ('smtp_host', '', 'secrets', 'Serveur SMTP', true),
  ('smtp_port', '587', 'secrets', 'Port SMTP', true),
  ('smtp_user', '', 'secrets', 'Utilisateur SMTP', true),
  ('smtp_password', '', 'secrets', 'Mot de passe SMTP', true),

  -- Netlify
  ('netlify_access_token', '', 'secrets', 'Token API Netlify', true),
  ('netlify_site_id', '', 'secrets', 'ID du site Netlify', true),

  -- GitHub (pour le wiki)
  ('github_token', '', 'secrets', 'Token GitHub pour sync wiki', true),
  ('github_repo', 'JeanHuguesRobert/survey', 'secrets', 'Repo GitHub (owner/repo)', true),
  ('github_wiki_branch', 'main', 'secrets', 'Branche pour le wiki', true)
ON CONFLICT (key) DO NOTHING;

-- === FÉDÉRATION ===
INSERT INTO public.instance_config (key, value, category, description, is_public) VALUES
  ('is_hub', 'false', 'federation', 'true si cette instance est un hub', true),
  ('hub_type', 'commune', 'federation', 'Type de hub: commune, epci, region, national', true),
  ('parent_hub_url', '', 'federation', 'URL du hub parent (si fédéré)', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.instance_config (key, value_json, category, description, is_public) VALUES
  ('federation_peers', '[]', 'federation', 'Liste des instances pairs (pour sync)', false)
ON CONFLICT (key) DO NOTHING;

-- === FEATURES FLAGS ===
INSERT INTO public.instance_config (key, value, category, description, is_public) VALUES
  ('feature_wiki', 'true', 'features', 'Wiki activé', true),
  ('feature_consultations', 'true', 'features', 'Consultations activées', true),
  ('feature_petitions', 'true', 'features', 'Pétitions activées', true),
  ('feature_chatbot', 'true', 'features', 'Chatbot Ophélia activé', true),
  ('feature_transparency', 'true', 'features', 'Module transparence activé', true),
  ('feature_social', 'true', 'features', 'Connexion sociale activée', true),
  ('feature_rag', 'true', 'features', 'RAG (recherche sémantique) activé', true),
  ('feature_ocr', 'true', 'features', 'OCR des PDF activé', true),
  ('feature_comments', 'true', 'features', 'Commentaires activés', true),
  ('feature_moderation', 'true', 'features', 'Modération IA activée', true)
ON CONFLICT (key) DO NOTHING;

-- === CARTE ===
INSERT INTO public.instance_config (key, value, category, description, is_public) VALUES
  ('map_default_lat', '42.3084', 'map', 'Latitude par défaut de la carte', true),
  ('map_default_lng', '9.1505', 'map', 'Longitude par défaut de la carte', true),
  ('map_default_zoom', '13', 'map', 'Zoom par défaut', true),
  ('map_style', 'osm', 'map', 'Style de carte: osm, satellite, cadastre', true)
ON CONFLICT (key) DO NOTHING;

-- === CHATBOT (ex chatbot_settings) ===
INSERT INTO public.instance_config (key, value, category, description, is_public) VALUES
  ('chatbot_welcome_message', 'Bonjour ! Je suis Ophélia. Comment puis-je vous aider ?', 'chatbot', 'Message d''accueil', true),
  ('chatbot_fallback_message', 'Désolée, je ne trouve pas de réponse. Souhaitez-vous créer une proposition ?', 'chatbot', 'Message de fallback', true),
  ('chatbot_similarity_threshold', '0.65', 'chatbot', 'Seuil de similarité pour RAG', false),
  ('chatbot_max_sources', '3', 'chatbot', 'Nombre max de sources à citer', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TRIGGER : Auto-update updated_at
-- ============================================================================

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

-- ============================================================================
-- RLS : Sécurité
-- ============================================================================

ALTER TABLE public.instance_config ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les configs publiques (non-secrets)
CREATE POLICY "instance_config_public_read" ON public.instance_config
  FOR SELECT
  USING (is_public = true AND is_secret = false);

-- Lecture complète pour les utilisateurs authentifiés (sauf secrets)
CREATE POLICY "instance_config_auth_read" ON public.instance_config
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_secret = false
  );

-- Lecture des secrets pour admins uniquement
CREATE POLICY "instance_config_admin_read_secrets" ON public.instance_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Écriture pour admins uniquement
CREATE POLICY "instance_config_admin_write" ON public.instance_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- FONCTIONS : Accès aux configurations
-- ============================================================================

-- Fonction pour récupérer une valeur de config
CREATE OR REPLACE FUNCTION get_instance_config(p_key text)
RETURNS text AS $$
DECLARE
  v_value text;
  v_is_secret boolean;
BEGIN
  SELECT value, is_secret INTO v_value, v_is_secret
  FROM public.instance_config
  WHERE key = p_key;

  -- Vérifier les permissions pour les secrets
  IF v_is_secret THEN
    -- Seuls les admins peuvent lire les secrets
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Permission denied for secret config';
    END IF;
  END IF;

  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour récupérer une config JSON
CREATE OR REPLACE FUNCTION get_instance_config_json(p_key text)
RETURNS jsonb AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT value_json INTO v_value
  FROM public.instance_config
  WHERE key = p_key;

  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour mettre à jour une config (admin only, via RPC)
CREATE OR REPLACE FUNCTION set_instance_config(
  p_key text,
  p_value text,
  p_updated_by uuid DEFAULT NULL
)
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

  UPDATE public.instance_config
  SET value = p_value, updated_by = COALESCE(p_updated_by, auth.uid())
  WHERE key = p_key;

  IF NOT FOUND THEN
    INSERT INTO public.instance_config (key, value, updated_by)
    VALUES (p_key, p_value, COALESCE(p_updated_by, auth.uid()));
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vue pour les configs publiques (safe pour le frontend)
CREATE OR REPLACE VIEW public.instance_config_public AS
SELECT key, value, value_json, category, description
FROM public.instance_config
WHERE is_public = true AND is_secret = false;

-- Vue complète pour les admins
CREATE OR REPLACE VIEW public.instance_config_admin AS
SELECT
  key,
  CASE WHEN is_secret THEN '***HIDDEN***' ELSE value END as value,
  value_json,
  category,
  description,
  is_secret,
  is_public,
  version,
  updated_at,
  updated_by
FROM public.instance_config;

-- ============================================================================
-- FONCTION : Exporter la config publique (pour le frontend)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_public_instance_config()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb := '{}';
  v_row record;
BEGIN
  FOR v_row IN
    SELECT key, value, value_json
    FROM public.instance_config
    WHERE is_public = true AND is_secret = false
  LOOP
    IF v_row.value_json IS NOT NULL THEN
      v_result := v_result || jsonb_build_object(v_row.key, v_row.value_json);
    ELSIF v_row.value IS NOT NULL THEN
      v_result := v_result || jsonb_build_object(v_row.key, v_row.value);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE public.instance_config IS 'Coffre-fort de configuration de l''instance - remplace les variables d''environnement';
COMMENT ON FUNCTION get_instance_config IS 'Récupère une valeur de configuration (vérifie les permissions pour les secrets)';
COMMENT ON FUNCTION set_instance_config IS 'Met à jour une configuration (admin only)';
COMMENT ON FUNCTION get_public_instance_config IS 'Récupère toutes les configurations publiques en JSON (pour le frontend)';
COMMENT ON VIEW public.instance_config_public IS 'Vue des configurations publiques (safe pour le frontend)';
COMMENT ON VIEW public.instance_config_admin IS 'Vue admin avec secrets masqués';
