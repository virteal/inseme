-- Migration: 20251205_feed_schema.sql
-- Description: Adds tables for Federated Feeds and User Subscriptions.
--              Adds public_profile column to users table.

-- 1. Add public_profile to users
-- Default is true because the platform is "totally public" by design.
-- Users can opt-out, which restricts their ability to publish.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS public_profile boolean NOT NULL DEFAULT true;

-- 2. Create feeds table
CREATE TABLE IF NOT EXISTS public.feeds (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    url text NOT NULL UNIQUE,
    title text,
    type text NOT NULL CHECK (type = ANY (ARRAY['jsonfeed'::text, 'rss'::text, 'atom'::text, 'internal'::text])),
    category text,
    is_internal boolean NOT NULL DEFAULT false,
    is_indexed_by_ai boolean NOT NULL DEFAULT false,
    etag text,
    last_modified text,
    last_fetched_at timestamp with time zone,
    last_status text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT feeds_pkey PRIMARY KEY (id)
);

-- 3. Create user_feed_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_feed_subscriptions (
    user_id uuid NOT NULL,
    feed_id uuid NOT NULL,
    category text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT user_feed_subscriptions_pkey PRIMARY KEY (user_id, feed_id),
    CONSTRAINT user_feed_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT user_feed_subscriptions_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feeds(id) ON DELETE CASCADE
);

-- 4. Enable RLS (Row Level Security)
ALTER TABLE public.feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feed_subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Feeds are readable by everyone (public reference)
CREATE POLICY "Feeds are viewable by everyone"
ON public.feeds FOR SELECT
USING (true);

-- Only admins or system can insert/update feeds (for now, or maybe users can add via RPC)
-- Allowing authenticated users to insert feeds (if they want to subscribe to a new one)
CREATE POLICY "Authenticated users can create feeds"
ON public.feeds FOR INSERT
TO authenticated
WITH CHECK (true);

-- User subscriptions: Users can manage their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.user_feed_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
ON public.user_feed_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
ON public.user_feed_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feeds_url ON public.feeds(url);
CREATE INDEX IF NOT EXISTS idx_user_feed_subscriptions_user_id ON public.user_feed_subscriptions(user_id);
