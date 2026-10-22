-- Migration: Hide Owner from Subordinate Employee Directory
-- Ensures superadmins, admins, editors, and authors cannot view the system owner profile.
-- Only the owner can view the owner in the employee directory.

create or replace function public.list_employees()
returns table (id uuid, email text, phone text, display_name text, role_key text, status text, created_at timestamptz, can_manage boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare actor_rank smallint;
begin
  if not public.has_permission('employee.directory.read') then raise exception 'Employee directory access is required'; end if;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  return query select profiles.id,
    case when public.has_permission('employee.contacts.view') then profiles.email else null end,
    case when public.has_permission('employee.contacts.view') then profiles.phone else null end,
    profiles.display_name, profiles.role_key, profiles.status, profiles.created_at,
    (roles.hierarchy_rank < actor_rank and profiles.role_key <> 'owner' and profiles.id <> auth.uid())
  from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key
  where (actor_rank >= 500 or profiles.role_key <> 'owner')
  order by roles.hierarchy_rank desc, profiles.display_name, profiles.email;
end;
$$;

revoke all on function public.list_employees() from public;
grant execute on function public.list_employees() to authenticated;
