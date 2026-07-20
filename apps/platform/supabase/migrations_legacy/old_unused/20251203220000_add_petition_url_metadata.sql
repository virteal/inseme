-- Migration: Add petition_url metadata field support
-- Date: 2025-12-03
-- Description: Documents the petition_url field in JSONB metadata for propositions and posts (incidents)
--
-- The petition_url field is stored in the existing JSONB metadata column.
-- This migration adds a comment and optional index for querying entities with petitions.
--
-- Schema: metadata.petition_url (string, nullable)
-- Example: {"schemaVersion": 1, "petition_url": "https://www.change.org/p/example-petition"}
--
-- Supported platforms (recommended):
--   - https://www.change.org
--   - https://www.mesopinions.com

-- Add comment to document the metadata field on propositions table
COMMENT ON COLUMN public.propositions.metadata IS
'JSONB metadata including: schemaVersion (int), petition_url (string, optional URL to external petition on Change.org or MesOpinions.com)';

-- Add comment to document the metadata field on posts table (for incidents)
COMMENT ON COLUMN public.posts.metadata IS
'JSONB metadata including: schemaVersion (int), subtype (string), incident (object), petition_url (string, optional URL to external petition)';

-- Optional: Create a partial index for faster queries on entities with petition_url
-- This index only includes rows where petition_url is present and non-null
CREATE INDEX IF NOT EXISTS idx_propositions_petition_url
ON public.propositions ((metadata->>'petition_url'))
WHERE metadata->>'petition_url' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_petition_url
ON public.posts ((metadata->>'petition_url'))
WHERE metadata->>'petition_url' IS NOT NULL;
