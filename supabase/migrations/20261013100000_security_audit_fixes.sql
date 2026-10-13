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
-- Fix #3: Revoke has_permission() from anon
-- The function always returns false for anon (auth.uid() is NULL), but the
-- grant is inconsistent with current_user_role() and current_user_permissions()
-- which are authenticated-only.
--
-- Note: user_has_editor_access() retains its anon grant because it is used in
-- the "Published articles are public" SELECT policy, which evaluates for
-- anonymous readers. Since it delegates to has_permission() which will still
-- return false for anon, the SELECT policy's `status = 'published'` branch
-- handles anonymous access. The anon grant on user_has_editor_access() is kept
-- to avoid breaking the RLS policy evaluation.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM anon;
