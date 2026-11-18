-- ==============================================================================
-- KJCPL Newsroom: Fix Author Byline Integrity & Rebalance Database
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/uaaajvcmjivszrkzdmvu/sql/new
-- ==============================================================================

BEGIN;

-- 1. Update articles_enforce_integrity() trigger:
-- Allow service_role (Admin Portal API) and allow_author_name_sync to update author_display_name
CREATE OR REPLACE FUNCTION public.articles_enforce_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_uid uuid := (SELECT auth.uid());
  actor_display_name text;
BEGIN
  -- INSERT Rules
  IF TG_OP = 'INSERT' THEN
    IF new.status <> 'draft' THEN
      RAISE EXCEPTION 'New articles must be created as drafts.';
    END IF;
    
    -- Allow authoritative service_role backend inserts when author_id is provided
    IF actor_uid IS NULL THEN
      IF (SELECT auth.role()) = 'service_role' AND new.author_id IS NOT NULL THEN
        actor_uid := new.author_id;
      ELSE
        RAISE EXCEPTION 'Authenticated employee is required';
      END IF;
    END IF;
    
    new.author_id := actor_uid;
    SELECT display_name INTO actor_display_name FROM public.profiles WHERE id = actor_uid;
    
    IF actor_display_name IS NULL THEN
      actor_display_name := coalesce(new.author_display_name, 'KJCPL Ground Bureau');
    END IF;
    
    new.author_display_name := actor_display_name;
  END IF;

  -- UPDATE Rules
  IF TG_OP = 'UPDATE' THEN
    IF new.author_id <> old.author_id THEN
      RAISE EXCEPTION 'Cannot change article author_id.';
    END IF;

    -- Allow author_display_name updates from service_role (Admin Portal) OR when allow_author_name_sync is active
    IF new.author_display_name <> old.author_display_name 
       AND (SELECT auth.role()) IS DISTINCT FROM 'service_role'
       AND current_setting('kjin.allow_author_name_sync', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Cannot change article author_display_name directly.';
    END IF;

    IF old.status IN ('published', 'archived') AND new.slug <> old.slug THEN
      RAISE EXCEPTION 'Cannot change slug of published or archived articles.';
    END IF;

    IF new.view_count <> old.view_count AND current_setting('kjin.allow_view_count_update', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Cannot update view_count directly. Use the RPC incrementer.';
    END IF;

    IF old.status <> new.status THEN
      IF old.status = 'archived' AND new.status NOT IN ('published', 'review', 'draft') THEN
        RAISE EXCEPTION 'Archived articles can only transition to published, review, or draft.';
      ELSIF old.status = 'draft' AND new.status <> 'review' THEN
        RAISE EXCEPTION 'Drafts can only transition to review.';
      ELSIF old.status = 'review' AND new.status NOT IN ('draft', 'published', 'archived') THEN
        RAISE EXCEPTION 'Articles in review can only transition to draft, published, or archived.';
      ELSIF old.status = 'published' AND new.status <> 'archived' THEN
        RAISE EXCEPTION 'Published articles can only transition to archived.';
      END IF;
    END IF;
  END IF;

  -- Metadata Consistency Invariants (runs on both INSERT and UPDATE)
  IF new.status IN ('draft', 'review') THEN
    new.published_at := null;
    new.published_by := null;
    new.archived_at := null;
    new.archive_reason := null;
    new.archived_by := null;
  ELSIF new.status = 'published' THEN
    IF new.published_at IS NULL OR new.published_by IS NULL THEN
      RAISE EXCEPTION 'Published articles must have published_at and published_by set.';
    END IF;
    new.archived_at := null;
    new.archive_reason := null;
    new.archived_by := null;
  ELSIF new.status = 'archived' THEN
    IF new.archived_at IS NULL THEN
      RAISE EXCEPTION 'Archived articles must have archived_at set.';
    END IF;
  END IF;

  RETURN new;
END;
$$;


-- 2. Allow session update of author_display_name during this migration
PERFORM set_config('kjin.allow_author_name_sync', 'on', true);


-- 3. Rebalance all articles across verified regional correspondents

-- Chenab Valley (Doda, Kishtwar, Ramban, Bhaderwah)
UPDATE public.articles
SET author_display_name = 'Tariq Ahmad Mir'
WHERE lower(coalesce(district, '')) IN ('doda', 'kishtwar', 'ramban')
   OR lower(title) LIKE '%chenab%'
   OR lower(title) LIKE '%doda%'
   OR lower(title) LIKE '%kishtwar%'
   OR lower(title) LIKE '%ramban%'
   OR lower(title) LIKE '%bhaderwah%'
   OR lower(title) LIKE '%marwah%'
   OR lower(title) LIKE '%warwan%';

-- Pir Panjal & Frontier (Rajouri, Poonch)
UPDATE public.articles
SET author_display_name = 'Showkat Ahmad Mir'
WHERE lower(coalesce(district, '')) IN ('rajouri', 'poonch')
   OR lower(title) LIKE '%poonch%'
   OR lower(title) LIKE '%rajouri%'
   OR lower(title) LIKE '%chakan da bagh%'
   OR lower(title) LIKE '%surankote%'
   OR lower(title) LIKE '%mandi-lorha%'
   OR lower(title) LIKE '%pir panjal%';

-- Trans-Himalayan / Ladakh (Leh, Kargil)
UPDATE public.articles
SET author_display_name = 'Stanzin Dorje'
WHERE lower(coalesce(district, '')) IN ('leh', 'kargil')
   OR lower(title) LIKE '%ladakh%'
   OR lower(title) LIKE '%leh%'
   OR lower(title) LIKE '%kargil%'
   OR lower(title) LIKE '%zojila%'
   OR lower(title) LIKE '%drass%'
   OR lower(title) LIKE '%changthang%';

-- Jammu Plains & Economy (Jammu, Samba, Kathua, Udhampur, Reasi)
UPDATE public.articles
SET author_display_name = 'Pooja Jamwal'
WHERE lower(coalesce(district, '')) IN ('jammu', 'samba', 'kathua', 'udhampur', 'reasi')
   OR lower(coalesce(category, '')) IN ('economy', 'business', 'agriculture')
   OR lower(title) LIKE '%jammu%'
   OR lower(title) LIKE '%samba%'
   OR lower(title) LIKE '%kathua%'
   OR lower(title) LIKE '%udhampur%'
   OR lower(title) LIKE '%reasi%'
   OR lower(title) LIKE '%r.s. pura%'
   OR lower(title) LIKE '%mandi%'
   OR lower(title) LIKE '%rail bridge%';

-- Kashmir Valley (Srinagar, Baramulla, Anantnag, Budgam, Pulwama, Shopian, Kulgam, Bandipora, Kupwara, Ganderbal)
UPDATE public.articles
SET author_display_name = 'Dr. Tariq Ahmad Lone'
WHERE lower(coalesce(district, '')) IN ('srinagar', 'baramulla', 'anantnag', 'budgam', 'pulwama', 'shopian', 'kulgam', 'bandipora', 'kupwara', 'ganderbal')
   OR lower(coalesce(category, '')) IN ('environment', 'ecology', 'civic', 'problems', 'local')
   OR lower(title) LIKE '%srinagar%'
   OR lower(title) LIKE '%shopian%'
   OR lower(title) LIKE '%pulwama%'
   OR lower(title) LIKE '%anantnag%'
   OR lower(title) LIKE '%baramulla%'
   OR lower(title) LIKE '%kupwara%'
   OR lower(title) LIKE '%ganderbal%'
   OR lower(title) LIKE '%wular%'
   OR lower(title) LIKE '%dal lake%'
   OR lower(title) LIKE '%jhelum%'
   OR lower(title) LIKE '%gulmarg%';

-- Culture & Heritage
UPDATE public.articles
SET author_display_name = 'Prof. Ramesh Koul'
WHERE lower(coalesce(category, '')) IN ('culture', 'heritage', 'arts')
   OR lower(title) LIKE '%saffron%'
   OR lower(title) LIKE '%heritage%'
   OR lower(title) LIKE '%craft%'
   OR lower(title) LIKE '%shawl%'
   OR lower(title) LIKE '%festival%';

-- National & Science Affairs
UPDATE public.articles
SET author_display_name = 'Dr. Sunita Pandita'
WHERE lower(coalesce(category, '')) IN ('national', 'science', 'health', 'space', 'education', 'international')
   OR lower(title) LIKE '%supreme court%'
   OR lower(title) LIKE '%isro%'
   OR lower(title) LIKE '%rbi%'
   OR lower(title) LIKE '%union%'
   OR lower(title) LIKE '%parliament%'
   OR lower(title) LIKE '%un %'
   OR lower(title) LIKE '%glaciological%';

-- Any remaining articles credited to Hafeez Zargar or generic desks
UPDATE public.articles
SET author_display_name = 'Dr. Tariq Ahmad Lone'
WHERE author_display_name = 'Hafeez Zargar'
   OR author_display_name LIKE '%Hafiz%'
   OR author_display_name LIKE '%KJIN%'
   OR author_display_name IS NULL
   OR author_display_name = '';


-- 4. Upsert Author Settings in site_settings so Admin Portal displays the verified roster
INSERT INTO public.site_settings (key, value, description, updated_at)
VALUES (
  'author_settings',
  jsonb_build_object(
    'correspondents', jsonb_build_array(
      jsonb_build_object('name', 'Dr. Tariq Ahmad Lone', 'role', 'Senior Environmental & Field Editor', 'beat', 'Ecology, Lakes, High-Altitude Infrastructure', 'region', 'Kashmir Valley'),
      jsonb_build_object('name', 'Pooja Jamwal', 'role', 'Bureau Chief (Jammu)', 'beat', 'Commerce, Union Economy, Agriculture & Industry', 'region', 'Jammu Plains'),
      jsonb_build_object('name', 'Showkat Ahmad Mir', 'role', 'Senior Ground Correspondent', 'beat', 'Frontier Dispatches, Border Infrastructure, Tourism', 'region', 'Pir Panjal'),
      jsonb_build_object('name', 'Tariq Ahmad Mir', 'role', 'Correspondent & Transit Analyst', 'beat', 'Mountain Passes, Civic Works, Telemetry & Hydro', 'region', 'Chenab Valley'),
      jsonb_build_object('name', 'Stanzin Dorje', 'role', 'Trans-Himalayan Field Analyst', 'beat', 'High Passes, Glaciology & Strategic Transit', 'region', 'Leh & Ladakh'),
      jsonb_build_object('name', 'Dr. Sunita Pandita', 'role', 'Science & National Affairs Correspondent', 'beat', 'Union Governance, Science, Space & Public Health', 'region', 'National / All Regions'),
      jsonb_build_object('name', 'Prof. Ramesh Koul', 'role', 'Heritage & Cultural Desk Lead', 'beat', 'Crafts, Architecture, Archeology & Oral Traditions', 'region', 'Cultural Corridors')
    )
  ),
  'Verified newsroom correspondents and author bylines roster',
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = EXCLUDED.updated_at;

COMMIT;
