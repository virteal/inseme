-- Migration: Create document_sources table for tracking ingested documents
-- Purpose: Track all documents uploaded to Supabase Storage and indexed in Gemini Context Cache
-- Date: 2025-11-20

-- Create table for document source tracking
CREATE TABLE IF NOT EXISTS document_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    public_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT,
    metadata JSONB DEFAULT '{}',
    first_ingested_at TIMESTAMPTZ DEFAULT NOW(),
    last_ingested_at TIMESTAMPTZ DEFAULT NOW(),
    ingestion_method TEXT CHECK (ingestion_method IN ('ui_upload', 'cli_bulk', 'cache_rebuild')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    ingested_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_document_sources_hash ON document_sources(content_hash);
CREATE INDEX idx_document_sources_status ON document_sources(status);
CREATE INDEX idx_document_sources_ingested_at ON document_sources(last_ingested_at DESC);
CREATE INDEX idx_document_sources_filename ON document_sources(filename);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_document_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER trigger_update_document_sources_updated_at
    BEFORE UPDATE ON document_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_document_sources_updated_at();

-- Add comment for documentation
COMMENT ON TABLE document_sources IS 'Tracks all documents uploaded to Supabase Storage and indexed in Gemini Context Cache';
COMMENT ON COLUMN document_sources.content_hash IS 'SHA-256 hash of file content for deduplication';
COMMENT ON COLUMN document_sources.metadata IS 'JSONB field for storing extracted metadata (type, date, description, etc.)';
COMMENT ON COLUMN document_sources.ingestion_method IS 'How the document was ingested: ui_upload, cli_bulk, or cache_rebuild';
