-- Migration: Add indexes for hierarchical forum posts using metadata.parent_id
-- This improves query performance for parent-child relationships

-- Index for querying posts by parent_id (find children of a specific post)
CREATE INDEX IF NOT EXISTS idx_posts_metadata_parent_id
ON posts USING GIN ((metadata->'parent_id'));

-- Index for querying root posts (posts with no parent)
CREATE INDEX IF NOT EXISTS idx_posts_metadata_no_parent
ON posts ((metadata->'parent_id'))
WHERE metadata->'parent_id' IS NULL;

-- Index for querying by rootPostId (get all posts in a thread)
CREATE INDEX IF NOT EXISTS idx_posts_metadata_root_post_id
ON posts USING GIN ((metadata->'rootPostId'));

-- Combined index for forum type and parent_id queries
CREATE INDEX IF NOT EXISTS idx_posts_forum_parent
ON posts ((metadata->'postType'), (metadata->'parent_id'))
WHERE metadata->>'postType' = 'forum';

-- Index for thread depth queries (useful for limiting deep nesting)
CREATE INDEX IF NOT EXISTS idx_posts_metadata_thread_depth
ON posts USING GIN ((metadata->'threadDepth'));

COMMENT ON INDEX idx_posts_metadata_parent_id IS 'Optimizes queries for finding child posts of a parent';
COMMENT ON INDEX idx_posts_metadata_no_parent IS 'Optimizes queries for finding root-level posts';
COMMENT ON INDEX idx_posts_metadata_root_post_id IS 'Optimizes queries for fetching complete thread hierarchies';
COMMENT ON INDEX idx_posts_forum_parent IS 'Optimizes forum-specific parent-child queries';
COMMENT ON INDEX idx_posts_metadata_thread_depth IS 'Enables efficient depth-based filtering';
