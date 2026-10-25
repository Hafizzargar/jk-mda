-- Migration: owner_superadmin_full_access
-- Ensures owner, superadmin, admin, editor, and author have full, unobstructed permissions to create, edit, and manage articles.
-- Owner and Superadmin have unconditional access to ALL system permissions.
-- Editorial operations (article.create, article.review, article.publish) are never blocked by AAL2.

BEGIN;

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
    LEFT JOIN public.role_permissions AS role_permissions ON role_permissions.role_key = profiles.role_key
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.status = 'active'
      AND (
        -- 1. Owner and Superadmin unconditionally have ALL permissions
        profiles.role_key IN ('owner', 'superadmin')
        OR
        (
          role_permissions.permission_key = p_permission_key
          AND (
            -- 2. Article creation, review, and editing are never locked out by MFA
            p_permission_key LIKE 'article.%'
            OR
            -- 3. Non-admin roles (editor, author) do not require MFA
            profiles.role_key NOT IN ('admin')
            OR
            -- 4. Admin MFA check only for destructive employee operations
            ((SELECT auth.jwt() ->> 'aal') = 'aal2')
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    -- Owner and Superadmin have ALL permissions in the system
    WHEN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND status = 'active'
        AND role_key IN ('owner', 'superadmin')
    ) THEN (
      SELECT COALESCE(array_agg(permission_key ORDER BY permission_key), ARRAY[]::text[])
      FROM public.permissions
    )
    -- Other active profiles get their role permissions
    ELSE (
      SELECT COALESCE(array_agg(role_permissions.permission_key ORDER BY role_permissions.permission_key), ARRAY[]::text[])
      FROM public.profiles AS profiles
      JOIN public.role_permissions AS role_permissions ON role_permissions.role_key = profiles.role_key
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.status = 'active'
        AND (
          role_permissions.permission_key LIKE 'article.%'
          OR
          profiles.role_key NOT IN ('admin')
          OR
          ((SELECT auth.jwt() ->> 'aal') = 'aal2')
        )
    )
  END;
$$;

-- Ensure execute permissions
REVOKE ALL ON FUNCTION public.has_permission(text) FROM public;
REVOKE ALL ON FUNCTION public.current_user_permissions() FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO authenticated, service_role;

COMMIT;
