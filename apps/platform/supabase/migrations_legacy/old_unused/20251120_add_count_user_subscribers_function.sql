-- Function to count subscribers to user's content
CREATE OR REPLACE FUNCTION count_user_subscribers(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_subscribers INTEGER;
BEGIN
  -- Count unique users subscribed to any content created by target_user_id
  SELECT COUNT(DISTINCT cs.user_id) INTO total_subscribers
  FROM content_subscriptions cs
  WHERE (
    -- Posts by user
    (cs.content_type = 'post' AND cs.content_id IN (
      SELECT id FROM posts WHERE author_id = target_user_id
    ))
    OR
    -- Propositions by user
    (cs.content_type = 'proposition' AND cs.content_id IN (
      SELECT id FROM propositions WHERE author_id = target_user_id
    ))
    OR
    -- Wiki pages by user
    (cs.content_type = 'wiki_page' AND cs.content_id IN (
      SELECT DISTINCT id FROM wiki_pages WHERE author_id = target_user_id
    ))
  );
  
  RETURN COALESCE(total_subscribers, 0);
END;
$$;
