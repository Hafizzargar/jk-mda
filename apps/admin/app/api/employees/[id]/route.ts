import {
  authenticateEmployeeRequest,
  checkEmployeePermission,
  isEmployeeAuthorization,
  requireRecentAuthentication,
} from '@/lib/employee-server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  // Caller must have permanent_delete or deletion.resolve permission
  const permError1 = await checkEmployeePermission(authorization, request, 'employee.permanent_delete');
  if (permError1) {
    const permError2 = await checkEmployeePermission(authorization, request, 'employee.deletion.resolve');
    if (permError2) return permError1;
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: 'A valid employee id is required.' }, { status: 400 });
  }

  let body: { reason?: string };
  try {
    body = (await request.json()) as { reason?: string };
  } catch {
    body = {};
  }

  const reason = (body.reason ?? '').trim();
  if (!reason) {
    return Response.json({ error: 'A reason is required to permanently delete an employee.' }, { status: 400 });
  }

  // Fetch target and rank info
  const { data: target } = await authorization.service
    .from('profiles')
    .select('id, email, display_name, role_key')
    .eq('id', id)
    .maybeSingle();

  const { data: actorRole } = await authorization.service
    .from('roles')
    .select('hierarchy_rank')
    .eq('role_key', authorization.profile.role_key)
    .single();

  const { data: targetRole } = target
    ? await authorization.service.from('roles').select('hierarchy_rank').eq('role_key', target.role_key).single()
    : { data: null };

  if (
    !target ||
    !actorRole ||
    !targetRole ||
    id === authorization.user.id ||
    target.role_key === 'owner' ||
    targetRole.hierarchy_rank >= actorRole.hierarchy_rank
  ) {
    return Response.json({ error: 'You cannot permanently delete this employee.' }, { status: 403 });
  }

  // 1. Log permanent deletion audit event before purging records
  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'employee.permanent_delete',
    target_type: 'profile',
    target_id: id,
    result: 'success',
    reason,
    details: {
      target_email: target.email,
      target_display_name: target.display_name,
      target_role: target.role_key,
    },
    ...authorization.auditContext,
  });

  // 2. Clean up any pending employee deletion requests or pending invites for this target
  await authorization.service.from('employee_deletion_requests').delete().eq('target_profile_id', id);
  await authorization.service.from('employee_invites').delete().eq('auth_user_id', id);

  // 3. Delete from Supabase Auth (this cascades to public.profiles via foreign key)
  const { error: authDeleteError } = await authorization.service.auth.admin.deleteUser(id);
  if (authDeleteError) {
    // Fallback: try manual deletion from profiles if auth user was already removed
    const { error: profileDeleteError } = await authorization.service.from('profiles').delete().eq('id', id);
    if (profileDeleteError) {
      await authorization.service.from('audit_logs').insert({
        actor_profile_id: authorization.user.id,
        action: 'employee.permanent_delete_failed',
        target_type: 'profile',
        target_id: id,
        result: 'failure',
        reason,
        details: { error: authDeleteError.message, profile_error: profileDeleteError.message },
        ...authorization.auditContext,
      });
      return Response.json({ error: 'Failed to permanently delete employee from database.' }, { status: 500 });
    }
  } else {
    // Extra safeguard to ensure profile is purged
    await authorization.service.from('profiles').delete().eq('id', id);
  }

  return Response.json({ success: true, message: 'Employee permanently deleted from database.' });
}
