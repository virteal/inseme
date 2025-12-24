-- Migration: Create collected_data table for Ophélia Data Collector
-- Description: Store structured data collected from websites by users to enrich Ophélia's knowledge base
-- Date: 2025-11-23

-- Create the collected_data table
CREATE TABLE IF NOT EXISTS public.collected_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('Titre', 'Description', 'Date', 'Lieu', 'Personne', 'Organisation', 'Autre')),
    value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published', 'archived')),
    metadata JSONB DEFAULT '{"schemaVersion": 1}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_collected_data_user_id ON public.collected_data(user_id);
CREATE INDEX IF NOT EXISTS idx_collected_data_status ON public.collected_data(status);
CREATE INDEX IF NOT EXISTS idx_collected_data_data_type ON public.collected_data(data_type);
CREATE INDEX IF NOT EXISTS idx_collected_data_source_url ON public.collected_data(source_url);
CREATE INDEX IF NOT EXISTS idx_collected_data_created_at ON public.collected_data(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_collected_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_collected_data_updated_at
    BEFORE UPDATE ON public.collected_data
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_collected_data_updated_at();

-- Enable Row Level Security
ALTER TABLE public.collected_data ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own data and all published data
CREATE POLICY "Users can view own and published data"
    ON public.collected_data
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR status = 'published'
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- RLS Policy: Authenticated users can insert their own data
CREATE POLICY "Authenticated users can insert data"
    ON public.collected_data
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own data, admins can update any
CREATE POLICY "Users can update own data, admins can update any"
    ON public.collected_data
    FOR UPDATE
    USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- RLS Policy: Users can delete their own data, admins can delete any
CREATE POLICY "Users can delete own data, admins can delete any"
    ON public.collected_data
    FOR DELETE
    USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Create a view for admin statistics
CREATE OR REPLACE VIEW public.collected_data_stats AS
SELECT 
    status,
    data_type,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_contributors,
    MAX(created_at) as last_contribution
FROM public.collected_data
GROUP BY status, data_type;

-- Grant permissions
GRANT SELECT ON public.collected_data_stats TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE public.collected_data IS 'Structured data collected by users from websites to enrich Ophélia AI knowledge base. Supports moderation workflow (draft → reviewed → published).';
COMMENT ON COLUMN public.collected_data.data_type IS 'Type of collected data: Titre, Description, Date, Lieu, Personne, Organisation, or Autre';
COMMENT ON COLUMN public.collected_data.status IS 'Moderation status: draft (user created), reviewed (moderator checked), published (available to Ophélia), archived (removed from use)';
COMMENT ON COLUMN public.collected_data.metadata IS 'JSONB field for extensible data. Always includes schemaVersion. Can include tags, ai_summary, confidence_score, etc.';
