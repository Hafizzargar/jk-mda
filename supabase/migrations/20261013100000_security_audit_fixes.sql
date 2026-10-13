-- Migration: Security Audit Fixes (13 October 2026)
-- Addresses 3 confirmed findings from the authorization & API security audit.

-- ============================================================================
-- Fix #1: Grant article.archive to editors
-- Editors manage the full editorial pipeline. Without this permission they
-- cannot remove inappropriate content from public view.
-- ============================================================================
INSERT INTO public.role_permissions (role_key, permission_key)
VALUES ('editor', 'article.archive')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Fix #2: Lock down increment_article_view_count(uuid, text) grants
-- The views-redesign migration (20261010110000) replaced the 1-param version
-- with a 2-param version but never re-issued grants. The API route calls it
-- via service_role, so restrict to service_role only.
-- Also drop the orphaned 1-param overload if it still exists.
-- ============================================================================

-- Revoke any existing grants on the current 2-param function
REVOKE ALL ON FUNCTION public.increment_article_view_count(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.increment_article_view_count(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_article_view_count(uuid, text) TO service_role;

-- Drop the orphaned 1-param overload (created in 20261008140000, superseded by 20261010110000)
DROP FUNCTION IF EXISTS public.increment_article_view_count(uuid);

-- ============================================================================
-- Fix #3: Re-architect public reading policies and restrict has_permission()
-- 1. Ensure user_has_editor_access() and user_has_author_access() are non-inlined
--    PL/pgSQL SECURITY DEFINER functions that return false immediately for anon.
-- 2. Update the "Published articles are public" SELECT policy on articles to
--    delegate to user_has_editor_access() and user_has_author_access() rather than
--    calling has_permission() directly in the policy expression.
-- 3. Safely revoke EXECUTE on has_permission(text) from anon while preserving
--    authenticated and service_role execution.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_editor_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN false;
  END IF;
  RETURN public.has_permission('article.review');
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_author_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN false;
  END IF;
  RETURN public.has_permission('article.create');
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_editor_access() FROM public;
REVOKE ALL ON FUNCTION public.user_has_author_access() FROM public;
GRANT EXECUTE ON FUNCTION public.user_has_editor_access() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_author_access() TO authenticated, anon;

-- Update the public SELECT policy on articles to use helper functions
DROP POLICY IF EXISTS "Published articles are public" ON public.articles;
CREATE POLICY "Published articles are public"
ON public.articles FOR SELECT
USING (
  status = 'published'
  OR public.user_has_editor_access()
  OR ((SELECT auth.uid()) IS NOT NULL AND author_id = (SELECT auth.uid()) AND public.user_has_author_access())
);

-- Revoke direct execution of has_permission(text) from anon
REVOKE ALL ON FUNCTION public.has_permission(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated, service_role;
