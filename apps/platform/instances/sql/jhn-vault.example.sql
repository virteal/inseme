-- Seed vault for personal instance JHN (dogfooding)
-- Run on the JHN Supabase project only (SQL Editor).
-- Requires public.instance_config (see old_applied/20251205_instance_vault.sql).
-- Safe to re-run: ON CONFLICT (key) DO UPDATE.

INSERT INTO public.instance_config (key, value, category, description, is_public, is_secret)
VALUES
  ('community_name', 'Jean Hugues Noël Robert — instance personnelle', 'identity',
   'Libellé affiché de l''instance', true, false),
  ('community_type', 'association', 'identity',
   'Enum legacy schéma ; sémantique réelle = personal-twin', true, false),
  ('community_tagline', 'Communauté cognitive personnelle sous mandat', 'identity',
   'Tagline', true, false),
  ('community_code', 'jhn', 'identity', 'Code instance', true, false),
  ('region_name', 'Corse', 'identity', 'Région', true, false),
  ('region_code', 'COR', 'identity', 'Code région', true, false),
  ('country', 'FR', 'identity', 'Pays', true, false),
  ('timezone', 'Europe/Paris', 'identity', 'Fuseau', true, false),
  ('locale', 'fr-FR', 'identity', 'Locale', true, false),
  ('contact_email', 'jhr@baronsmariani.org', 'identity', 'Contact public', true, false),
  ('support_email', 'jhr@baronsmariani.org', 'identity', 'Support', false, false),
  ('deployment_kind', 'personal', 'identity', 'personal | civic | institutional | …', true, false),
  ('subject_kind', 'living_person', 'identity', 'Sujet représenté', true, false),
  ('community_kind', 'cognitive', 'identity', 'Société hébergée (Minsky / mandats)', true, false),
  ('host_domain', 'baronsmariani.org', 'identity', 'Apex DNS', true, false),
  ('app_url', 'https://jhn.baronsmariani.org', 'identity', 'URL canonique', true, false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

INSERT INTO public.instance_config (key, value, category, description, is_public, is_secret)
VALUES
  ('movement_name', 'Corpus / Cogentia', 'branding', 'Mouvement / cadre', true, false),
  ('party_name', '', 'branding', 'Pas un parti — instance personnelle', true, false),
  ('hashtag', '#PERTITELLU', 'branding', 'Hashtag optionnel', true, false),
  ('bot_name', 'Ophélia', 'branding', 'Médiateur IA', true, false),
  ('primary_color', '#3B4E6B', 'branding', 'Couleur primaire', true, false),
  ('secondary_color', '#B35A4A', 'branding', 'Couleur secondaire', true, false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- Optional: map center Corte (for map brique if loaded)
INSERT INTO public.instance_config (key, value_json, category, description, is_public, is_secret)
VALUES
  ('map_default_center', '[42.3084, 9.1505]'::jsonb, 'features',
   'Centre carte par défaut', true, false)
ON CONFLICT (key) DO UPDATE SET
  value_json = EXCLUDED.value_json,
  updated_at = now();
