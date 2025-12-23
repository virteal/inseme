-- 1. Ensure public.users table exists and has correct columns
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin', 'ai')),
    avatar_url TEXT,
    public_profile BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add missing columns if table already existed
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='public_profile') THEN
        ALTER TABLE public.users ADD COLUMN public_profile BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='created_at') THEN
        ALTER TABLE public.users ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='updated_at') THEN
        ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 3. Robust Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$ 
DECLARE 
  requested_name text; 
  room_name text; 
  final_name text; 
  is_anonymous boolean; 
BEGIN 
  -- Detect anonymity
  is_anonymous := (NEW.email IS NULL OR NEW.email = ''); 
  
  -- Extract room from metadata safely
  IF NEW.raw_user_meta_data IS NOT NULL THEN
    room_name := NEW.raw_user_meta_data->>'initial_room'; 
    requested_name := COALESCE( 
      NEW.raw_user_meta_data->>'display_name', 
      NEW.raw_user_meta_data->>'full_name'
    );
  END IF;

  -- Fallback for name
  IF requested_name IS NULL THEN
    IF NOT is_anonymous THEN 
      requested_name := split_part(NEW.email, '@', 1);
    ELSE 
      requested_name := 'Invité'; 
    END IF;
  END IF;

  -- Construction for guests: "Name (Invité) @ Room"
  IF is_anonymous THEN 
    final_name := requested_name || ' (Invité)'; 
    IF room_name IS NOT NULL THEN 
      final_name := final_name || ' @ ' || room_name; 
    END IF; 
  ELSE 
    final_name := requested_name; 
  END IF; 

  -- Collision detection (append short ID if name already taken)
  IF EXISTS (SELECT 1 FROM public.users WHERE display_name = final_name AND id != NEW.id) THEN 
    final_name := final_name || ' #' || substr(NEW.id::text, 1, 4); 
  END IF; 

  -- Insert or Update
  INSERT INTO public.users ( 
    id, 
    display_name, 
    role, 
    public_profile, 
    metadata,
    updated_at
  ) 
  VALUES ( 
    NEW.id, 
    final_name, 
    'user', 
    true, 
    jsonb_build_object( 
      'schemaVersion', 1, 
      'is_anonymous', is_anonymous, 
      'source', COALESCE(NEW.raw_user_meta_data->>'source', 'unknown'), 
      'initial_room', room_name 
    ),
    NOW()
  ) 
  ON CONFLICT (id) DO UPDATE SET 
    display_name = EXCLUDED.display_name, 
    updated_at = NOW(), 
    metadata = public.users.metadata || EXCLUDED.metadata; 

  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
