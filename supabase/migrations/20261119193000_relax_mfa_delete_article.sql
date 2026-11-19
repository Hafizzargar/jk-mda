-- ==============================================================================
-- Relax delete_article() RPC: Remove strict AAL2 MFA requirement
-- Allows Owner, Superadmin, and Admin to permanently delete articles without
-- being blocked when MFA is disabled in production.
-- ==============================================================================

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
  select role_key into actor_role from public.profiles where id = actor_uid and status = 'active';

  -- Strictly verify role and permission: only owner, superadmin, and admin
  if actor_role is null or actor_role not in ('owner', 'superadmin', 'admin') then
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
