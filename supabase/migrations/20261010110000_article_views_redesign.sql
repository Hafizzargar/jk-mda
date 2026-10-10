-- Migration: Redesign Article View Counter Limits
-- Loosens the global IP limit to 30 distinct articles per 15 minutes and removes the hard 60-views/min ceiling.

create or replace function public.increment_article_view_count(p_article_id uuid, p_ip_address text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_ip_articles int;
begin
  -- First verify the article actually exists and is published
  if not exists (select 1 from public.articles where id = p_article_id and status = 'published') then
    return;
  end if;

  -- Consistently acquire advisory locks to prevent deadlocks and enforce atomicity
  -- 1. Lock the article to serialize global per-article view checks
  perform pg_advisory_xact_lock(hashtext('view_counter_article_' || p_article_id::text));
  -- 2. Lock the IP to serialize per-IP checks and deduplication
  perform pg_advisory_xact_lock(hashtext('view_counter_ip_' || p_ip_address));

  -- 1. Check IP-based rate limit: max 30 distinct articles in 15 minutes
  select count(distinct article_id) into v_recent_ip_articles
  from public.article_views_log
  where ip_address = p_ip_address
    and viewed_at > now() - interval '15 minutes';

  if v_recent_ip_articles >= 30 then
    return; -- Silently ignore abuse
  end if;

  -- 2. Deduplicate IP per article (max 1 view per 24 hours per IP for the same article)
  if exists (
    select 1 from public.article_views_log
    where article_id = p_article_id
      and ip_address = p_ip_address
      and viewed_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  -- All checks passed, log the view
  insert into public.article_views_log (article_id, ip_address)
  values (p_article_id, p_ip_address);

  -- Increment the public counter
  perform set_config('kjin.allow_view_count_update', 'on', true);
  
  update public.articles
  set view_count = view_count + 1
  where id = p_article_id and status = 'published';
end;
$$;
