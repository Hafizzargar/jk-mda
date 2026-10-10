-- Store newsletter subscribers for KJIN.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 254),
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security.
alter table public.newsletter_subscribers enable row level security;

-- Block direct access by public and regular application users.
revoke all on table public.newsletter_subscribers from public, anon, authenticated;

-- Allow the trusted server-side service role to access the table.
grant select, insert on table public.newsletter_subscribers to service_role;
