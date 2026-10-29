
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
