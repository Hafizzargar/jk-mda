create or replace function public.enforce_article_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  permitted_review_submission boolean;
  permitted_editor_transition boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  permitted_review_submission :=
    old.status = 'draft'
    and new.status = 'review'
    and old.author_id = auth.uid()
    and current_setting('kjin.allow_review_submission', true) = 'on';

  permitted_editor_transition :=
    public.user_has_editor_access()
    and current_setting('kjin.allow_status_transition', true) = 'on'
    and (
      (old.status = 'draft' and new.status = 'review')
      or (old.status = 'review' and new.status in ('draft', 'published', 'archived'))
      or (old.status = 'published' and new.status = 'archived')
    );

  if permitted_review_submission or permitted_editor_transition then
    return new;
  end if;

  raise exception 'Invalid or unauthorized article status transition: % to %', old.status, new.status;
end;
$$;

create or replace function public.transition_article_status(p_article_id uuid, p_next_status public.article_status)
returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles;
begin
  if auth.uid() is null or not public.user_has_editor_access() then
    raise exception 'Editor access is required to change article status';
  end if;

  perform set_config('kjin.allow_status_transition', 'on', true);
  update public.articles
  set status = p_next_status
  where id = p_article_id
  returning * into article_row;

  if not found then
    raise exception 'Article not found';
  end if;

  return article_row;
end;
$$;

revoke all on function public.transition_article_status(uuid, public.article_status) from public;
grant execute on function public.transition_article_status(uuid, public.article_status) to authenticated;
