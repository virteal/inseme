-- 1. Extend the role constraint to allow 'ai'
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role = ANY (ARRAY['user'::text, 'moderator'::text, 'admin'::text, 'ai'::text]));

-- 2. Add avatar_url if it doesn't exist (useful for UI)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='avatar_url') THEN
        ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- 3. Insert Ophélia as a permanent identity
INSERT INTO public.users (id, display_name, role, avatar_url, metadata)
VALUES (
    '00000000-0000-0000-0000-000000000001', 
    'Ophélia', 
    'ai', 
    'https://api.dicebear.com/7.x/bottts/svg?seed=Ophelia',
    '{"is_ai": true, "version": "2.0"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    avatar_url = EXCLUDED.avatar_url,
    metadata = public.users.metadata || EXCLUDED.metadata;

-- 4. Re-link messages to public.users instead of auth.users
-- This allows Ophélia's ID to be valid in the messages table
ALTER TABLE public.inseme_messages 
DROP CONSTRAINT IF EXISTS inseme_messages_user_id_fkey;

ALTER TABLE public.inseme_messages 
ADD CONSTRAINT inseme_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
