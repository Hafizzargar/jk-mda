create table if not exists public.employee_invitation_attempts (
  id bigint generated always as identity primary key,
  actor_profile_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_employee_invitation_attempts_actor_time
on public.employee_invitation_attempts (actor_profile_id, attempted_at desc);

alter table public.employee_invitation_attempts enable row level security;
revoke all on public.employee_invitation_attempts from anon, authenticated;

create or replace function public.claim_employee_invitation_attempt()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_attempts integer;
begin
  if auth.uid() is null or not public.has_permission('employee.invite') then
    raise exception 'Employee invitation permission is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':employee-invite-send', 0));

  select count(*) into recent_attempts
  from public.employee_invitation_attempts
  where actor_profile_id = auth.uid()
    and attempted_at > now() - interval '24 hours';

  if recent_attempts >= 20 then
    raise exception 'Daily employee invitation limit reached';
  end if;

  insert into public.employee_invitation_attempts (actor_profile_id)
  values (auth.uid());
end;
$$;

create or replace function public.request_employee_invite(
  p_email text,
  p_display_name text,
  p_requested_role text,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  actor_rank smallint;
  requested_rank smallint;
  recent_requests integer;
begin
  if auth.uid() is null or not public.has_permission('employee.invite.request') then
    raise exception 'Active employee access is required';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if p_requested_role not in ('author', 'editor', 'admin', 'superadmin') then
    raise exception 'Owner invitations require the controlled bootstrap process';
  end if;
  if length(trim(coalesce(p_email, ''))) > 254
    or trim(coalesce(p_email, '')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(trim(coalesce(p_display_name, ''))) not between 1 and 120
    or length(trim(coalesce(p_reason, ''))) > 1000 then
    raise exception 'Invitation request fields are invalid';
  end if;

  select roles.hierarchy_rank into actor_rank
  from public.profiles profiles
  join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = auth.uid() and profiles.status = 'active';
  select hierarchy_rank into requested_rank from public.roles where role_key = p_requested_role;
  if requested_rank is null or requested_rank > actor_rank then
    raise exception 'You cannot request an employee above your role level';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':employee-invite-request', 0));
  select count(*) into recent_requests
  from public.employee_invite_requests
  where requested_by = auth.uid() and created_at > now() - interval '24 hours';
  if recent_requests >= 10 then raise exception 'Daily employee invitation request limit reached'; end if;

  insert into public.employee_invite_requests (requested_by, email, display_name, requested_role, reason)
  values (auth.uid(), lower(trim(p_email)), trim(coalesce(p_display_name, '')), p_requested_role, trim(coalesce(p_reason, '')))
  returning id into request_id;

  perform public.write_audit_event(auth.uid(), 'employee.invite_requested', 'employee_invite_request', request_id, 'success', p_reason,
    jsonb_build_object('email', lower(trim(p_email)), 'requested_role', p_requested_role));
  return request_id;
end;
$$;

revoke all on function public.claim_employee_invitation_attempt() from public;
revoke all on function public.request_employee_invite(text, text, text, text) from public;
grant execute on function public.claim_employee_invitation_attempt() to authenticated;
grant execute on function public.request_employee_invite(text, text, text, text) to authenticated;
