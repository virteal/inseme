-- Migration: 20251206_municipal_schema.sql
-- Description: Schema for Municipal Data Ingestion (Corte Reference)
--              Adds tracking tables (sources, raw docs) and normalized tables (POI, generic docs).
--              Extends posts table for Events.

-- 0. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Ingestion Tracking Tables

-- Sources Web: Registries of websites/APIs being scraped
CREATE TABLE IF NOT EXISTS public.sources_web (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label text NOT NULL,                -- e.g., "Mairie de Corte - Agenda"
    base_url text NOT NULL,             -- e.g., "https://www.mairie-corte.fr/"
    description text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Crawl Runs: Execution logs for scrapers
CREATE TABLE IF NOT EXISTS public.crawl_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid REFERENCES public.sources_web(id),
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz,
    status text DEFAULT 'running',      -- 'running' | 'ok' | 'error'
    error_message text
);

-- Raw Documents: Versioned storage of scraped content
-- "municipal_" prefix to distinguish from RAG document_sources
CREATE TABLE IF NOT EXISTS public.municipal_raw_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid REFERENCES public.sources_web(id),
    crawl_run_id uuid REFERENCES public.crawl_runs(id),
    url text NOT NULL,
    content_type text,                  -- 'text/html', 'text/xml', 'application/pdf'
    http_status integer,
    retrieved_at timestamptz DEFAULT now(),
    etag text,
    last_modified text,
    body bytea,                         -- Binary body (optional, for PDFs/Images)
    body_text text,                     -- Cleaned text or raw HTML string
    hash_content text,                  -- content checksum for dedup/change detection
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Index for idempotency checks
CREATE UNIQUE INDEX IF NOT EXISTS municipal_raw_documents_url_hash_idx
    ON public.municipal_raw_documents (url, hash_content);

-- 2. Normalized Municipal Tables

-- Municipal POI: Points of Interest (Mairie, Schools, Sports, etc.)
CREATE TABLE IF NOT EXISTS public.municipal_poi (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid REFERENCES public.sources_web(id),
    source_poi_id text,                 -- ID from source (e.g. SimpleCarto ID)
    raw_document_id uuid REFERENCES public.municipal_raw_documents(id),

    name text NOT NULL,
    category text,                      -- 'mairie', 'sport', 'culture'
    subcategory text,
    description text,

    -- Geometry
    latitude double precision,
    longitude double precision,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (
        CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        ELSE NULL END
    ) STORED,

    external_url text,
    internal_page_url text,
    metadata jsonb DEFAULT '{}',

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS municipal_poi_geom_idx ON public.municipal_poi USING GIST (geom);

-- Municipal Documents: Generic docs (PDFs, Pages) that aren't posts
CREATE TABLE IF NOT EXISTS public.municipal_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid REFERENCES public.sources_web(id),
    source_doc_id text,
    source_url text NOT NULL,

    type text NOT NULL,                 -- 'news', 'page', 'download', 'act'
    title text NOT NULL,
    summary text,
    content_html text,

    published_at timestamptz,

    attachment_url text,
    attachment_content_type text,

    raw_document_id uuid REFERENCES public.municipal_raw_documents(id),
    metadata jsonb DEFAULT '{}',

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);


-- 4. RLS Policies

-- Enable RLS
ALTER TABLE public.sources_web ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_raw_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_poi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_documents ENABLE ROW LEVEL SECURITY;

-- Public Read Policies (Transparency)
CREATE POLICY "Public can view sources" ON public.sources_web FOR SELECT USING (true);
CREATE POLICY "Public can view POIs" ON public.municipal_poi FOR SELECT USING (true);
CREATE POLICY "Public can view municipal docs" ON public.municipal_documents FOR SELECT USING (true);
-- Note: Raw documents might contain noise, maybe restrict? No, transparency first.
CREATE POLICY "Public can view raw docs" ON public.municipal_raw_documents FOR SELECT USING (true);
CREATE POLICY "Public can view crawl runs" ON public.crawl_runs FOR SELECT USING (true);

-- Authenticated/Service Role Write Policies
-- Only service role (crawlers) or admins should write.
-- For simple MVP using standard authenticated policies for now, restricted to admins usually.
-- But ingestion scripts run potentially as service_role.

-- Allow service role full access (implicit, but good to note)
-- We just add a policy for authenticated admins to manage configuration if needed.
