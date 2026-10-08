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
alter table public.articles
  add column slug text,
  rename column summary to excerpt;

alter table public.articles
  rename column body to content;

alter table public.articles
  add column district text,
  add column category text,
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
