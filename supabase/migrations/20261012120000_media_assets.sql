-- Migration 3: Media Assets Library
-- Establishes centralized newsroom media assets catalog with localized alt text,
-- credit metadata, file dimensions, and uploader attribution.
-- Preserves existing articles.featured_image_url for seamless backward compatibility.
--
-- Rollback Strategy (Forward-Fix):
-- ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_featured_image_id_fkey;
-- ALTER TABLE public.articles DROP COLUMN IF EXISTS featured_image_id;
-- DROP TABLE IF EXISTS public.media_assets;

-- 1. Create media_assets catalog table
CREATE TABLE IF NOT EXISTS public.media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_bucket text NOT NULL DEFAULT 'news-media',
    storage_path text NOT NULL UNIQUE,
    public_url text NOT NULL,
    alt_text_en text NOT NULL DEFAULT '',
    alt_text_ur text,
    alt_text_hi text,
    caption text,
    credit text,
    width integer CHECK (width IS NULL OR width > 0),
    height integer CHECK (height IS NULL OR height > 0),
    file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
    mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml')),
    uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS media_assets_set_updated_at ON public.media_assets;
CREATE TRIGGER media_assets_set_updated_at
BEFORE UPDATE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for asset lookup
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by ON public.media_assets (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON public.media_assets (created_at DESC);

-- 2. RLS on media_assets
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Media assets are readable by everyone" ON public.media_assets;
CREATE POLICY "Media assets are readable by everyone"
ON public.media_assets FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Employees create media assets" ON public.media_assets;
CREATE POLICY "Employees create media assets"
ON public.media_assets FOR INSERT
TO authenticated
WITH CHECK (
    public.has_permission('article.create')
    OR public.user_has_editor_access()
);

DROP POLICY IF EXISTS "Authors update own media and editors update all" ON public.media_assets;
CREATE POLICY "Authors update own media and editors update all"
ON public.media_assets FOR UPDATE
TO authenticated
USING (
    uploaded_by = (SELECT auth.uid())
    OR public.user_has_editor_access()
)
WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    OR public.user_has_editor_access()
);

DROP POLICY IF EXISTS "Editors delete media assets" ON public.media_assets;
CREATE POLICY "Editors delete media assets"
ON public.media_assets FOR DELETE
TO authenticated
USING (public.user_has_editor_access());

-- 3. Add optional foreign key to articles table (preserving existing featured_image_url)
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS featured_image_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_featured_image_id ON public.articles (featured_image_id);
