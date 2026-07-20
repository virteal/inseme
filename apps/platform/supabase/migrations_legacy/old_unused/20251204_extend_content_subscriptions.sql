-- Migration: Extend content_subscriptions for all content types
-- Date: 2025-12-04
-- Description: Étendre les types de contenu pour les abonnements

-- Step 1: Drop existing constraint
ALTER TABLE public.content_subscriptions
DROP CONSTRAINT IF EXISTS content_subscriptions_content_type_check;

-- Step 2: Add new constraint with all content types
ALTER TABLE public.content_subscriptions
ADD CONSTRAINT content_subscriptions_content_type_check
CHECK (content_type IN (
  'post',
  'proposition',
  'wiki_page',
  'user',
  'group',
  'mission',
  'task_project',
  'fil_item',
  'tag'
));

-- Comment
COMMENT ON TABLE public.content_subscriptions IS
  'Abonnements utilisateurs à tout type de contenu';
