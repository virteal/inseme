-- ============================================================================
-- Migration: RAG Infrastructure Setup
-- Description: Adds RAG-specific columns to document_sources and creates
--              knowledge_chunks table with vector embeddings support
-- ============================================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. Extend document_sources table
-- ============================================================================

-- Add domain column (thematic categorization)
ALTER TABLE public.document_sources
ADD COLUMN IF NOT EXISTS domain text

COMMENT ON COLUMN public.document_sources.domain IS
'Thematic domain: civics (municipal), history (Corti d''Eri), budget, urbanisme, etc.';

-- Add source_type column (reliability/nature of source)
ALTER TABLE public.document_sources
ADD COLUMN IF NOT EXISTS source_type text

COMMENT ON COLUMN public.document_sources.source_type IS
'Type of source: official (mairie), history (cortideri), wiki, proposal, comment, forum';

-- Add external_id column (original system identifier)
ALTER TABLE public.document_sources
ADD COLUMN IF NOT EXISTS external_id text;

COMMENT ON COLUMN public.document_sources.external_id IS
'Original identifier from source system (e.g., cortideri:post_id=10657)';

-- Add unique constraint on external_id (nullable unique)
CREATE UNIQUE INDEX IF NOT EXISTS document_sources_external_id_key
ON public.document_sources (external_id)
WHERE external_id IS NOT NULL;

-- ============================================================================
-- 2. Create knowledge_chunks table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to source document
  source_id uuid REFERENCES public.document_sources(id) ON DELETE CASCADE,

  -- Content
  text text NOT NULL,
  text_hash text NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension

  -- Classification
  type text NOT NULL CHECK (type IN ('fact', 'allegation', 'opinion')),
  status text NOT NULL DEFAULT 'under_review'
    CHECK (status IN ('under_review', 'confirmed', 'refuted', 'obsolete')),

  -- Context
  source_type text NOT NULL,
  domain text NOT NULL,
  territory text NOT NULL DEFAULT 'Corte',

  -- Temporal
  info_date date, -- Logical date of the information (event date, council date, etc.)

  -- Layering (for filtering)
  layer text NOT NULL DEFAULT 'hot'
    CHECK (layer IN ('hot', 'summary', 'archive')),

  -- Flexible metadata (JSON)
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comments
COMMENT ON TABLE public.knowledge_chunks IS
'Atomic knowledge units with embeddings for RAG. Append-only: never edit, only add new chunks.';

COMMENT ON COLUMN public.knowledge_chunks.text IS
'Full text with header (TYPE/STATUS/DATE/SOURCE) + content';

COMMENT ON COLUMN public.knowledge_chunks.text_hash IS
'SHA-256 hash of normalized text for deduplication';

COMMENT ON COLUMN public.knowledge_chunks.type IS
'Nature of information: fact (verified), allegation (claimed), opinion (subjective)';

COMMENT ON COLUMN public.knowledge_chunks.status IS
'Verification status: under_review, confirmed, refuted, obsolete';

COMMENT ON COLUMN public.knowledge_chunks.layer IS
'Visibility layer: hot (active), summary (consolidated), archive (historical)';

COMMENT ON COLUMN public.knowledge_chunks.metadata IS
'Flexible metadata: {topic, tags, actors, kind_of_content, legal_cues, etc.}';

-- ============================================================================
-- 3. Indexes for performance
-- ============================================================================

-- Full-text search index (French)
CREATE INDEX IF NOT EXISTS knowledge_chunks_text_fts_idx
ON public.knowledge_chunks
USING GIN (to_tsvector('french', text));

-- Vector similarity search index (HNSW for better performance than IVFFlat)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
ON public.knowledge_chunks
USING hnsw (embedding vector_cosine_ops);

-- Deduplication index (unique per source_type)
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_text_hash_source_type_idx
ON public.knowledge_chunks (text_hash, source_type);

-- Filter indexes
CREATE INDEX IF NOT EXISTS knowledge_chunks_domain_idx
ON public.knowledge_chunks (domain);

CREATE INDEX IF NOT EXISTS knowledge_chunks_source_type_idx
ON public.knowledge_chunks (source_type);

CREATE INDEX IF NOT EXISTS knowledge_chunks_layer_idx
ON public.knowledge_chunks (layer);

CREATE INDEX IF NOT EXISTS knowledge_chunks_info_date_idx
ON public.knowledge_chunks (info_date DESC);

CREATE INDEX IF NOT EXISTS knowledge_chunks_status_idx
ON public.knowledge_chunks (status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS knowledge_chunks_domain_layer_status_idx
ON public.knowledge_chunks (domain, layer, status);

-- ============================================================================
-- 4. Helper functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for knowledge_chunks
DROP TRIGGER IF EXISTS update_knowledge_chunks_updated_at ON public.knowledge_chunks;
CREATE TRIGGER update_knowledge_chunks_updated_at
  BEFORE UPDATE ON public.knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Row Level Security (RLS) - Optional, adjust as needed
-- ============================================================================

-- Enable RLS on knowledge_chunks (read-only for all authenticated users)
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read
CREATE POLICY knowledge_chunks_select_policy
ON public.knowledge_chunks
FOR SELECT
TO authenticated, anon
USING (true);

-- Policy: Only service role can insert/update/delete
CREATE POLICY knowledge_chunks_insert_policy
ON public.knowledge_chunks
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY knowledge_chunks_update_policy
ON public.knowledge_chunks
FOR UPDATE
TO service_role
USING (true);

CREATE POLICY knowledge_chunks_delete_policy
ON public.knowledge_chunks
FOR DELETE
TO service_role
USING (true);

-- ============================================================================
-- 6. Sample data (optional, for testing)
-- ============================================================================

-- Uncomment to insert a test chunk
/*
INSERT INTO public.knowledge_chunks (
  text,
  text_hash,
  type,
  status,
  source_type,
  domain,
  territory,
  info_date,
  layer,
  metadata
) VALUES (
  E'TYPE: fact\nSTATUT: confirmed\nDATE: 2024-03-15\nSOURCE: Conseil Municipal de Corte\n\nDélibération 2024-03-15: Budget primitif 2024 adopté à l''unanimité.',
  encode(sha256('test-chunk-1'::bytea), 'hex'),
  'fact',
  'confirmed',
  'official',
  'civics',
  'Corte',
  '2024-03-15',
  'hot',
  '{"topic": "budget", "tags": ["budget", "2024"], "actors": ["Conseil Municipal"]}'::jsonb
);
*/

-- ============================================================================
-- Migration complete
-- ============================================================================
