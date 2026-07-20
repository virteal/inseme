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
