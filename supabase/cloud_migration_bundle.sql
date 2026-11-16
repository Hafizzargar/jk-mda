
-- =============================================
-- MIGRATION: 20261005193000_create_articles_table.sql
-- =============================================

do $$
begin
  create type public.article_status as enum ('draft', 'review', 'published', 'archived');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  body text not null,
  category text not null default 'General',
  author text not null default 'KJIN desk',
  language text not null default 'en' check (language in ('en', 'ur', 'hi')),
  status public.article_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_status on public.articles (status);
create index if not exists idx_articles_language on public.articles (language);
create index if not exists idx_articles_created_at on public.articles (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();

alter table public.articles enable row level security;

create or replace function public.user_has_editor_access()
returns boolean
language sql
stable
as $$
  select false;
$$;

create or replace function public.user_has_author_access()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null;
$$;

drop policy if exists "Published articles are public" on public.articles;
create policy "Published articles are public"
on public.articles
for select
using (status = 'published' or public.user_has_editor_access());

drop policy if exists "Authors can create draft articles" on public.articles;
create policy "Authors can create draft articles"
on public.articles
for insert
with check (public.user_has_author_access() and status = 'draft');

drop policy if exists "Editors can update article state" on public.articles;
create policy "Editors can update article state"
on public.articles
for update
using (public.user_has_editor_access())
with check (public.user_has_editor_access());

drop policy if exists "Editors can delete articles" on public.articles;
create policy "Editors can delete articles"
on public.articles
for delete
using (public.user_has_editor_access());


-- =============================================
-- MIGRATION: 20261006120000_profiles_and_article_security.sql
-- =============================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  role text not null default 'author' check (role in ('owner', 'superadmin', 'admin', 'editor', 'author')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

insert into public.profiles (id, email, display_name, role)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'display_name', ''),
  'author'
from auth.users as users
on conflict (id) do nothing;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    'author'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_create_profile on auth.users;
create trigger auth_user_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.role
  from public.profiles as profiles
  where profiles.id = (select auth.uid())
    and profiles.status = 'active'
  limit 1;
$$;

create or replace function public.user_has_editor_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('owner', 'superadmin', 'admin', 'editor'), false);
$$;

create or replace function public.user_has_author_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('owner', 'superadmin', 'admin', 'editor', 'author'), false);
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.user_has_editor_access() from public;
revoke all on function public.user_has_author_access() from public;
grant execute on function public.current_user_role() to authenticated, anon;
grant execute on function public.user_has_editor_access() to authenticated, anon;
grant execute on function public.user_has_author_access() to authenticated, anon;

drop policy if exists "Profiles are readable by owner or editors" on public.profiles;
create policy "Profiles are readable by owner or editors"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or public.user_has_editor_access());

drop policy if exists "Published articles are public" on public.articles;
drop policy if exists "Authenticated users can read articles" on public.articles;
drop policy if exists "Authors can create draft articles" on public.articles;
drop policy if exists "Authenticated users can create articles" on public.articles;
drop policy if exists "Editors can update article state" on public.articles;
drop policy if exists "Authenticated users can update articles" on public.articles;
drop policy if exists "Editors can delete articles" on public.articles;
drop policy if exists "Authenticated users can delete articles" on public.articles;

alter table public.articles
  add column if not exists author_id uuid references public.profiles (id) on delete set null;

create index if not exists idx_articles_author_id on public.articles (author_id);

create policy "Published articles are public"
on public.articles
for select
using (status = 'published' or public.user_has_editor_access() or author_id = (select auth.uid()));

create policy "Active users create draft articles"
on public.articles
for insert
to authenticated
with check (
  public.user_has_author_access()
  and status = 'draft'
  and author_id = (select auth.uid())
);

create policy "Authors edit own drafts and editors edit all articles"
on public.articles
for update
to authenticated
using (
  public.user_has_editor_access()
  or (author_id = (select auth.uid()) and status = 'draft')
)
with check (
  public.user_has_editor_access()
  or (author_id = (select auth.uid()) and status = 'draft')
);

create policy "Editors delete articles"
on public.articles
for delete
to authenticated
using (public.user_has_editor_access());

create or replace function public.set_article_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_display_name text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.status <> 'draft' then
      raise exception 'Articles must be created by an authenticated user as drafts';
    end if;

    select profiles.display_name
      into profile_display_name
      from public.profiles as profiles
      where profiles.id = auth.uid()
        and profiles.status = 'active';

    if not found then
      raise exception 'An active profile is required to create articles';
    end if;

    new.author_id := auth.uid();
    new.author := coalesce(nullif(profile_display_name, ''), 'KJIN desk');
    return new;
  end if;

  if new.author_id is distinct from old.author_id then
    raise exception 'Article attribution cannot be changed';
  end if;

  new.author := old.author;
  return new;
end;
$$;

drop trigger if exists articles_set_author on public.articles;
create trigger articles_set_author
before insert or update on public.articles
for each row execute function public.set_article_author();

create or replace function public.enforce_article_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  permitted_review_submission boolean;
  permitted_editor_transition boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  permitted_review_submission :=
    old.status = 'draft'
    and new.status = 'review'
    and old.author_id = auth.uid()
    and current_setting('kjin.allow_review_submission', true) = 'on';

  permitted_editor_transition :=
    public.user_has_editor_access()
    and current_setting('kjin.allow_status_transition', true) = 'on'
    and (
      (old.status = 'draft' and new.status = 'review')
      or (old.status = 'review' and new.status in ('draft', 'published', 'archived'))
      or (old.status = 'published' and new.status = 'archived')
    );

  if permitted_review_submission or permitted_editor_transition then
    return new;
  end if;

  raise exception 'Invalid or unauthorized article status transition: % to %', old.status, new.status;
end;
$$;

drop trigger if exists articles_enforce_status_transition on public.articles;
create trigger articles_enforce_status_transition
before update of status on public.articles
for each row execute function public.enforce_article_status_transition();

create or replace function public.submit_article_for_review(p_article_id uuid)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
begin
  if auth.uid() is null or not public.user_has_author_access() then
    raise exception 'An active account is required to submit articles';
  end if;

  select * into article_row
  from public.articles
  where id = p_article_id
  for update;

  if not found or article_row.author_id <> auth.uid() or article_row.status <> 'draft' then
    raise exception 'Only your own draft articles can be submitted for review';
  end if;

  perform set_config('kjin.allow_review_submission', 'on', true);
  update public.articles set status = 'review' where id = p_article_id
  returning * into article_row;

  return article_row;
end;
$$;

create or replace function public.transition_article_status(p_article_id uuid, p_next_status public.article_status)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
begin
  if auth.uid() is null or not public.user_has_editor_access() then
    raise exception 'Editor access is required to change article status';
  end if;

  perform set_config('kjin.allow_status_transition', 'on', true);
  update public.articles
  set status = p_next_status
  where id = p_article_id
  returning * into article_row;

  if not found then
    raise exception 'Article not found';
  end if;

  return article_row;
end;
$$;

create or replace function public.create_article(
  p_title text,
  p_summary text,
  p_body text,
  p_category text,
  p_language text,
  p_submit_for_review boolean default false
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
begin
  if auth.uid() is null or not public.user_has_author_access() then
    raise exception 'An active account is required to create articles';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null
    or nullif(trim(coalesce(p_body, '')), '') is null then
    raise exception 'Title and article body are required';
  end if;

  insert into public.articles (title, summary, body, category, language, status)
  values (
    trim(p_title),
    trim(coalesce(p_summary, '')),
    trim(p_body),
    coalesce(nullif(trim(p_category), ''), 'General'),
    coalesce(nullif(trim(p_language), ''), 'en'),
    'draft'
  )
  returning * into article_row;

  if p_submit_for_review then
    article_row := public.submit_article_for_review(article_row.id);
  end if;

  return article_row;
end;
$$;

revoke all on function public.submit_article_for_review(uuid) from public;
revoke all on function public.transition_article_status(uuid, public.article_status) from public;
revoke all on function public.create_article(text, text, text, text, text, boolean) from public;
grant execute on function public.submit_article_for_review(uuid) to authenticated;
grant execute on function public.transition_article_status(uuid, public.article_status) to authenticated;
grant execute on function public.create_article(text, text, text, text, text, boolean) to authenticated;


-- =============================================
-- MIGRATION: 20261006130000_require_article_status_rpc.sql
-- =============================================

create or replace function public.enforce_article_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  permitted_review_submission boolean;
  permitted_editor_transition boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  permitted_review_submission :=
    old.status = 'draft'
    and new.status = 'review'
    and old.author_id = auth.uid()
    and current_setting('kjin.allow_review_submission', true) = 'on';

  permitted_editor_transition :=
    public.user_has_editor_access()
    and current_setting('kjin.allow_status_transition', true) = 'on'
    and (
      (old.status = 'draft' and new.status = 'review')
      or (old.status = 'review' and new.status in ('draft', 'published', 'archived'))
      or (old.status = 'published' and new.status = 'archived')
    );

  if permitted_review_submission or permitted_editor_transition then
    return new;
  end if;

  raise exception 'Invalid or unauthorized article status transition: % to %', old.status, new.status;
end;
$$;

create or replace function public.transition_article_status(p_article_id uuid, p_next_status public.article_status)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
begin
  if auth.uid() is null or not public.user_has_editor_access() then
    raise exception 'Editor access is required to change article status';
  end if;

  perform set_config('kjin.allow_status_transition', 'on', true);
  update public.articles
  set status = p_next_status
  where id = p_article_id
  returning * into article_row;

  if not found then
    raise exception 'Article not found';
  end if;

  return article_row;
end;
$$;

revoke all on function public.transition_article_status(uuid, public.article_status) from public;
grant execute on function public.transition_article_status(uuid, public.article_status) to authenticated;


-- =============================================
-- MIGRATION: 20261006140000_employee_permissions_and_audit.sql
-- =============================================

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


-- =============================================
-- MIGRATION: 20261006150000_publish_and_contact_safety.sql
-- =============================================

delete from public.role_permissions
where role_key in ('admin', 'editor')
  and permission_key = 'article.publish';

insert into public.role_permissions (role_key, permission_key)
values
  ('owner', 'article.publish'),
  ('superadmin', 'article.publish')
on conflict do nothing;


-- =============================================
-- MIGRATION: 20261006160000_atomic_invitation_limits.sql
-- =============================================

create table if not exists public.employee_invitation_attempts (
  id bigint generated always as identity primary key,
  actor_profile_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_employee_invitation_attempts_actor_time
on public.employee_invitation_attempts (actor_profile_id, attempted_at desc);

alter table public.employee_invitation_attempts enable row level security;
revoke all on public.employee_invitation_attempts from anon, authenticated;

create or replace function public.claim_employee_invitation_attempt()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_attempts integer;
begin
  if auth.uid() is null or not public.has_permission('employee.invite') then
    raise exception 'Employee invitation permission is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':employee-invite-send', 0));

  select count(*) into recent_attempts
  from public.employee_invitation_attempts
  where actor_profile_id = auth.uid()
    and attempted_at > now() - interval '24 hours';

  if recent_attempts >= 20 then
    raise exception 'Daily employee invitation limit reached';
  end if;

  insert into public.employee_invitation_attempts (actor_profile_id)
  values (auth.uid());
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

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':employee-invite-request', 0));
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

revoke all on function public.claim_employee_invitation_attempt() from public;
revoke all on function public.request_employee_invite(text, text, text, text) from public;
grant execute on function public.claim_employee_invitation_attempt() to authenticated;
grant execute on function public.request_employee_invite(text, text, text, text) to authenticated;


-- =============================================
-- MIGRATION: 20261006170000_single_superadmin_and_uniform_validation.sql
-- =============================================

-- Single Second Superadmin invariant + uniform input validation for employee RPCs.
-- Enforces the product decision: exactly one Owner (already indexed) and exactly one Second Superadmin.

create unique index if not exists idx_profiles_single_superadmin
on public.profiles (role_key)
where role_key = 'superadmin';

create unique index if not exists idx_employee_invites_single_superadmin
on public.employee_invites (role_key)
where role_key = 'superadmin' and status in ('sending', 'invited');

create or replace function public.update_employee_basic(p_target_id uuid, p_display_name text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor_rank smallint; target_rank smallint; target_role text;
begin
  if not public.has_permission('employee.basic.update') then raise exception 'Employee update access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  if length(trim(coalesce(p_display_name, ''))) not between 1 and 120 then raise exception 'Display name must be 1 to 120 characters'; end if;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select profiles.role_key, roles.hierarchy_rank into target_role, target_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = p_target_id;
  if p_target_id = auth.uid() or target_role = 'owner' or target_rank is null or target_rank >= actor_rank then
    raise exception 'You cannot modify this employee';
  end if;
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
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  if p_role_key = 'owner' then raise exception 'Owner cannot be assigned through employee management'; end if;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select profiles.role_key, roles.hierarchy_rank into old_role, target_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = p_target_id;
  select hierarchy_rank into new_rank from public.roles where role_key = p_role_key;
  if p_target_id = auth.uid() or old_role = 'owner' or target_rank is null or target_rank >= actor_rank or new_rank is null or new_rank >= actor_rank then
    raise exception 'You cannot change this employee role';
  end if;
  if p_role_key = 'superadmin' and exists (select 1 from public.profiles where role_key = 'superadmin' and id <> p_target_id) then
    raise exception 'Only one Second Superadmin is allowed';
  end if;
  update public.profiles set role_key = p_role_key, role = p_role_key, updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.role_changed', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('from_role', old_role, 'to_role', p_role_key));
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
  if p_requested_role = 'superadmin' and exists (select 1 from public.profiles where role_key = 'superadmin') then
    raise exception 'Only one Second Superadmin is allowed';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':employee-invite-request', 0));
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
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  update public.employee_invite_requests
  set status = 'rejected', reviewed_by = auth.uid(), review_reason = trim(coalesce(p_reason, '')), reviewed_at = now()
  where id = p_request_id and status = 'pending';
  if not found then raise exception 'Pending invitation request not found'; end if;
  perform public.write_audit_event(auth.uid(), 'employee.invite_request_rejected', 'employee_invite_request', p_request_id, 'success', p_reason);
end;
$$;

create or replace function public.request_employee_deletion(p_target_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare request_id uuid; target_role text;
begin
  if not public.has_permission('employee.deletion.request') then raise exception 'Employee deletion request access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  select role_key into target_role from public.profiles where id = p_target_id;
  if target_role is null or target_role = 'owner' or p_target_id = auth.uid() then raise exception 'This employee cannot be requested for deletion'; end if;
  insert into public.employee_deletion_requests (target_profile_id, requested_by, reason)
  values (p_target_id, auth.uid(), trim(p_reason)) returning id into request_id;
  perform public.write_audit_event(auth.uid(), 'employee.deletion_requested', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('request_id', request_id));
  return request_id;
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
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
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
declare target_role text; target_status text; actor_rank smallint; target_rank smallint;
begin
  if p_next_status not in ('active', 'disabled') then raise exception 'Status must be active or disabled'; end if;
  if p_next_status = 'disabled' and not public.has_permission('employee.disable') then raise exception 'Disable access is required'; end if;
  if p_next_status = 'active' and not public.has_permission('employee.enable') then raise exception 'Enable access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
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

revoke all on function public.update_employee_basic(uuid, text, text) from public;
revoke all on function public.change_employee_role(uuid, text, text) from public;
revoke all on function public.request_employee_invite(text, text, text, text) from public;
revoke all on function public.reject_employee_invite_request(uuid, text) from public;
revoke all on function public.request_employee_deletion(uuid, text) from public;
revoke all on function public.resolve_employee_deletion(uuid, text, text) from public;
revoke all on function public.set_employee_status(uuid, text, text) from public;
grant execute on function public.update_employee_basic(uuid, text, text) to authenticated;
grant execute on function public.change_employee_role(uuid, text, text) to authenticated;
grant execute on function public.request_employee_invite(text, text, text, text) to authenticated;
grant execute on function public.reject_employee_invite_request(uuid, text) to authenticated;
grant execute on function public.request_employee_deletion(uuid, text) to authenticated;
grant execute on function public.resolve_employee_deletion(uuid, text, text) to authenticated;
grant execute on function public.set_employee_status(uuid, text, text) to authenticated;





-- =============================================
-- MIGRATION: 20261007120000_enforce_mfa_in_permissions.sql
-- =============================================

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


-- =============================================
-- MIGRATION: 20261007130000_mfa_rate_limit.sql
-- =============================================

create or replace function public.claim_mfa_challenge_attempt()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_attempts integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':mfa-challenge', 0));

  select count(*) into recent_attempts
  from public.audit_logs
  where actor_profile_id = auth.uid()
    and action in ('employee.mfa_challenge_failed', 'employee.mfa_challenge_attempt')
    and created_at > now() - interval '15 minutes';

  if recent_attempts >= 5 then
    raise exception 'Too many failed verification attempts. Please try again later.';
  end if;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, result, reason)
  values (auth.uid(), 'employee.mfa_challenge_attempt', 'profile', auth.uid(), 'success', 'MFA challenge attempt rate-limit claim');
end;
$$;

revoke all on function public.claim_mfa_challenge_attempt() from public;
grant execute on function public.claim_mfa_challenge_attempt() to authenticated;


-- =============================================
-- MIGRATION: 20261008120000_article_cms_schema.sql
-- =============================================

-- Step 1: Cleanup old triggers and permissions
drop trigger if exists articles_set_author on public.articles;
drop function if exists public.set_article_author cascade;

drop trigger if exists articles_enforce_status_transition on public.articles;
drop trigger if exists enforce_article_status_transition on public.articles;
drop function if exists public.enforce_article_status_transition cascade;
drop function if exists public.check_article_status_transition cascade;

drop function if exists public.create_article cascade;
drop function if exists public.transition_article_status cascade;
drop function if exists public.submit_article_for_review cascade;

-- Remove article.publish permission from admin and editor
delete from public.role_permissions
where permission_key = 'article.publish'
  and role_key in ('admin', 'editor');

-- Clean up data safely instead of TRUNCATE CASCADE
delete from public.articles;

-- Step 2: Alter articles table
alter table public.articles add column slug text;
alter table public.articles rename column summary to excerpt;

alter table public.articles
  rename column body to content;

alter table public.articles
  add column district text,
  add column author_display_name text,
  add column source_name text,
  add column source_url text,
  add column featured_image_url text,
  add column published_at timestamptz,
  add column published_by uuid references public.profiles(id),
  add column archived_at timestamptz,
  add column view_count bigint not null default 0 check (view_count >= 0);

alter table public.articles
  drop column if exists language,
  drop column if exists author;

-- Note: We will populate author_display_name in the insert trigger dynamically, 
-- but we set it NOT NULL for schema integrity.
alter table public.articles
  alter column slug set not null,
  add constraint articles_slug_key unique (slug),
  alter column author_display_name set not null;

-- Step 3: Create article_versions
create table if not exists public.article_versions (
    id uuid primary key default gen_random_uuid(),
    article_id uuid not null references public.articles(id) on delete cascade,
    version_number integer not null,
    title text not null,
    excerpt text,
    content text not null,
    edited_by uuid not null references public.profiles(id),
    created_at timestamptz not null default now(),
    unique(article_id, version_number)
);

alter table public.article_versions enable row level security;

-- Step 4: Indexes
create index if not exists idx_article_versions_article_id on public.article_versions(article_id);
create index if not exists idx_articles_author_id on public.articles(author_id);
-- No redundant slug index needed, UNIQUE constraint covers it.

-- Step 5: RLS Policies
-- article_versions: Only SELECT is allowed. INSERT/UPDATE/DELETE are blocked for clients 
-- to prevent forging history. Versions must be created via RPC.
drop policy if exists "Editors can view all versions, authors can view their own" on public.article_versions;
create policy "Editors can view all versions, authors can view their own"
on public.article_versions for select to authenticated
using (
  public.has_permission('article.review') or
  (exists (select 1 from public.articles a where a.id = article_id and a.author_id = (select auth.uid())))
);

-- articles: Remove ALL direct mutation policies to lock down the CMS workflow.
-- All INSERT, UPDATE, and DELETE operations must now flow through the SECURITY DEFINER RPCs.
alter table public.articles enable row level security;

drop policy if exists "Active employees create draft articles" on public.articles;
drop policy if exists "Active users create draft articles" on public.articles;
drop policy if exists "Authors can create draft articles" on public.articles;
drop policy if exists "Authenticated users can create articles" on public.articles;

drop policy if exists "Authors edit own drafts and reviewers edit all" on public.articles;
drop policy if exists "Authors edit own drafts and editors edit all articles" on public.articles;
drop policy if exists "Editors can update article state" on public.articles;
drop policy if exists "Authenticated users can update articles" on public.articles;

drop policy if exists "Authorized employees delete articles" on public.articles;
drop policy if exists "Editors delete articles" on public.articles;
drop policy if exists "Editors can delete articles" on public.articles;
drop policy if exists "Authenticated users can delete articles" on public.articles;

-- Step 6: Comprehensive State & Integrity Trigger
create or replace function public.articles_enforce_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uid uuid := (select auth.uid());
  actor_display_name text;
begin
  -- INSERT Rules
  if TG_OP = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New articles must be created as drafts.';
    end if;
    
    if actor_uid is null then
      raise exception 'Authenticated employee is required';
    end if;
    
    new.author_id := actor_uid;
    select display_name into actor_display_name from public.profiles where id = actor_uid;
    
    if actor_display_name is null then
      raise exception 'Active profile is required for article creation';
    end if;
    
    new.author_display_name := actor_display_name;
  end if;

  -- UPDATE Rules
  if TG_OP = 'UPDATE' then
    -- Author attribution immutability
    if new.author_id <> old.author_id then
      raise exception 'Cannot change article author_id.';
    end if;
    if new.author_display_name <> old.author_display_name then
      raise exception 'Cannot change article author_display_name directly.';
    end if;

    -- Slug immutability after publication
    if old.status in ('published', 'archived') and new.slug <> old.slug then
      raise exception 'Cannot change slug of published or archived articles.';
    end if;

    -- View count protection (only allowed if bypass setting is present)
    if new.view_count <> old.view_count and current_setting('kjin.allow_view_count_update', true) is distinct from 'on' then
      raise exception 'Cannot update view_count directly. Use the RPC incrementer.';
    end if;

    -- Status Transition State Machine
    if old.status <> new.status then
      if old.status = 'archived' then
        raise exception 'Archived articles cannot change status.';
      elsif old.status = 'draft' and new.status <> 'review' then
        raise exception 'Drafts can only transition to review.';
      elsif old.status = 'review' and new.status not in ('draft', 'published', 'archived') then
        raise exception 'Articles in review can only transition to draft, published, or archived.';
      elsif old.status = 'published' and new.status <> 'archived' then
        raise exception 'Published articles can only transition to archived.';
      end if;
    end if;
  end if;

  -- Metadata Consistency Invariants (runs on both INSERT and UPDATE)
  if new.status in ('draft', 'review') then
    new.published_at := null;
    new.published_by := null;
    new.archived_at := null;
  elsif new.status = 'published' then
    if new.published_at is null or new.published_by is null then
      raise exception 'Published articles must have published_at and published_by set.';
    end if;
    new.archived_at := null;
  elsif new.status = 'archived' then
    if new.archived_at is null then
      raise exception 'Archived articles must have archived_at set.';
    end if;
  end if;

  return new;
end;
$$;

create trigger articles_enforce_integrity
before insert or update on public.articles
for each row
execute function public.articles_enforce_integrity();


-- =============================================
-- MIGRATION: 20261008130000_article_cms_rpcs.sql
-- =============================================

-- Migration: Article CMS RPCs
-- Covers the entire lifecycle of articles with strict security definer boundaries,
-- row locking, audit trailing, and immutable versioning.

-- 1. Cleanup old RPC signatures
drop function if exists public.create_article cascade;
drop function if exists public.update_article cascade;
drop function if exists public.submit_article_for_review cascade;
drop function if exists public.return_article_to_draft cascade;
drop function if exists public.publish_article cascade;
drop function if exists public.archive_article cascade;


-- 2. create_article()
create or replace function public.create_article(
  p_title text,
  p_excerpt text,
  p_content text,
  p_slug text,
  p_district text default null,
  p_category text default 'General',
  p_source_name text default null,
  p_source_url text default null,
  p_featured_image_url text default null
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
begin
  if auth.uid() is null then
    raise exception 'Authenticated employee required';
  end if;

  if not public.has_permission('article.create') then
    raise exception 'Article creation permission required';
  end if;

  insert into public.articles (
    title, excerpt, content, slug, district, category, 
    source_name, source_url, featured_image_url, status
  )
  values (
    p_title, p_excerpt, p_content, p_slug, p_district, p_category,
    p_source_name, p_source_url, p_featured_image_url, 'draft'
  )
  returning * into article_row;

  insert into public.article_versions (
    article_id, version_number, title, excerpt, content, edited_by
  ) values (
    article_row.id, 1, p_title, p_excerpt, p_content, auth.uid()
  );

  perform public.write_audit_event(auth.uid(), 'article.created', 'article', article_row.id, 'success');

  return article_row;
end;
$$;


-- 3. update_article()
create or replace function public.update_article(
  p_article_id uuid,
  p_title text,
  p_excerpt text,
  p_content text,
  p_slug text,
  p_district text default null,
  p_category text default 'General',
  p_source_name text default null,
  p_source_url text default null,
  p_featured_image_url text default null
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  next_version integer;
  actor_uid uuid := (select auth.uid());
  has_review_permission boolean;
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;

  has_review_permission := public.has_permission('article.review');

  -- Lock the row for update
  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  -- Verify update authorization
  if not (
    (has_review_permission and article_row.status in ('draft', 'review')) or
    (article_row.author_id = actor_uid and article_row.status = 'draft' and public.has_permission('article.create'))
  ) then
    raise exception 'Unauthorized to edit this article in its current state';
  end if;

  -- Calculate next version number
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.article_versions
  where article_id = p_article_id;

  -- Update article
  update public.articles set
    title = p_title,
    excerpt = p_excerpt,
    content = p_content,
    slug = p_slug,
    district = p_district,
    category = p_category,
    source_name = p_source_name,
    source_url = p_source_url,
    featured_image_url = p_featured_image_url
  where id = p_article_id
  returning * into article_row;

  -- Create immutable version record
  insert into public.article_versions (
    article_id, version_number, title, excerpt, content, edited_by
  ) values (
    p_article_id, next_version, p_title, p_excerpt, p_content, actor_uid
  );

  perform public.write_audit_event(actor_uid, 'article.updated', 'article', p_article_id, 'success');

  return article_row;
end;
$$;


-- 4. submit_article_for_review()
create or replace function public.submit_article_for_review(p_article_id uuid)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;
  
  if not public.has_permission('article.submit_review') then
    raise exception 'Article submit permission required';
  end if;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if article_row.author_id <> actor_uid then
    raise exception 'Only the author can submit their draft for review';
  end if;

  if article_row.status <> 'draft' then
    raise exception 'Only drafts can be submitted for review';
  end if;

  update public.articles set status = 'review' where id = p_article_id returning * into article_row;

  perform public.write_audit_event(actor_uid, 'article.submitted_for_review', 'article', p_article_id, 'success');

  return article_row;
end;
$$;


-- 5. return_article_to_draft()
create or replace function public.return_article_to_draft(p_article_id uuid)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;
  if not public.has_permission('article.review') then raise exception 'Article review permission required'; end if;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if article_row.status <> 'review' then
    raise exception 'Only articles in review can be returned to draft';
  end if;

  update public.articles set status = 'draft' where id = p_article_id returning * into article_row;

  perform public.write_audit_event(actor_uid, 'article.returned_to_draft', 'article', p_article_id, 'success');

  return article_row;
end;
$$;


-- 6. publish_article()
create or replace function public.publish_article(p_article_id uuid)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;
  
  -- Publish is highly privileged, explicitly require article.publish permission
  -- Note: has_permission('article.publish') already ensures AAL2 for admins/superadmins/owners
  if not public.has_permission('article.publish') then 
    raise exception 'Article publish permission required'; 
  end if;

  -- Enforce explicit MFA verification directly just in case (defense-in-depth)
  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'MFA (AAL2) is strictly required to publish articles';
  end if;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if article_row.status <> 'review' then
    raise exception 'Only articles in review can be published';
  end if;

  update public.articles set 
    status = 'published',
    published_at = now(),
    published_by = actor_uid
  where id = p_article_id 
  returning * into article_row;

  perform public.write_audit_event(actor_uid, 'article.published', 'article', p_article_id, 'success');

  return article_row;
end;
$$;


-- 7. archive_article()
create or replace function public.archive_article(p_article_id uuid)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;
  
  if not public.has_permission('article.archive') then 
    raise exception 'Article archive permission required'; 
  end if;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if article_row.status not in ('review', 'published') then
    raise exception 'Only published or in-review articles can be archived';
  end if;

  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'MFA (AAL2) is strictly required to archive articles';
  end if;

  update public.articles set 
    status = 'archived',
    archived_at = now()
  where id = p_article_id 
  returning * into article_row;

  perform public.write_audit_event(actor_uid, 'article.archived', 'article', p_article_id, 'success');

  return article_row;
end;
$$;

-- 8. Execution Privileges (Security Definer Hardening)
-- Revoke execution from PUBLIC to prevent unauthenticated execution attempts
revoke all on function public.create_article(text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.update_article(uuid, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.submit_article_for_review(uuid) from public;
revoke all on function public.return_article_to_draft(uuid) from public;
revoke all on function public.publish_article(uuid) from public;
revoke all on function public.archive_article(uuid) from public;

-- Grant execution explicitly to authenticated users only
grant execute on function public.create_article(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_article(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.submit_article_for_review(uuid) to authenticated;
grant execute on function public.return_article_to_draft(uuid) to authenticated;
grant execute on function public.publish_article(uuid) to authenticated;
grant execute on function public.archive_article(uuid) to authenticated;


-- =============================================
-- MIGRATION: 20261008140000_article_cms_hardening.sql
-- =============================================

-- Migration: Article CMS Input Validation and View Count RPC
-- Hardens the database layer with strict constraints and atomic view count increments.

-- 1. Input Validation Constraints on `articles` table
alter table public.articles
  add constraint articles_title_length check (char_length(title) between 1 and 255),
  add constraint articles_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint articles_slug_length check (char_length(slug) between 1 and 255),
  add constraint articles_excerpt_length check (excerpt is null or char_length(excerpt) <= 1000),
  add constraint articles_content_nonempty check (char_length(btrim(content)) > 0),
  add constraint articles_author_display_name_nonempty check (char_length(btrim(author_display_name)) > 0),
  add constraint articles_source_url_format check (source_url is null or source_url ~ '^https?://.*'),
  add constraint articles_featured_image_url_format check (featured_image_url is null or featured_image_url ~ '^https?://.*');

-- 2. view_count increment RPC
-- This safely increments the view count of a published article.
-- It is the ONLY way to modify view_count because of the integrity trigger.
create or replace function public.increment_article_view_count(p_article_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Set local transaction variable to bypass the integrity trigger's view_count block
  perform set_config('kjin.allow_view_count_update', 'on', true);
  
  -- Only increment if the article is published
  update public.articles
  set view_count = view_count + 1
  where id = p_article_id and status = 'published';
end;
$$;

-- 3. Execution Privileges
-- Revoke from public, grant to both anon and authenticated so public readers can increment views.
revoke all on function public.increment_article_view_count(uuid) from public;
grant execute on function public.increment_article_view_count(uuid) to anon, authenticated;


-- =============================================
-- MIGRATION: 20261008150000_article_archive_permission.sql
-- =============================================

-- Migration: Add article.archive permission
-- This ensures the archiving workflow matches the intended Admin+ access
-- without granting dangerous deletion permissions.

insert into public.permissions (permission_key, description)
values ('article.archive', 'Archive published or reviewed articles')
on conflict do nothing;

-- Grant to Owner and Superadmin (who implicitly get all via UI or rules, but we explicitly insert to be safe, 
-- or we can rely on their wildcard behavior if they have it, but for role_permissions, we insert explicit rows)
insert into public.role_permissions (role_key, permission_key)
values
  ('owner', 'article.archive'),
  ('superadmin', 'article.archive'),
  ('admin', 'article.archive')
on conflict do nothing;


-- =============================================
-- MIGRATION: 20261008160000_article_views_hardening.sql
-- =============================================

-- 1. Create a tracking table for views to prevent abuse
create table public.article_views_log (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete cascade not null,
  ip_address text not null,
  viewed_at timestamptz default now() not null
);

-- Index for IP-based and global rate-limiting
create index idx_article_views_log_recent on public.article_views_log (article_id, viewed_at);
create index idx_article_views_log_ip on public.article_views_log (ip_address, viewed_at);

-- 2. Enable RLS on the tracking table
alter table public.article_views_log enable row level security;
-- No policies granted to public, so it's fully private

-- 3. Update the RPC to use DB-level abuse protection
create or replace function public.increment_article_view_count(p_article_id uuid, p_ip_address text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_ip_views int;
  v_recent_global_views int;
begin
  -- 1. Check IP-based rate limit (max 5 views per 15 minutes per IP across all articles)
  -- This stops a single IP from hammering the system
  select count(*) into v_recent_ip_views
  from public.article_views_log
  where ip_address = p_ip_address
    and viewed_at > now() - interval '15 minutes';

  if v_recent_ip_views >= 5 then
    return; -- Silently ignore abuse
  end if;

  -- 2. Check Global rate limit per article (max 60 views per minute globally)
  -- This mitigates distributed botnets rotating IPs
  select count(*) into v_recent_global_views
  from public.article_views_log
  where article_id = p_article_id
    and viewed_at > now() - interval '1 minute';

  if v_recent_global_views >= 60 then
    return; -- Silently ignore abuse
  end if;

  -- 3. Deduplicate IP per article (max 1 view per 24 hours per IP for the same article)
  if exists (
    select 1 from public.article_views_log
    where article_id = p_article_id
      and ip_address = p_ip_address
      and viewed_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  -- All checks passed, log the view
  insert into public.article_views_log (article_id, ip_address)
  values (p_article_id, p_ip_address);

  -- Increment the public counter
  perform set_config('kjin.allow_view_count_update', 'on', true);
  
  update public.articles
  set view_count = view_count + 1
  where id = p_article_id and status = 'published';
end;
$$;

-- Revoke the old signature if it existed
drop function if exists public.increment_article_view_count(uuid);

-- Grant execute to anon and authenticated
revoke all on function public.increment_article_view_count(uuid, text) from public;
grant execute on function public.increment_article_view_count(uuid, text) to anon, authenticated;


-- =============================================
-- MIGRATION: 20261008170000_article_views_atomic.sql
-- =============================================

-- Migration: Fully Atomic View Counter & Correct Permissions
-- Introduces fully atomic rate limits and strict service_role execution.

create or replace function public.increment_article_view_count(p_article_id uuid, p_ip_address text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_ip_views int;
  v_recent_global_views int;
begin
  -- First verify the article actually exists and is published
  if not exists (select 1 from public.articles where id = p_article_id and status = 'published') then
    return;
  end if;

  -- Consistently acquire advisory locks to prevent deadlocks and enforce atomicity
  -- 1. Lock the article to serialize global per-article view checks
  perform pg_advisory_xact_lock(hashtext('view_counter_article_' || p_article_id::text));
  -- 2. Lock the IP to serialize per-IP checks and deduplication
  perform pg_advisory_xact_lock(hashtext('view_counter_ip_' || p_ip_address));

  -- 1. Check IP-based rate limit (max 5 views per 15 minutes per IP across all articles)
  select count(*) into v_recent_ip_views
  from public.article_views_log
  where ip_address = p_ip_address
    and viewed_at > now() - interval '15 minutes';

  if v_recent_ip_views >= 5 then
    return; -- Silently ignore abuse
  end if;

  -- 2. Check Global rate limit per article (max 60 views per minute globally)
  select count(*) into v_recent_global_views
  from public.article_views_log
  where article_id = p_article_id
    and viewed_at > now() - interval '1 minute';

  if v_recent_global_views >= 60 then
    return; -- Silently ignore abuse
  end if;

  -- 3. Deduplicate IP per article (max 1 view per 24 hours per IP for the same article)
  if exists (
    select 1 from public.article_views_log
    where article_id = p_article_id
      and ip_address = p_ip_address
      and viewed_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  -- All checks passed, log the view
  insert into public.article_views_log (article_id, ip_address)
  values (p_article_id, p_ip_address);

  -- Increment the public counter
  perform set_config('kjin.allow_view_count_update', 'on', true);
  
  update public.articles
  set view_count = view_count + 1
  where id = p_article_id and status = 'published';
end;
$$;

-- Secure the RPC by removing public execution and restricting solely to service_role
revoke all on function public.increment_article_view_count(uuid, text) from public;
revoke all on function public.increment_article_view_count(uuid, text) from anon, authenticated;
grant execute on function public.increment_article_view_count(uuid, text) to service_role;


-- =============================================
-- MIGRATION: 20261010100000_newsletter_subscribers.sql
-- =============================================

-- Store newsletter subscribers for KJIN.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 254),
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security.
alter table public.newsletter_subscribers enable row level security;

-- Block direct access by public and regular application users.
revoke all on table public.newsletter_subscribers from public, anon, authenticated;

-- Allow the trusted server-side service role to access the table.
grant select, insert on table public.newsletter_subscribers to service_role;


-- =============================================
-- MIGRATION: 20261010110000_article_views_redesign.sql
-- =============================================

-- Migration: Redesign Article View Counter Limits
-- Loosens the global IP limit to 30 distinct articles per 15 minutes and removes the hard 60-views/min ceiling.

create or replace function public.increment_article_view_count(p_article_id uuid, p_ip_address text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_ip_articles int;
begin
  -- First verify the article actually exists and is published
  if not exists (select 1 from public.articles where id = p_article_id and status = 'published') then
    return;
  end if;

  -- Consistently acquire advisory locks to prevent deadlocks and enforce atomicity
  -- 1. Lock the article to serialize global per-article view checks
  perform pg_advisory_xact_lock(hashtext('view_counter_article_' || p_article_id::text));
  -- 2. Lock the IP to serialize per-IP checks and deduplication
  perform pg_advisory_xact_lock(hashtext('view_counter_ip_' || p_ip_address));

  -- 1. Check IP-based rate limit: max 30 distinct articles in 15 minutes
  select count(distinct article_id) into v_recent_ip_articles
  from public.article_views_log
  where ip_address = p_ip_address
    and viewed_at > now() - interval '15 minutes';

  if v_recent_ip_articles >= 30 then
    return; -- Silently ignore abuse
  end if;

  -- 2. Deduplicate IP per article (max 1 view per 24 hours per IP for the same article)
  if exists (
    select 1 from public.article_views_log
    where article_id = p_article_id
      and ip_address = p_ip_address
      and viewed_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  -- All checks passed, log the view
  insert into public.article_views_log (article_id, ip_address)
  values (p_article_id, p_ip_address);

  -- Increment the public counter
  perform set_config('kjin.allow_view_count_update', 'on', true);
  
  update public.articles
  set view_count = view_count + 1
  where id = p_article_id and status = 'published';
end;
$$;


-- =============================================
-- MIGRATION: 20261010120000_newsletter_rate_limit.sql
-- =============================================

-- Create a table to track newsletter subscription requests per IP
CREATE TABLE IF NOT EXISTS public.newsletter_ip_rate_limit (
    ip_address text PRIMARY KEY,
    request_count integer NOT NULL DEFAULT 1,
    last_request_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Secure the table
ALTER TABLE public.newsletter_ip_rate_limit ENABLE ROW LEVEL SECURITY;
-- No public policies; only service_role should access this table

-- Create an RPC to atomically check and increment the rate limit
CREATE OR REPLACE FUNCTION public.check_newsletter_rate_limit(p_ip_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Clean up expired rate limits (older than 1 hour)
    DELETE FROM public.newsletter_ip_rate_limit 
    WHERE last_request_at < now() - interval '1 hour';

    -- Upsert the IP address
    INSERT INTO public.newsletter_ip_rate_limit (ip_address, request_count, last_request_at)
    VALUES (p_ip_address, 1, now())
    ON CONFLICT (ip_address) 
    DO UPDATE SET 
        request_count = public.newsletter_ip_rate_limit.request_count + 1,
        last_request_at = now()
    RETURNING request_count INTO v_count;

    -- Return true if under or at the limit of 3 requests per hour
    RETURN v_count <= 3;
END;
$$;

-- Revoke public execution
REVOKE EXECUTE ON FUNCTION public.check_newsletter_rate_limit(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.check_newsletter_rate_limit(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_newsletter_rate_limit(text) TO service_role;


-- =============================================
-- MIGRATION: 20261010130000_newsletter_rate_limit_fix.sql
-- =============================================

DO $$
BEGIN
    -- Safely rename the column if it hasn't been renamed yet
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'newsletter_ip_rate_limit'
          AND column_name = 'last_request_at'
    ) THEN
        ALTER TABLE public.newsletter_ip_rate_limit RENAME COLUMN last_request_at TO window_start_at;
    END IF;
END $$;

-- Update the RPC to use window_start_at and not extend the window on every request
CREATE OR REPLACE FUNCTION public.check_newsletter_rate_limit(p_ip_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Clean up expired rate limits (older than 1 hour)
    DELETE FROM public.newsletter_ip_rate_limit 
    WHERE window_start_at < now() - interval '1 hour';

    -- Upsert the IP address
    INSERT INTO public.newsletter_ip_rate_limit (ip_address, request_count, window_start_at)
    VALUES (p_ip_address, 1, now())
    ON CONFLICT (ip_address) 
    DO UPDATE SET 
        request_count = public.newsletter_ip_rate_limit.request_count + 1
    RETURNING request_count INTO v_count;

    -- Return true if under or at the limit of 3 requests per hour
    RETURN v_count <= 3;
END;
$$;


-- =============================================
-- MIGRATION: 20261010180000_article_translations.sql
-- =============================================

-- Create article translations table
create table if not exists public.article_translations (
    id uuid primary key default gen_random_uuid(),
    article_id uuid not null references public.articles(id) on delete cascade,
    language_code text not null check (language_code in ('ur', 'hi')),
    title text not null,
    excerpt text,
    content text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(article_id, language_code)
);

alter table public.article_translations enable row level security;

-- Index for fast lookup by article and language
create index if not exists idx_article_translations_article_id on public.article_translations(article_id);
create index if not exists idx_article_translations_language on public.article_translations(language_code);

-- RLS Policies
-- Anyone who can read the original article can read its translations
create policy "Translations are readable if article is readable"
on public.article_translations
for select
using (
    exists (
        select 1 from public.articles a 
        where a.id = article_translations.article_id
        -- the articles table RLS will evaluate automatically via this subquery
    )
);

-- Editors can manage translations
create policy "Editors can insert translations"
on public.article_translations
for insert
to authenticated
with check (public.user_has_editor_access());

create policy "Editors can update translations"
on public.article_translations
for update
to authenticated
using (public.user_has_editor_access())
with check (public.user_has_editor_access());

create policy "Editors can delete translations"
on public.article_translations
for delete
to authenticated
using (public.user_has_editor_access());

-- Update trigger to maintain updated_at
create or replace function public.set_translation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_article_translation_updated_at
before update on public.article_translations
for each row
execute function public.set_translation_updated_at();

-- RPC for editors to create/update translation safely
create or replace function public.upsert_article_translation(
    p_article_id uuid,
    p_language_code text,
    p_title text,
    p_excerpt text,
    p_content text
)
returns public.article_translations
language plpgsql
security definer
set search_path = ''
as $$
declare
    translation_row public.article_translations;
begin
    if auth.uid() is null or not public.user_has_editor_access() then
        raise exception 'Editor access is required to modify translations';
    end if;

    if p_language_code not in ('ur', 'hi') then
        raise exception 'Language code must be one of: ur, hi';
    end if;

    insert into public.article_translations (article_id, language_code, title, excerpt, content)
    values (p_article_id, p_language_code, trim(p_title), trim(p_excerpt), trim(p_content))
    on conflict (article_id, language_code) 
    do update set 
        title = excluded.title,
        excerpt = excluded.excerpt,
        content = excluded.content,
        updated_at = now()
    returning * into translation_row;

    return translation_row;
end;
$$;

revoke all on function public.upsert_article_translation(uuid, text, text, text, text) from public;
grant execute on function public.upsert_article_translation(uuid, text, text, text, text) to authenticated;


-- =============================================
-- MIGRATION: 20261010190000_ai_rate_limiter.sql
-- =============================================

-- Migration: AI Rate Limiting
-- Enforces isolated per-endpoint rate limiting with advisory locking,
-- per-user window pruning, and a dedicated global retention cleanup procedure.

create table if not exists public.ai_usage_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    endpoint text not null,
    created_at timestamptz not null default now()
);

-- Indexes for fast composite queries on user + endpoint + time window
create index if not exists ai_usage_logs_user_created_at_idx on public.ai_usage_logs (user_id, created_at);
create index if not exists ai_usage_logs_user_endpoint_created_idx on public.ai_usage_logs (user_id, endpoint, created_at);
create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs (created_at);

-- Set up RLS (accessed via backend service role)
alter table public.ai_usage_logs enable row level security;

-- Create an RPC to atomically check and record usage per endpoint
create or replace function public.check_ai_rate_limit(
    p_user_id uuid,
    p_endpoint text,
    p_max_requests int,
    p_window_interval interval
) returns boolean as $$
declare
    v_recent_count int;
begin
    -- 1. Authorization: Only allow the actual user (or service_role) to rate-limit themselves
    if auth.role() != 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Unauthorized: You can only record rate limits for your own user ID.';
    end if;

    -- 2. Concurrency Control: Acquire an exclusive transaction-level lock for this user + endpoint
    -- Hash user UUID and endpoint name together so concurrent requests across different endpoints do not block each other
    perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || coalesce(p_endpoint, 'default')));

    -- 3. Cleanup: Delete expired logs for this specific user and endpoint
    delete from public.ai_usage_logs
    where user_id = p_user_id
      and endpoint = p_endpoint
      and created_at < now() - p_window_interval;

    -- 4. Opportunistic Global Maintenance: Purge stale logs older than 7 days probabilistically (~2% of calls)
    -- This bounds overall table size even when dedicated cron jobs are paused
    if random() < 0.02 then
        delete from public.ai_usage_logs
        where created_at < now() - interval '7 days';
    end if;

    -- 5. Count: Count recent requests within the window for this specific endpoint
    select count(*)
    into v_recent_count
    from public.ai_usage_logs
    where user_id = p_user_id
      and endpoint = p_endpoint
      and created_at >= now() - p_window_interval;

    if v_recent_count >= p_max_requests then
        return false; -- Rate limit exceeded for this endpoint
    end if;

    -- 6. Record: Insert the new request log
    insert into public.ai_usage_logs (user_id, endpoint)
    values (p_user_id, p_endpoint);

    return true; -- Allowed
end;
$$ language plpgsql security definer set search_path = '';

-- Dedicated Global Maintenance Cleanup: Purges expired usage logs across all users and endpoints
create or replace function public.cleanup_ai_usage_logs(
    p_retention_window interval default '7 days'
) returns bigint as $$
declare
    v_deleted_count bigint;
begin
    -- Authorization: Restrict to service_role or admin
    if auth.role() != 'service_role' and not public.user_has_editor_access() then
        raise exception 'Unauthorized: Service role or admin access required for maintenance cleanup.';
    end if;

    delete from public.ai_usage_logs
    where created_at < now() - p_retention_window;

    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$ language plpgsql security definer set search_path = '';

-- Revoke default execute permissions
revoke all on function public.check_ai_rate_limit(uuid, text, int, interval) from public, anon, authenticated;
revoke all on function public.cleanup_ai_usage_logs(interval) from public, anon, authenticated;

-- Grant explicitly only to service_role
grant execute on function public.check_ai_rate_limit(uuid, text, int, interval) to service_role;
grant execute on function public.cleanup_ai_usage_logs(interval) to service_role;


-- =============================================
-- MIGRATION: 20261012100000_categories_and_districts.sql
-- =============================================

-- Migration 1: Categories and Districts
-- Creates normalized lookup tables seeded from apps/web/lib/taxonomy.ts,
-- adds nullable foreign keys to public.articles, runs backward-compatible backfills,
-- and reports any unmatched legacy taxonomy entries.
--
-- Rollback Strategy (Forward-Fix):
-- ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_category_id_fkey;
-- ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_district_id_fkey;
-- ALTER TABLE public.articles DROP COLUMN IF EXISTS category_id;
-- ALTER TABLE public.articles DROP COLUMN IF EXISTS district_id;
-- (Retain public.categories and public.districts to preserve any editor additions).

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name_en text NOT NULL CHECK (char_length(btrim(name_en)) > 0),
    name_ur text,
    name_hi text,
    description text NOT NULL DEFAULT '',
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS categories_set_updated_at ON public.categories;
CREATE TRIGGER categories_set_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories are readable by everyone" ON public.categories;
CREATE POLICY "Categories are readable by everyone"
ON public.categories FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Editors can manage categories" ON public.categories;
CREATE POLICY "Editors can manage categories"
ON public.categories FOR ALL
TO authenticated
USING (public.user_has_editor_access())
WITH CHECK (public.user_has_editor_access());

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

-- 2. Seed canonical categories (9 categories from apps/web/lib/taxonomy.ts)
INSERT INTO public.categories (slug, name_en, name_ur, name_hi, description, display_order)
VALUES
  ('politics', 'Politics', 'Ø³ÛŒØ§Ø³Øª', 'à¤°à¤¾à¤œà¤¨à¥€à¤¤à¤¿', 'Governance, policy, and public affairs reporting across J&K.', 1),
  ('local', 'Local', 'Ù…Ù‚Ø§Ù…ÛŒ Ø®Ø¨Ø±ÛŒÚº', 'à¤¸à¥à¤¥à¤¾à¤¨à¥€à¤¯', 'Ground reporting, civic issues, and grassroots updates from districts.', 2),
  ('economy', 'Economy', 'Ù…Ø¹ÛŒØ´Øª', 'à¤…à¤°à¥à¤¥à¤µà¥à¤¯à¤µà¤¸à¥à¤¥à¤¾', 'Business, agriculture, tourism, and financial developments.', 3),
  ('culture', 'Culture', 'Ø«Ù‚Ø§ÙØª Ùˆ Ø§Ø¯Ø¨', 'à¤¸à¤‚à¤¸à¥à¤•à¥ƒà¤¤à¤¿', 'Heritage, literature, arts, and traditions of Jammu and Kashmir.', 4),
  ('sports', 'Sports', 'Ú©Ú¾ÛŒÙ„', 'à¤–à¥‡à¤²', 'Athletics, youth sports, and regional championships.', 5),
  ('education', 'Education', 'ØªØ¹Ù„ÛŒÙ…', 'à¤¶à¤¿à¤•à¥à¤·à¤¾', 'Schools, universities, and academic affairs.', 6),
  ('investigation', 'Investigation', 'ØªØ­Ù‚ÛŒÙ‚Ø§ØªÛŒ Ø±Ù¾ÙˆØ±Ù¹Ù†Ú¯', 'à¤œà¤¾à¤‚à¤š', 'In-depth investigative journalism and accountability reporting.', 7),
  ('opinion', 'Opinion', 'Ø§Ø¯Ø§Ø±ÛŒÛ Ùˆ Ø¢Ø±Ø§Ø¡', 'à¤µà¤¿à¤šà¤¾à¤°', 'Editorials, columns, and analytical perspectives.', 8),
  ('general', 'General', 'Ø¹Ø§Ù… Ø®Ø¨Ø±ÛŒÚº', 'à¤¸à¤¾à¤®à¤¾à¤¨à¥à¤¯', 'General regional news and public interest bulletins.', 9)
ON CONFLICT (slug) DO UPDATE SET
  name_en = excluded.name_en,
  name_ur = excluded.name_ur,
  name_hi = excluded.name_hi,
  description = excluded.description,
  display_order = excluded.display_order,
  updated_at = now();

-- 3. Create districts table
CREATE TABLE IF NOT EXISTS public.districts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name_en text NOT NULL CHECK (char_length(btrim(name_en)) > 0),
    name_ur text,
    name_hi text,
    division text NOT NULL CHECK (division IN ('Kashmir', 'Jammu')),
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS districts_set_updated_at ON public.districts;
CREATE TRIGGER districts_set_updated_at
BEFORE UPDATE ON public.districts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS on districts
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Districts are readable by everyone" ON public.districts;
CREATE POLICY "Districts are readable by everyone"
ON public.districts FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Editors can manage districts" ON public.districts;
CREATE POLICY "Editors can manage districts"
ON public.districts FOR ALL
TO authenticated
USING (public.user_has_editor_access())
WITH CHECK (public.user_has_editor_access());

GRANT SELECT ON public.districts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.districts TO authenticated;

-- 4. Seed official 20 J&K districts (from apps/web/lib/taxonomy.ts)
INSERT INTO public.districts (slug, name_en, name_ur, name_hi, division, display_order)
VALUES
  -- Kashmir Division (10)
  ('srinagar', 'Srinagar', 'Ø³Ø±ÛŒ Ù†Ú¯Ø±', 'à¤¶à¥à¤°à¥€à¤¨à¤—à¤°', 'Kashmir', 1),
  ('anantnag', 'Anantnag', 'Ø§Ù†Ù†Øª Ù†Ø§Ú¯', 'à¤…à¤¨à¤‚à¤¤à¤¨à¤¾à¤—', 'Kashmir', 2),
  ('baramulla', 'Baramulla', 'Ø¨Ø§Ø±ÛÙ…ÙˆÙ„Û', 'à¤¬à¤¾à¤°à¤¾à¤®à¥‚à¤²à¤¾', 'Kashmir', 3),
  ('budgam', 'Budgam', 'Ø¨ÚˆÚ¯Ø§Ù…', 'à¤¬à¤¡à¤—à¤¾à¤®', 'Kashmir', 4),
  ('bandipora', 'Bandipora', 'Ø¨Ø§Ù†ÚˆÛŒ Ù¾ÙˆØ±Û', 'à¤¬à¤¾à¤‚à¤¡à¥€à¤ªà¥‹à¤°à¤¾', 'Kashmir', 5),
  ('ganderbal', 'Ganderbal', 'Ú¯Ø§Ù†Ø¯Ø±Ø¨Ù„', 'à¤—à¤¾à¤‚à¤¦à¤°à¤¬à¤²', 'Kashmir', 6),
  ('kulgam', 'Kulgam', 'Ú©ÙˆÙ„Ú¯Ø§Ù…', 'à¤•à¥à¤²à¤—à¤¾à¤®', 'Kashmir', 7),
  ('kupwara', 'Kupwara', 'Ú©Ù¾ÙˆØ§Ø±Û', 'à¤•à¥à¤ªà¤µà¤¾à¤¡à¤¼à¤¾', 'Kashmir', 8),
  ('pulwama', 'Pulwama', 'Ù¾Ù„ÙˆØ§Ù…Û', 'à¤ªà¥à¤²à¤µà¤¾à¤®à¤¾', 'Kashmir', 9),
  ('shopian', 'Shopian', 'Ø´ÙˆÙ¾ÛŒØ§Úº', 'à¤¶à¥‹à¤ªà¤¿à¤¯à¤¾à¤‚', 'Kashmir', 10),
  -- Jammu Division (10)
  ('jammu', 'Jammu', 'Ø¬Ù…ÙˆÚº', 'à¤œà¤®à¥à¤®à¥‚', 'Jammu', 11),
  ('doda', 'Doda', 'ÚˆÙˆÚˆÛ', 'à¤¡à¥‹à¤¡à¤¾', 'Jammu', 12),
  ('kathua', 'Kathua', 'Ú©Ù¹Ú¾ÙˆØ¹Û', 'à¤•à¤ à¥à¤†', 'Jammu', 13),
  ('kishtwar', 'Kishtwar', 'Ú©Ø´ØªÙˆØ§Ú‘', 'à¤•à¤¿à¤¶à¥à¤¤à¤µà¤¾à¤¡à¤¼', 'Jammu', 14),
  ('poonch', 'Poonch', 'Ù¾ÙˆÙ†Ú†Ú¾', 'à¤ªà¥à¤‚à¤›', 'Jammu', 15),
  ('rajouri', 'Rajouri', 'Ø±Ø§Ø¬ÙˆØ±ÛŒ', 'à¤°à¤¾à¤œà¥Œà¤°à¥€', 'Jammu', 16),
  ('ramban', 'Ramban', 'Ø±Ø§Ù… Ø¨Ù†', 'à¤°à¤¾à¤®à¤¬à¤¨', 'Jammu', 17),
  ('reasi', 'Reasi', 'Ø±ÛŒØ§Ø³ÛŒ', 'à¤°à¤¿à¤¯à¤¾à¤¸à¥€', 'Jammu', 18),
  ('samba', 'Samba', 'Ø³Ø§Ù…Ø¨Ø§', 'à¤¸à¤¾à¤‚à¤¬à¤¾', 'Jammu', 19),
  ('udhampur', 'Udhampur', 'Ø§Ø¯Ú¾Ù… Ù¾ÙˆØ±', 'à¤‰à¤§à¤®à¤ªà¥à¤°', 'Jammu', 20)
ON CONFLICT (slug) DO UPDATE SET
  name_en = excluded.name_en,
  name_ur = excluded.name_ur,
  name_hi = excluded.name_hi,
  division = excluded.division,
  display_order = excluded.display_order,
  updated_at = now();

-- 5. Add nullable foreign keys to articles table
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_category_id ON public.articles (category_id);
CREATE INDEX IF NOT EXISTS idx_articles_district_id ON public.articles (district_id);

-- 6. Backfill existing articles to populate foreign keys from existing text columns
UPDATE public.articles a
SET category_id = c.id
FROM public.categories c
WHERE (lower(trim(a.category)) = c.slug OR lower(trim(a.category)) = lower(c.name_en))
  AND a.category_id IS NULL;

UPDATE public.articles a
SET district_id = d.id
FROM public.districts d
WHERE (lower(trim(coalesce(a.district, ''))) = d.slug OR lower(trim(coalesce(a.district, ''))) = lower(d.name_en))
  AND a.district_id IS NULL;

-- 7. Validate and report any unmatched taxonomy values
DO $$
DECLARE
  v_unmatched_cat_count integer;
  v_unmatched_cat_sample text;
  v_unmatched_dist_count integer;
  v_unmatched_dist_sample text;
BEGIN
  SELECT count(*), coalesce(string_agg(DISTINCT category, ', '), 'none')
  INTO v_unmatched_cat_count, v_unmatched_cat_sample
  FROM public.articles
  WHERE category_id IS NULL AND category IS NOT NULL AND btrim(category) <> '';

  IF v_unmatched_cat_count > 0 THEN
    RAISE NOTICE 'Migration 1 Notice: % article(s) have unmatched categories: %', v_unmatched_cat_count, v_unmatched_cat_sample;
  ELSE
    RAISE NOTICE 'Migration 1 Validation: All article categories successfully linked.';
  END IF;

  SELECT count(*), coalesce(string_agg(DISTINCT district, ', '), 'none')
  INTO v_unmatched_dist_count, v_unmatched_dist_sample
  FROM public.articles
  WHERE district_id IS NULL AND district IS NOT NULL AND btrim(district) <> '';

  IF v_unmatched_dist_count > 0 THEN
    RAISE NOTICE 'Migration 1 Notice: % article(s) have unmatched districts: %', v_unmatched_dist_count, v_unmatched_dist_sample;
  ELSE
    RAISE NOTICE 'Migration 1 Validation: All article districts successfully linked.';
  END IF;
END $$;


-- =============================================
-- MIGRATION: 20261012110000_tags_and_article_tags.sql
-- =============================================

-- Migration 2: Tags and Article Tags
-- Implements topic clustering, related-content indexing, and many-to-many article tagging
-- with composite uniqueness on (article_id, tag_id) and RLS security boundaries.
--
-- Rollback Strategy (Forward-Fix):
-- DROP TABLE IF EXISTS public.article_tags;
-- DROP TABLE IF EXISTS public.tags;

-- 1. Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name_en text NOT NULL CHECK (char_length(btrim(name_en)) > 0),
    name_ur text,
    name_hi text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tags are readable by everyone" ON public.tags;
CREATE POLICY "Tags are readable by everyone"
ON public.tags FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Editors can manage tags" ON public.tags;
CREATE POLICY "Editors can manage tags"
ON public.tags FOR ALL
TO authenticated
USING (public.user_has_editor_access())
WITH CHECK (public.user_has_editor_access());

-- 2. Create article_tags junction table
CREATE TABLE IF NOT EXISTS public.article_tags (
    article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_article_tags_tag_id ON public.article_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON public.article_tags (article_id);

-- RLS on article_tags
ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Article tags of published articles are readable" ON public.article_tags;
CREATE POLICY "Article tags of published articles are readable"
ON public.article_tags FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.articles a
        WHERE a.id = article_tags.article_id
          AND a.status = 'published'
    )
    OR public.user_has_editor_access()
);

DROP POLICY IF EXISTS "Editors can manage article tags" ON public.article_tags;
CREATE POLICY "Editors can manage article tags"
ON public.article_tags FOR ALL
TO authenticated
USING (public.user_has_editor_access())
WITH CHECK (public.user_has_editor_access());

GRANT SELECT ON public.tags, public.article_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tags, public.article_tags TO authenticated;


-- =============================================
-- MIGRATION: 20261012120000_media_assets.sql
-- =============================================

-- Migration 3: Media Assets Library
-- Establishes centralized newsroom media assets catalog with localized alt text,
-- credit metadata, file dimensions, approval status, and non-destructive retention.
-- Preserves existing articles.featured_image_url for seamless backward compatibility.
--
-- Security & Retention Enhancements:
-- 1. SVG excluded from MIME check to prevent script injection vectors.
-- 2. uploaded_by uses ON DELETE SET NULL to preserve historical assets when profiles change.
-- 3. status defaults to 'draft'. Standard authors can only upload drafts; only editors can publish.
-- 4. Authors can only update their own drafts; published assets can only be modified by editors.
--
-- Rollback Strategy (Forward-Fix):
-- ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_featured_image_id_fkey;
-- ALTER TABLE public.articles DROP COLUMN IF EXISTS featured_image_id;
-- DROP TABLE IF EXISTS public.media_assets;

-- 1. Create media_assets catalog table
CREATE TABLE IF NOT EXISTS public.media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_bucket text NOT NULL DEFAULT 'news-media',
    storage_path text NOT NULL UNIQUE,
    public_url text NOT NULL,
    alt_text_en text NOT NULL DEFAULT '',
    alt_text_ur text,
    alt_text_hi text,
    caption text,
    credit text,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    width integer CHECK (width IS NULL OR width > 0),
    height integer CHECK (height IS NULL OR height > 0),
    file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
    mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
    uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS media_assets_set_updated_at ON public.media_assets;
CREATE TRIGGER media_assets_set_updated_at
BEFORE UPDATE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for asset lookup
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON public.media_assets (status);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by ON public.media_assets (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON public.media_assets (created_at DESC);

-- 2. RLS on media_assets
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Media assets are readable by everyone" ON public.media_assets;
DROP POLICY IF EXISTS "Published media assets are readable by everyone" ON public.media_assets;
CREATE POLICY "Published media assets are readable by everyone"
ON public.media_assets FOR SELECT
USING (
    status = 'published'
    OR public.user_has_editor_access()
    OR (uploaded_by IS NOT NULL AND uploaded_by = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Employees create media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Employees upload draft media and editors create any" ON public.media_assets;
CREATE POLICY "Employees upload draft media and editors create any"
ON public.media_assets FOR INSERT
TO authenticated
WITH CHECK (
    uploaded_by IS NOT NULL
    AND uploaded_by = (SELECT auth.uid())
    AND (
        (status = 'draft' AND (public.has_permission('article.create') OR public.user_has_editor_access()))
        OR
        (status IN ('published', 'archived') AND public.user_has_editor_access())
    )
);

DROP POLICY IF EXISTS "Authors update own media and editors update all" ON public.media_assets;
DROP POLICY IF EXISTS "Authors update own drafts and editors update all" ON public.media_assets;
CREATE POLICY "Authors update own drafts and editors update all"
ON public.media_assets FOR UPDATE
TO authenticated
USING (
    public.user_has_editor_access()
    OR (uploaded_by IS NOT NULL AND uploaded_by = (SELECT auth.uid()) AND status = 'draft')
)
WITH CHECK (
    public.user_has_editor_access()
    OR (uploaded_by IS NOT NULL AND uploaded_by = (SELECT auth.uid()) AND status = 'draft')
);

DROP POLICY IF EXISTS "Editors delete media assets" ON public.media_assets;
CREATE POLICY "Editors delete media assets"
ON public.media_assets FOR DELETE
TO authenticated
USING (public.user_has_editor_access());

GRANT SELECT ON public.media_assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;

-- 3. Add optional foreign key to articles table (preserving existing featured_image_url)
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS featured_image_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_featured_image_id ON public.articles (featured_image_id);


-- =============================================
-- MIGRATION: 20261012130000_translation_workflow.sql
-- =============================================

-- Migration 4: Translation Workflow & Independent Publication Lifecycle
-- Decouples Urdu and Hindi translation visibility from automatic publication,
-- adds translator attribution, independent status, editor tracking, and SEO metadata.
--
-- Security & Integrity Hardening:
-- 1. Deliberate backfill runs BEFORE enabling new RLS policy.
-- 2. Direct client mutations (INSERT, UPDATE, DELETE) are revoked; all writes must flow
--    through the SECURITY DEFINER RPC upsert_article_translation(), closing MFA bypasses.
-- 3. A defense-in-depth trigger unconditionally enforces MFA (AAL2) for translation publication.
-- 4. translator_id preserves original translator attribution; last_edited_by tracks latest modifier.
--
-- Rollback Strategy (Forward-Fix):
-- ALTER TABLE public.article_translations DROP CONSTRAINT IF EXISTS article_translations_meta_title_len;
-- ALTER TABLE public.article_translations DROP CONSTRAINT IF EXISTS article_translations_meta_desc_len;
-- DROP TRIGGER IF EXISTS article_translations_enforce_integrity ON public.article_translations;
-- DROP FUNCTION IF EXISTS public.article_translations_enforce_integrity cascade;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS status;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS translator_id;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS last_edited_by;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS meta_title;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS meta_description;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS published_at;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS published_by;
-- (Restore previous policy "Translations are readable if article is readable").

-- 1. Add workflow, attribution, and SEO columns to article_translations
ALTER TABLE public.article_translations
  ADD COLUMN IF NOT EXISTS status public.article_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS translator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.article_translations
  ADD CONSTRAINT article_translations_meta_title_len CHECK (meta_title IS NULL OR char_length(meta_title) <= 255),
  ADD CONSTRAINT article_translations_meta_desc_len CHECK (meta_description IS NULL OR char_length(meta_description) <= 1000);

CREATE INDEX IF NOT EXISTS idx_article_translations_status ON public.article_translations (status);
CREATE INDEX IF NOT EXISTS idx_article_translations_translator ON public.article_translations (translator_id);
CREATE INDEX IF NOT EXISTS idx_article_translations_last_edited_by ON public.article_translations (last_edited_by);

-- 2. DELIBERATE BACKFILL: Synchronize existing translation status with parent article status
-- Prior to this migration, any translation of a published article was treated as public.
-- To prevent live translations from disappearing, backfill them to 'published'.
UPDATE public.article_translations t
SET
  status = 'published',
  published_at = COALESCE(t.updated_at, t.created_at, now()),
  published_by = a.published_by
FROM public.articles a
WHERE a.id = t.article_id
  AND a.status = 'published';

-- Set remaining translations of draft/review/archived articles to their parent status
UPDATE public.article_translations t
SET
  status = a.status
FROM public.articles a
WHERE a.id = t.article_id
  AND a.status IN ('draft', 'review', 'archived')
  AND t.status = 'draft';

-- 3. Enforce NOT NULL on status after data backfill
ALTER TABLE public.article_translations
  ALTER COLUMN status SET NOT NULL;

-- 4. Defense-in-depth Database Trigger: Enforce MFA (AAL2) on publication at engine level
CREATE OR REPLACE FUNCTION public.article_translations_enforce_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Strict MFA enforcement when setting status to published
    IF NEW.status = 'published' AND COALESCE((SELECT auth.jwt() ->> 'aal'), '') <> 'aal2' THEN
        RAISE EXCEPTION 'MFA (AAL2) is strictly required to publish translations';
    END IF;

    -- Invariant consistency
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

DROP TRIGGER IF EXISTS article_translations_enforce_integrity ON public.article_translations;
CREATE TRIGGER article_translations_enforce_integrity
BEFORE INSERT OR UPDATE ON public.article_translations
FOR EACH ROW EXECUTE FUNCTION public.article_translations_enforce_integrity();

-- 5. Secure RLS & Lock down direct client mutations
-- Readers can only view a translation if BOTH the parent article is published AND the translation is published.
DROP POLICY IF EXISTS "Translations are readable if article is readable" ON public.article_translations;
DROP POLICY IF EXISTS "Published translations of published articles are public" ON public.article_translations;

CREATE POLICY "Published translations of published articles are public"
ON public.article_translations FOR SELECT
USING (
    (
        status = 'published'
        AND EXISTS (
            SELECT 1 FROM public.articles a
            WHERE a.id = article_translations.article_id
              AND a.status = 'published'
        )
    )
    OR public.user_has_editor_access()
    OR translator_id = (SELECT auth.uid())
);

-- Drop legacy direct mutation policies to route all writes through the secured RPC
DROP POLICY IF EXISTS "Editors can insert translations" ON public.article_translations;
DROP POLICY IF EXISTS "Editors can update translations" ON public.article_translations;
DROP POLICY IF EXISTS "Editors can delete translations" ON public.article_translations;

-- Revoke direct mutation privileges from client roles
REVOKE INSERT, UPDATE, DELETE ON public.article_translations FROM public, anon, authenticated;
GRANT SELECT ON public.article_translations TO anon, authenticated;

-- 6. Updated RPC: upsert_article_translation
DROP FUNCTION IF EXISTS public.upsert_article_translation(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.upsert_article_translation(uuid, text, text, text, text, public.article_status, text, text);

CREATE OR REPLACE FUNCTION public.upsert_article_translation(
    p_article_id uuid,
    p_language_code text,
    p_title text,
    p_excerpt text,
    p_content text,
    p_status public.article_status DEFAULT 'draft',
    p_meta_title text DEFAULT NULL,
    p_meta_description text DEFAULT NULL
)
RETURNS public.article_translations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    translation_row public.article_translations;
    actor_uid uuid := (SELECT auth.uid());
    v_published_at timestamptz := NULL;
    v_published_by uuid := NULL;
BEGIN
    IF actor_uid IS NULL OR NOT public.user_has_editor_access() THEN
        RAISE EXCEPTION 'Editor access is required to modify translations';
    END IF;

    IF p_language_code NOT IN ('ur', 'hi') THEN
        RAISE EXCEPTION 'Language code must be one of: ur, hi';
    END IF;

    -- Verify parent article exists
    IF NOT EXISTS (SELECT 1 FROM public.articles WHERE id = p_article_id) THEN
        RAISE EXCEPTION 'Parent article not found';
    END IF;

    -- Strict MFA enforcement when publishing translations
    IF p_status = 'published' AND COALESCE((SELECT auth.jwt() ->> 'aal'), '') <> 'aal2' THEN
        RAISE EXCEPTION 'MFA (AAL2) is strictly required to publish translations';
    END IF;

    IF p_status = 'published' THEN
        v_published_at := now();
        v_published_by := actor_uid;
    END IF;

    INSERT INTO public.article_translations (
        article_id, language_code, title, excerpt, content,
        status, translator_id, last_edited_by, meta_title, meta_description,
        published_at, published_by
    )
    VALUES (
        p_article_id, p_language_code, trim(p_title), trim(COALESCE(p_excerpt, '')), trim(p_content),
        p_status, actor_uid, actor_uid, nullif(trim(COALESCE(p_meta_title, '')), ''), nullif(trim(COALESCE(p_meta_description, '')), ''),
        v_published_at, v_published_by
    )
    ON CONFLICT (article_id, language_code)
    DO UPDATE SET
        title = excluded.title,
        excerpt = excluded.excerpt,
        content = excluded.content,
        status = excluded.status,
        -- Preserve original translator_id; track modifier in last_edited_by
        translator_id = COALESCE(public.article_translations.translator_id, excluded.translator_id),
        last_edited_by = actor_uid,
        meta_title = excluded.meta_title,
        meta_description = excluded.meta_description,
        published_at = CASE WHEN excluded.status = 'published' THEN COALESCE(public.article_translations.published_at, now()) ELSE NULL END,
        published_by = CASE WHEN excluded.status = 'published' THEN COALESCE(public.article_translations.published_by, actor_uid) ELSE NULL END,
        updated_at = now()
    RETURNING * INTO translation_row;

    RETURN translation_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_article_translation(uuid, text, text, text, text, public.article_status, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_article_translation(uuid, text, text, text, text, public.article_status, text, text) TO authenticated;


-- =============================================
-- MIGRATION: 20261012140000_multilingual_search_indexing.sql
-- =============================================

-- Migration 5: Multilingual Full-Text Search & GIN Indexing
-- Adds stored search vectors and GIN indexes for high-performance article search
-- across English, Urdu (Arabic script), and Hindi (Devanagari script).
--
-- Technical Architecture:
-- 1. English Source: Combines 'english' stemming with 'simple' tokenization.
-- 2. Urdu & Hindi Translations: Uses 'simple' Unicode parser to tokenize non-Latin scripts
--    verbatim without incorrect Latin stemming.
-- 3. GIN (Generalized Inverted Index) provides sub-millisecond full-text lookups.
--
-- Rollback Strategy (Forward-Fix):
-- DROP INDEX IF EXISTS public.idx_articles_tsv_search;
-- DROP INDEX IF EXISTS public.idx_article_translations_tsv_search;
-- ALTER TABLE public.articles DROP COLUMN IF EXISTS tsv_search;
-- ALTER TABLE public.article_translations DROP COLUMN IF EXISTS tsv_search;

-- 1. Stored generated search vector on articles
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS tsv_search tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(content, '')), 'C')
  ) STORED;

-- GIN index on articles search vector
CREATE INDEX IF NOT EXISTS idx_articles_tsv_search
ON public.articles USING gin (tsv_search);

-- 2. Stored generated search vector on article_translations (Urdu & Hindi)
ALTER TABLE public.article_translations
  ADD COLUMN IF NOT EXISTS tsv_search tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(content, '')), 'C')
  ) STORED;

-- GIN index on article_translations search vector
CREATE INDEX IF NOT EXISTS idx_article_translations_tsv_search
ON public.article_translations USING gin (tsv_search);


-- =============================================
-- MIGRATION: 20261013100000_security_audit_fixes.sql
-- =============================================

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


-- =============================================
-- MIGRATION: 20261022140000_hide_owner_from_subordinates.sql
-- =============================================

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


-- =============================================
-- MIGRATION: 20261022160000_site_settings_and_templates.sql
-- =============================================

-- Migration: Site Settings & Presentation Templates
-- Establishes site_settings table for dynamic public website templates
-- Allows owner, superadmin, and admin (hierarchy_rank >= 300) to manage presentation templates.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create or replace function public.set_site_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_site_settings_updated_at();

alter table public.site_settings enable row level security;

drop policy if exists "Site settings are readable by everyone" on public.site_settings;
create policy "Site settings are readable by everyone"
on public.site_settings for select
using (true);

drop policy if exists "Admins can update site settings" on public.site_settings;
create policy "Admins can update site settings"
on public.site_settings for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.roles r on r.role_key = p.role_key
    where p.id = auth.uid()
      and r.hierarchy_rank >= 300
      and p.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.roles r on r.role_key = p.role_key
    where p.id = auth.uid()
      and r.hierarchy_rank >= 300
      and p.status = 'active'
  )
);

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

-- Seed default active template
insert into public.site_settings (key, value, description)
values (
  'active_template',
  jsonb_build_object(
    'template_id', 'classic-editorial',
    'name', 'Classic Editorial Broadsheet',
    'activated_at', now()
  ),
  'Currently active public website presentation template'
)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description;


-- =============================================
-- MIGRATION: 20261022200000_explicit_pending_deletion_error.sql
-- =============================================

-- Migration: explicit_pending_deletion_error
-- Returns clear exception when an employee already has a pending deprovisioning request.

create or replace function public.request_employee_deletion(p_target_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare request_id uuid; target_role text;
begin
  if not public.has_permission('employee.deletion.request') then raise exception 'Employee deletion request access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  select role_key into target_role from public.profiles where id = p_target_id;
  if target_role is null or target_role = 'owner' or p_target_id = auth.uid() then raise exception 'This employee cannot be requested for deletion'; end if;
  if exists (select 1 from public.employee_deletion_requests where target_profile_id = p_target_id and status = 'pending') then
    raise exception 'A deprovisioning request is already pending for this employee';
  end if;
  insert into public.employee_deletion_requests (target_profile_id, requested_by, reason)
  values (p_target_id, auth.uid(), trim(p_reason)) returning id into request_id;
  perform public.write_audit_event(auth.uid(), 'employee.deletion_requested', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('request_id', request_id));
  return request_id;
end;
$$;


-- =============================================
-- MIGRATION: 20261022204500_allow_owner_and_requester_resolve.sql
-- =============================================

-- Migration: allow_owner_and_requester_resolve
-- Allows:
-- 1) Any requester to cancel/reject their own pending deprovisioning request (p_decision = 'rejected')
-- 2) The system Owner (rank = 4 / role 'owner') to approve/resolve deprovisioning requests for subordinate employees (even if requested by Owner, since no higher authority exists)
-- 3) Strict four-eyes principle remains enforced for non-owner administrators (an Admin/Superadmin who requests deletion cannot self-approve)
-- 4) Self-deprovisioning remains strictly blocked (target cannot be auth.uid(), owner cannot be deleted)

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
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;

  select * into request_row from public.employee_deletion_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'Pending deletion request not found'; end if;

  if request_row.target_profile_id = auth.uid() then
    raise exception 'You cannot resolve your own deletion request';
  end if;

  select profiles.role_key, roles.hierarchy_rank into target_role, target_rank
  from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = request_row.target_profile_id;

  select roles.hierarchy_rank into actor_rank
  from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = auth.uid() and profiles.status = 'active';

  if target_role is null or target_role = 'owner' or target_rank >= actor_rank then
    raise exception 'You cannot deprovision this employee';
  end if;

  if request_row.requested_by = auth.uid() and p_decision = 'approved' and actor_rank < 4 then
    raise exception 'You cannot resolve your own deletion request';
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


-- =============================================
-- MIGRATION: 20261022210000_regional_divisions_and_leh.sql
-- =============================================

-- Migration: regional_divisions_and_leh
-- Expands division taxonomy to support 5 distinct regions:
-- 1. Kashmir Valley
-- 2. Jammu Plains
-- 3. Chenab Valley
-- 4. Pir Panjal Range
-- 5. Leh & Ladakh

BEGIN;

-- 1. Update check constraint on public.districts
ALTER TABLE public.districts DROP CONSTRAINT IF EXISTS districts_division_check;
ALTER TABLE public.districts ADD CONSTRAINT districts_division_check
  CHECK (division = ANY (ARRAY['Kashmir'::text, 'Jammu'::text, 'Chenab Valley'::text, 'Pir Panjal'::text, 'Leh & Ladakh'::text, 'Ladakh'::text]));

-- 2. Update divisions for Chenab Valley and Pir Panjal
UPDATE public.districts SET division = 'Chenab Valley', updated_at = NOW() WHERE slug IN ('doda', 'kishtwar', 'ramban');
UPDATE public.districts SET division = 'Pir Panjal', updated_at = NOW() WHERE slug IN ('rajouri', 'poonch');

-- 3. Insert Leh and Kargil districts if missing
INSERT INTO public.districts (slug, name_en, name_ur, name_hi, division, display_order, is_active)
VALUES
  ('leh', 'Leh', 'Ù„ÛŒÛÛ', 'à¤²à¥‡à¤¹', 'Leh & Ladakh', 21, true),
  ('kargil', 'Kargil', 'Ú©Ø±Ú¯Ù„', 'à¤•à¤¾à¤°à¤—à¤¿à¤²', 'Leh & Ladakh', 22, true)
ON CONFLICT (slug) DO UPDATE
SET division = 'Leh & Ladakh', name_en = EXCLUDED.name_en, is_active = true;

-- 4. Insert published articles for Leh and Kargil
SET session_replication_role = 'replica';

INSERT INTO public.articles (
  id,
  title,
  slug,
  excerpt,
  content,
  category,
  category_id,
  district,
  district_id,
  author_id,
  author_display_name,
  status,
  published_at,
  published_by,
  created_at,
  updated_at,
  view_count,
  featured_image_url,
  source_name,
  source_url
) VALUES
(
  'e0000001-0000-0000-0000-000000000021',
  'High-Altitude Geothermal and Solar Hybrid Grid Commissioned Across Eastern Leh Plateau',
  'high-altitude-geothermal-and-solar-hybrid-grid-commissioned-across-eastern-leh-plateau',
  'Renewable energy researchers and border power agencies inaugurate Ladakh first winter-resilient hybrid solar-geothermal installation, ensuring continuous energy for high-altitude hamlets.',
  '## Clean Power for Trans-Himalayan Hamlets

A landmark renewable energy project was formally commissioned in the eastern plateau of Leh this week, delivering reliable 24/7 power to remote high-altitude communities even as temperatures plummet below minus twenty degrees Celsius.

The installation pairs advanced bifacial solar photovoltaic arrays with closed-loop geothermal heat pumps, overcoming the seasonal freezing challenges that traditionally incapacitated lithium-ion battery banks during peak winter months.

### Transforming Winter Resilience in Ladakh

Engineers with the Ladakh Renewable Energy Development Agency confirmed that the microgrid supports over 450 households, local health wellness centres, and cold-storage facilities for regional agricultural produce.

"For decades, high-altitude villages relied on fossil-fuel generators during sub-zero months," said a senior project officer in Leh. "This indigenous hybrid grid demonstrates that clean, decentralized Himalayan energy is practical, ecologically protective, and economically sustainable."',
  'economy',
  (SELECT id FROM public.categories WHERE slug = 'economy' LIMIT 1),
  'leh',
  (SELECT id FROM public.districts WHERE slug = 'leh' LIMIT 1),
  (SELECT id FROM public.profiles WHERE role_key = 'owner' LIMIT 1),
  'Hafiz Zargar',
  'published',
  NOW() - INTERVAL '2 hours',
  (SELECT id FROM public.profiles WHERE role_key = 'owner' LIMIT 1),
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours',
  312,
  'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1200&q=80',
  'KJIN Leh Bureau',
  'https://kjin.org/dispatches/leh-geothermal-grid'
),
(
  'e0000001-0000-0000-0000-000000000022',
  'Zojila Tunnel Approach Works Expedited Ahead of Early Winter Frost in Kargil District',
  'zojila-tunnel-approach-works-expedited-ahead-of-early-winter-frost-in-kargil-district',
  'Infrastructure task forces complete critical avalanche-shelter sheds and reinforced snow galleries along the Western Kargil highway approach, reinforcing year-round transit connectivity.',
  '## Fortifying Strategic Himalayan Lifelines

Construction crews along the high-elevation Dras-Kargil axis have achieved critical breakthroughs this week on the approach viaducts and anti-avalanche cut-and-cover galleries flanking the Zojila Tunnel portal.

With winter weather systems approaching the upper ridges, specialized engineering units accelerated the installation of high-tensile rockfall barriers and heated roadway expansion joints designed to withstand heavy snow accumulation.

### Community Transit and Strategic Lifelines

Local logistics cooperatives and traders in Kargil town welcomed the rapid progress. For generations, seasonal closure of the high passes isolated the district for upwards of four months each year, inflating essentials prices and restricting emergency medical transfers.

"Maintaining continuous arterial transit between Srinagar, Kargil, and Leh is transformative for our families and schools," noted an elder from the Dras traders council. "Seeing these reinforced all-weather galleries come together brings immense confidence to the entire frontier valley."',
  'local',
  (SELECT id FROM public.categories WHERE slug = 'local' LIMIT 1),
  'kargil',
  (SELECT id FROM public.districts WHERE slug = 'kargil' LIMIT 1),
  (SELECT id FROM public.profiles WHERE role_key = 'owner' LIMIT 1),
  'Hafiz Zargar',
  'published',
  NOW() - INTERVAL '3 hours',
  (SELECT id FROM public.profiles WHERE role_key = 'owner' LIMIT 1),
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '3 hours',
  284,
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
  'KJIN Kargil Bureau',
  'https://kjin.org/dispatches/kargil-zojila-approach'
)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  district = EXCLUDED.district,
  status = 'published',
  published_at = EXCLUDED.published_at;

SET session_replication_role = 'origin';

COMMIT;


-- =============================================
-- MIGRATION: 20261022220000_seed_footer_contact.sql
-- =============================================

-- Migration: Seed Footer & Contact Settings in site_settings
insert into public.site_settings (key, value, description)
values (
  'footer_contact',
  jsonb_build_object(
    'organization_name', 'KJIN (Kashmir & Jammu Information Network)',
    'tagline', 'Verified Journalism & Public Affairs across Jammu & Kashmir',
    'description', 'Independent, non-partisan journal of record dedicated to verified investigative reporting, regional public affairs, and civic documentation across Jammu, Kashmir, and Ladakh.',
    'primary_address', 'Press Enclave, Residency Road, Srinagar, Jammu & Kashmir 190001',
    'primary_address_label', 'Srinagar Central Bureau & Headquarters',
    'bureau_address', 'Bahu Plaza Commercial Complex, Rail Head, Jammu, J&K 180012',
    'bureau_address_label', 'Jammu Regional Bureau',
    'operating_hours', 'Newsroom Desk: 24/7 Wire Operations â€¢ Administrative: Monâ€“Sat 9:30 AM â€“ 6:00 PM IST',
    'phone_primary', '+91 194 245 7800',
    'phone_primary_label', 'Editorial Newsdesk Hotline',
    'phone_secondary', '+91 94190 12345',
    'phone_secondary_label', 'WhatsApp Secure Tip Line',
    'email_editorial', 'editorial@kjin.org',
    'email_grievance', 'grievance@kjin.org',
    'email_press', 'press@kjin.org',
    'grievance_officer_name', 'Adv. Bashir Ahmad (Public Grievance Redressal Officer)',
    'registration_number', 'JK/REG/2026/0842 â€¢ Compliant with Information Technology (Intermediary Guidelines & Digital Media Ethics Code) Rules, 2021',
    'social_twitter', 'https://twitter.com/kjin_live',
    'social_facebook', 'https://facebook.com/kjinnews',
    'social_whatsapp', 'https://whatsapp.com/channel/kjin',
    'social_telegram', 'https://t.me/kjin_wire',
    'social_youtube', 'https://youtube.com/@kjin_live'
  ),
  'Public website footer contact info, bureau addresses, emails, and hotlines'
)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description;


-- =============================================
-- MIGRATION: 20261023163000_article_retraction_and_delete.sql
-- =============================================

-- Migration: Article Retraction (Inactive / Fake Flagging) and Permanent Deletion
-- 1. Add archived_by and archive_reason columns to public.articles to track retraction reasons
alter table public.articles
  add column if not exists archived_by uuid references public.profiles(id),
  add column if not exists archive_reason text;

-- 2. Ensure admin and editor roles have permission to delete articles if needed
insert into public.role_permissions (role_key, permission_key)
values
  ('admin', 'article.delete'),
  ('editor', 'article.delete')
on conflict do nothing;

-- 3. Update archive_article() to record retraction reason and who archived it
drop function if exists public.archive_article(uuid) cascade;
drop function if exists public.archive_article(uuid, text) cascade;

create or replace function public.archive_article(
  p_article_id uuid,
  p_reason text default null
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;
  
  if not public.has_permission('article.archive') then 
    raise exception 'Article archive permission required'; 
  end if;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if article_row.status not in ('review', 'published') then
    raise exception 'Only published or in-review articles can be archived';
  end if;

  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'MFA (AAL2) is strictly required to archive articles';
  end if;

  update public.articles set 
    status = 'archived',
    archived_at = now(),
    archived_by = actor_uid,
    archive_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_article_id 
  returning * into article_row;

  perform public.write_audit_event(actor_uid, 'article.archived', 'article', p_article_id, 'success');

  return article_row;
end;
$$;

revoke all on function public.archive_article(uuid, text) from public;
grant execute on function public.archive_article(uuid, text) to authenticated;


-- 4. Create delete_article() RPC for permanent deletion
drop function if exists public.delete_article(uuid) cascade;
drop function if exists public.delete_article(uuid, text) cascade;

create or replace function public.delete_article(
  p_article_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;
  
  if not (public.has_permission('article.delete') or public.has_permission('article.archive')) then 
    raise exception 'Article delete permission required'; 
  end if;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'MFA (AAL2) is strictly required to delete articles';
  end if;

  -- Write audit event before deleting to record who deleted the article and preserve audit log
  perform public.write_audit_event(actor_uid, 'article.deleted', 'article', p_article_id, 'success');

  -- Cascades automatically to article_versions, article_translations, and article_views
  delete from public.articles where id = p_article_id;

  return true;
end;
$$;

revoke all on function public.delete_article(uuid, text) from public;
grant execute on function public.delete_article(uuid, text) to authenticated;


-- =============================================
-- MIGRATION: 20261023170000_permanent_employee_deletion_cascades.sql
-- =============================================

-- Migration: Permanent Employee Deletion Cascades & Safe Foreign Keys
-- Allows employees to be permanently deleted without foreign key constraint violations
-- Authored articles and revisions will retain their display names and content while author/publisher references set to NULL.

-- 1. Relax NOT NULL constraint on article_versions.edited_by
alter table public.article_versions alter column edited_by drop not null;

-- 2. Update foreign keys on articles and article_versions to ON DELETE SET NULL
alter table public.articles drop constraint if exists articles_published_by_fkey;
alter table public.articles add constraint articles_published_by_fkey
  foreign key (published_by) references public.profiles(id) on delete set null;

alter table public.articles drop constraint if exists articles_archived_by_fkey;
alter table public.articles add constraint articles_archived_by_fkey
  foreign key (archived_by) references public.profiles(id) on delete set null;

alter table public.article_versions drop constraint if exists article_versions_edited_by_fkey;
alter table public.article_versions add constraint article_versions_edited_by_fkey
  foreign key (edited_by) references public.profiles(id) on delete set null;

-- 3. Register employee.permanent_delete permission
insert into public.permissions (permission_key, description)
values ('employee.permanent_delete', 'Permanently delete employee account and purge from database')
on conflict (permission_key) do update set description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values 
  ('owner', 'employee.permanent_delete'),
  ('superadmin', 'employee.permanent_delete')
on conflict do nothing;


-- =============================================
-- MIGRATION: 20261023173000_article_full_crud_and_reactivation.sql
-- =============================================

-- Migration: Full CRUD for Articles, Editing in all states, and Article Reactivation
-- Allows editing of published/archived articles to correct misinformation or update facts
-- Adds reactivate_article() RPC to restore retracted/inactive articles back to published or review

-- 1. Update public.update_article to permit editing in draft, review, published, and archived states
create or replace function public.update_article(
  p_article_id uuid,
  p_title text,
  p_excerpt text,
  p_content text,
  p_slug text,
  p_district text default null,
  p_category text default 'General',
  p_source_name text default null,
  p_source_url text default null,
  p_featured_image_url text default null
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  next_version integer;
  actor_uid uuid := (select auth.uid());
  has_review_permission boolean;
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;

  has_review_permission := public.has_permission('article.review');

  -- Lock the row for update
  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  -- Verify update authorization:
  -- Reviewers and editors can update articles in draft, review, published, or archived state
  -- Authors can update their own drafts
  if not (
    (has_review_permission and article_row.status in ('draft', 'review', 'published', 'archived')) or
    (article_row.author_id = actor_uid and article_row.status = 'draft' and public.has_permission('article.create'))
  ) then
    raise exception 'Unauthorized to edit this article in its current state';
  end if;

  -- Calculate next version number
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.article_versions
  where article_id = p_article_id;

  -- Update article
  update public.articles set
    title = p_title,
    excerpt = p_excerpt,
    content = p_content,
    slug = p_slug,
    district = p_district,
    category = p_category,
    source_name = p_source_name,
    source_url = p_source_url,
    featured_image_url = p_featured_image_url,
    updated_at = now()
  where id = p_article_id
  returning * into article_row;

  -- Create immutable version record
  insert into public.article_versions (
    article_id, version_number, title, excerpt, content, edited_by
  ) values (
    p_article_id, next_version, p_title, p_excerpt, p_content, actor_uid
  );

  perform public.write_audit_event(actor_uid, 'article.updated', 'article', p_article_id, 'success');

  return article_row;
end;
$$;

revoke all on function public.update_article(uuid, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.update_article(uuid, text, text, text, text, text, text, text, text, text) to authenticated;


-- 2. Create reactivate_article() RPC
create or replace function public.reactivate_article(
  p_article_id uuid,
  p_target_status text default 'published'
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;

  if not (public.has_permission('article.publish') or public.has_permission('article.review')) then
    raise exception 'Article publish or review permission required';
  end if;

  if p_target_status not in ('published', 'review', 'draft') then
    raise exception 'Target status must be published, review, or draft';
  end if;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if article_row.status <> 'archived' then
    raise exception 'Only inactive/archived articles can be reactivated';
  end if;

  update public.articles set
    status = p_target_status,
    published_at = case when p_target_status = 'published' then coalesce(published_at, now()) else published_at end,
    archived_at = null,
    archive_reason = null,
    updated_at = now()
  where id = p_article_id
  returning * into article_row;

  perform public.write_audit_event(actor_uid, 'article.reactivated', 'article', p_article_id, 'success');

  return article_row;
end;
$$;

revoke all on function public.reactivate_article(uuid, text) from public;
grant execute on function public.reactivate_article(uuid, text) to authenticated;


-- =============================================
-- MIGRATION: 20261023180000_fix_reactivate_article_integrity.sql
-- =============================================

-- Migration: Fix Article Reactivation RPC and State Machine Integrity Trigger
-- 1. Update articles_enforce_integrity trigger function to allow reactivation from archived to published, review, or draft
create or replace function public.articles_enforce_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uid uuid := (select auth.uid());
  actor_display_name text;
begin
  -- INSERT Rules
  if TG_OP = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New articles must be created as drafts.';
    end if;
    
    if actor_uid is null then
      raise exception 'Authenticated employee is required';
    end if;
    
    new.author_id := actor_uid;
    select display_name into actor_display_name from public.profiles where id = actor_uid;
    
    if actor_display_name is null then
      raise exception 'Active profile is required for article creation';
    end if;
    
    new.author_display_name := actor_display_name;
  end if;

  -- UPDATE Rules
  if TG_OP = 'UPDATE' then
    -- Author attribution immutability
    if new.author_id <> old.author_id then
      raise exception 'Cannot change article author_id.';
    end if;
    if new.author_display_name <> old.author_display_name then
      raise exception 'Cannot change article author_display_name directly.';
    end if;

    -- Slug immutability after publication
    if old.status in ('published', 'archived') and new.slug <> old.slug then
      raise exception 'Cannot change slug of published or archived articles.';
    end if;

    -- View count protection (only allowed if bypass setting is present)
    if new.view_count <> old.view_count and current_setting('kjin.allow_view_count_update', true) is distinct from 'on' then
      raise exception 'Cannot update view_count directly. Use the RPC incrementer.';
    end if;

    -- Status Transition State Machine
    if old.status <> new.status then
      if old.status = 'archived' and new.status not in ('published', 'review', 'draft') then
        raise exception 'Archived articles can only transition to published, review, or draft.';
      elsif old.status = 'draft' and new.status <> 'review' then
        raise exception 'Drafts can only transition to review.';
      elsif old.status = 'review' and new.status not in ('draft', 'published', 'archived') then
        raise exception 'Articles in review can only transition to draft, published, or archived.';
      elsif old.status = 'published' and new.status <> 'archived' then
        raise exception 'Published articles can only transition to archived.';
      end if;
    end if;
  end if;

  -- Metadata Consistency Invariants (runs on both INSERT and UPDATE)
  if new.status in ('draft', 'review') then
    new.published_at := null;
    new.published_by := null;
    new.archived_at := null;
    new.archive_reason := null;
    new.archived_by := null;
  elsif new.status = 'published' then
    if new.published_at is null or new.published_by is null then
      raise exception 'Published articles must have published_at and published_by set.';
    end if;
    new.archived_at := null;
    new.archive_reason := null;
    new.archived_by := null;
  elsif new.status = 'archived' then
    if new.archived_at is null then
      raise exception 'Archived articles must have archived_at set.';
    end if;
  end if;

  return new;
end;
$$;


-- 2. Update reactivate_article() RPC with proper enum casting and metadata clearing
create or replace function public.reactivate_article(
  p_article_id uuid,
  p_target_status text default 'published'
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
  v_target_status public.article_status;
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;

  if not (public.has_permission('article.publish') or public.has_permission('article.review')) then
    raise exception 'Article publish or review permission required';
  end if;

  if p_target_status not in ('published', 'review', 'draft') then
    raise exception 'Target status must be published, review, or draft';
  end if;

  v_target_status := p_target_status::public.article_status;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if article_row.status <> 'archived' then
    raise exception 'Only inactive/archived articles can be reactivated';
  end if;

  update public.articles set
    status = v_target_status,
    published_at = case when v_target_status = 'published' then coalesce(published_at, now()) else published_at end,
    published_by = case when v_target_status = 'published' then coalesce(published_by, actor_uid) else published_by end,
    archived_at = null,
    archive_reason = null,
    archived_by = null,
    updated_at = now()
  where id = p_article_id
  returning * into article_row;

  perform public.write_audit_event(actor_uid, 'article.reactivated', 'article', p_article_id, 'success');

  return article_row;
end;
$$;

revoke all on function public.reactivate_article(uuid, text) from public;
grant execute on function public.reactivate_article(uuid, text) to authenticated;


-- =============================================
-- MIGRATION: 20261023183000_user_profile_and_author_name_sync.sql
-- =============================================

-- Migration: Self-Profile Management & Author Name Synchronization
-- Allows any authenticated staff member (superadmin, owner, admin, editor, author)
-- to view their details, update their author display name, and synchronize author attribution.

-- 1. Update articles_enforce_integrity trigger to permit author display name synchronization when session bypass is active
create or replace function public.articles_enforce_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uid uuid := (select auth.uid());
  actor_display_name text;
begin
  -- INSERT Rules
  if TG_OP = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New articles must be created as drafts.';
    end if;
    
    if actor_uid is null then
      raise exception 'Authenticated employee is required';
    end if;
    
    new.author_id := actor_uid;
    select display_name into actor_display_name from public.profiles where id = actor_uid;
    
    if actor_display_name is null then
      raise exception 'Active profile is required for article creation';
    end if;
    
    new.author_display_name := actor_display_name;
  end if;

  -- UPDATE Rules
  if TG_OP = 'UPDATE' then
    -- Author attribution immutability (except when authorized author name synchronization is active)
    if new.author_id <> old.author_id then
      raise exception 'Cannot change article author_id.';
    end if;
    if new.author_display_name <> old.author_display_name 
       and current_setting('kjin.allow_author_name_sync', true) is distinct from 'on' then
      raise exception 'Cannot change article author_display_name directly.';
    end if;

    -- Slug immutability after publication
    if old.status in ('published', 'archived') and new.slug <> old.slug then
      raise exception 'Cannot change slug of published or archived articles.';
    end if;

    -- View count protection (only allowed if bypass setting is present)
    if new.view_count <> old.view_count and current_setting('kjin.allow_view_count_update', true) is distinct from 'on' then
      raise exception 'Cannot update view_count directly. Use the RPC incrementer.';
    end if;

    -- Status Transition State Machine
    if old.status <> new.status then
      if old.status = 'archived' and new.status not in ('published', 'review', 'draft') then
        raise exception 'Archived articles can only transition to published, review, or draft.';
      elsif old.status = 'draft' and new.status <> 'review' then
        raise exception 'Drafts can only transition to review.';
      elsif old.status = 'review' and new.status not in ('draft', 'published', 'archived') then
        raise exception 'Articles in review can only transition to draft, published, or archived.';
      elsif old.status = 'published' and new.status <> 'archived' then
        raise exception 'Published articles can only transition to archived.';
      end if;
    end if;
  end if;

  -- Metadata Consistency Invariants (runs on both INSERT and UPDATE)
  if new.status in ('draft', 'review') then
    new.published_at := null;
    new.published_by := null;
    new.archived_at := null;
    new.archive_reason := null;
    new.archived_by := null;
  elsif new.status = 'published' then
    if new.published_at is null or new.published_by is null then
      raise exception 'Published articles must have published_at and published_by set.';
    end if;
    new.archived_at := null;
    new.archive_reason := null;
    new.archived_by := null;
  elsif new.status = 'archived' then
    if new.archived_at is null then
      raise exception 'Archived articles must have archived_at set.';
    end if;
  end if;

  return new;
end;
$$;


-- 2. Create update_my_profile RPC
create or replace function public.update_my_profile(
  p_display_name text,
  p_update_articles boolean default true
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uid uuid := (select auth.uid());
  profile_row public.profiles;
  cleaned_name text;
begin
  if actor_uid is null then 
    raise exception 'Authenticated employee required'; 
  end if;

  cleaned_name := trim(coalesce(p_display_name, ''));
  if length(cleaned_name) not between 1 and 120 then
    raise exception 'Display name must be 1 to 120 characters';
  end if;

  select * into profile_row from public.profiles where id = actor_uid and status = 'active';
  if not found then 
    raise exception 'Active profile not found'; 
  end if;

  -- Update own display name
  update public.profiles set
    display_name = cleaned_name,
    updated_at = now()
  where id = actor_uid
  returning * into profile_row;

  -- Synchronize author display name across authored articles if requested
  if p_update_articles then
    perform set_config('kjin.allow_author_name_sync', 'on', true);

    update public.articles set
      author_display_name = cleaned_name,
      updated_at = now()
    where author_id = actor_uid;
  end if;

  perform public.write_audit_event(
    actor_uid, 
    'employee.profile_updated', 
    'profile', 
    actor_uid, 
    'success', 
    'User updated own author display name', 
    jsonb_build_object('display_name', cleaned_name, 'articles_updated', p_update_articles)
  );

  return profile_row;
end;
$$;

revoke all on function public.update_my_profile(text, boolean) from public;
grant execute on function public.update_my_profile(text, boolean) to authenticated;


-- =============================================
-- MIGRATION: 20261023190000_storage_buckets_setup.sql
-- =============================================

-- Setup public storage buckets for article images and news media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('article-images', 'article-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']),
    ('news-media', 'news-media', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

-- Storage RLS policies
DROP POLICY IF EXISTS "Public can view article-images" ON storage.objects;
CREATE POLICY "Public can view article-images"
ON storage.objects FOR SELECT
USING (bucket_id IN ('article-images', 'news-media'));

DROP POLICY IF EXISTS "Authenticated employees can upload article-images" ON storage.objects;
CREATE POLICY "Authenticated employees can upload article-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('article-images', 'news-media'));


-- =============================================
-- MIGRATION: 20261023200000_seed_custom_ads_settings.sql
-- =============================================

-- Seed default Custom Ads & Monetization configuration in site_settings
INSERT INTO public.site_settings (key, value, description)
VALUES (
    'custom_ads',
    '{
        "monetization_enabled": true,
        "contact_email_for_ads": "advertise@kjin.org",
        "contact_phone_for_ads": "+91 194 245 7777",
        "pricing_badge": "Reach 50,000+ J&K Readers Daily",
        "placements": [
            {
                "id": "leaderboard_top",
                "name": "Homepage Top Leaderboard",
                "enabled": true,
                "sponsor_name": "Kashmir Artisans & Heritage Guild",
                "badge_label": "Official Partner",
                "title": "Authentic Hand-Knotted Silk Carpets & Pashmina Shawls",
                "description": "Geographical Indication (GI) certified crafts delivered worldwide directly from valley master craftsmen.",
                "cta_text": "Shop Verified Collection",
                "destination_url": "https://kashmircrafts.org",
                "image_url": "https://images.unsplash.com/photo-1606744888344-493238955de0?auto=format&fit=crop&w=600&q=80",
                "theme_accent": "gold"
            },
            {
                "id": "sidebar_banner",
                "name": "Sidebar Right Rail Banner",
                "enabled": true,
                "sponsor_name": "Valley MedX Diagnostic Laboratories",
                "badge_label": "Health Sponsor",
                "title": "Comprehensive 72-Parameter Full Body Health Checkup",
                "description": "NABL Accredited center at Residency Road, Srinagar. Same-day digital reports & free home sample pickup.",
                "cta_text": "Book Home Pickup",
                "destination_url": "https://valleymedx.in",
                "image_url": "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80",
                "theme_accent": "emerald"
            },
            {
                "id": "in_article_native",
                "name": "In-Article Native Sponsored Dispatch",
                "enabled": true,
                "sponsor_name": "Gulmarg Alpine Eco-Resorts",
                "badge_label": "Winter Season 2026",
                "title": "Experience First Snow in Gondola Valley: Early Bird Suites Open",
                "description": "Centrally heated pine chalets with panoramic views of Apharwat peak. Complimentary airport transfers included.",
                "cta_text": "Check Availability",
                "destination_url": "https://gulmargresorts.com",
                "image_url": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80",
                "theme_accent": "cyan"
            }
        ]
    }'::jsonb,
    'Configurable custom advertising placements, sponsor banners, and commercial revenue slots.'
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();


-- =============================================
-- MIGRATION: 20261024130000_seed_navbar_settings.sql
-- =============================================

-- Seed default Navbar & Header Navigation configuration in site_settings
INSERT INTO public.site_settings (key, value, description)
VALUES (
    'navbar_settings',
    '{
        "brand": {
            "logo_url": "/kjin-emblem.png",
            "show_logo_image": true,
            "name": "KJIN",
            "show_name": true,
            "tagline": "J&K Journal of Record",
            "show_tagline": true
        },
        "nav_items": [
            { "id": "politics", "label": "Politics", "slug": "politics", "enabled": true },
            { "id": "local", "label": "Local", "slug": "local", "enabled": true },
            { "id": "economy", "label": "Economy", "slug": "economy", "enabled": true },
            { "id": "culture", "label": "Culture", "slug": "culture", "enabled": true },
            { "id": "investigation", "label": "Investigation", "slug": "investigation", "enabled": true },
            { "id": "sports", "label": "Sports", "slug": "sports", "enabled": true },
            { "id": "international", "label": "International", "slug": "international", "enabled": true }
        ],
        "languages": {
            "enabled": true,
            "en": true,
            "ur": true,
            "ks": true,
            "hi": true
        },
        "top_strip": {
            "enabled": true,
            "show_date": true,
            "show_live_wire": true,
            "live_wire_label": "Live Verified Wire",
            "center_banner_text": "Jammu & Kashmir Journal of Record",
            "show_center_banner": true
        },
        "actions": {
            "show_regions_dropdown": true,
            "show_latest_wire_badge": true,
            "latest_wire_label": "Latest Wire",
            "show_submit_tip": true,
            "submit_tip_label": "Submit Tip",
            "submit_tip_url": "mailto:editorial@kjin.org?subject=News%20Tip%20Dispatch"
        }
    }'::jsonb,
    'Configurable public website navbar, brand identity, navigation categories, language switcher, and header tools.'
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();


-- =============================================
-- MIGRATION: 20261026120000_ai_newsroom_monitor.sql
-- =============================================

-- Migration: AI Newsroom â€” Event & Government Response Monitor
-- Integrates district event detection, official government response matching,
-- global health & humanitarian feeds, and owner-approved YouTube monitor.

BEGIN;

-- 1. Official Government & News Source Registry
CREATE TABLE IF NOT EXISTS public.newsroom_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    authority TEXT NOT NULL,
    feed_url TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'official_portal', 'api', 'youtube_channel')),
    division TEXT CHECK (division IN ('Kashmir', 'Jammu', 'Chenab Valley', 'Pir Panjal', 'Leh & Ladakh', 'National', 'Global')),
    district_slug TEXT REFERENCES public.districts(slug) ON DELETE SET NULL,
    topics TEXT[] NOT NULL DEFAULT '{}',
    collection_frequency_minutes INT NOT NULL DEFAULT 60 CHECK (collection_frequency_minutes >= 5),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_successful_check TIMESTAMPTZ,
    last_error TEXT,
    collection_status TEXT NOT NULL DEFAULT 'idle' CHECK (collection_status IN ('idle', 'checking', 'healthy', 'error', 'unreachable')),
    attribution_terms TEXT,
    youtube_channel_id TEXT,
    is_owner_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for source lookups
CREATE INDEX IF NOT EXISTS idx_newsroom_sources_type ON public.newsroom_sources (source_type);
CREATE INDEX IF NOT EXISTS idx_newsroom_sources_district ON public.newsroom_sources (district_slug);
CREATE INDEX IF NOT EXISTS idx_newsroom_sources_active ON public.newsroom_sources (is_active);

-- 2. Detected Events Table
CREATE TABLE IF NOT EXISTS public.newsroom_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    district_slug TEXT REFERENCES public.districts(slug) ON DELETE SET NULL,
    division TEXT CHECK (division IN ('Kashmir', 'Jammu', 'Chenab Valley', 'Pir Panjal', 'Leh & Ladakh', 'National', 'Global')),
    location_name TEXT,
    event_category TEXT NOT NULL DEFAULT 'public_safety' CHECK (event_category IN (
        'accidents',
        'road_closures',
        'weather_disaster',
        'public_safety',
        'school_closures',
        'public_services',
        'demonstrations_restrictions',
        'administration',
        'public_health',
        'global_humanitarian',
        'general'
    )),
    event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verification_status TEXT NOT NULL DEFAULT 'unverified_report' CHECK (verification_status IN (
        'unverified_report',
        'confirmed_event',
        'official_announcement'
    )),
    original_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    uncertainty_flags TEXT[] NOT NULL DEFAULT '{}',
    editor_notes TEXT,
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
        'discovered',
        'reviewed',
        'draft_approved',
        'drafted',
        'dismissed'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsroom_events_district ON public.newsroom_events (district_slug);
CREATE INDEX IF NOT EXISTS idx_newsroom_events_category ON public.newsroom_events (event_category);
CREATE INDEX IF NOT EXISTS idx_newsroom_events_status ON public.newsroom_events (status);
CREATE INDEX IF NOT EXISTS idx_newsroom_events_detected ON public.newsroom_events (detected_at DESC);

-- 3. Matched Official Government Responses Table
CREATE TABLE IF NOT EXISTS public.newsroom_official_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.newsroom_events(id) ON DELETE CASCADE,
    source_id UUID REFERENCES public.newsroom_sources(id) ON DELETE SET NULL,
    authority_name TEXT NOT NULL,
    document_title TEXT,
    document_url TEXT,
    published_at TIMESTAMPTZ,
    response_type TEXT CHECK (response_type IN (
        'order',
        'advisory',
        'public_notice',
        'press_release',
        'police_statement',
        'traffic_advisory',
        'disaster_alert',
        'clarification',
        'none'
    )),
    match_status TEXT NOT NULL CHECK (match_status IN (
        'confirmed_relevant',
        'possible_match',
        'no_official_update',
        'check_failed'
    )),
    match_explanation TEXT NOT NULL,
    extracted_text_excerpt TEXT,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsroom_responses_event ON public.newsroom_official_responses (event_id);
CREATE INDEX IF NOT EXISTS idx_newsroom_responses_status ON public.newsroom_official_responses (match_status);

-- 4. Fact-Checking Checklist Table
CREATE TABLE IF NOT EXISTS public.newsroom_fact_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.newsroom_events(id) ON DELETE CASCADE,
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    claim TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN (
        'unverified',
        'verified',
        'flagged_disputed'
    )),
    source_reference_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsroom_fact_checks_event ON public.newsroom_fact_checks (event_id);
CREATE INDEX IF NOT EXISTS idx_newsroom_fact_checks_article ON public.newsroom_fact_checks (article_id);

-- 5. Seed Verified Official Government & Health Sources
INSERT INTO public.newsroom_sources (
    name, authority, feed_url, source_type, division, district_slug, topics, is_active, attribution_terms
) VALUES
(
    'District Doda Administration',
    'District Magistrate & Administration, Doda',
    'https://doda.gov.in/',
    'official_portal',
    'Chenab Valley',
    'doda',
    ARRAY['road_closures', 'weather_disaster', 'school_closures', 'public_safety', 'administration'],
    true,
    'Official district administration portal notices and advisories.'
),
(
    'District Kishtwar Administration',
    'District Magistrate & Administration, Kishtwar',
    'https://kishtwar.nic.in/',
    'official_portal',
    'Chenab Valley',
    'kishtwar',
    ARRAY['road_closures', 'weather_disaster', 'public_safety', 'administration'],
    true,
    'Official district portal for Chenab Valley regional notices.'
),
(
    'J&K General Administration Department (GAD)',
    'Government of Jammu & Kashmir',
    'https://jkgad.nic.in/',
    'official_portal',
    'National',
    NULL,
    ARRAY['administration', 'public_services', 'school_closures'],
    true,
    'Official administrative orders and gazette notifications.'
),
(
    'J&K Police Official Statements',
    'Jammu & Kashmir Police HQ',
    'https://jkpolice.gov.in/',
    'official_portal',
    'National',
    NULL,
    ARRAY['accidents', 'public_safety', 'demonstrations_restrictions'],
    true,
    'Official police statements and law-and-order press bulletins.'
),
(
    'India Meteorological Department (IMD J&K)',
    'IMD Meteorological Centre Srinagar / Jammu',
    'https://mausam.imd.gov.in/',
    'official_portal',
    'National',
    NULL,
    ARRAY['weather_disaster', 'public_safety'],
    true,
    'Weather forecasts, flash flood warnings, and snowfall advisories.'
),
(
    'Press Information Bureau (PIB) J&K Regional',
    'PIB Ministry of Information & Broadcasting',
    'https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1',
    'rss',
    'National',
    NULL,
    ARRAY['administration', 'public_services', 'public_health', 'weather_disaster'],
    true,
    'Official PIB RSS feed. Attribution: PIB Government of India.'
),
(
    'WHO Disease Outbreak News',
    'World Health Organization (WHO)',
    'https://www.who.int/emergencies/disease-outbreak-news',
    'official_portal',
    'Global',
    NULL,
    ARRAY['public_health', 'global_humanitarian'],
    true,
    'Official WHO epidemiological alerts and disease outbreak surveillance.'
),
(
    'UN News Global Human Rights & Humanitarian',
    'United Nations',
    'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    'rss',
    'Global',
    NULL,
    ARRAY['global_humanitarian', 'public_health'],
    true,
    'UN News public RSS feed. Attribution: United Nations.'
)
ON CONFLICT (feed_url) DO UPDATE SET
    authority = EXCLUDED.authority,
    topics = EXCLUDED.topics,
    attribution_terms = EXCLUDED.attribution_terms;

-- 6. RLS Security Policies
ALTER TABLE public.newsroom_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsroom_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsroom_official_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsroom_fact_checks ENABLE ROW LEVEL SECURITY;

-- Allow editors, admins, superadmins, and owners to view & manage
DROP POLICY IF EXISTS "Newsroom staff access sources" ON public.newsroom_sources;
CREATE POLICY "Newsroom staff access sources"
ON public.newsroom_sources FOR ALL TO authenticated
USING (public.has_permission('article.review'));

DROP POLICY IF EXISTS "Newsroom staff access events" ON public.newsroom_events;
CREATE POLICY "Newsroom staff access events"
ON public.newsroom_events FOR ALL TO authenticated
USING (public.has_permission('article.review'));

DROP POLICY IF EXISTS "Newsroom staff access responses" ON public.newsroom_official_responses;
CREATE POLICY "Newsroom staff access responses"
ON public.newsroom_official_responses FOR ALL TO authenticated
USING (public.has_permission('article.review'));

DROP POLICY IF EXISTS "Newsroom staff access fact checks" ON public.newsroom_fact_checks;
CREATE POLICY "Newsroom staff access fact checks"
ON public.newsroom_fact_checks FOR ALL TO authenticated
USING (public.has_permission('article.review'));

COMMIT;


-- =============================================
-- MIGRATION: 20261026140000_editorial_scopes_and_navbar_national.sql
-- =============================================

-- Migration: 20261026140000_editorial_scopes_and_navbar_national.sql
-- Description: Enforce strict editorial 3-way scoping (Jammu & Kashmir, National India, International)
--              Add National and International taxonomy categories, seed national & global stories,
--              and configure the navbar with NATIONAL (/india) and INTERNATIONAL (/international).

-- 1. Ensure National and International categories exist in public.categories
INSERT INTO public.categories (slug, name_en, description, display_order, is_active)
VALUES 
    ('national', 'National', 'Pan-India developments, union policy, national economy, courts, and inter-state affairs.', 1, true),
    ('international', 'International', 'Global developments, diaspora connections, trade diplomacy, and cross-border relations.', 2, true)
ON CONFLICT (slug) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = now();

-- 2. Clean up existing article scopes to prevent bleed
-- Ensure Yemen and Sudan are classified strictly as International with no district
UPDATE public.articles
SET category = 'International',
    district = NULL,
    category_id = (SELECT id FROM public.categories WHERE slug = 'international' LIMIT 1),
    updated_at = now()
WHERE id IN (
    '4c67dddb-ee93-4df0-8847-a8697e483d6f'::uuid, -- Yemen Taiz
    'c08b3eba-131a-4ec9-af71-d877c6a68062'::uuid  -- Sudan drone strikes
);

-- Re-categorize local J&K academic/diaspora stories that had 'International' to their proper J&K categories
UPDATE public.articles
SET category = 'Environment',
    district = 'anantnag',
    category_id = (SELECT id FROM public.categories WHERE slug = 'general' LIMIT 1),
    updated_at = now()
WHERE id = '1b9ccb4d-0218-40a5-a4ff-53eda1ff3fe4'::uuid;

UPDATE public.articles
SET category = 'Culture',
    district = 'srinagar',
    category_id = (SELECT id FROM public.categories WHERE slug = 'culture' LIMIT 1),
    updated_at = now()
WHERE id = '612116f9-bd25-41ef-af03-f3008761e19e'::uuid;

-- 3. Seed Verified Indian National News Articles (/india) and Global Stories (/international)
SET session_replication_role = 'replica';

DO $$
DECLARE
    v_author_id uuid;
    v_nat_cat_id uuid;
    v_intl_cat_id uuid;
BEGIN
    SELECT id INTO v_author_id FROM public.profiles WHERE status = 'active' ORDER BY created_at ASC LIMIT 1;
    SELECT id INTO v_nat_cat_id FROM public.categories WHERE slug = 'national' LIMIT 1;
    SELECT id INTO v_intl_cat_id FROM public.categories WHERE slug = 'international' LIMIT 1;

    -- National Article 1: Supreme Court Water Sharing
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'supreme-court-constitution-bench-inter-state-water-sharing',
        'Supreme Court Constitution Bench Upholds Inter-State River Water Sharing Framework in Landmark Ruling',
        'A five-judge Constitution bench has affirmed the primacy of federal equitable apportionment principles, establishing binding dispute-resolution timelines for inter-state river basins.',
        '<h2>Constitutional Ruling</h2><p><strong>NEW DELHI</strong> â€” A five-judge Constitution Bench of the Supreme Court of India delivered a unanimous verdict on Tuesday upholding the constitutional primacy of the Union framework for equitable apportionment in inter-state river basin disputes.</p><p>The judgment, authored by the bench, established definitive guidelines governing water allocation during deficit monsoon cycles, ruling that downstream riparian rights must be harmonized with upper riparian ecological minimums under Article 262 of the Constitution.</p><h2>Institutional Mechanism</h2><p>The bench directed the Ministry of Jal Shakti to operationalize continuous real-time telemetry monitoring along major inter-state river networks within six months, ensuring transparent data sharing among riparian states.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN National Desk',
        now() - interval '2 hours',
        v_author_id,
        now() - interval '3 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- National Article 2: ISRO Gaganyaan Propulsion Test
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'isro-heavy-lift-launch-vehicle-gaganyaan-orbital-test',
        'ISRO Completes Full-Duration Propulsion Test for Next-Generation Heavy-Lift Vehicle Ahead of Gaganyaan Mission',
        'The Indian Space Research Organisation has successfully qualified the cryogenic upper stage engine at Mahendragiri, clearing the path for the upcoming uncrewed orbital test flight.',
        '<h2>Propulsion Milestone</h2><p><strong>BENGALURU</strong> â€” The Indian Space Research Organisation (ISRO) successfully concluded a 720-second hot-fire endurance test of the CE-20 cryogenic engine at the ISRO Propulsion Complex in Mahendragiri, Tamil Nadu.</p><p>The test verified nominal performance parameters across vacuum conditions, clearing the propulsion system for flight qualification on the LVM3 heavy-lift vehicle designated for the Gaganyaan-1 uncrewed orbital demonstration mission.</p><h2>Mission Readiness</h2><p>Senior mission scientists confirmed that all flight telemetry matched pre-test mathematical models, with the crew module environmental control and life-support systems scheduled for integrated drop tests later this quarter.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN Science & National Desk',
        now() - interval '5 hours',
        v_author_id,
        now() - interval '6 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- National Article 3: Reserve Bank Repo Rate Policy
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'rbi-monetary-policy-repo-rate-economic-growth',
        'Reserve Bank of India Retains Policy Repo Rate at 6.50 Percent Amid Resilient National Economic Growth',
        'The Monetary Policy Committee unanimously maintained the benchmark policy rate, projecting 7.2 percent real GDP growth supported by sustained manufacturing and capital expenditure.',
        '<h2>Monetary Policy Dispatch</h2><p><strong>MUMBAI</strong> â€” The Monetary Policy Committee (MPC) of the Reserve Bank of India concluded its bi-monthly review on Wednesday, deciding by unanimous consensus to hold the policy repo rate unchanged at 6.50 percent.</p><p>Reserve Bank Governor stated in the monetary policy dispatch that steady disinflation alongside robust domestic consumption supports macroeconomic stability, maintaining the national real GDP growth projection for the fiscal year at 7.2 percent.</p><h2>Liquidity and Inflation Outlook</h2><p>The central bank emphasized its commitment to withdrawal of accommodation to align headline CPI inflation durably with the 4 percent target while ensuring adequate credit flow to productive commercial sectors.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN Economy Desk',
        now() - interval '8 hours',
        v_author_id,
        now() - interval '9 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- National Article 4: Ministry of Finance Freight Corridors
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'ministry-finance-infrastructure-capital-outlay-freight-corridors',
        'Ministry of Finance Allocates Record Capital Outlay for Pan-India Dedicated Freight Corridors',
        'Union finance officials unveiled targeted allocations accelerating modern logistics corridors, multitrack electrification, and port connectivity nodes across twelve states.',
        '<h2>Infrastructure Development</h2><p><strong>NEW DELHI</strong> â€” The Union Ministry of Finance has sanctioned targeted disbursements totaling Rs 48,000 crore to fast-track construction milestones across the Eastern and Western Dedicated Freight Corridors.</p><p>The capital infusion aims to link inland multi-modal logistics parks with coastal maritime ports, reducing average container transit times between northern manufacturing hubs and western seaports by more than 40 percent.</p><h2>National Logistics Efficiency</h2><p>Industry stakeholders welcomed the infrastructure impetus, noting that improved freight velocity will significantly compress logistics costs as a percentage of gross domestic output.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN National Desk',
        now() - interval '12 hours',
        v_author_id,
        now() - interval '13 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- National Article 5: Parliamentary Committee on AI Framework
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'parliament-standing-committee-national-ai-governance-framework',
        'Parliamentary Standing Committee Submits Comprehensive National Artificial Intelligence Governance Framework',
        'The cross-party parliamentary panel recommended statutory safeguards on algorithmic transparency, data sovereignty, and responsible enterprise computing.',
        '<h2>Legislative Review</h2><p><strong>NEW DELHI</strong> â€” The Parliamentary Standing Committee on Communications and Information Technology tabled its final report on national artificial intelligence governance before both houses of Parliament on Thursday.</p><p>The report outlines a risk-tiered regulatory matrix requiring mandatory algorithmic audits for high-impact decision systems in healthcare, banking, and public law enforcement, while preserving regulatory sandboxes for domestic startups.</p><h2>Data Sovereignty & Protections</h2><p>The committee urged statutory coordination between the Data Protection Board and sector-specific regulators to ensure citizen privacy safeguards are rigorously enforced.</p>',
        'National',
        v_nat_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN Policy Bureau',
        now() - interval '16 hours',
        v_author_id,
        now() - interval '17 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'National',
        district = NULL,
        category_id = v_nat_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- International Article 1: UN Climate Summit
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'un-climate-summit-geneva-renewable-energy-pact',
        'United Nations Climate Summit in Geneva Adopts High-Ambition Global Renewable Energy Transition Pact',
        'Delegates from 140 nations ratified an operational framework committing multilateral climate finance to developing grid infrastructure and international clean-energy storage.',
        '<h2>Multilateral Accord</h2><p><strong>GENEVA</strong> â€” Delegates representing more than 140 sovereign states adopted the Geneva Energy Compact at the conclusion of five-day United Nations environmental negotiations in Switzerland.</p><p>The agreement establishes an international pooled risk-guarantee facility designed to de-risk commercial capital investments in high-capacity solar, wind, and battery storage infrastructure across developing nations.</p><h2>Global Grid Modernization</h2><p>United Nations environmental officials praised the multilateral consensus, calling the binding monitoring mechanisms a pivotal benchmark for international climate diplomacy.</p>',
        'International',
        v_intl_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN Global Desk',
        now() - interval '4 hours',
        v_author_id,
        now() - interval '5 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'International',
        district = NULL,
        category_id = v_intl_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

    -- International Article 2: ICJ Maritime Boundary Ruling
    INSERT INTO public.articles (
        slug, title, excerpt, content, category, category_id, district, status, author_id, author_display_name, published_at, published_by, created_at, updated_at
    ) VALUES (
        'icj-ruling-sovereign-maritime-boundaries-eez-protection',
        'International Court of Justice Delivers Landmark Judgment on Sovereign Maritime Boundaries and EEZ Rights',
        'The principal judicial organ of the United Nations defined binding delimitation methodology for disputed exclusive economic zones, strengthening international maritime order.',
        '<h2>International Jurisprudence</h2><p><strong>THE HAGUE</strong> â€” The International Court of Justice (ICJ) at the Peace Palace in The Hague rendered a landmark judgment on Monday adjudicating a long-standing maritime delimitation dispute regarding overlapping exclusive economic zones.</p><p>By a 14-to-1 majority, the court applied the standard three-stage delimitation methodology, establishing a provisional equidistance line adjusted for coastal geography and proportionality.</p><h2>Sovereign Rights Protected</h2><p>Both litigant governments released joint communiquÃ©s pledging full compliance with the final and non-appealable judgment, underscoring the authority of peaceful international adjudication under the UN Charter.</p>',
        'International',
        v_intl_cat_id,
        NULL,
        'published',
        v_author_id,
        'KJIN International Affairs',
        now() - interval '7 hours',
        v_author_id,
        now() - interval '8 hours',
        now()
    ) ON CONFLICT (slug) DO UPDATE SET
        category = 'International',
        district = NULL,
        category_id = v_intl_cat_id,
        status = 'published',
        published_at = EXCLUDED.published_at,
        updated_at = now();

END $$;

RESET session_replication_role;

-- 4. Update site_settings.navbar_settings to show NATIONAL (/india) and INTERNATIONAL (/international)
UPDATE public.site_settings
SET value = jsonb_set(
    jsonb_set(
        value,
        '{nav_items}',
        '[
            { "id": "national", "label": "NATIONAL", "slug": "india", "enabled": true },
            { "id": "international", "label": "INTERNATIONAL", "slug": "international", "enabled": true },
            { "id": "politics", "label": "Politics", "slug": "politics", "enabled": false },
            { "id": "local", "label": "Local", "slug": "local", "enabled": false },
            { "id": "economy", "label": "Economy", "slug": "economy", "enabled": false },
            { "id": "culture", "label": "Culture", "slug": "culture", "enabled": false },
            { "id": "investigation", "label": "Investigation", "slug": "investigation", "enabled": false },
            { "id": "sports", "label": "Sports", "slug": "sports", "enabled": false }
        ]'::jsonb
    ),
    '{actions,show_regions_dropdown}',
    'true'::jsonb
),
updated_at = now()
WHERE key = 'navbar_settings';


-- =============================================
-- MIGRATION: 20261026160000_fix_newsroom_draft_permissions_and_service_fallback.sql
-- =============================================

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
            -- Editorial standard draft operations do not require MFA level 2
            p_permission_key IN ('article.create', 'article.review', 'article.submit_review')
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


-- =============================================
-- MIGRATION: 20261026170000_fix_profiles_permission_and_align_publish_mfa.sql
-- =============================================

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


-- =============================================
-- MIGRATION: 20261028140000_revoke_all_sessions_rpc.sql
-- =============================================

-- Function to securely revoke all sessions and refresh tokens across all devices for a given user
CREATE OR REPLACE FUNCTION public.revoke_all_user_sessions(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_sessions_count INT := 0;
  deleted_tokens_count INT := 0;
BEGIN
  -- Delete all refresh tokens for this user
  DELETE FROM auth.refresh_tokens
  WHERE user_id = target_user_id::text
     OR session_id IN (SELECT id FROM auth.sessions WHERE user_id = target_user_id);
  GET DIAGNOSTICS deleted_tokens_count = ROW_COUNT;

  -- Delete all active sessions for this user
  DELETE FROM auth.sessions
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_sessions_count = ROW_COUNT;

  -- Update profiles updated_at
  UPDATE public.profiles
  SET updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'sessions_revoked', deleted_sessions_count,
    'tokens_revoked', deleted_tokens_count,
    'revoked_at', NOW()
  );
END;
$$;

-- Secure the RPC function: Only service_role can call this function directly
REVOKE ALL ON FUNCTION public.revoke_all_user_sessions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_all_user_sessions(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_all_user_sessions(UUID) TO postgres;


-- =============================================
-- MIGRATION: 20261029170000_strict_delete_and_activity_audit.sql
-- =============================================


-- Migration: Strict Article Deletion Protection and Comprehensive Activity Audit
-- Enforces:
-- 1. ONLY 'owner', 'superadmin', and 'admin' can delete articles. 'author' and 'editor' are strictly forbidden.
-- 2. Comprehensive details in audit_logs for article creation, updates, deletions, and status changes.
-- 3. Database-level trigger preventing deletion by non-admin roles even on raw SQL or direct client queries.

-- 1. Clean role_permissions to guarantee 'editor' and 'author' never have article.delete
delete from public.role_permissions 
where permission_key = 'article.delete' 
  and role_key not in ('owner', 'superadmin', 'admin');

-- 2. Update delete_article RPC with strict role verification and detailed audit logging
drop function if exists public.delete_article(uuid) cascade;
drop function if exists public.delete_article(uuid, text) cascade;

create or replace function public.delete_article(
  p_article_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
  actor_role text;
begin
  if actor_uid is null then 
    raise exception 'Authenticated employee required'; 
  end if;

  -- Look up actor role
  select role_key into actor_role from public.profiles where id = actor_uid;

  -- Strictly verify role and permission: only owner, superadmin, and admin
  if actor_role is null or actor_role not in ('owner', 'superadmin', 'admin') or not public.has_permission('article.delete') then
    -- Record unauthorized deletion attempt in audit_logs so superadmins and owners are alerted!
    perform public.write_audit_event(
      actor_uid,
      'article.delete_attempt_blocked',
      'article',
      p_article_id,
      'denied',
      'Authors and editors are strictly forbidden from deleting articles',
      jsonb_build_object(
        'attempted_by_role', coalesce(actor_role, 'unknown'),
        'reason', coalesce(p_reason, 'No reason provided')
      )
    );
    raise exception 'Only owners, superadmins, and admins can delete articles';
  end if;

  -- Lock the article for deletion
  select * into article_row from public.articles where id = p_article_id for update;
  if not found then 
    raise exception 'Article not found'; 
  end if;

  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'MFA (AAL2) is strictly required to delete articles';
  end if;

  -- Write rich audit event before deleting to preserve the full record for owner/superadmin review
  perform public.write_audit_event(
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

  -- Delete cascades to article_versions, article_translations, and article_views_log
  delete from public.articles where id = p_article_id;

  return true;
end;
$$;

revoke all on function public.delete_article(uuid, text) from public;
grant execute on function public.delete_article(uuid, text) to authenticated;


-- 3. Database Trigger: Enforce Delete Protection directly on public.articles
create or replace function public.trg_enforce_article_delete_protection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uid uuid := (select auth.uid());
  actor_role text;
begin
  -- If invoked in an authenticated context
  if actor_uid is not null then
    select role_key into actor_role from public.profiles where id = actor_uid;
    if actor_role is not null and actor_role not in ('owner', 'superadmin', 'admin') then
      -- Record blocked delete attempt in audit_logs
      perform public.write_audit_event(
        actor_uid,
        'article.delete_attempt_blocked',
        'article',
        OLD.id,
        'denied',
        'Authors and editors cannot delete articles',
        jsonb_build_object(
          'title', OLD.title,
          'category', OLD.category,
          'attempted_by_role', actor_role
        )
      );
      raise exception 'Only owners, superadmins, and admins can delete articles';
    end if;
  end if;
  return OLD;
end;
$$;

drop trigger if exists trg_articles_delete_protection on public.articles;
create trigger trg_articles_delete_protection
  before delete on public.articles
  for each row
  execute function public.trg_enforce_article_delete_protection();


-- 4. Update update_article RPC with rich before/after audit details
create or replace function public.update_article(
  p_article_id uuid,
  p_title text,
  p_excerpt text,
  p_content text,
  p_slug text,
  p_district text default null,
  p_category text default 'General',
  p_source_name text default null,
  p_source_url text default null,
  p_featured_image_url text default null
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  next_version integer;
  actor_uid uuid := (select auth.uid());
  actor_role text;
  has_review_permission boolean;
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;

  has_review_permission := public.has_permission('article.review');
  select role_key into actor_role from public.profiles where id = actor_uid;

  -- Lock the row for update
  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  -- Verify update authorization:
  -- Reviewers and editors can update articles in draft, review, published, or archived state
  -- Authors can update their own drafts
  if not (
    (has_review_permission and article_row.status in ('draft', 'review', 'published', 'archived')) or
    (article_row.author_id = actor_uid and article_row.status = 'draft' and public.has_permission('article.create'))
  ) then
    raise exception 'Unauthorized to edit this article in its current state';
  end if;

  -- Calculate next version number
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.article_versions
  where article_id = p_article_id;

  -- Update article
  update public.articles set
    title = p_title,
    excerpt = p_excerpt,
    content = p_content,
    slug = p_slug,
    district = p_district,
    category = p_category,
    source_name = p_source_name,
    source_url = p_source_url,
    featured_image_url = p_featured_image_url,
    updated_at = now()
  where id = p_article_id
  returning * into article_row;

  -- Create immutable version record
  insert into public.article_versions (
    article_id, version_number, title, excerpt, content, edited_by
  ) values (
    p_article_id, next_version, p_title, p_excerpt, p_content, actor_uid
  );

  -- Write comprehensive audit log with changed details
  perform public.write_audit_event(
    actor_uid,
    'article.updated',
    'article',
    p_article_id,
    'success',
    '',
    jsonb_build_object(
      'title', p_title,
      'category', p_category,
      'district', p_district,
      'slug', p_slug,
      'version', next_version,
      'role', actor_role,
      'status', article_row.status
    )
  );

  return article_row;
end;
$$;

revoke all on function public.update_article(uuid, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.update_article(uuid, text, text, text, text, text, text, text, text, text) to authenticated;


-- 5. Update create_article RPC with rich audit details
create or replace function public.create_article(
  p_title text,
  p_excerpt text,
  p_content text,
  p_slug text,
  p_district text default null,
  p_category text default 'General',
  p_source_name text default null,
  p_source_url text default null,
  p_featured_image_url text default null
)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
  actor_uid uuid := (select auth.uid());
  actor_role text;
begin
  if actor_uid is null then
    raise exception 'Authenticated employee required';
  end if;

  if not public.has_permission('article.create') then
    raise exception 'Article creation permission required';
  end if;

  select role_key into actor_role from public.profiles where id = actor_uid;

  insert into public.articles (
    title, excerpt, content, slug, district, category, 
    source_name, source_url, featured_image_url, status
  )
  values (
    p_title, p_excerpt, p_content, p_slug, p_district, p_category,
    p_source_name, p_source_url, p_featured_image_url, 'draft'
  )
  returning * into article_row;

  insert into public.article_versions (
    article_id, version_number, title, excerpt, content, edited_by
  ) values (
    article_row.id, 1, p_title, p_excerpt, p_content, actor_uid
  );

  perform public.write_audit_event(
    actor_uid,
    'article.created',
    'article',
    article_row.id,
    'success',
    '',
    jsonb_build_object(
      'title', article_row.title,
      'slug', article_row.slug,
      'category', article_row.category,
      'district', article_row.district,
      'role', actor_role
    )
  );

  return article_row;
end;
$$;

revoke all on function public.create_article(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_article(text, text, text, text, text, text, text, text, text) to authenticated;


-- =============================================
-- MIGRATION: 20261029190000_youtube_news_monitoring.sql
-- =============================================

-- Migration: YouTube News Monitoring System
-- Creates youtube_sources and youtube_videos tables with unique constraints,
-- seeds the initial 4 channels, and sets up RLS and indexes.

BEGIN;

-- 1. YouTube Sources Registry
CREATE TABLE IF NOT EXISTS public.youtube_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_name TEXT NOT NULL,
    channel_url TEXT NOT NULL UNIQUE,
    channel_id TEXT NOT NULL UNIQUE,
    country TEXT NOT NULL DEFAULT 'India',
    region TEXT NOT NULL DEFAULT 'Global',
    language TEXT NOT NULL DEFAULT 'Hindi / Urdu / English',
    category TEXT NOT NULL DEFAULT 'General News',
    is_active BOOLEAN NOT NULL DEFAULT true,
    collection_frequency_minutes INT NOT NULL DEFAULT 60 CHECK (collection_frequency_minutes >= 5),
    last_checked_at TIMESTAMPTZ,
    last_video_published_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for source lookups
CREATE INDEX IF NOT EXISTS idx_youtube_sources_active ON public.youtube_sources (is_active);
CREATE INDEX IF NOT EXISTS idx_youtube_sources_channel_id ON public.youtube_sources (channel_id);

-- 2. YouTube Ingested Videos & Deduplication Table
CREATE TABLE IF NOT EXISTS public.youtube_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.youtube_sources(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL UNIQUE, -- Primary deduplication constraint
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    video_url TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'discovered' CHECK (processing_status IN (
        'discovered',
        'analyzing',
        'draft_proposed',
        'approved',
        'rejected',
        'manual_review_needed',
        'failed'
    )),
    transcript_text TEXT,
    has_transcript BOOLEAN NOT NULL DEFAULT false,
    ai_analysis JSONB DEFAULT '{}'::jsonb,
    proposed_headline TEXT,
    proposed_summary TEXT,
    proposed_category TEXT,
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    last_error TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_video_id ON public.youtube_videos (video_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_status ON public.youtube_videos (processing_status);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON public.youtube_videos (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_source ON public.youtube_videos (source_id);

-- 3. Job Lock Table for Scheduled Worker
CREATE TABLE IF NOT EXISTS public.youtube_worker_locks (
    lock_name TEXT PRIMARY KEY,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_by TEXT NOT NULL
);

-- 4. Seed Initial 4 Monitored Channels
INSERT INTO public.youtube_sources (
    channel_name, channel_url, channel_id, country, region, language, category, is_active
) VALUES
(
    'Abhisar Sharma',
    'https://www.youtube.com/@abhisar_sharma',
    'UCfA29qhHnOQrEr7yjHsP9Jw',
    'India',
    'National',
    'Hindi',
    'National Affairs & Analysis',
    true
),
(
    'RazaGraphy',
    'https://www.youtube.com/@razagraphy',
    'UCDZ8phcfP-ocrYfl-S1VvIA',
    'India',
    'Jammu & Kashmir / Chenab Valley',
    'Urdu / Hindi',
    'Current Affairs & Regional Reporting',
    true
),
(
    'Gulistan News',
    'https://www.youtube.com/@gulistannewschannel',
    'UCk7rHVFVs1Uf_dDOPKc2l0Q',
    'India',
    'Jammu & Kashmir / Ladakh',
    'Urdu / Kashmiri / Hindi',
    'State & Regional Broadcast',
    true
),
(
    'Greater Kashmir',
    'https://www.youtube.com/@GreaterKashmirvideo',
    'UCmzsSbFbWqDRNDem1idwNyQ',
    'India',
    'Jammu & Kashmir',
    'English / Kashmiri / Urdu',
    'State News & Interviews',
    true
)
ON CONFLICT (channel_id) DO UPDATE SET
    channel_name = EXCLUDED.channel_name,
    channel_url = EXCLUDED.channel_url,
    updated_at = now();

-- 5. Row Level Security Policies
ALTER TABLE public.youtube_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_worker_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read youtube sources" ON public.youtube_sources;
CREATE POLICY "Staff read youtube sources"
ON public.youtube_sources FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage youtube sources" ON public.youtube_sources;
CREATE POLICY "Admins manage youtube sources"
ON public.youtube_sources FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role_key IN ('owner', 'superadmin', 'admin')
        AND p.status = 'active'
    )
);

DROP POLICY IF EXISTS "Staff read youtube videos" ON public.youtube_videos;
CREATE POLICY "Staff read youtube videos"
ON public.youtube_videos FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Staff manage youtube videos" ON public.youtube_videos;
CREATE POLICY "Staff manage youtube videos"
ON public.youtube_videos FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role_key IN ('owner', 'superadmin', 'admin', 'editor')
        AND p.status = 'active'
    )
);

DROP POLICY IF EXISTS "Worker manage locks" ON public.youtube_worker_locks;
CREATE POLICY "Worker manage locks"
ON public.youtube_worker_locks FOR ALL TO authenticated
USING (true);

COMMIT;


-- =============================================
-- MIGRATION: 20261114165000_seed_festive_celebration.sql
-- =============================================

-- Seed default Festive & Occasion Celebration configuration in site_settings
INSERT INTO public.site_settings (key, value, description)
VALUES (
    'festive_celebration',
    '{
        "enabled": true,
        "force_active_now": true,
        "mode": "scheduled",
        "start_date": "2026-11-14T00:00",
        "end_date": "2026-11-14T23:59",
        "occasion_name": "Diwali â€” Festival of Lights",
        "greeting_title": "Happy Deepavali to All!",
        "greeting_message": "May the festival of lights bring peace, brightness, and warmth to every home across Jammu & Kashmir and Ladakh.",
        "effect_type": "firelight_sparkles",
        "colors": ["#F59E0B", "#EF4444", "#FBBF24", "#D97706", "#10B981"],
        "duration_seconds": 8,
        "play_frequency": "always",
        "show_greeting_banner": true,
        "sound_enabled": false
    }'::jsonb,
    'Festive celebration overlay, firelight particle effects, and cultural greetings'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();


