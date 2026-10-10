-- Migration: AI Rate Limiting

create table if not exists public.ai_usage_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    endpoint text not null,
    created_at timestamptz not null default now()
);

-- Index for faster rate limit counting
create index if not exists ai_usage_logs_user_created_at_idx on public.ai_usage_logs (user_id, created_at);

-- Set up RLS (though mostly accessed via backend service role)
alter table public.ai_usage_logs enable row level security;

-- Create an RPC to atomically check and record usage
create or replace function public.check_ai_rate_limit(
    p_user_id uuid,
    p_endpoint text,
    p_max_requests int,
    p_window_interval interval
) returns boolean as $$
declare
    v_recent_count int;
begin
    -- Delete old logs to prevent unbounded growth (cleanup old logs for this user)
    delete from public.ai_usage_logs
    where user_id = p_user_id
      and created_at < now() - p_window_interval;

    -- Count recent requests
    select count(*)
    into v_recent_count
    from public.ai_usage_logs
    where user_id = p_user_id
      and created_at >= now() - p_window_interval;

    if v_recent_count >= p_max_requests then
        return false; -- Rate limit exceeded
    end if;

    -- Record the new request
    insert into public.ai_usage_logs (user_id, endpoint)
    values (p_user_id, p_endpoint);

    return true; -- Allowed
end;
$$ language plpgsql security definer set search_path = '';
