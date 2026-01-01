-- Migration pour activer le stockage FTS et Embeddings sur le Wiki
-- Note: La logique de génération est gérée côté application (Javascript)

-- 1. Colonnes de stockage
ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS fts_tokens tsvector;
ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 2. Index de performance
CREATE INDEX IF NOT EXISTS wiki_pages_fts_idx ON wiki_pages USING GIN (fts_tokens);
CREATE INDEX IF NOT EXISTS wiki_pages_embedding_idx ON wiki_pages USING hnsw (embedding vector_cosine_ops);
