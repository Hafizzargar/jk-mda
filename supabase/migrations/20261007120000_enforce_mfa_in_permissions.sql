-- Migration: enforce_mfa_in_permissions
-- Enforces that owner, superadmin, and admin roles must have AAL2 to pass permission checks.

create or replace function public.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profiles
    join public.role_permissions as role_permissions on role_permissions.role_key = profiles.role_key
    where profiles.id = (select auth.uid())
      and profiles.status = 'active'
      and role_permissions.permission_key = p_permission_key
      and (
        profiles.role_key not in ('owner', 'superadmin', 'admin')
        or
        ((select auth.jwt() ->> 'aal') = 'aal2')
      )
  );
$$;

create or replace function public.current_user_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(role_permissions.permission_key order by role_permissions.permission_key), array[]::text[])
  from public.profiles as profiles
  join public.role_permissions as role_permissions on role_permissions.role_key = profiles.role_key
  where profiles.id = (select auth.uid())
    and profiles.status = 'active'
    and (
      profiles.role_key not in ('owner', 'superadmin', 'admin')
      or
      ((select auth.jwt() ->> 'aal') = 'aal2')
    )
$$;
