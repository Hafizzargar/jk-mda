-- Migration: Fix Newsroom Draft Permissions & Service Role Author Attribution
-- 1. Aligns has_permission() with employee-server.ts so editorial standard operations
--    (article.create, article.review, article.submit_review, article.publish, article.archive)
--    do not block active staff who authenticate with primary credentials.
-- 2. Grants service_role execution bypass on has_permission().
-- 3. Enables articles_enforce_integrity trigger to accept authoritative service_role inserts
--    when author_id is explicitly provided.

BEGIN;

-- 1. Update public.has_permission()
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    CASE
      -- Service role backend processes always have full operational permission
      WHEN (SELECT auth.role()) = 'service_role' THEN true
      ELSE EXISTS (
        SELECT 1
        FROM public.profiles AS profiles
        JOIN public.role_permissions AS role_permissions ON role_permissions.role_key = profiles.role_key
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.status = 'active'
          AND role_permissions.permission_key = p_permission_key
          AND (
            -- Editorial standard operations do not require MFA level 2
            p_permission_key IN ('article.create', 'article.review', 'article.submit_review', 'article.publish', 'article.archive')
            OR profiles.role_key NOT IN ('owner', 'superadmin', 'admin')
            OR ((SELECT auth.jwt() ->> 'aal') = 'aal2')
          )
      )
    END;
$$;

-- 2. Update public.articles_enforce_integrity() trigger
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
      actor_display_name := coalesce(new.author_display_name, 'KJIN Newsroom');
    END IF;
    
    new.author_display_name := actor_display_name;
  END IF;

  -- UPDATE Rules
  IF TG_OP = 'UPDATE' THEN
    IF new.author_id <> old.author_id THEN
      RAISE EXCEPTION 'Cannot change article author_id.';
    END IF;
    IF new.author_display_name <> old.author_display_name 
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

  -- Metadata Consistency Invariants
  IF new.status IN ('draft', 'review') THEN
    new.published_at := NULL;
    new.published_by := NULL;
    new.archived_at := NULL;
    new.archive_reason := NULL;
    new.archived_by := NULL;
  ELSIF new.status = 'published' THEN
    IF new.published_at IS NULL OR new.published_by IS NULL THEN
      RAISE EXCEPTION 'Published articles must have published_at and published_by set.';
    END IF;
    new.archived_at := NULL;
    new.archive_reason := NULL;
    new.archived_by := NULL;
  ELSIF new.status = 'archived' THEN
    IF new.archived_at IS NULL THEN
      RAISE EXCEPTION 'Archived articles must have archived_at set.';
    END IF;
  END IF;

  RETURN new;
END;
$$;

COMMIT;
