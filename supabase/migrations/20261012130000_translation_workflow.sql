-- Migration 4: Translation Workflow & Independent Publication Lifecycle
-- Decouples Urdu and Hindi translation visibility from automatic publication,
-- adds translator attribution, independent status, editor tracking, and SEO metadata.
--
-- Security & Integrity Hardening:
-- 1. Deliberate backfill runs BEFORE enabling new RLS policy.
-- 2. Direct client mutations (INSERT, UPDATE, DELETE) are revoked; all writes must flow
--    through the SECURITY DEFINER RPC upsert_article_translation(), closing MFA bypasses.
-- 3. A defense-in-depth trigger unconditionally enforces MFA (AAL2) for translation publication.
-- 4. translator_id preserves original translator attribution; last_edited_by tracks latest modifier.
--
-- Rollback Strategy (Forward-Fix):
-- ALTER TABLE public.article_translations DROP CONSTRAINT IF EXISTS article_translations_meta_title_len;
-- ALTER TABLE public.article_translations DROP CONSTRAINT IF EXISTS article_translations_meta_desc_len;
-- DROP TRIGGER IF EXISTS article_translations_enforce_integrity ON public.article_translations;
-- DROP FUNCTION IF EXISTS public.article_translations_enforce_integrity cascade;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS status;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS translator_id;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS last_edited_by;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS meta_title;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS meta_description;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS published_at;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS published_by;
-- (Restore previous policy "Translations are readable if article is readable").

-- 1. Add workflow, attribution, and SEO columns to article_translations
ALTER TABLE public.article_translations
  ADD COLUMN IF NOT EXISTS status public.article_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS translator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.article_translations
  ADD CONSTRAINT article_translations_meta_title_len CHECK (meta_title IS NULL OR char_length(meta_title) <= 255),
  ADD CONSTRAINT article_translations_meta_desc_len CHECK (meta_description IS NULL OR char_length(meta_description) <= 1000);

CREATE INDEX IF NOT EXISTS idx_article_translations_status ON public.article_translations (status);
CREATE INDEX IF NOT EXISTS idx_article_translations_translator ON public.article_translations (translator_id);
CREATE INDEX IF NOT EXISTS idx_article_translations_last_edited_by ON public.article_translations (last_edited_by);

-- 2. DELIBERATE BACKFILL: Synchronize existing translation status with parent article status
-- Prior to this migration, any translation of a published article was treated as public.
-- To prevent live translations from disappearing, backfill them to 'published'.
UPDATE public.article_translations t
SET
  status = 'published',
  published_at = COALESCE(t.updated_at, t.created_at, now()),
  published_by = a.published_by
FROM public.articles a
WHERE a.id = t.article_id
  AND a.status = 'published';

-- Set remaining translations of draft/review/archived articles to their parent status
UPDATE public.article_translations t
SET
  status = a.status
FROM public.articles a
WHERE a.id = t.article_id
  AND a.status IN ('draft', 'review', 'archived')
  AND t.status = 'draft';

-- 3. Enforce NOT NULL on status after data backfill
ALTER TABLE public.article_translations
  ALTER COLUMN status SET NOT NULL;

-- 4. Defense-in-depth Database Trigger: Enforce MFA (AAL2) on publication at engine level
CREATE OR REPLACE FUNCTION public.article_translations_enforce_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Strict MFA enforcement when setting status to published
    IF NEW.status = 'published' AND COALESCE((SELECT auth.jwt() ->> 'aal'), '') <> 'aal2' THEN
        RAISE EXCEPTION 'MFA (AAL2) is strictly required to publish translations';
    END IF;

    -- Invariant consistency
    IF NEW.status = 'published' THEN
        IF NEW.published_at IS NULL THEN
            NEW.published_at := now();
        END IF;
    ELSE
        NEW.published_at := NULL;
        NEW.published_by := NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS article_translations_enforce_integrity ON public.article_translations;
CREATE TRIGGER article_translations_enforce_integrity
BEFORE INSERT OR UPDATE ON public.article_translations
FOR EACH ROW EXECUTE FUNCTION public.article_translations_enforce_integrity();

-- 5. Secure RLS & Lock down direct client mutations
-- Readers can only view a translation if BOTH the parent article is published AND the translation is published.
DROP POLICY IF EXISTS "Translations are readable if article is readable" ON public.article_translations;
DROP POLICY IF EXISTS "Published translations of published articles are public" ON public.article_translations;

CREATE POLICY "Published translations of published articles are public"
ON public.article_translations FOR SELECT
USING (
    (
        status = 'published'
        AND EXISTS (
            SELECT 1 FROM public.articles a
            WHERE a.id = article_translations.article_id
              AND a.status = 'published'
        )
    )
    OR public.user_has_editor_access()
    OR translator_id = (SELECT auth.uid())
);

-- Drop legacy direct mutation policies to route all writes through the secured RPC
DROP POLICY IF EXISTS "Editors can insert translations" ON public.article_translations;
DROP POLICY IF EXISTS "Editors can update translations" ON public.article_translations;
DROP POLICY IF EXISTS "Editors can delete translations" ON public.article_translations;

-- Revoke direct mutation privileges from client roles
REVOKE INSERT, UPDATE, DELETE ON public.article_translations FROM public, anon, authenticated;
GRANT SELECT ON public.article_translations TO anon, authenticated;

-- 6. Updated RPC: upsert_article_translation
DROP FUNCTION IF EXISTS public.upsert_article_translation(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.upsert_article_translation(uuid, text, text, text, text, public.article_status, text, text);

CREATE OR REPLACE FUNCTION public.upsert_article_translation(
    p_article_id uuid,
    p_language_code text,
    p_title text,
    p_excerpt text,
    p_content text,
    p_status public.article_status DEFAULT 'draft',
    p_meta_title text DEFAULT NULL,
    p_meta_description text DEFAULT NULL
)
RETURNS public.article_translations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    translation_row public.article_translations;
    actor_uid uuid := (SELECT auth.uid());
    v_published_at timestamptz := NULL;
    v_published_by uuid := NULL;
BEGIN
    IF actor_uid IS NULL OR NOT public.user_has_editor_access() THEN
        RAISE EXCEPTION 'Editor access is required to modify translations';
    END IF;

    IF p_language_code NOT IN ('ur', 'hi') THEN
        RAISE EXCEPTION 'Language code must be one of: ur, hi';
    END IF;

    -- Verify parent article exists
    IF NOT EXISTS (SELECT 1 FROM public.articles WHERE id = p_article_id) THEN
        RAISE EXCEPTION 'Parent article not found';
    END IF;

    -- Strict MFA enforcement when publishing translations
    IF p_status = 'published' AND COALESCE((SELECT auth.jwt() ->> 'aal'), '') <> 'aal2' THEN
        RAISE EXCEPTION 'MFA (AAL2) is strictly required to publish translations';
    END IF;

    IF p_status = 'published' THEN
        v_published_at := now();
        v_published_by := actor_uid;
    END IF;

    INSERT INTO public.article_translations (
        article_id, language_code, title, excerpt, content,
        status, translator_id, last_edited_by, meta_title, meta_description,
        published_at, published_by
    )
    VALUES (
        p_article_id, p_language_code, trim(p_title), trim(COALESCE(p_excerpt, '')), trim(p_content),
        p_status, actor_uid, actor_uid, nullif(trim(COALESCE(p_meta_title, '')), ''), nullif(trim(COALESCE(p_meta_description, '')), ''),
        v_published_at, v_published_by
    )
    ON CONFLICT (article_id, language_code)
    DO UPDATE SET
        title = excluded.title,
        excerpt = excluded.excerpt,
        content = excluded.content,
        status = excluded.status,
        -- Preserve original translator_id; track modifier in last_edited_by
        translator_id = COALESCE(public.article_translations.translator_id, excluded.translator_id),
        last_edited_by = actor_uid,
        meta_title = excluded.meta_title,
        meta_description = excluded.meta_description,
        published_at = CASE WHEN excluded.status = 'published' THEN COALESCE(public.article_translations.published_at, now()) ELSE NULL END,
        published_by = CASE WHEN excluded.status = 'published' THEN COALESCE(public.article_translations.published_by, actor_uid) ELSE NULL END,
        updated_at = now()
    RETURNING * INTO translation_row;

    RETURN translation_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_article_translation(uuid, text, text, text, text, public.article_status, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_article_translation(uuid, text, text, text, text, public.article_status, text, text) TO authenticated;
