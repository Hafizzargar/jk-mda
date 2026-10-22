-- Migration: allow_owner_and_requester_resolve
-- Allows:
-- 1) Any requester to cancel/reject their own pending deprovisioning request (p_decision = 'rejected')
-- 2) The system Owner (rank = 4 / role 'owner') to approve/resolve deprovisioning requests for subordinate employees (even if requested by Owner, since no higher authority exists)
-- 3) Strict four-eyes principle remains enforced for non-owner administrators (an Admin/Superadmin who requests deletion cannot self-approve)
-- 4) Self-deprovisioning remains strictly blocked (target cannot be auth.uid(), owner cannot be deleted)

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

  if request_row.target_profile_id = auth.uid() then
    raise exception 'You cannot resolve your own deletion request';
  end if;

  select profiles.role_key, roles.hierarchy_rank into target_role, target_rank
  from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = request_row.target_profile_id;

  select roles.hierarchy_rank into actor_rank
  from public.profiles profiles join public.roles roles on roles.role_key = profiles.role_key
  where profiles.id = auth.uid() and profiles.status = 'active';

  if target_role is null or target_role = 'owner' or target_rank >= actor_rank then
    raise exception 'You cannot deprovision this employee';
  end if;

  if request_row.requested_by = auth.uid() and p_decision = 'approved' and actor_rank < 4 then
    raise exception 'You cannot resolve your own deletion request';
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
