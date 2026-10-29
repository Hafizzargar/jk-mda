-- Migration: YouTube News Monitoring System
-- Creates youtube_sources and youtube_videos tables with unique constraints,
-- seeds the initial 4 channels, and sets up RLS and indexes.

BEGIN;

-- 1. YouTube Sources Registry
CREATE TABLE IF NOT EXISTS public.youtube_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_name TEXT NOT NULL,
    channel_url TEXT NOT NULL UNIQUE,
    channel_id TEXT NOT NULL UNIQUE,
    country TEXT NOT NULL DEFAULT 'India',
    region TEXT NOT NULL DEFAULT 'Global',
    language TEXT NOT NULL DEFAULT 'Hindi / Urdu / English',
    category TEXT NOT NULL DEFAULT 'General News',
    is_active BOOLEAN NOT NULL DEFAULT true,
    collection_frequency_minutes INT NOT NULL DEFAULT 60 CHECK (collection_frequency_minutes >= 5),
    last_checked_at TIMESTAMPTZ,
    last_video_published_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for source lookups
CREATE INDEX IF NOT EXISTS idx_youtube_sources_active ON public.youtube_sources (is_active);
CREATE INDEX IF NOT EXISTS idx_youtube_sources_channel_id ON public.youtube_sources (channel_id);

-- 2. YouTube Ingested Videos & Deduplication Table
CREATE TABLE IF NOT EXISTS public.youtube_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.youtube_sources(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL UNIQUE, -- Primary deduplication constraint
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    video_url TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'discovered' CHECK (processing_status IN (
        'discovered',
        'analyzing',
        'draft_proposed',
        'approved',
        'rejected',
        'manual_review_needed',
        'failed'
    )),
    transcript_text TEXT,
    has_transcript BOOLEAN NOT NULL DEFAULT false,
    ai_analysis JSONB DEFAULT '{}'::jsonb,
    proposed_headline TEXT,
    proposed_summary TEXT,
    proposed_category TEXT,
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    last_error TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_video_id ON public.youtube_videos (video_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_status ON public.youtube_videos (processing_status);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON public.youtube_videos (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_source ON public.youtube_videos (source_id);

-- 3. Job Lock Table for Scheduled Worker
CREATE TABLE IF NOT EXISTS public.youtube_worker_locks (
    lock_name TEXT PRIMARY KEY,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_by TEXT NOT NULL
);

-- 4. Seed Initial 4 Monitored Channels
INSERT INTO public.youtube_sources (
    channel_name, channel_url, channel_id, country, region, language, category, is_active
) VALUES
(
    'Abhisar Sharma',
    'https://www.youtube.com/@abhisar_sharma',
    'UCfA29qhHnOQrEr7yjHsP9Jw',
    'India',
    'National',
    'Hindi',
    'National Affairs & Analysis',
    true
),
(
    'RazaGraphy',
    'https://www.youtube.com/@razagraphy',
    'UCDZ8phcfP-ocrYfl-S1VvIA',
    'India',
    'Jammu & Kashmir / Chenab Valley',
    'Urdu / Hindi',
    'Current Affairs & Regional Reporting',
    true
),
(
    'Gulistan News',
    'https://www.youtube.com/@gulistannewschannel',
    'UCk7rHVFVs1Uf_dDOPKc2l0Q',
    'India',
    'Jammu & Kashmir / Ladakh',
    'Urdu / Kashmiri / Hindi',
    'State & Regional Broadcast',
    true
),
(
    'Greater Kashmir',
    'https://www.youtube.com/@GreaterKashmirvideo',
    'UCmzsSbFbWqDRNDem1idwNyQ',
    'India',
    'Jammu & Kashmir',
    'English / Kashmiri / Urdu',
    'State News & Interviews',
    true
)
ON CONFLICT (channel_id) DO UPDATE SET
    channel_name = EXCLUDED.channel_name,
    channel_url = EXCLUDED.channel_url,
    updated_at = now();

-- 5. Row Level Security Policies
ALTER TABLE public.youtube_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_worker_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read youtube sources" ON public.youtube_sources;
CREATE POLICY "Staff read youtube sources"
ON public.youtube_sources FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage youtube sources" ON public.youtube_sources;
CREATE POLICY "Admins manage youtube sources"
ON public.youtube_sources FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role_key IN ('owner', 'superadmin', 'admin')
        AND p.status = 'active'
    )
);

DROP POLICY IF EXISTS "Staff read youtube videos" ON public.youtube_videos;
CREATE POLICY "Staff read youtube videos"
ON public.youtube_videos FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Staff manage youtube videos" ON public.youtube_videos;
CREATE POLICY "Staff manage youtube videos"
ON public.youtube_videos FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role_key IN ('owner', 'superadmin', 'admin', 'editor')
        AND p.status = 'active'
    )
);

DROP POLICY IF EXISTS "Worker manage locks" ON public.youtube_worker_locks;
CREATE POLICY "Worker manage locks"
ON public.youtube_worker_locks FOR ALL TO authenticated
USING (true);

COMMIT;
