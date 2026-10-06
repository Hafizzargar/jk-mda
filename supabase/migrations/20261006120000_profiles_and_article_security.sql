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
