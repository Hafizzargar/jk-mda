-- Migration 2: Tags and Article Tags
-- Implements topic clustering, related-content indexing, and many-to-many article tagging
-- with composite uniqueness on (article_id, tag_id) and RLS security boundaries.
--
-- Rollback Strategy (Forward-Fix):
-- DROP TABLE IF EXISTS public.article_tags;
-- DROP TABLE IF EXISTS public.tags;

-- 1. Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name_en text NOT NULL CHECK (char_length(btrim(name_en)) > 0),
    name_ur text,
    name_hi text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tags are readable by everyone" ON public.tags;
CREATE POLICY "Tags are readable by everyone"
ON public.tags FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Editors can manage tags" ON public.tags;
CREATE POLICY "Editors can manage tags"
ON public.tags FOR ALL
TO authenticated
USING (public.user_has_editor_access())
WITH CHECK (public.user_has_editor_access());

-- 2. Create article_tags junction table
CREATE TABLE IF NOT EXISTS public.article_tags (
    article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_article_tags_tag_id ON public.article_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON public.article_tags (article_id);

-- RLS on article_tags
ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Article tags of published articles are readable" ON public.article_tags;
CREATE POLICY "Article tags of published articles are readable"
ON public.article_tags FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.articles a
        WHERE a.id = article_tags.article_id
          AND a.status = 'published'
    )
    OR public.user_has_editor_access()
);

DROP POLICY IF EXISTS "Editors can manage article tags" ON public.article_tags;
CREATE POLICY "Editors can manage article tags"
ON public.article_tags FOR ALL
TO authenticated
USING (public.user_has_editor_access())
WITH CHECK (public.user_has_editor_access());
