create or replace function public.claim_mfa_challenge_attempt()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_attempts integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':mfa-challenge', 0));

  select count(*) into recent_attempts
  from public.audit_logs
  where actor_profile_id = auth.uid()
    and action in ('employee.mfa_challenge_failed', 'employee.mfa_challenge_attempt')
    and created_at > now() - interval '15 minutes';

  if recent_attempts >= 5 then
    raise exception 'Too many failed verification attempts. Please try again later.';
  end if;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, result, reason)
  values (auth.uid(), 'employee.mfa_challenge_attempt', 'profile', auth.uid(), 'in_progress', 'MFA challenge attempt rate-limit claim');
end;
$$;

revoke all on function public.claim_mfa_challenge_attempt() from public;
grant execute on function public.claim_mfa_challenge_attempt() to authenticated;
