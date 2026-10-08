import { authorizeEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let body: { status?: 'active' | 'disabled'; reason?: string };
  try {
    body = (await request.json()) as { status?: 'active' | 'disabled'; reason?: string };
  } catch {
    body = {};
  }

  // Authenticate before validating input so unauthenticated callers always get 401.
  const permission = body.status === 'disabled' ? 'employee.disable' : 'employee.enable';
  const authorization = await authorizeEmployeeRequest(request, permission);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  if (body.status !== 'active' && body.status !== 'disabled') {
    return Response.json({ error: 'Status must be active or disabled.' }, { status: 400 });
  }

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: 'A valid employee id is required.' }, { status: 400 });
  }

  const { data: target } = await authorization.service.from('profiles').select('id, role_key').eq('id', id).maybeSingle();
  const { data: actorRole } = await authorization.service.from('roles').select('hierarchy_rank').eq('role_key', authorization.profile.role_key).single();
  const { data: targetRole } = target
    ? await authorization.service.from('roles').select('hierarchy_rank').eq('role_key', target.role_key).single()
    : { data: null };

  if (!target || !actorRole || !targetRole || id === authorization.user.id || target.role_key === 'owner' || targetRole.hierarchy_rank >= actorRole.hierarchy_rank) {
    return Response.json({ error: 'You cannot change this employee status.' }, { status: 403 });
  }

  const { error: profileError } = await authorization.userClient.rpc('set_employee_status', {
    p_target_id: id,
    p_next_status: body.status,
    p_reason: body.reason ?? '',
  });
  if (profileError) {
    await authorization.service.from('audit_logs').insert({
      actor_profile_id: authorization.user.id,
      action: 'employee.status_change_denied',
      target_type: 'profile',
      target_id: id,
      result: 'denied',
      reason: profileError.message,
      details: { requested_status: body.status },
      ...authorization.auditContext,
    });
    // Deliberate raise-exception messages (P0001) are authored by us and safe to show.
    const clientMessage =
      profileError.code === 'P0001'
        ? profileError.message
        : 'The employee status could not be changed.';
    return Response.json({ error: clientMessage }, { status: 400 });
  }

  const { error: banError } = await authorization.service.auth.admin.updateUserById(id, {
    ban_duration: body.status === 'disabled' ? '876000h' : 'none',
  });

  if (banError) {
    await authorization.service.from('audit_logs').insert({
      actor_profile_id: authorization.user.id,
      action: 'employee.auth_status_update_failed',
      target_type: 'profile',
      target_id: id,
      result: 'failure',
      reason: body.reason ?? '',
      details: { requested_status: body.status, error: banError.message },
      ...authorization.auditContext,
    });
    return Response.json(
      { error: 'Profile access changed, but the Auth status update failed. Contact support if this persists.' },
      { status: 502 }
    );
  }

  return Response.json({ status: body.status });
}
