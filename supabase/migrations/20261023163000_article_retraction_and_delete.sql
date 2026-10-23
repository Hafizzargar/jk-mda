-- Migration: Article Retraction (Inactive / Fake Flagging) and Permanent Deletion
-- 1. Add archived_by and archive_reason columns to public.articles to track retraction reasons
alter table public.articles
  add column if not exists archived_by uuid references public.profiles(id),
  add column if not exists archive_reason text;

-- 2. Ensure admin and editor roles have permission to delete articles if needed
insert into public.role_permissions (role_key, permission_key)
values
  ('admin', 'article.delete'),
  ('editor', 'article.delete')
on conflict do nothing;

-- 3. Update archive_article() to record retraction reason and who archived it
drop function if exists public.archive_article(uuid) cascade;
drop function if exists public.archive_article(uuid, text) cascade;

create or replace function public.archive_article(
  p_article_id uuid,
  p_reason text default null
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
  
  if not public.has_permission('article.archive') then 
    raise exception 'Article archive permission required'; 
  end if;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if article_row.status not in ('review', 'published') then
    raise exception 'Only published or in-review articles can be archived';
  end if;

  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'MFA (AAL2) is strictly required to archive articles';
  end if;

  update public.articles set 
    status = 'archived',
    archived_at = now(),
    archived_by = actor_uid,
    archive_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_article_id 
  returning * into article_row;

  perform public.write_audit_event(actor_uid, 'article.archived', 'article', p_article_id, 'success');

  return article_row;
end;
$$;

revoke all on function public.archive_article(uuid, text) from public;
grant execute on function public.archive_article(uuid, text) to authenticated;


-- 4. Create delete_article() RPC for permanent deletion
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
begin
  if actor_uid is null then raise exception 'Authenticated employee required'; end if;
  
  if not (public.has_permission('article.delete') or public.has_permission('article.archive')) then 
    raise exception 'Article delete permission required'; 
  end if;

  select * into article_row from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;

  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'MFA (AAL2) is strictly required to delete articles';
  end if;

  -- Write audit event before deleting to record who deleted the article and preserve audit log
  perform public.write_audit_event(actor_uid, 'article.deleted', 'article', p_article_id, 'success');

  -- Cascades automatically to article_versions, article_translations, and article_views
  delete from public.articles where id = p_article_id;

  return true;
end;
$$;

revoke all on function public.delete_article(uuid, text) from public;
grant execute on function public.delete_article(uuid, text) to authenticated;
