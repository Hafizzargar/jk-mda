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
