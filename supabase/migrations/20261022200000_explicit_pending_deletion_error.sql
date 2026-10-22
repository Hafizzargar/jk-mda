-- Migration: explicit_pending_deletion_error
-- Returns clear exception when an employee already has a pending deprovisioning request.

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
  if exists (select 1 from public.employee_deletion_requests where target_profile_id = p_target_id and status = 'pending') then
    raise exception 'A deprovisioning request is already pending for this employee';
  end if;
  insert into public.employee_deletion_requests (target_profile_id, requested_by, reason)
  values (p_target_id, auth.uid(), trim(p_reason)) returning id into request_id;
  perform public.write_audit_event(auth.uid(), 'employee.deletion_requested', 'profile', p_target_id, 'success', p_reason, jsonb_build_object('request_id', request_id));
  return request_id;
end;
$$;
