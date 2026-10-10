-- 1. Create a tracking table for views to prevent abuse
create table public.article_views_log (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete cascade not null,
  ip_address text not null,
  viewed_at timestamptz default now() not null
);

-- Index for IP-based and global rate-limiting
create index idx_article_views_log_recent on public.article_views_log (article_id, viewed_at);
create index idx_article_views_log_ip on public.article_views_log (ip_address, viewed_at);

-- 2. Enable RLS on the tracking table
alter table public.article_views_log enable row level security;
-- No policies granted to public, so it's fully private

-- 3. Update the RPC to use DB-level abuse protection
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
  -- 1. Check IP-based rate limit (max 5 views per 15 minutes per IP across all articles)
  -- This stops a single IP from hammering the system
  select count(*) into v_recent_ip_views
  from public.article_views_log
  where ip_address = p_ip_address
    and viewed_at > now() - interval '15 minutes';

  if v_recent_ip_views >= 5 then
    return; -- Silently ignore abuse
  end if;

  -- 2. Check Global rate limit per article (max 60 views per minute globally)
  -- This mitigates distributed botnets rotating IPs
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

-- Revoke the old signature if it existed
drop function if exists public.increment_article_view_count(uuid);

-- Grant execute to anon and authenticated
revoke all on function public.increment_article_view_count(uuid, text) from public;
grant execute on function public.increment_article_view_count(uuid, text) to anon, authenticated;
