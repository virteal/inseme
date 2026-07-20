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
