-- Migration: Site Settings & Presentation Templates
-- Establishes site_settings table for dynamic public website templates
-- Allows owner, superadmin, and admin (hierarchy_rank >= 300) to manage presentation templates.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create or replace function public.set_site_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_site_settings_updated_at();

alter table public.site_settings enable row level security;

drop policy if exists "Site settings are readable by everyone" on public.site_settings;
create policy "Site settings are readable by everyone"
on public.site_settings for select
using (true);

drop policy if exists "Admins can update site settings" on public.site_settings;
create policy "Admins can update site settings"
on public.site_settings for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.roles r on r.role_key = p.role_key
    where p.id = auth.uid()
      and r.hierarchy_rank >= 300
      and p.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.roles r on r.role_key = p.role_key
    where p.id = auth.uid()
      and r.hierarchy_rank >= 300
      and p.status = 'active'
  )
);

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

-- Seed default active template
insert into public.site_settings (key, value, description)
values (
  'active_template',
  jsonb_build_object(
    'template_id', 'classic-editorial',
    'name', 'Classic Editorial Broadsheet',
    'activated_at', now()
  ),
  'Currently active public website presentation template'
)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description;
