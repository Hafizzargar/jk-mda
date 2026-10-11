-- Migration 1: Categories and Districts
-- Creates normalized lookup tables seeded from apps/web/lib/taxonomy.ts,
-- adds nullable foreign keys to public.articles, runs backward-compatible backfills,
-- and reports any unmatched legacy taxonomy entries.
--
-- Rollback Strategy (Forward-Fix):
-- ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_category_id_fkey;
-- ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_district_id_fkey;
-- ALTER TABLE public.articles DROP COLUMN IF EXISTS category_id;
-- ALTER TABLE public.articles DROP COLUMN IF EXISTS district_id;
-- (Retain public.categories and public.districts to preserve any editor additions).

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name_en text NOT NULL CHECK (char_length(btrim(name_en)) > 0),
    name_ur text,
    name_hi text,
    description text NOT NULL DEFAULT '',
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS categories_set_updated_at ON public.categories;
CREATE TRIGGER categories_set_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories are readable by everyone" ON public.categories;
CREATE POLICY "Categories are readable by everyone"
ON public.categories FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Editors can manage categories" ON public.categories;
CREATE POLICY "Editors can manage categories"
ON public.categories FOR ALL
TO authenticated
USING (public.user_has_editor_access())
WITH CHECK (public.user_has_editor_access());

-- 2. Seed canonical categories (9 categories from apps/web/lib/taxonomy.ts)
INSERT INTO public.categories (slug, name_en, name_ur, name_hi, description, display_order)
VALUES
  ('politics', 'Politics', 'سیاست', 'राजनीति', 'Governance, policy, and public affairs reporting across J&K.', 1),
  ('local', 'Local', 'مقامی خبریں', 'स्थानीय', 'Ground reporting, civic issues, and grassroots updates from districts.', 2),
  ('economy', 'Economy', 'معیشت', 'अर्थव्यवस्था', 'Business, agriculture, tourism, and financial developments.', 3),
  ('culture', 'Culture', 'ثقافت و ادب', 'संस्कृति', 'Heritage, literature, arts, and traditions of Jammu and Kashmir.', 4),
  ('sports', 'Sports', 'کھیل', 'खेल', 'Athletics, youth sports, and regional championships.', 5),
  ('education', 'Education', 'تعلیم', 'शिक्षा', 'Schools, universities, and academic affairs.', 6),
  ('investigation', 'Investigation', 'تحقیقاتی رپورٹنگ', 'जांच', 'In-depth investigative journalism and accountability reporting.', 7),
  ('opinion', 'Opinion', 'اداریہ و آراء', 'विचार', 'Editorials, columns, and analytical perspectives.', 8),
  ('general', 'General', 'عام خبریں', 'सामान्य', 'General regional news and public interest bulletins.', 9)
ON CONFLICT (slug) DO UPDATE SET
  name_en = excluded.name_en,
  name_ur = excluded.name_ur,
  name_hi = excluded.name_hi,
  description = excluded.description,
  display_order = excluded.display_order,
  updated_at = now();

-- 3. Create districts table
CREATE TABLE IF NOT EXISTS public.districts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name_en text NOT NULL CHECK (char_length(btrim(name_en)) > 0),
    name_ur text,
    name_hi text,
    division text NOT NULL CHECK (division IN ('Kashmir', 'Jammu')),
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS districts_set_updated_at ON public.districts;
CREATE TRIGGER districts_set_updated_at
BEFORE UPDATE ON public.districts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS on districts
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Districts are readable by everyone" ON public.districts;
CREATE POLICY "Districts are readable by everyone"
ON public.districts FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Editors can manage districts" ON public.districts;
CREATE POLICY "Editors can manage districts"
ON public.districts FOR ALL
TO authenticated
USING (public.user_has_editor_access())
WITH CHECK (public.user_has_editor_access());

-- 4. Seed official 20 J&K districts (from apps/web/lib/taxonomy.ts)
INSERT INTO public.districts (slug, name_en, name_ur, name_hi, division, display_order)
VALUES
  -- Kashmir Division (10)
  ('srinagar', 'Srinagar', 'سری نگر', 'श्रीनगर', 'Kashmir', 1),
  ('anantnag', 'Anantnag', 'اننت ناگ', 'अनंतनाग', 'Kashmir', 2),
  ('baramulla', 'Baramulla', 'بارہمولہ', 'बारामूला', 'Kashmir', 3),
  ('budgam', 'Budgam', 'بڈگام', 'बडगाम', 'Kashmir', 4),
  ('bandipora', 'Bandipora', 'بانڈی پورہ', 'बांडीपोरा', 'Kashmir', 5),
  ('ganderbal', 'Ganderbal', 'گاندربل', 'गांदरबल', 'Kashmir', 6),
  ('kulgam', 'Kulgam', 'کولگام', 'कुलगाम', 'Kashmir', 7),
  ('kupwara', 'Kupwara', 'کپوارہ', 'कुपवाड़ा', 'Kashmir', 8),
  ('pulwama', 'Pulwama', 'پلوامہ', 'पुलवामा', 'Kashmir', 9),
  ('shopian', 'Shopian', 'شوپیاں', 'शोपियां', 'Kashmir', 10),
  -- Jammu Division (10)
  ('jammu', 'Jammu', 'جموں', 'जम्मू', 'Jammu', 11),
  ('doda', 'Doda', 'ڈوڈہ', 'डोडा', 'Jammu', 12),
  ('kathua', 'Kathua', 'کٹھوعہ', 'कठुआ', 'Jammu', 13),
  ('kishtwar', 'Kishtwar', 'کشتواڑ', 'किश्तवाड़', 'Jammu', 14),
  ('poonch', 'Poonch', 'پونچھ', 'पुंछ', 'Jammu', 15),
  ('rajouri', 'Rajouri', 'راجوری', 'राजौरी', 'Jammu', 16),
  ('ramban', 'Ramban', 'رام بن', 'रामबन', 'Jammu', 17),
  ('reasi', 'Reasi', 'ریاسی', 'रियासी', 'Jammu', 18),
  ('samba', 'Samba', 'سامبا', 'सांबा', 'Jammu', 19),
  ('udhampur', 'Udhampur', 'ادھم پور', 'उधमपुर', 'Jammu', 20)
ON CONFLICT (slug) DO UPDATE SET
  name_en = excluded.name_en,
  name_ur = excluded.name_ur,
  name_hi = excluded.name_hi,
  division = excluded.division,
  display_order = excluded.display_order,
  updated_at = now();

-- 5. Add nullable foreign keys to articles table
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_category_id ON public.articles (category_id);
CREATE INDEX IF NOT EXISTS idx_articles_district_id ON public.articles (district_id);

-- 6. Backfill existing articles to populate foreign keys from existing text columns
UPDATE public.articles a
SET category_id = c.id
FROM public.categories c
WHERE (lower(trim(a.category)) = c.slug OR lower(trim(a.category)) = lower(c.name_en))
  AND a.category_id IS NULL;

UPDATE public.articles a
SET district_id = d.id
FROM public.districts d
WHERE (lower(trim(coalesce(a.district, ''))) = d.slug OR lower(trim(coalesce(a.district, ''))) = lower(d.name_en))
  AND a.district_id IS NULL;

-- 7. Validate and report any unmatched taxonomy values
DO $$
DECLARE
  v_unmatched_cat_count integer;
  v_unmatched_cat_sample text;
  v_unmatched_dist_count integer;
  v_unmatched_dist_sample text;
BEGIN
  SELECT count(*), coalesce(string_agg(DISTINCT category, ', '), 'none')
  INTO v_unmatched_cat_count, v_unmatched_cat_sample
  FROM public.articles
  WHERE category_id IS NULL AND category IS NOT NULL AND btrim(category) <> '';

  IF v_unmatched_cat_count > 0 THEN
    RAISE NOTICE 'Migration 1 Notice: % article(s) have unmatched categories: %', v_unmatched_cat_count, v_unmatched_cat_sample;
  ELSE
    RAISE NOTICE 'Migration 1 Validation: All article categories successfully linked.';
  END IF;

  SELECT count(*), coalesce(string_agg(DISTINCT district, ', '), 'none')
  INTO v_unmatched_dist_count, v_unmatched_dist_sample
  FROM public.articles
  WHERE district_id IS NULL AND district IS NOT NULL AND btrim(district) <> '';

  IF v_unmatched_dist_count > 0 THEN
    RAISE NOTICE 'Migration 1 Notice: % article(s) have unmatched districts: %', v_unmatched_dist_count, v_unmatched_dist_sample;
  ELSE
    RAISE NOTICE 'Migration 1 Validation: All article districts successfully linked.';
  END IF;
END $$;
