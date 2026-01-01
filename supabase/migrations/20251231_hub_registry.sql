-- 20251231_hub_registry.sql
-- Create the instances table for dynamic tenant resolution

CREATE TABLE IF NOT EXISTS public.instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL, -- e.g. "corte", "bastia"
    custom_domain TEXT UNIQUE, -- e.g. "agora.corte.corsica"
    
    name TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access for resolution (via RPC usually, but direct select is fine for the Edge function if using service role)
-- Actually, resolution usually happens via a trusted function using Service Role, so RLS might block anonymous access.
-- Let's allow public read for now to facilitate the 'get_instance_by_subdomain' logic if it runs anonymously.
CREATE POLICY "Allow public read of instances" ON public.instances
    FOR SELECT
    USING (true);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_instances_slug ON public.instances(slug);
CREATE INDEX IF NOT EXISTS idx_instances_custom_domain ON public.instances(custom_domain);

-- RPC for resolution (optional, but requested in TODO)
CREATE OR REPLACE FUNCTION get_instance_by_subdomain(lookup_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    instance_record jsonb;
BEGIN
    SELECT to_jsonb(i) INTO instance_record
    FROM public.instances i
    WHERE i.slug = lookup_slug OR i.custom_domain = lookup_slug
    LIMIT 1;

    RETURN instance_record;
END;
$$;
