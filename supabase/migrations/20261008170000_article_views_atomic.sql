-- Migration: Fully Atomic View Counter & Correct Permissions
-- Introduces fully atomic rate limits and strict service_role execution.

create or replace function public.increment_article_view_count(p_article_id uuid, p_ip_address text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_ip_views int;
  v_recent_global_views int;
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

  -- 1. Check IP-based rate limit (max 5 views per 15 minutes per IP across all articles)
  select count(*) into v_recent_ip_views
  from public.article_views_log
  where ip_address = p_ip_address
    and viewed_at > now() - interval '15 minutes';

  if v_recent_ip_views >= 5 then
    return; -- Silently ignore abuse
  end if;

  -- 2. Check Global rate limit per article (max 60 views per minute globally)
  select count(*) into v_recent_global_views
  from public.article_views_log
  where article_id = p_article_id
    and viewed_at > now() - interval '1 minute';

  if v_recent_global_views >= 60 then
    return; -- Silently ignore abuse
  end if;

  -- 3. Deduplicate IP per article (max 1 view per 24 hours per IP for the same article)
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

-- Secure the RPC by removing public execution and restricting solely to service_role
revoke all on function public.increment_article_view_count(uuid, text) from public;
revoke all on function public.increment_article_view_count(uuid, text) from anon, authenticated;
grant execute on function public.increment_article_view_count(uuid, text) to service_role;
