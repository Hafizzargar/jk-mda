create table if not exists public.roles (
  role_key text primary key check (role_key in ('owner', 'superadmin', 'admin', 'editor', 'author')),
  hierarchy_rank smallint not null unique
);

insert into public.roles (role_key, hierarchy_rank) values
  ('owner', 500),
  ('superadmin', 400),
  ('admin', 300),
  ('editor', 200),
  ('author', 100)
on conflict (role_key) do update set hierarchy_rank = excluded.hierarchy_rank;

create table if not exists public.permissions (
  permission_key text primary key,
  description text not null
);

insert into public.permissions (permission_key, description) values
  ('employee.directory.read', 'Read the employee directory'),
  ('employee.contacts.view', 'View employee email and phone'),
  ('employee.invite.request', 'Request an employee invitation'),
  ('employee.invite', 'Invite employees below the acting role'),
  ('employee.invite.review', 'Approve or reject employee invitation requests'),
  ('employee.basic.update', 'Update basic employee details below the acting role'),
  ('employee.contact.update', 'Change employee email or phone below the acting role'),
  ('employee.role.change', 'Change roles below the acting role'),
  ('employee.disable', 'Disable employees below the acting role'),
  ('employee.enable', 'Enable employees below the acting role'),
  ('employee.deletion.request', 'Request employee deprovisioning'),
  ('employee.deletion.view', 'View pending employee deprovisioning requests'),
  ('employee.deletion.resolve', 'Approve or reject employee deprovisioning'),
  ('employee.audit.read', 'Read employee-operation audit history'),
  ('employee.audit.security.read', 'Read role and security audit history'),
  ('article.create', 'Create article drafts'),
  ('article.submit_review', 'Submit authored articles for review'),
  ('article.review', 'Review article workflow'),
  ('article.publish', 'Publish articles'),
  ('article.delete', 'Delete articles'),
  ('advertisement.submit', 'Submit advertisements for review'),
  ('advertisement.manage', 'Manage advertisement scheduling'),
  ('advertisement.approve', 'Approve advertisements'),
  ('reader_counter.view', 'View the permanent reader counter'),
  ('reader_counter.set_initial', 'Set the initial reader count'),
  ('reader_counter.reset', 'Reset the reader count')
on conflict (permission_key) do update set description = excluded.description;

create table if not exists public.role_permissions (
  role_key text not null references public.roles (role_key) on delete cascade,
  permission_key text not null references public.permissions (permission_key) on delete cascade,
  primary key (role_key, permission_key)
);

insert into public.role_permissions (role_key, permission_key)
select roles.role_key, permissions.permission_key
from public.roles as roles
cross join public.permissions as permissions
where roles.role_key = 'owner'
on conflict do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'superadmin', permissions.permission_key
from public.permissions as permissions
on conflict do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'admin', permissions.permission_key
from public.permissions as permissions
where permissions.permission_key in (
  'employee.directory.read', 'employee.contacts.view', 'employee.invite.request',
  'employee.invite', 'employee.invite.review', 'employee.basic.update',
  'employee.role.change',
  'employee.deletion.request', 'employee.deletion.view', 'employee.audit.read', 'article.create',
  'article.submit_review', 'article.review', 'article.publish',
  'advertisement.submit', 'advertisement.manage'
)
on conflict do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'editor', permissions.permission_key
from public.permissions as permissions
where permissions.permission_key in (
  'employee.directory.read', 'employee.invite.request', 'article.create',
  'article.submit_review', 'article.review', 'article.publish', 'advertisement.submit'
)
on conflict do nothing;

insert into public.role_permissions (role_key, permission_key)
select 'author', permissions.permission_key
from public.permissions as permissions
where permissions.permission_key in (
  'employee.directory.read', 'employee.invite.request', 'article.create',
  'article.submit_review', 'advertisement.submit'
)
on conflict do nothing;

revoke all on public.roles, public.permissions, public.role_permissions from anon, authenticated;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

alter table public.profiles add column if not exists role_key text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles alter column status set default 'invited';
alter table public.profiles drop constraint if exists profiles_status_check;
update public.profiles set status = 'disabled' where status = 'suspended';
update public.profiles set status = 'disabled' where role = 'author' and status = 'active';
update public.profiles set role_key = role where role_key is null;
alter table public.profiles alter column role_key set not null;
alter table public.profiles drop constraint if exists profiles_role_key_fkey;
alter table public.profiles add constraint profiles_role_key_fkey foreign key (role_key) references public.roles (role_key);
alter table public.profiles add constraint profiles_status_check check (status in ('invited', 'active', 'disabled'));
alter table public.profiles add constraint profiles_role_key_check check (role_key in ('owner', 'superadmin', 'admin', 'editor', 'author'));
create unique index if not exists idx_profiles_single_owner
on public.profiles (role_key)
where role_key = 'owner';

update public.profiles profiles
set email = users.email, phone = nullif(users.phone, '')
from auth.users users
where users.id = profiles.id;

create table if not exists public.employee_invite_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null,
  email text not null,
  display_name text not null default '',
  requested_role text not null references public.roles (role_key),
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid,
  review_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists idx_employee_invite_request_pending_email
on public.employee_invite_requests (lower(email))
where status = 'pending';

create table if not exists public.employee_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null default '',
  phone text,
  role_key text not null references public.roles (role_key),
  reason text not null default '',
  invited_by uuid not null,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  request_id uuid references public.employee_invite_requests (id) on delete set null,
  status text not null default 'sending' check (status in ('sending', 'invited', 'accepted', 'failed', 'revoked')),
  failure_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);

alter table public.employee_invites alter column invited_by drop not null;

create unique index if not exists idx_employee_invites_pending_email
on public.employee_invites (lower(email))
where status in ('sending', 'invited');

create table if not exists public.employee_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null,
  requested_by uuid not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  review_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists idx_employee_deletion_one_pending
on public.employee_deletion_requests (target_profile_id)
where status = 'pending';

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_profile_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  result text not null check (result in ('success', 'denied', 'failure')),
  reason text not null default '',
  session_id uuid,
  request_id text,
  ip_address inet,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_target on public.audit_logs (target_type, target_id, created_at desc);
create index if not exists idx_employee_invites_status on public.employee_invites (status, created_at desc);
create index if not exists idx_employee_deletion_requests_status on public.employee_deletion_requests (status, created_at desc);

alter table public.employee_invite_requests enable row level security;
alter table public.employee_invites enable row level security;
alter table public.employee_deletion_requests enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.employee_invite_requests, public.employee_invites, public.employee_deletion_requests, public.audit_logs from anon, authenticated;

drop function if exists public.current_user_role();
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.role_key
  from public.profiles as profiles
  where profiles.id = (select auth.uid())
    and profiles.status = 'active'
  limit 1;
$$;

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
    and profiles.status = 'active';
$$;

create or replace function public.user_has_editor_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('article.review');
$$;

create or replace function public.user_has_author_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('article.create');
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.current_user_permissions() from public;
revoke all on function public.user_has_editor_access() from public;
revoke all on function public.user_has_author_access() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_permission(text) to authenticated, anon;
grant execute on function public.current_user_permissions() to authenticated;
grant execute on function public.user_has_editor_access() to authenticated, anon;
grant execute on function public.user_has_author_access() to authenticated;

drop policy if exists "Profiles are readable by owner or editors" on public.profiles;
drop policy if exists "Profiles are readable by directory permission" on public.profiles;
create policy "Profiles are readable by directory permission"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or public.has_permission('employee.directory.read'));

revoke all on public.profiles from anon, authenticated;
grant select (id, role, role_key, status, created_at, updated_at) on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

create or replace function public.write_audit_event(
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_result text,
  p_reason text default '',
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (
    actor_profile_id, action, target_type, target_id, result, reason,
    session_id, request_id, user_agent, details
  )
  values (
    p_actor_id, p_action, p_target_type, p_target_id, p_result, coalesce(p_reason, ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id', '')::uuid,
    nullif(current_setting('request.headers', true)::jsonb ->> 'x-request-id', ''),
    nullif(current_setting('request.headers', true)::jsonb ->> 'user-agent', ''),
    coalesce(p_details, '{}'::jsonb)
  );
$$;
revoke all on function public.write_audit_event(uuid, text, text, uuid, text, text, jsonb) from public;

create or replace function public.list_employees()
returns table (
  id uuid,
  email text,
  phone text,
  display_name text,
  role_key text,
  status text,
  created_at timestamptz,
  can_manage boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_rank smallint;
begin
  if not public.has_permission('employee.directory.read') then
    raise exception 'Employee directory access is required';
  end if;

  select roles.hierarchy_rank into actor_rank
  from public.profiles as profiles
  join public.roles as roles on roles.role_key = profiles.role_key
  where profiles.id = auth.uid() and profiles.status = 'active';

  return query
  select profiles.id,
    case when public.has_permission('employee.contacts.view') then profiles.email else null end,
    case when public.has_permission('employee.contacts.view') then profiles.phone else null end,
    profiles.display_name,
    profiles.role_key,
    profiles.status,
    profiles.created_at,
    (roles.hierarchy_rank < actor_rank and profiles.role_key <> 'owner' and profiles.id <> auth.uid())
  from public.profiles as profiles
  join public.roles as roles on roles.role_key = profiles.role_key
  order by roles.hierarchy_rank desc, profiles.display_name, profiles.email;
end;
$$;

create or replace function public.request_employee_invite(
  p_email text,
  p_display_name text,
  p_requested_role text,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  actor_rank smallint;
  requested_rank smallint;
  recent_requests integer;
begin
  if auth.uid() is null or not public.has_permission('employee.invite.request') then
    raise exception 'Active employee access is required';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if p_requested_role not in ('author', 'editor', 'admin', 'superadmin') then
    raise exception 'Owner invitations require the controlled bootstrap process';
  end if;
  if length(trim(coalesce(p_email, ''))) > 254
    or trim(coalesce(p_email, '')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(trim(coalesce(p_display_name, ''))) not between 1 and 120
    or length(trim(coalesce(p_reason, ''))) > 1000 then
    raise exception 'Invitation request fields are invalid';
  end if;
  select roles.hierarchy_rank into actor_rank
  from public.profiles profiles
  join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = auth.uid() and profiles.status = 'active';
  select hierarchy_rank into requested_rank from public.roles where role_key = p_requested_role;
  if requested_rank is null or requested_rank > actor_rank then
    raise exception 'You cannot request an employee above your role level';
  end if;
  select count(*) into recent_requests
  from public.employee_invite_requests
  where requested_by = auth.uid() and created_at > now() - interval '24 hours';
  if recent_requests >= 10 then raise exception 'Daily employee invitation request limit reached'; end if;

  insert into public.employee_invite_requests (requested_by, email, display_name, requested_role, reason)
  values (auth.uid(), lower(trim(p_email)), trim(coalesce(p_display_name, '')), p_requested_role, trim(coalesce(p_reason, '')))
  returning id into request_id;

  perform public.write_audit_event(auth.uid(), 'employee.invite_requested', 'employee_invite_request', request_id, 'success', p_reason,
    jsonb_build_object('email', lower(trim(p_email)), 'requested_role', p_requested_role));
  return request_id;
end;
$$;

create or replace function public.list_employee_invite_requests()
returns table (
  id uuid,
  email text,
  display_name text,
  requested_role text,
  reason text,
  status text,
  requested_by uuid,
  requester_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('employee.invite.review') then
    raise exception 'Employee invitation review access is required';
  end if;
  return query
  select requests.id, requests.email, requests.display_name, requests.requested_role,
    requests.reason, requests.status, requests.requested_by, profiles.display_name, requests.created_at
  from public.employee_invite_requests as requests
  left join public.profiles as profiles on profiles.id = requests.requested_by
  where requests.status = 'pending'
  order by requests.created_at;
end;
$$;

create or replace function public.reject_employee_invite_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('employee.invite.review') then
    raise exception 'Employee invitation review access is required';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  update public.employee_invite_requests
  set status = 'rejected', reviewed_by = auth.uid(), review_reason = trim(coalesce(p_reason, '')), reviewed_at = now()
  where id = p_request_id and status = 'pending';
  if not found then raise exception 'Pending invitation request not found'; end if;
  perform public.write_audit_event(auth.uid(), 'employee.invite_request_rejected', 'employee_invite_request', p_request_id, 'success', p_reason);
end;
$$;

create or replace function public.update_employee_basic(p_target_id uuid, p_display_name text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_rank smallint;
  target_rank smallint;
begin
  if not public.has_permission('employee.basic.update') then raise exception 'Employee update access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select roles.hierarchy_rank into target_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = p_target_id;
  if p_target_id = auth.uid() or target_rank is null or target_rank >= actor_rank or (select role_key from public.profiles where id = p_target_id) = 'owner' then
    raise exception 'You cannot modify this employee';
  end if;
  update public.profiles set display_name = trim(p_display_name), updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.basic_updated', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('fields', jsonb_build_array('display_name')));
end;
$$;

create or replace function public.change_employee_role(p_target_id uuid, p_role_key text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_rank smallint;
  target_rank smallint;
  new_rank smallint;
  old_role text;
begin
  if not public.has_permission('employee.role.change') then raise exception 'Role-change access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if p_role_key = 'owner' then raise exception 'Owner cannot be assigned through employee management'; end if;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select profiles.role_key, roles.hierarchy_rank into old_role, target_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = p_target_id;
  select hierarchy_rank into new_rank from public.roles where role_key = p_role_key;
  if p_target_id = auth.uid() or old_role = 'owner' or target_rank is null or target_rank >= actor_rank or new_rank is null or new_rank >= actor_rank then
    raise exception 'You cannot change this employee role';
  end if;
  update public.profiles set role_key = p_role_key, role = p_role_key, updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.role_changed', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('from_role', old_role, 'to_role', p_role_key));
end;
$$;

create or replace function public.request_employee_deletion(p_target_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  target_role text;
begin
  if not public.has_permission('employee.deletion.request') then raise exception 'Employee deletion request access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(p_reason)) > 1000 then raise exception 'Reason is too long'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  select role_key into target_role from public.profiles where id = p_target_id;
  if target_role is null or target_role = 'owner' or p_target_id = auth.uid() then raise exception 'This employee cannot be requested for deletion'; end if;
  insert into public.employee_deletion_requests (target_profile_id, requested_by, reason)
  values (p_target_id, auth.uid(), trim(p_reason)) returning id into request_id;
  perform public.write_audit_event(auth.uid(), 'employee.deletion_requested', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('request_id', request_id));
  return request_id;
end;
$$;

create or replace function public.list_employee_deletion_requests()
returns table (
  id uuid,
  target_profile_id uuid,
  target_name text,
  target_role text,
  requested_by uuid,
  requester_name text,
  reason text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('employee.deletion.view') then raise exception 'Deletion request access is required'; end if;
  return query
  select requests.id, requests.target_profile_id, target.display_name, target.role_key,
    requests.requested_by, requester.display_name, requests.reason, requests.status, requests.created_at
  from public.employee_deletion_requests requests
  left join public.profiles target on target.id = requests.target_profile_id
  left join public.profiles requester on requester.id = requests.requested_by
  where requests.status = 'pending'
  order by requests.created_at;
end;
$$;

create or replace function public.resolve_employee_deletion(p_request_id uuid, p_decision text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.employee_deletion_requests;
  target_role text;
  actor_rank smallint;
  target_rank smallint;
begin
  if not public.has_permission('employee.deletion.resolve') then raise exception 'Deletion review access is required'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  select * into request_row from public.employee_deletion_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'Pending deletion request not found'; end if;
  if request_row.requested_by = auth.uid() or request_row.target_profile_id = auth.uid() then raise exception 'You cannot resolve your own deletion request'; end if;
  select profiles.role_key, roles.hierarchy_rank into target_role, target_rank
  from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = request_row.target_profile_id;
  select roles.hierarchy_rank into actor_rank
  from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = auth.uid() and profiles.status = 'active';
  if target_role is null or target_role = 'owner' or target_rank >= actor_rank then
    raise exception 'You cannot deprovision this employee';
  end if;

  update public.employee_deletion_requests
  set status = p_decision, reviewed_by = auth.uid(), review_reason = trim(coalesce(p_reason, '')), reviewed_at = now()
  where id = p_request_id;
  if p_decision = 'approved' then
    update public.profiles set status = 'disabled', updated_at = now() where id = request_row.target_profile_id;
  end if;
  perform public.write_audit_event(auth.uid(), 'employee.deletion_' || p_decision, 'profile', request_row.target_profile_id, 'success', p_reason, jsonb_build_object('request_id', p_request_id));
end;
$$;

create or replace function public.set_employee_status(p_target_id uuid, p_next_status text, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
  target_status text;
  actor_rank smallint;
  target_rank smallint;
begin
  if p_next_status not in ('active', 'disabled') then raise exception 'Status must be active or disabled'; end if;
  if p_next_status = 'disabled' and not public.has_permission('employee.disable') then raise exception 'Disable access is required'; end if;
  if p_next_status = 'active' and not public.has_permission('employee.enable') then raise exception 'Enable access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  select role_key, status into target_role, target_status from public.profiles where id = p_target_id;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select hierarchy_rank into target_rank from public.roles where role_key = target_role;
  if target_role is null or target_role = 'owner' or p_target_id = auth.uid() then raise exception 'You cannot change this employee status'; end if;
  if target_rank is null or target_rank >= actor_rank then raise exception 'You cannot change this employee status'; end if;
  if target_status = 'invited' and p_next_status = 'active' then raise exception 'Employees must accept their invitation before activation'; end if;
  update public.profiles set status = p_next_status, updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.' || p_next_status, 'profile', p_target_id, 'success', p_reason);
end;
$$;

create or replace function public.list_audit_history()
returns table (
  id bigint,
  actor_profile_id uuid,
  actor_name text,
  action text,
  target_type text,
  target_id uuid,
  result text,
  reason text,
  details jsonb,
  session_id uuid,
  request_id text,
  ip_address inet,
  user_agent text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('employee.audit.read') and not public.has_permission('employee.audit.security.read') then
    raise exception 'Audit history access is required';
  end if;
  return query
  select logs.id, logs.actor_profile_id, coalesce(profiles.display_name, 'Former employee'), logs.action,
    logs.target_type, logs.target_id, logs.result, logs.reason, logs.details,
    logs.session_id, logs.request_id, logs.ip_address, logs.user_agent, logs.created_at
  from public.audit_logs logs
  left join public.profiles profiles on profiles.id = logs.actor_profile_id
  where public.has_permission('employee.audit.security.read')
     or logs.action not like '%role%'
  order by logs.created_at desc
  limit 500;
end;
$$;

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit history is append-only';
end;
$$;
create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

create or replace function public.sync_profile_contact_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email or new.phone is distinct from old.phone then
    update public.profiles
    set email = new.email, phone = nullif(new.phone, ''), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists auth_user_sync_profile_contact on auth.users;
create trigger auth_user_sync_profile_contact
after update of email, phone on auth.users
for each row execute function public.sync_profile_contact_from_auth();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matching_invite public.employee_invites;
begin
  select * into matching_invite
  from public.employee_invites
  where id::text = new.raw_user_meta_data ->> 'employee_invite_id'
    and lower(email) = lower(new.email)
    and status = 'sending'
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if matching_invite.id is null then
    raise exception 'Staff accounts must be provisioned through a server-issued invitation';
  end if;

  insert into public.profiles (id, email, display_name, role, role_key, status, phone)
  values (
    new.id,
    new.email,
    coalesce(nullif(matching_invite.display_name, ''), new.raw_user_meta_data ->> 'display_name', ''),
    matching_invite.role_key,
    matching_invite.role_key,
    'invited',
    nullif(new.phone, '')
  )
  on conflict (id) do nothing;

  update public.employee_invites
  set auth_user_id = new.id, status = 'invited'
  where id = matching_invite.id;

  return new;
end;
$$;

create or replace function public.activate_employee_invite_on_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles as profiles
    set status = 'active', updated_at = now()
    from public.employee_invites as invites
    where invites.auth_user_id = new.id
      and invites.status = 'invited'
      and invites.expires_at > now()
      and profiles.id = new.id;

    update public.employee_invites
    set status = 'accepted', accepted_at = now()
    where auth_user_id = new.id and status = 'invited' and expires_at > now();
  end if;
  return new;
end;
$$;
drop trigger if exists auth_user_activate_employee_invite on auth.users;
create trigger auth_user_activate_employee_invite
after update of email_confirmed_at on auth.users
for each row execute function public.activate_employee_invite_on_confirmation();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.role_key from public.profiles profiles
  where profiles.id = (select auth.uid()) and profiles.status = 'active' limit 1;
$$;

create or replace function public.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles profiles
    join public.role_permissions grants on grants.role_key = profiles.role_key
    where profiles.id = (select auth.uid()) and profiles.status = 'active'
      and grants.permission_key = p_permission_key
  );
$$;

create or replace function public.user_has_editor_access()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_permission('article.review'); $$;

create or replace function public.user_has_author_access()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_permission('article.create'); $$;

create or replace function public.set_article_author()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare profile_display_name text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.status <> 'draft' or not public.has_permission('article.create') then
      raise exception 'An active employee may create draft articles only';
    end if;
    select display_name into profile_display_name from public.profiles
      where id = auth.uid() and status = 'active';
    if not found then raise exception 'An active employee profile is required'; end if;
    new.author_id := auth.uid();
    new.author := coalesce(nullif(profile_display_name, ''), 'KJIN desk');
    return new;
  end if;
  if new.author_id is distinct from old.author_id then raise exception 'Article attribution cannot be changed'; end if;
  new.author := old.author;
  return new;
end;
$$;

create or replace function public.enforce_article_status_transition()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  permitted_review_submission boolean;
  permitted_reviewer_transition boolean;
begin
  if new.status = old.status then return new; end if;
  permitted_review_submission := old.status = 'draft' and new.status = 'review'
    and old.author_id = auth.uid() and public.has_permission('article.submit_review')
    and current_setting('kjin.allow_review_submission', true) = 'on';
  permitted_reviewer_transition := public.has_permission('article.review')
    and current_setting('kjin.allow_status_transition', true) = 'on'
    and ((old.status = 'draft' and new.status = 'review')
      or (old.status = 'review' and new.status in ('draft', 'published', 'archived'))
      or (old.status = 'published' and new.status = 'archived'))
    and (new.status <> 'published' or public.has_permission('article.publish'));
  if permitted_review_submission or permitted_reviewer_transition then return new; end if;
  raise exception 'Invalid or unauthorized article status transition: % to %', old.status, new.status;
end;
$$;

create or replace function public.submit_article_for_review(p_article_id uuid)
returns public.articles language plpgsql security definer set search_path = ''
as $$
declare article_row public.articles;
begin
  if auth.uid() is null or not public.has_permission('article.submit_review') then raise exception 'Article submission access is required'; end if;
  select * into article_row from public.articles where id = p_article_id for update;
  if not found or article_row.author_id <> auth.uid() or article_row.status <> 'draft' then raise exception 'Only your own draft articles can be submitted'; end if;
  perform set_config('kjin.allow_review_submission', 'on', true);
  update public.articles set status = 'review' where id = p_article_id returning * into article_row;
  perform public.write_audit_event(auth.uid(), 'article.submitted_for_review', 'article', p_article_id, 'success');
  return article_row;
end;
$$;

create or replace function public.transition_article_status(p_article_id uuid, p_next_status public.article_status)
returns public.articles language plpgsql security definer set search_path = ''
as $$
declare article_row public.articles;
begin
  if p_next_status = 'published' then
    if not public.has_permission('article.publish') then raise exception 'Article publish access is required'; end if;
  elsif not public.has_permission('article.review') then
    raise exception 'Article review access is required';
  end if;
  perform set_config('kjin.allow_status_transition', 'on', true);
  update public.articles set status = p_next_status where id = p_article_id returning * into article_row;
  if not found then raise exception 'Article not found'; end if;
  perform public.write_audit_event(auth.uid(), 'article.status_' || p_next_status::text, 'article', p_article_id, 'success');
  return article_row;
end;
$$;

create or replace function public.create_article(
  p_title text, p_summary text, p_body text, p_category text, p_language text,
  p_submit_for_review boolean default false
)
returns public.articles language plpgsql security definer set search_path = ''
as $$
declare article_row public.articles;
begin
  if auth.uid() is null or not public.has_permission('article.create') then raise exception 'Article creation access is required'; end if;
  if nullif(trim(coalesce(p_title, '')), '') is null or nullif(trim(coalesce(p_body, '')), '') is null then raise exception 'Title and body are required'; end if;
  insert into public.articles (title, summary, body, category, language, status)
  values (trim(p_title), trim(coalesce(p_summary, '')), trim(p_body), coalesce(nullif(trim(p_category), ''), 'General'), coalesce(nullif(trim(p_language), ''), 'en'), 'draft')
  returning * into article_row;
  if p_submit_for_review then article_row := public.submit_article_for_review(article_row.id); end if;
  return article_row;
end;
$$;

create or replace function public.user_has_author_access()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_permission('article.create'); $$;

 drop policy if exists "Published articles are public" on public.articles;
drop policy if exists "Active users create draft articles" on public.articles;
drop policy if exists "Authors edit own drafts and editors edit all articles" on public.articles;
drop policy if exists "Editors delete articles" on public.articles;
create policy "Published articles are public"
on public.articles for select
using (status = 'published' or public.has_permission('article.review') or (author_id = (select auth.uid()) and public.has_permission('article.create')));
create policy "Active employees create draft articles"
on public.articles for insert to authenticated
with check (public.has_permission('article.create') and status = 'draft' and author_id = (select auth.uid()));
create policy "Authors edit own drafts and reviewers edit all"
on public.articles for update to authenticated
using (public.has_permission('article.review') or (author_id = (select auth.uid()) and status = 'draft' and public.has_permission('article.create')))
with check (public.has_permission('article.review') or (author_id = (select auth.uid()) and status = 'draft' and public.has_permission('article.create')));
create policy "Authorized employees delete articles"
on public.articles for delete to authenticated
using (public.has_permission('article.delete'));

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
  order by roles.hierarchy_rank desc, profiles.display_name, profiles.email;
end;
$$;

create or replace function public.update_employee_basic(p_target_id uuid, p_display_name text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor_rank smallint; target_rank smallint; target_role text;
begin
  if not public.has_permission('employee.basic.update') then raise exception 'Employee update access is required'; end if;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select profiles.role_key, roles.hierarchy_rank into target_role, target_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = p_target_id;
  if p_target_id = auth.uid() or target_role = 'owner' or target_rank is null or target_rank >= actor_rank then raise exception 'You cannot modify this employee'; end if;
  update public.profiles set display_name = trim(p_display_name), updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.basic_updated', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('fields', jsonb_build_array('display_name')));
end;
$$;

create or replace function public.change_employee_role(p_target_id uuid, p_role_key text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor_rank smallint; target_rank smallint; new_rank smallint; old_role text;
begin
  if not public.has_permission('employee.role.change') then raise exception 'Role-change access is required'; end if;
  if p_role_key = 'owner' then raise exception 'Owner cannot be assigned through employee management'; end if;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select profiles.role_key, roles.hierarchy_rank into old_role, target_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = p_target_id;
  select hierarchy_rank into new_rank from public.roles where role_key = p_role_key;
  if p_target_id = auth.uid() or old_role = 'owner' or target_rank is null or target_rank >= actor_rank or new_rank is null or new_rank >= actor_rank then raise exception 'You cannot change this employee role'; end if;
  update public.profiles set role_key = p_role_key, role = p_role_key, updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.role_changed', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('from_role', old_role, 'to_role', p_role_key));
end;
$$;

create or replace function public.request_employee_deletion(p_target_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare request_id uuid; target_role text;
begin
  if not public.has_permission('employee.deletion.request') then raise exception 'Employee deletion request access is required'; end if;
  select role_key into target_role from public.profiles where id = p_target_id;
  if target_role is null or target_role = 'owner' or p_target_id = auth.uid() then raise exception 'This employee cannot be requested for deletion'; end if;
  insert into public.employee_deletion_requests (target_profile_id, requested_by, reason) values (p_target_id, auth.uid(), trim(p_reason)) returning id into request_id;
  perform public.write_audit_event(auth.uid(), 'employee.deletion_requested', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('request_id', request_id));
  return request_id;
end;
$$;

create or replace function public.list_employee_deletion_requests()
returns table (id uuid, target_profile_id uuid, target_name text, target_role text, requested_by uuid, requester_name text, reason text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_permission('employee.deletion.view') then raise exception 'Deletion request access is required'; end if;
  return query select requests.id, requests.target_profile_id, target.display_name, target.role_key, requests.requested_by, requester.display_name, requests.reason, requests.status, requests.created_at
  from public.employee_deletion_requests requests left join public.profiles target on target.id = requests.target_profile_id left join public.profiles requester on requester.id = requests.requested_by
  where requests.status = 'pending' order by requests.created_at;
end;
$$;

create or replace function public.resolve_employee_deletion(p_request_id uuid, p_decision text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare request_row public.employee_deletion_requests; target_role text; actor_rank smallint; target_rank smallint;
begin
  if not public.has_permission('employee.deletion.resolve') then raise exception 'Deletion review access is required'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into request_row from public.employee_deletion_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'Pending deletion request not found'; end if;
  if request_row.requested_by = auth.uid() or request_row.target_profile_id = auth.uid() then raise exception 'You cannot resolve your own deletion request'; end if;
  select profiles.role_key, roles.hierarchy_rank into target_role, target_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = request_row.target_profile_id;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  if target_role is null or target_role = 'owner' or target_rank >= actor_rank then raise exception 'You cannot deprovision this employee'; end if;
  update public.employee_deletion_requests set status = p_decision, reviewed_by = auth.uid(), review_reason = trim(coalesce(p_reason, '')), reviewed_at = now() where id = p_request_id;
  if p_decision = 'approved' then update public.profiles set status = 'disabled', updated_at = now() where id = request_row.target_profile_id; end if;
  perform public.write_audit_event(auth.uid(), 'employee.deletion_' || p_decision, 'profile', request_row.target_profile_id, 'success', p_reason, jsonb_build_object('request_id', p_request_id));
end;
$$;

create or replace function public.set_employee_status(p_target_id uuid, p_next_status text, p_reason text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare target_role text; target_status text; actor_rank smallint; target_rank smallint;
begin
  if p_next_status not in ('active', 'disabled') then raise exception 'Status must be active or disabled'; end if;
  if p_next_status = 'disabled' and not public.has_permission('employee.disable') then raise exception 'Disable access is required'; end if;
  if p_next_status = 'active' and not public.has_permission('employee.enable') then raise exception 'Enable access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  select role_key, status into target_role, target_status from public.profiles where id = p_target_id;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select hierarchy_rank into target_rank from public.roles where role_key = target_role;
  if target_role is null or target_role = 'owner' or p_target_id = auth.uid() then raise exception 'You cannot change this employee status'; end if;
  if target_rank is null or target_rank >= actor_rank then raise exception 'You cannot change this employee status'; end if;
  if target_status = 'invited' and p_next_status = 'active' then raise exception 'Employees must accept their invitation before activation'; end if;
  update public.profiles set status = p_next_status, updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.' || p_next_status, 'profile', p_target_id, 'success', p_reason);
end;
$$;

create or replace function public.list_audit_history()
returns table (id bigint, actor_profile_id uuid, actor_name text, action text, target_type text, target_id uuid, result text, reason text, details jsonb, session_id uuid, request_id text, ip_address inet, user_agent text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_permission('employee.audit.read') and not public.has_permission('employee.audit.security.read') then raise exception 'Audit history access is required'; end if;
  return query select logs.id, logs.actor_profile_id, coalesce(profiles.display_name, 'Former employee'), logs.action, logs.target_type, logs.target_id, logs.result, logs.reason, logs.details, logs.session_id, logs.request_id, logs.ip_address, logs.user_agent, logs.created_at
  from public.audit_logs logs left join public.profiles profiles on profiles.id = logs.actor_profile_id
  where public.has_permission('employee.audit.security.read') or logs.action not like '%role%'
  order by logs.created_at desc limit 500;
end;
$$;

create or replace function public.prevent_audit_log_mutation()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'Audit history is append-only'; end; $$;
drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only before update or delete on public.audit_logs for each row execute function public.prevent_audit_log_mutation();

create or replace function public.activate_employee_invite_on_confirmation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles profiles set status = 'active', updated_at = now()
    from public.employee_invites invites
    where invites.auth_user_id = new.id and invites.status = 'invited' and invites.expires_at > now() and profiles.id = new.id;
    update public.employee_invites set status = 'accepted', accepted_at = now() where auth_user_id = new.id and status = 'invited' and expires_at > now();
  end if;
  return new;
end;
$$;

create or replace function public.revoke_direct_employee_writes()
returns void language plpgsql security definer set search_path = ''
as $$ begin
  revoke insert, update, delete on public.profiles from anon, authenticated;
end; $$;
select public.revoke_direct_employee_writes();
drop function public.revoke_direct_employee_writes();

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = ''
as $$ select role_key from public.profiles where id = (select auth.uid()) and status = 'active' limit 1; $$;

create or replace function public.has_permission(p_permission_key text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles profiles join public.role_permissions grants on grants.role_key = profiles.role_key where profiles.id = (select auth.uid()) and profiles.status = 'active' and grants.permission_key = p_permission_key); $$;

create or replace function public.current_user_permissions()
returns text[] language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(grants.permission_key order by grants.permission_key), array[]::text[]) from public.profiles profiles join public.role_permissions grants on grants.role_key = profiles.role_key where profiles.id = (select auth.uid()) and profiles.status = 'active'; $$;

create or replace function public.user_has_editor_access()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_permission('article.review'); $$;

create or replace function public.user_has_author_access()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_permission('article.create'); $$;

revoke all on function public.current_user_role() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.current_user_permissions() from public;
revoke all on function public.user_has_editor_access() from public;
revoke all on function public.user_has_author_access() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_permission(text) to authenticated, anon;
grant execute on function public.current_user_permissions() to authenticated;
grant execute on function public.user_has_editor_access() to authenticated, anon;
grant execute on function public.user_has_author_access() to authenticated;

revoke all on function public.list_employees() from public;
revoke all on function public.request_employee_invite(text, text, text, text) from public;
revoke all on function public.list_employee_invite_requests() from public;
revoke all on function public.reject_employee_invite_request(uuid, text) from public;
revoke all on function public.update_employee_basic(uuid, text, text) from public;
revoke all on function public.change_employee_role(uuid, text, text) from public;
revoke all on function public.request_employee_deletion(uuid, text) from public;
revoke all on function public.list_employee_deletion_requests() from public;
revoke all on function public.resolve_employee_deletion(uuid, text, text) from public;
revoke all on function public.set_employee_status(uuid, text, text) from public;
revoke all on function public.list_audit_history() from public;
revoke all on function public.submit_article_for_review(uuid) from public;
revoke all on function public.transition_article_status(uuid, public.article_status) from public;
revoke all on function public.create_article(text, text, text, text, text, boolean) from public;
grant execute on function public.list_employees() to authenticated;
grant execute on function public.request_employee_invite(text, text, text, text) to authenticated;
grant execute on function public.list_employee_invite_requests() to authenticated;
grant execute on function public.reject_employee_invite_request(uuid, text) to authenticated;
grant execute on function public.update_employee_basic(uuid, text, text) to authenticated;
grant execute on function public.change_employee_role(uuid, text, text) to authenticated;
grant execute on function public.request_employee_deletion(uuid, text) to authenticated;
grant execute on function public.list_employee_deletion_requests() to authenticated;
grant execute on function public.resolve_employee_deletion(uuid, text, text) to authenticated;
grant execute on function public.set_employee_status(uuid, text, text) to authenticated;
grant execute on function public.list_audit_history() to authenticated;
grant execute on function public.submit_article_for_review(uuid) to authenticated;
grant execute on function public.transition_article_status(uuid, public.article_status) to authenticated;
grant execute on function public.create_article(text, text, text, text, text, boolean) to authenticated;
