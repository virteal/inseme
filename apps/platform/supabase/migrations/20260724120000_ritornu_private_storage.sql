-- Ritornu (#26): private platform storage for personal publication captures.
-- Captures are NOT public corpus documents and must not live in Git.
-- Bucket is private. Edge tools write with the service role (bypasses RLS).
-- Do not add broad storage.objects policies here: other buckets have their own RLS.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ritornu-private',
  'ritornu-private',
  false,
  10485760,
  ARRAY[
    'text/html',
    'text/plain',
    'text/markdown',
    'application/json',
    'application/zip',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO public.instance_config (key, value, value_json, category, description, is_public, is_secret)
VALUES
  (
    'feature_ritornu',
    'true',
    NULL,
    'features',
    'Enable Ritornu personal publication retrofit tools',
    true,
    false
  ),
  (
    'ritornu_storage_bucket',
    'ritornu-private',
    NULL,
    'storage',
    'Private Supabase bucket for Ritornu captures and package manifests',
    false,
    false
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = COALESCE(EXCLUDED.description, public.instance_config.description),
  is_public = EXCLUDED.is_public,
  is_secret = false,
  updated_at = now();
