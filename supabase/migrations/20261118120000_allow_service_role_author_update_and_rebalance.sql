-- Migration: Allow Service Role Author Display Name Updates and Rebalance Bylines
-- Enables the Admin Portal (service_role) to update article author_display_name directly
-- without tripping the articles_enforce_integrity trigger.

BEGIN;

-- 1. Update articles_enforce_integrity() trigger
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

COMMIT;
