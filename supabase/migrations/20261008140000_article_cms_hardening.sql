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
