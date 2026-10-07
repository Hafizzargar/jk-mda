-- Single Second Superadmin invariant + uniform input validation for employee RPCs.
-- Enforces the product decision: exactly one Owner (already indexed) and exactly one Second Superadmin.

create unique index if not exists idx_profiles_single_superadmin
on public.profiles (role_key)
where role_key = 'superadmin';

create unique index if not exists idx_employee_invites_single_superadmin
on public.employee_invites (role_key)
where role_key = 'superadmin' and status in ('sending', 'invited');

create or replace function public.update_employee_basic(p_target_id uuid, p_display_name text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor_rank smallint; target_rank smallint; target_role text;
begin
  if not public.has_permission('employee.basic.update') then raise exception 'Employee update access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  if length(trim(coalesce(p_display_name, ''))) not between 1 and 120 then raise exception 'Display name must be 1 to 120 characters'; end if;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select profiles.role_key, roles.hierarchy_rank into target_role, target_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = p_target_id;
  if p_target_id = auth.uid() or target_role = 'owner' or target_rank is null or target_rank >= actor_rank then
    raise exception 'You cannot modify this employee';
  end if;
  update public.profiles set display_name = trim(p_display_name), updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.basic_updated', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('fields', jsonb_build_array('display_name')));
end;
$$;

create or replace function public.change_employee_role(p_target_id uuid, p_role_key text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor_rank smallint; target_rank smallint; new_rank smallint; old_role text;
begin
  if not public.has_permission('employee.role.change') then raise exception 'Role-change access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  if p_role_key = 'owner' then raise exception 'Owner cannot be assigned through employee management'; end if;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select profiles.role_key, roles.hierarchy_rank into old_role, target_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = p_target_id;
  select hierarchy_rank into new_rank from public.roles where role_key = p_role_key;
  if p_target_id = auth.uid() or old_role = 'owner' or target_rank is null or target_rank >= actor_rank or new_rank is null or new_rank >= actor_rank then
    raise exception 'You cannot change this employee role';
  end if;
  if p_role_key = 'superadmin' and exists (select 1 from public.profiles where role_key = 'superadmin' and id <> p_target_id) then
    raise exception 'Only one Second Superadmin is allowed';
  end if;
  update public.profiles set role_key = p_role_key, role = p_role_key, updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.role_changed', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('from_role', old_role, 'to_role', p_role_key));
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
  if p_requested_role = 'superadmin' and exists (select 1 from public.profiles where role_key = 'superadmin') then
    raise exception 'Only one Second Superadmin is allowed';
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

create or replace function public.reject_employee_invite_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('employee.invite.review') then
    raise exception 'Employee invitation review access is required';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  update public.employee_invite_requests
  set status = 'rejected', reviewed_by = auth.uid(), review_reason = trim(coalesce(p_reason, '')), reviewed_at = now()
  where id = p_request_id and status = 'pending';
  if not found then raise exception 'Pending invitation request not found'; end if;
  perform public.write_audit_event(auth.uid(), 'employee.invite_request_rejected', 'employee_invite_request', p_request_id, 'success', p_reason);
end;
$$;

create or replace function public.request_employee_deletion(p_target_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare request_id uuid; target_role text;
begin
  if not public.has_permission('employee.deletion.request') then raise exception 'Employee deletion request access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  select role_key into target_role from public.profiles where id = p_target_id;
  if target_role is null or target_role = 'owner' or p_target_id = auth.uid() then raise exception 'This employee cannot be requested for deletion'; end if;
  insert into public.employee_deletion_requests (target_profile_id, requested_by, reason)
  values (p_target_id, auth.uid(), trim(p_reason)) returning id into request_id;
  perform public.write_audit_event(auth.uid(), 'employee.deletion_requested', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('request_id', request_id));
  return request_id;
end;
$$;

create or replace function public.resolve_employee_deletion(p_request_id uuid, p_decision text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.employee_deletion_requests;
  target_role text;
  actor_rank smallint;
  target_rank smallint;
begin
  if not public.has_permission('employee.deletion.resolve') then raise exception 'Deletion review access is required'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  select * into request_row from public.employee_deletion_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'Pending deletion request not found'; end if;
  if request_row.requested_by = auth.uid() or request_row.target_profile_id = auth.uid() then raise exception 'You cannot resolve your own deletion request'; end if;
  select profiles.role_key, roles.hierarchy_rank into target_role, target_rank
  from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = request_row.target_profile_id;
  select roles.hierarchy_rank into actor_rank
  from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = auth.uid() and profiles.status = 'active';
  if target_role is null or target_role = 'owner' or target_rank >= actor_rank then
    raise exception 'You cannot deprovision this employee';
  end if;

  update public.employee_deletion_requests
  set status = p_decision, reviewed_by = auth.uid(), review_reason = trim(coalesce(p_reason, '')), reviewed_at = now()
  where id = p_request_id;
  if p_decision = 'approved' then
    update public.profiles set status = 'disabled', updated_at = now() where id = request_row.target_profile_id;
  end if;
  perform public.write_audit_event(auth.uid(), 'employee.deletion_' || p_decision, 'profile', request_row.target_profile_id, 'success', p_reason, jsonb_build_object('request_id', p_request_id));
end;
$$;

create or replace function public.set_employee_status(p_target_id uuid, p_next_status text, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_role text; target_status text; actor_rank smallint; target_rank smallint;
begin
  if p_next_status not in ('active', 'disabled') then raise exception 'Status must be active or disabled'; end if;
  if p_next_status = 'disabled' and not public.has_permission('employee.disable') then raise exception 'Disable access is required'; end if;
  if p_next_status = 'active' and not public.has_permission('employee.enable') then raise exception 'Enable access is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'A reason is required'; end if;
  if length(trim(coalesce(p_reason, ''))) > 1000 then raise exception 'Reason is too long'; end if;
  select role_key, status into target_role, target_status from public.profiles where id = p_target_id;
  select roles.hierarchy_rank into actor_rank from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key where profiles.id = auth.uid() and profiles.status = 'active';
  select hierarchy_rank into target_rank from public.roles where role_key = target_role;
  if target_role is null or target_role = 'owner' or p_target_id = auth.uid() then raise exception 'You cannot change this employee status'; end if;
  if target_rank is null or target_rank >= actor_rank then raise exception 'You cannot change this employee status'; end if;
  if target_status = 'invited' and p_next_status = 'active' then raise exception 'Employees must accept their invitation before activation'; end if;
  update public.profiles set status = p_next_status, updated_at = now() where id = p_target_id;
  perform public.write_audit_event(auth.uid(), 'employee.' || p_next_status, 'profile', p_target_id, 'success', p_reason);
end;
$$;

revoke all on function public.update_employee_basic(uuid, text, text) from public;
revoke all on function public.change_employee_role(uuid, text, text) from public;
revoke all on function public.request_employee_invite(text, text, text, text) from public;
revoke all on function public.reject_employee_invite_request(uuid, text) from public;
revoke all on function public.request_employee_deletion(uuid, text) from public;
revoke all on function public.resolve_employee_deletion(uuid, text, text) from public;
revoke all on function public.set_employee_status(uuid, text, text) from public;
grant execute on function public.update_employee_basic(uuid, text, text) to authenticated;
grant execute on function public.change_employee_role(uuid, text, text) to authenticated;
grant execute on function public.request_employee_invite(text, text, text, text) to authenticated;
grant execute on function public.reject_employee_invite_request(uuid, text) to authenticated;
grant execute on function public.request_employee_deletion(uuid, text) to authenticated;
grant execute on function public.resolve_employee_deletion(uuid, text, text) to authenticated;
grant execute on function public.set_employee_status(uuid, text, text) to authenticated;



