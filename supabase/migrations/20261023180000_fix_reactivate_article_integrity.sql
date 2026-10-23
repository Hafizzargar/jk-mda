-- Migration: Fix Article Reactivation RPC and State Machine Integrity Trigger
-- 1. Update articles_enforce_integrity trigger function to allow reactivation from archived to published, review, or draft
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
      if old.status = 'archived' and new.status not in ('published', 'review', 'draft') then
        raise exception 'Archived articles can only transition to published, review, or draft.';
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
    new.archive_reason := null;
    new.archived_by := null;
  elsif new.status = 'published' then
    if new.published_at is null or new.published_by is null then
      raise exception 'Published articles must have published_at and published_by set.';
    end if;
    new.archived_at := null;
    new.archive_reason := null;
    new.archived_by := null;
  elsif new.status = 'archived' then
    if new.archived_at is null then
      raise exception 'Archived articles must have archived_at set.';
    end if;
  end if;

  return new;
end;
$$;


-- 2. Update reactivate_article() RPC with proper enum casting and metadata clearing
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
  v_target_status public.article_status;
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;

  if not (public.has_permission('article.publish') or public.has_permission('article.review')) then
    raise exception 'Article publish or review permission required';
  end if;

  if p_target_status not in ('published', 'review', 'draft') then
    raise exception 'Target status must be published, review, or draft';
  end if;

  v_target_status := p_target_status::public.article_status;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if article_row.status <> 'archived' then
    raise exception 'Only inactive/archived articles can be reactivated';
  end if;

  update public.articles set
    status = v_target_status,
    published_at = case when v_target_status = 'published' then coalesce(published_at, now()) else published_at end,
    published_by = case when v_target_status = 'published' then coalesce(published_by, actor_uid) else published_by end,
    archived_at = null,
    archive_reason = null,
    archived_by = null,
    updated_at = now()
  where id = p_article_id
  returning * into article_row;

  perform public.write_audit_event(actor_uid, 'article.reactivated', 'article', p_article_id, 'success');

  return article_row;
end;
$$;

revoke all on function public.reactivate_article(uuid, text) from public;
grant execute on function public.reactivate_article(uuid, text) to authenticated;
