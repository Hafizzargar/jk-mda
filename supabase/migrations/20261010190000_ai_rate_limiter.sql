-- Migration: AI Rate Limiting
-- Enforces isolated per-endpoint rate limiting with advisory locking,
-- per-user window pruning, and a dedicated global retention cleanup procedure.

create table if not exists public.ai_usage_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    endpoint text not null,
    created_at timestamptz not null default now()
);

-- Indexes for fast composite queries on user + endpoint + time window
create index if not exists ai_usage_logs_user_created_at_idx on public.ai_usage_logs (user_id, created_at);
create index if not exists ai_usage_logs_user_endpoint_created_idx on public.ai_usage_logs (user_id, endpoint, created_at);
create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs (created_at);

-- Set up RLS (accessed via backend service role)
alter table public.ai_usage_logs enable row level security;

-- Create an RPC to atomically check and record usage per endpoint
create or replace function public.check_ai_rate_limit(
    p_user_id uuid,
    p_endpoint text,
    p_max_requests int,
    p_window_interval interval
) returns boolean as $$
declare
    v_recent_count int;
begin
    -- 1. Authorization: Only allow the actual user (or service_role) to rate-limit themselves
    if auth.role() != 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Unauthorized: You can only record rate limits for your own user ID.';
    end if;

    -- 2. Concurrency Control: Acquire an exclusive transaction-level lock for this user + endpoint
    -- Hash user UUID and endpoint name together so concurrent requests across different endpoints do not block each other
    perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || coalesce(p_endpoint, 'default')));

    -- 3. Cleanup: Delete expired logs for this specific user and endpoint
    delete from public.ai_usage_logs
    where user_id = p_user_id
      and endpoint = p_endpoint
      and created_at < now() - p_window_interval;

    -- 4. Opportunistic Global Maintenance: Purge stale logs older than 7 days probabilistically (~2% of calls)
    -- This bounds overall table size even when dedicated cron jobs are paused
    if random() < 0.02 then
        delete from public.ai_usage_logs
        where created_at < now() - interval '7 days';
    end if;

    -- 5. Count: Count recent requests within the window for this specific endpoint
    select count(*)
    into v_recent_count
    from public.ai_usage_logs
    where user_id = p_user_id
      and endpoint = p_endpoint
      and created_at >= now() - p_window_interval;

    if v_recent_count >= p_max_requests then
        return false; -- Rate limit exceeded for this endpoint
    end if;

    -- 6. Record: Insert the new request log
    insert into public.ai_usage_logs (user_id, endpoint)
    values (p_user_id, p_endpoint);

    return true; -- Allowed
end;
$$ language plpgsql security definer set search_path = '';

-- Dedicated Global Maintenance Cleanup: Purges expired usage logs across all users and endpoints
create or replace function public.cleanup_ai_usage_logs(
    p_retention_window interval default '7 days'
) returns bigint as $$
declare
    v_deleted_count bigint;
begin
    -- Authorization: Restrict to service_role or admin
    if auth.role() != 'service_role' and not public.user_has_editor_access() then
        raise exception 'Unauthorized: Service role or admin access required for maintenance cleanup.';
    end if;

    delete from public.ai_usage_logs
    where created_at < now() - p_retention_window;

    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$ language plpgsql security definer set search_path = '';

-- Revoke default execute permissions
revoke all on function public.check_ai_rate_limit(uuid, text, int, interval) from public, anon, authenticated;
revoke all on function public.cleanup_ai_usage_logs(interval) from public, anon, authenticated;

-- Grant explicitly only to service_role
grant execute on function public.check_ai_rate_limit(uuid, text, int, interval) to service_role;
grant execute on function public.cleanup_ai_usage_logs(interval) to service_role;
