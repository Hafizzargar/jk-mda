-- ==============================================================================
-- KJIN Newsroom: Direct Administrator Access & MFA Relaxation
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/uaaajvcmjivszrkzdmvu/sql/new
-- ==============================================================================

-- 1. Relax has_permission() so owner, superadmin, and admin don't get blocked by AAL2
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profiles
    JOIN public.role_permissions AS role_permissions ON role_permissions.role_key = profiles.role_key
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.status = 'active'
      AND role_permissions.permission_key = p_permission_key
  );
$$;

-- 2. Relax current_user_permissions() so all role permissions are returned without AAL2
CREATE OR REPLACE FUNCTION public.current_user_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(role_permissions.permission_key ORDER BY role_permissions.permission_key), array[]::text[])
  FROM public.profiles AS profiles
  JOIN public.role_permissions AS role_permissions ON role_permissions.role_key = profiles.role_key
  WHERE profiles.id = (SELECT auth.uid())
    AND profiles.status = 'active';
$$;

-- 3. Reset rate-limit blocker on MFA challenge attempts
CREATE OR REPLACE FUNCTION public.claim_mfa_challenge_attempt()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN;
END;
$$;

-- 4. Relax publish_article() to not require AAL2
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
  
  IF NOT public.has_permission('article.publish') THEN 
    RAISE EXCEPTION 'Article publish permission required'; 
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

-- 5. Relax archive_article() to not require AAL2
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

-- 6. Relax delete_article() to not require AAL2
CREATE OR REPLACE FUNCTION public.delete_article(
  p_article_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  article_row public.articles;
  actor_uid uuid := (SELECT auth.uid());
  actor_role text;
BEGIN
  IF actor_uid IS NULL THEN 
    RAISE EXCEPTION 'Authenticated employee required'; 
  END IF;

  SELECT role_key INTO actor_role 
  FROM public.profiles 
  WHERE id = actor_uid AND status = 'active';

  IF actor_role NOT IN ('owner', 'superadmin', 'admin') THEN
    RAISE EXCEPTION 'Only owners, superadmins, and admins can delete articles';
  END IF;

  SELECT * INTO article_row FROM public.articles WHERE id = p_article_id FOR UPDATE;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Article not found'; 
  END IF;

  PERFORM public.write_audit_event(
    actor_uid,
    'article.deleted',
    'article',
    p_article_id,
    'success',
    coalesce(p_reason, 'Permanently deleted by authorized administrator'),
    jsonb_build_object(
      'title', article_row.title,
      'slug', article_row.slug,
      'category', article_row.category,
      'district', article_row.district,
      'status', article_row.status,
      'author_id', article_row.author_id,
      'author_display_name', article_row.author_display_name,
      'deleted_by_role', actor_role,
      'view_count', article_row.view_count
    )
  );

  DELETE FROM public.articles WHERE id = p_article_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_article(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_article(uuid, text) TO authenticated;

-- 7. Relax translation integrity trigger
CREATE OR REPLACE FUNCTION public.article_translations_enforce_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
