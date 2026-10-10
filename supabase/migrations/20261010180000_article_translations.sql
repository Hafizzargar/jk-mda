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
