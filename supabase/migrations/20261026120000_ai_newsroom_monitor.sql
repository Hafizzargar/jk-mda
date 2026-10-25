-- Migration: AI Newsroom — Event & Government Response Monitor
-- Integrates district event detection, official government response matching,
-- global health & humanitarian feeds, and owner-approved YouTube monitor.

BEGIN;

-- 1. Official Government & News Source Registry
CREATE TABLE IF NOT EXISTS public.newsroom_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    authority TEXT NOT NULL,
    feed_url TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'official_portal', 'api', 'youtube_channel')),
    division TEXT CHECK (division IN ('Kashmir', 'Jammu', 'Chenab Valley', 'Pir Panjal', 'Leh & Ladakh', 'National', 'Global')),
    district_slug TEXT REFERENCES public.districts(slug) ON DELETE SET NULL,
    topics TEXT[] NOT NULL DEFAULT '{}',
    collection_frequency_minutes INT NOT NULL DEFAULT 60 CHECK (collection_frequency_minutes >= 5),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_successful_check TIMESTAMPTZ,
    last_error TEXT,
    collection_status TEXT NOT NULL DEFAULT 'idle' CHECK (collection_status IN ('idle', 'checking', 'healthy', 'error', 'unreachable')),
    attribution_terms TEXT,
    youtube_channel_id TEXT,
    is_owner_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for source lookups
CREATE INDEX IF NOT EXISTS idx_newsroom_sources_type ON public.newsroom_sources (source_type);
CREATE INDEX IF NOT EXISTS idx_newsroom_sources_district ON public.newsroom_sources (district_slug);
CREATE INDEX IF NOT EXISTS idx_newsroom_sources_active ON public.newsroom_sources (is_active);

-- 2. Detected Events Table
CREATE TABLE IF NOT EXISTS public.newsroom_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    district_slug TEXT REFERENCES public.districts(slug) ON DELETE SET NULL,
    division TEXT CHECK (division IN ('Kashmir', 'Jammu', 'Chenab Valley', 'Pir Panjal', 'Leh & Ladakh', 'National', 'Global')),
    location_name TEXT,
    event_category TEXT NOT NULL DEFAULT 'public_safety' CHECK (event_category IN (
        'accidents',
        'road_closures',
        'weather_disaster',
        'public_safety',
        'school_closures',
        'public_services',
        'demonstrations_restrictions',
        'administration',
        'public_health',
        'global_humanitarian',
        'general'
    )),
    event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verification_status TEXT NOT NULL DEFAULT 'unverified_report' CHECK (verification_status IN (
        'unverified_report',
        'confirmed_event',
        'official_announcement'
    )),
    original_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    uncertainty_flags TEXT[] NOT NULL DEFAULT '{}',
    editor_notes TEXT,
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
        'discovered',
        'reviewed',
        'draft_approved',
        'drafted',
        'dismissed'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsroom_events_district ON public.newsroom_events (district_slug);
CREATE INDEX IF NOT EXISTS idx_newsroom_events_category ON public.newsroom_events (event_category);
CREATE INDEX IF NOT EXISTS idx_newsroom_events_status ON public.newsroom_events (status);
CREATE INDEX IF NOT EXISTS idx_newsroom_events_detected ON public.newsroom_events (detected_at DESC);

-- 3. Matched Official Government Responses Table
CREATE TABLE IF NOT EXISTS public.newsroom_official_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.newsroom_events(id) ON DELETE CASCADE,
    source_id UUID REFERENCES public.newsroom_sources(id) ON DELETE SET NULL,
    authority_name TEXT NOT NULL,
    document_title TEXT,
    document_url TEXT,
    published_at TIMESTAMPTZ,
    response_type TEXT CHECK (response_type IN (
        'order',
        'advisory',
        'public_notice',
        'press_release',
        'police_statement',
        'traffic_advisory',
        'disaster_alert',
        'clarification',
        'none'
    )),
    match_status TEXT NOT NULL CHECK (match_status IN (
        'confirmed_relevant',
        'possible_match',
        'no_official_update',
        'check_failed'
    )),
    match_explanation TEXT NOT NULL,
    extracted_text_excerpt TEXT,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsroom_responses_event ON public.newsroom_official_responses (event_id);
CREATE INDEX IF NOT EXISTS idx_newsroom_responses_status ON public.newsroom_official_responses (match_status);

-- 4. Fact-Checking Checklist Table
CREATE TABLE IF NOT EXISTS public.newsroom_fact_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.newsroom_events(id) ON DELETE CASCADE,
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    claim TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN (
        'unverified',
        'verified',
        'flagged_disputed'
    )),
    source_reference_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsroom_fact_checks_event ON public.newsroom_fact_checks (event_id);
CREATE INDEX IF NOT EXISTS idx_newsroom_fact_checks_article ON public.newsroom_fact_checks (article_id);

-- 5. Seed Verified Official Government & Health Sources
INSERT INTO public.newsroom_sources (
    name, authority, feed_url, source_type, division, district_slug, topics, is_active, attribution_terms
) VALUES
(
    'District Doda Administration',
    'District Magistrate & Administration, Doda',
    'https://doda.gov.in/',
    'official_portal',
    'Chenab Valley',
    'doda',
    ARRAY['road_closures', 'weather_disaster', 'school_closures', 'public_safety', 'administration'],
    true,
    'Official district administration portal notices and advisories.'
),
(
    'District Kishtwar Administration',
    'District Magistrate & Administration, Kishtwar',
    'https://kishtwar.nic.in/',
    'official_portal',
    'Chenab Valley',
    'kishtwar',
    ARRAY['road_closures', 'weather_disaster', 'public_safety', 'administration'],
    true,
    'Official district portal for Chenab Valley regional notices.'
),
(
    'J&K General Administration Department (GAD)',
    'Government of Jammu & Kashmir',
    'https://jkgad.nic.in/',
    'official_portal',
    'National',
    NULL,
    ARRAY['administration', 'public_services', 'school_closures'],
    true,
    'Official administrative orders and gazette notifications.'
),
(
    'J&K Police Official Statements',
    'Jammu & Kashmir Police HQ',
    'https://jkpolice.gov.in/',
    'official_portal',
    'National',
    NULL,
    ARRAY['accidents', 'public_safety', 'demonstrations_restrictions'],
    true,
    'Official police statements and law-and-order press bulletins.'
),
(
    'India Meteorological Department (IMD J&K)',
    'IMD Meteorological Centre Srinagar / Jammu',
    'https://mausam.imd.gov.in/',
    'official_portal',
    'National',
    NULL,
    ARRAY['weather_disaster', 'public_safety'],
    true,
    'Weather forecasts, flash flood warnings, and snowfall advisories.'
),
(
    'Press Information Bureau (PIB) J&K Regional',
    'PIB Ministry of Information & Broadcasting',
    'https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1',
    'rss',
    'National',
    NULL,
    ARRAY['administration', 'public_services', 'public_health', 'weather_disaster'],
    true,
    'Official PIB RSS feed. Attribution: PIB Government of India.'
),
(
    'WHO Disease Outbreak News',
    'World Health Organization (WHO)',
    'https://www.who.int/emergencies/disease-outbreak-news',
    'official_portal',
    'Global',
    NULL,
    ARRAY['public_health', 'global_humanitarian'],
    true,
    'Official WHO epidemiological alerts and disease outbreak surveillance.'
),
(
    'UN News Global Human Rights & Humanitarian',
    'United Nations',
    'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    'rss',
    'Global',
    NULL,
    ARRAY['global_humanitarian', 'public_health'],
    true,
    'UN News public RSS feed. Attribution: United Nations.'
)
ON CONFLICT (feed_url) DO UPDATE SET
    authority = EXCLUDED.authority,
    topics = EXCLUDED.topics,
    attribution_terms = EXCLUDED.attribution_terms;

-- 6. RLS Security Policies
ALTER TABLE public.newsroom_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsroom_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsroom_official_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsroom_fact_checks ENABLE ROW LEVEL SECURITY;

-- Allow editors, admins, superadmins, and owners to view & manage
DROP POLICY IF EXISTS "Newsroom staff access sources" ON public.newsroom_sources;
CREATE POLICY "Newsroom staff access sources"
ON public.newsroom_sources FOR ALL TO authenticated
USING (public.has_permission('article.review'));

DROP POLICY IF EXISTS "Newsroom staff access events" ON public.newsroom_events;
CREATE POLICY "Newsroom staff access events"
ON public.newsroom_events FOR ALL TO authenticated
USING (public.has_permission('article.review'));

DROP POLICY IF EXISTS "Newsroom staff access responses" ON public.newsroom_official_responses;
CREATE POLICY "Newsroom staff access responses"
ON public.newsroom_official_responses FOR ALL TO authenticated
USING (public.has_permission('article.review'));

DROP POLICY IF EXISTS "Newsroom staff access fact checks" ON public.newsroom_fact_checks;
CREATE POLICY "Newsroom staff access fact checks"
ON public.newsroom_fact_checks FOR ALL TO authenticated
USING (public.has_permission('article.review'));

COMMIT;
