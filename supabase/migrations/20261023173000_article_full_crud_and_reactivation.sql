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
