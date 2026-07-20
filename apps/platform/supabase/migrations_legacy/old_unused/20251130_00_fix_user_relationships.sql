-- Migration to fix auth.users vs public.users relationships

-- 1. Backfill public.users to ensure all auth.users exist in public.users
-- This ensures that when we switch the FKs, all existing IDs are valid.
INSERT INTO public.users (id, display_name, created_at, updated_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)),
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 2. Update chat_interactions
ALTER TABLE public.chat_interactions
DROP CONSTRAINT chat_interactions_user_id_fkey;

ALTER TABLE public.chat_interactions
ADD CONSTRAINT chat_interactions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id);

-- 3. Update collected_data
ALTER TABLE public.collected_data
DROP CONSTRAINT collected_data_user_id_fkey;

ALTER TABLE public.collected_data
ADD CONSTRAINT collected_data_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id);

-- 4. Update document_sources
ALTER TABLE public.document_sources
DROP CONSTRAINT document_sources_ingested_by_fkey;

ALTER TABLE public.document_sources
ADD CONSTRAINT document_sources_ingested_by_fkey
FOREIGN KEY (ingested_by) REFERENCES public.users(id);

-- 5. Update tasks
ALTER TABLE public.tasks
DROP CONSTRAINT tasks_owner_fkey;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_owner_fkey
FOREIGN KEY (owner) REFERENCES public.users(id);

-- 6. Update wiki_pages
ALTER TABLE public.wiki_pages
DROP CONSTRAINT wiki_pages_author_id_fkey;

ALTER TABLE public.wiki_pages
ADD CONSTRAINT wiki_pages_author_id_fkey
FOREIGN KEY (author_id) REFERENCES public.users(id);
