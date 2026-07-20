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
