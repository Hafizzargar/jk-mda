-- Step 1: Alter existing articles table to match new schema
-- We preserve the table so that dependent policies and RLS remain attached, 
-- but we drop functions that use the old schema since they need rewriting.

drop function if exists public.create_article cascade;
drop function if exists public.transition_article_status cascade;
drop function if exists public.submit_article_for_review cascade;

-- Clear any dummy data to allow structural changes
truncate table public.articles cascade;

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
  add column view_count bigint not null default 0;

-- We don't need language as a column if we are moving to translations later, 
-- or we can leave it for now. We will drop language and author to match the spec.
alter table public.articles
  drop column language,
  drop column author;

-- Make slug and author_display_name required
alter table public.articles
  alter column slug set not null,
  add constraint articles_slug_key unique (slug),
  alter column author_display_name set not null;

-- Step 2: Create article_versions
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

-- Step 3: Indexes & Constraints
create index if not exists idx_article_versions_article_id on public.article_versions(article_id);
create index if not exists idx_articles_slug on public.articles(slug);
create index if not exists idx_articles_author_id on public.articles(author_id);
-- status index already exists from previous migration

-- Step 4: RLS Policies for article_versions
create policy "Editors can view all versions, authors can view their own"
on public.article_versions for select to authenticated
using (
  public.has_permission('article.review') or
  (exists (select 1 from public.articles a where a.id = article_id and a.author_id = (select auth.uid())))
);

create policy "Editors and authors can create versions"
on public.article_versions for insert to authenticated
with check (
  public.has_permission('article.review') or
  (exists (select 1 from public.articles a where a.id = article_id and a.author_id = (select auth.uid())))
);

-- Note: No update or delete policies on article_versions. Versions are immutable.

-- Step 5: State-transition trigger
create or replace function public.check_article_status_transition()
returns trigger
language plpgsql
as $$
begin
  -- If it's a new article, it must be a draft
  if TG_OP = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New articles must be created as drafts.';
    end if;
    return new;
  end if;

  -- Allow updates that don't change the status
  if old.status = new.status then
    return new;
  end if;

  -- Terminal state check
  if old.status = 'archived' then
    raise exception 'Archived articles cannot change status.';
  end if;

  -- Draft transitions
  if old.status = 'draft' then
    if new.status = 'review' then return new; end if;
    raise exception 'Drafts can only transition to review.';
  end if;

  -- Review transitions
  if old.status = 'review' then
    if new.status in ('draft', 'published', 'archived') then return new; end if;
    raise exception 'Articles in review can only transition to draft, published, or archived.';
  end if;

  -- Published transitions
  if old.status = 'published' then
    if new.status = 'archived' then return new; end if;
    raise exception 'Published articles can only transition to archived.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_article_status_transition on public.articles;
create trigger enforce_article_status_transition
before insert or update on public.articles
for each row
execute function public.check_article_status_transition();
