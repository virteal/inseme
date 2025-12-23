-- Inseme SaaS: Room Registry
CREATE TABLE IF NOT EXISTS public.inseme_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inseme_rooms ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public rooms are viewable by everyone" 
ON public.inseme_rooms FOR SELECT 
USING (true);

CREATE POLICY "Owners can manage their own rooms" 
ON public.inseme_rooms FOR ALL 
USING (auth.uid() = owner_id);

-- Update inseme_messages to link to rooms (optional but recommended for large SaaS)
-- For now, we keep room_id as TEXT for compatibility with existing rooms, 
-- but in SaaS mode, room_id will match inseme_rooms.slug.

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_inseme_rooms_slug ON public.inseme_rooms(slug);
