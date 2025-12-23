-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to inseme_messages
-- Using 1536 dimensions for OpenAI text-embedding-3-small
ALTER TABLE public.inseme_messages 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create a function to search messages by cosine similarity
CREATE OR REPLACE FUNCTION match_messages(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  room_id_filter text
)
RETURNS TABLE (
  id uuid,
  message text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    inseme_messages.id,
    inseme_messages.message,
    inseme_messages.metadata,
    1 - (inseme_messages.embedding <=> query_embedding) as similarity
  FROM inseme_messages
  WHERE 1 - (inseme_messages.embedding <=> query_embedding) > match_threshold
  AND inseme_messages.room_id::text = room_id_filter -- Cast to text if room_id is UUID/Slug mix, ideally distinct
  ORDER BY inseme_messages.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
