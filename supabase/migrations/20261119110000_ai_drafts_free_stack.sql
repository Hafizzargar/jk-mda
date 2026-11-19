-- Migration: 20261119110000_ai_drafts_free_stack.sql
-- Autonomous News Intelligence Free Stack ($0 Stack)
-- Uses pg_trgm for fast duplicate headline detection, stores structured AI drafts (summary, claims, Hindi/Urdu),
-- and enforces editor-controlled verification workflow.

create extension if not exists pg_trgm;

create table if not exists public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text unique not null,
  source_title text not null,
  published_at timestamptz,
  summary text,
  summary_hi text,
  summary_ur text,
  category text,
  district text,
  tags text[],
  claims jsonb,
  status text not null default 'pending',  -- pending | approved | rejected
  reviewed_by text,
  created_at timestamptz default now()
);

-- Fast trigram GIN index on source_title for similarity queries
create index if not exists ai_drafts_source_title_trgm_idx on public.ai_drafts using gin (source_title gin_trgm_ops);
create index if not exists ai_drafts_status_created_at_idx on public.ai_drafts (status, created_at desc);

-- Enable RLS
alter table public.ai_drafts enable row level security;

-- Drop any existing policies to avoid conflicts
drop policy if exists "Service role full access to ai_drafts" on public.ai_drafts;
drop policy if exists "Staff can view ai_drafts" on public.ai_drafts;
drop policy if exists "Staff can update ai_drafts status" on public.ai_drafts;

-- Service role full access
create policy "Service role full access to ai_drafts"
  on public.ai_drafts
  for all
  to service_role
  using (true)
  with check (true);

-- Authenticated staff can view drafts
create policy "Staff can view ai_drafts"
  on public.ai_drafts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.status = 'active'
        and profiles.role_key in ('owner', 'superadmin', 'admin', 'editor')
    )
  );

-- Authenticated staff can update review status
create policy "Staff can update ai_drafts status"
  on public.ai_drafts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.status = 'active'
        and profiles.role_key in ('owner', 'superadmin', 'admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.status = 'active'
        and profiles.role_key in ('owner', 'superadmin', 'admin', 'editor')
    )
  );

-- RPC for duplicate detection within past 3 days (similarity threshold > 0.6)
create or replace function public.similar_recent(t text)
returns int
language sql
stable
security definer
as $$
  select count(*)::int from public.ai_drafts
  where created_at > now() - interval '3 days'
    and similarity(source_title, t) > 0.6;
$$;
