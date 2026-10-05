create type public.article_status as enum ('draft', 'review', 'published', 'archived');

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

create trigger articles_set_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();

alter table public.articles enable row level security;

create policy "Authenticated users can read articles"
on public.articles
for select
using (auth.uid() is not null);

create policy "Authenticated users can create articles"
on public.articles
for insert
with check (auth.uid() is not null);

create policy "Authenticated users can update articles"
on public.articles
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "Authenticated users can delete articles"
on public.articles
for delete
using (auth.uid() is not null);
