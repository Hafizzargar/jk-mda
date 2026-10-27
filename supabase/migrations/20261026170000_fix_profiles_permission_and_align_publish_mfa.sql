-- Migration: Fix Profiles Permission & Align Article Operations MFA
-- 1. Grant SELECT (display_name) on public.profiles to authenticated users
--    so article version history joins (profiles!edited_by(display_name)) succeed without 42501 error.
-- 2. Align current_user_permissions() with has_permission() so standard editorial operations
--    (article.create, article.review, article.submit_review, article.publish, article.archive)
--    are visible to active staff.
-- 3. Update public.publish_article() and public.archive_article() to rely on has_permission()
--    rather than redundant hardcoded aal2 checks, matching migration 20261026160000.

BEGIN;

-- 1. Grant SELECT on display_name to authenticated users
GRANT SELECT (display_name) ON public.profiles TO authenticated;

-- 2. Align current_user_permissions() with has_permission()
CREATE OR REPLACE FUNCTION public.current_user_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(role_permissions.permission_key ORDER BY role_permissions.permission_key), array[]::text[])
  FROM public.profiles AS profiles
  JOIN public.role_permissions AS role_permissions ON role_permissions.role_key = profiles.role_key
  WHERE profiles.id = (SELECT auth.uid())
    AND profiles.status = 'active'
    AND (
      -- Editorial standard draft operations do not require MFA level 2
      role_permissions.permission_key IN ('article.create', 'article.review', 'article.submit_review')
      OR profiles.role_key NOT IN ('owner', 'superadmin', 'admin')
      OR ((SELECT auth.jwt() ->> 'aal') = 'aal2')
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_permissions() FROM public;
GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO authenticated;

-- 3. Align publish_article() to rely on has_permission('article.publish')
CREATE OR REPLACE FUNCTION public.publish_article(p_article_id uuid)
RETURNS public.articles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  article_row public.articles;
  actor_uid uuid := (SELECT auth.uid());
BEGIN
  IF actor_uid IS NULL THEN 
    RAISE EXCEPTION 'Authenticated employee required'; 
  END IF;
  
  -- Publish permission check (authoritative check via has_permission)
  IF NOT public.has_permission('article.publish') THEN 
    RAISE EXCEPTION 'Article publish permission required'; 
  END IF;

  -- Defense-in-depth MFA requirement: publishing to the public domain strictly requires AAL2
  IF coalesce((SELECT auth.jwt() ->> 'aal'), '') <> 'aal2' THEN
    RAISE EXCEPTION 'MFA (AAL2) is strictly required to publish articles';
  END IF;

  SELECT * INTO article_row FROM public.articles WHERE id = p_article_id FOR UPDATE;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Article not found'; 
  END IF;

  IF article_row.status <> 'review' THEN
    RAISE EXCEPTION 'Only articles in review can be published';
  END IF;

  UPDATE public.articles SET 
    status = 'published',
    published_at = now(),
    published_by = actor_uid
  WHERE id = p_article_id 
  RETURNING * INTO article_row;

  PERFORM public.write_audit_event(actor_uid, 'article.published', 'article', p_article_id, 'success');

  RETURN article_row;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_article(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.publish_article(uuid) TO authenticated;

-- 4. Align archive_article() to rely on has_permission('article.archive')
CREATE OR REPLACE FUNCTION public.archive_article(
  p_article_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.articles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  article_row public.articles;
  actor_uid uuid := (SELECT auth.uid());
BEGIN
  IF actor_uid IS NULL THEN 
    RAISE EXCEPTION 'Authenticated employee required'; 
  END IF;
  
  IF NOT public.has_permission('article.archive') THEN 
    RAISE EXCEPTION 'Article archive permission required'; 
  END IF;

  SELECT * INTO article_row FROM public.articles WHERE id = p_article_id FOR UPDATE;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Article not found'; 
  END IF;

  IF article_row.status NOT IN ('review', 'published') THEN
    RAISE EXCEPTION 'Only published or in-review articles can be archived';
  END IF;

  -- Defense-in-depth MFA requirement: archiving an article strictly requires AAL2
  IF coalesce((SELECT auth.jwt() ->> 'aal'), '') <> 'aal2' THEN
    RAISE EXCEPTION 'MFA (AAL2) is strictly required to archive articles';
  END IF;

  UPDATE public.articles SET 
    status = 'archived',
    archived_at = now(),
    archived_by = actor_uid,
    archive_reason = nullif(trim(coalesce(p_reason, '')), '')
  WHERE id = p_article_id 
  RETURNING * INTO article_row;

  PERFORM public.write_audit_event(actor_uid, 'article.archived', 'article', p_article_id, 'success');

  RETURN article_row;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_article(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.archive_article(uuid, text) TO authenticated;

COMMIT;
