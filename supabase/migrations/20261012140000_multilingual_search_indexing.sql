-- Migration 5: Multilingual Full-Text Search & GIN Indexing
-- Adds stored search vectors and GIN indexes for high-performance article search
-- across English, Urdu (Arabic script), and Hindi (Devanagari script).
--
-- Technical Architecture:
-- 1. English Source: Combines 'english' stemming with 'simple' tokenization.
-- 2. Urdu & Hindi Translations: Uses 'simple' Unicode parser to tokenize non-Latin scripts
--    verbatim without incorrect Latin stemming.
-- 3. GIN (Generalized Inverted Index) provides sub-millisecond full-text lookups.
--
-- Rollback Strategy (Forward-Fix):
-- DROP INDEX IF EXISTS public.idx_articles_tsv_search;
-- DROP INDEX IF EXISTS public.idx_article_translations_tsv_search;
-- ALTER TABLE public.articles DROP COLUMN IF EXISTS tsv_search;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS tsv_search;

-- 1. Stored generated search vector on articles
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS tsv_search tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(content, '')), 'C')
  ) STORED;

-- GIN index on articles search vector
CREATE INDEX IF NOT EXISTS idx_articles_tsv_search
ON public.articles USING gin (tsv_search);

-- 2. Stored generated search vector on article_translations (Urdu & Hindi)
ALTER TABLE public.article_translations
  ADD COLUMN IF NOT EXISTS tsv_search tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(content, '')), 'C')
  ) STORED;

-- GIN index on article_translations search vector
CREATE INDEX IF NOT EXISTS idx_article_translations_tsv_search
ON public.article_translations USING gin (tsv_search);
