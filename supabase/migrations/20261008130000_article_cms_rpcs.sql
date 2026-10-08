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
  p_category text default null,
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
  p_category text default null,
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
