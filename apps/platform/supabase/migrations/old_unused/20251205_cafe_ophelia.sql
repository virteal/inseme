-- Migration: Café Ophélia Vocal Schema
-- Date: 2025-12-05

-- 1. Conversations
CREATE TABLE IF NOT EXISTS cafe_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    tags TEXT[],
    global_summary TEXT
);

-- 2. Sessions
CREATE TABLE IF NOT EXISTS cafe_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES cafe_conversations(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'running', 'ended')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    timezone TEXT DEFAULT 'Europe/Paris',
    location_type TEXT CHECK (location_type IN ('physical', 'online', 'hybrid')),
    venue_name TEXT,
    address TEXT,
    geo_lat DOUBLE PRECISION,
    geo_lon DOUBLE PRECISION,

    -- Control Plane Params
    session_purpose TEXT, -- 'exploration', 'mandate', etc
    structure_mode TEXT DEFAULT 'simple',
    phases_enabled BOOLEAN DEFAULT false,
    current_phase TEXT, -- 'warmup', 'exploration', etc
    confidentiality_level TEXT DEFAULT 'public' CHECK (confidentiality_level IN ('public', 'chatham_house', 'internal_only', 'ephemeral')),

    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Participants
CREATE TABLE IF NOT EXISTS cafe_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES cafe_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id), -- Can be null for anonymous/guest in physical room
    device_role TEXT DEFAULT 'local_phone' CHECK (device_role IN ('center_device', 'local_phone', 'remote_client')),
    display_name TEXT,
    mic_state TEXT DEFAULT 'off' CHECK (mic_state IN ('off', 'requesting', 'queued', 'focused', 'recording', 'cooled_down')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Utterances (The Transcript)
CREATE TABLE IF NOT EXISTS cafe_utterances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES cafe_sessions(id) ON DELETE CASCADE,
    sequence_number SERIAL,
    speaker_type TEXT CHECK (speaker_type IN ('participant', 'ophelia')),
    participant_id UUID REFERENCES cafe_participants(id), -- Null if Ophelia
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_ms INTEGER,
    raw_transcript TEXT,
    clean_transcript TEXT,
    speech_type TEXT, -- 'statement', 'question', 'answer', 'interruption'
    is_important BOOLEAN DEFAULT false
);

-- 5. Reactions (Gestural Votes)
CREATE TABLE IF NOT EXISTS cafe_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES cafe_sessions(id) ON DELETE CASCADE,
    utterance_id UUID REFERENCES cafe_utterances(id),
    participant_id UUID REFERENCES cafe_participants(id),
    reaction_type TEXT CHECK (reaction_type IN ('agree', 'disagree', 'block', 'too_long', 'recenter', 'clarification')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, utterance_id, participant_id)
);

-- 6. Civic Objects (Outputs)
CREATE TABLE IF NOT EXISTS cafe_civic_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES cafe_sessions(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('proposal', 'question', 'mandate', 'petition')),
    text TEXT NOT NULL,
    status TEXT DEFAULT 'suggested_by_ai' CHECK (status IN ('suggested_by_ai', 'proposed_to_host', 'validated_in_session', 'exported', 'archived')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE cafe_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_utterances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cafe_civic_objects ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for Vibe Coding - Authentic user can read all, host can write)
-- Note: In production, strict Host policies needed.
CREATE POLICY "Public Read Sessions" ON cafe_sessions FOR SELECT USING (true);
CREATE POLICY "Auth Create Sessions" ON cafe_sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Update Sessions" ON cafe_sessions FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Participants Read" ON cafe_participants FOR SELECT USING (true);
CREATE POLICY "Participants Join" ON cafe_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants Update Self" ON cafe_participants FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Utterances Read" ON cafe_utterances FOR SELECT USING (true);
CREATE POLICY "Utterances Insert" ON cafe_utterances FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE cafe_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE cafe_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE cafe_utterances;
ALTER PUBLICATION supabase_realtime ADD TABLE cafe_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE cafe_civic_objects;
