import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

const roleRanks: Record<string, number> = {
  owner: 500,
  superadmin: 400,
  admin: 300,
  editor: 200,
  author: 100,
};

type InviteRequest = {
  email?: string;
  display_name?: string;
  role_key?: string;
  request_id?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const authorization = await authorizeEmployeeRequest(request, 'employee.invite');
  if (!isEmployeeAuthorization(authorization)) return authorization;

  let body: InviteRequest;
  try {
    body = (await request.json()) as InviteRequest;
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  let email = body.email?.trim().toLowerCase() ?? '';
  let displayName = body.display_name?.trim() ?? '';
  let roleKey = body.role_key ?? '';
  const reason = body.reason?.trim() ?? '';

  if (!reason) return Response.json({ error: 'A reason is required for an employee invitation.' }, { status: 400 });

  if (body.request_id) {
    const { data: inviteRequest, error } = await authorization.service
      .from('employee_invite_requests')
      .select('id, email, display_name, requested_role, status')
      .eq('id', body.request_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (error || !inviteRequest) {
      return Response.json({ error: 'Pending employee request not found.' }, { status: 404 });
    }

    email = inviteRequest.email;
    displayName = inviteRequest.display_name;
    roleKey = inviteRequest.requested_role;
  }

  if (!/^\S+@\S+\.\S+$/.test(email) || !displayName || !Object.hasOwn(roleRanks, roleKey)) {
    return Response.json({ error: 'A valid email, name, and role are required.' }, { status: 400 });
  }

  const { data: actorRole } = await authorization.service
    .from('roles')
    .select('hierarchy_rank')
    .eq('role_key', authorization.profile.role_key)
    .single();
  const { data: targetRole } = await authorization.service
    .from('roles')
    .select('hierarchy_rank')
    .eq('role_key', roleKey)
    .single();

  if (!actorRole || !targetRole || roleKey === 'owner' || targetRole.hierarchy_rank >= actorRole.hierarchy_rank) {
    await authorization.service.from('audit_logs').insert({
      actor_profile_id: authorization.user.id,
      action: 'employee.invite_denied',
      target_type: 'employee_invite',
      result: 'denied',
      reason,
      details: { email, role_key: roleKey },
      ...authorization.auditContext,
    });
    return Response.json({ error: 'You cannot invite an employee at this role level.' }, { status: 403 });
  }

  const { data: invite, error: inviteRowError } = await authorization.service
    .from('employee_invites')
    .insert({
      email,
      display_name: displayName,
      role_key: roleKey,
      reason,
      invited_by: authorization.user.id,
      request_id: body.request_id ?? null,
      status: 'sending',
    })
    .select('id')
    .single();

  if (inviteRowError || !invite) {
    return Response.json({ error: inviteRowError?.message ?? 'Unable to create invitation.' }, { status: 409 });
  }

  const { data: invited, error: authError } = await authorization.service.auth.admin.inviteUserByEmail(email, {
    data: {
      display_name: displayName,
      employee_invite_id: invite.id,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'}/login`,
  });

  if (authError || !invited.user) {
    const failureReason = authError?.message ?? 'Auth did not return an invited user.';
    await authorization.service.from('employee_invites').update({ status: 'failed', failure_reason: failureReason }).eq('id', invite.id);
    await authorization.service.from('audit_logs').insert({
      actor_profile_id: authorization.user.id,
      action: 'employee.invite_failed',
      target_type: 'employee_invite',
      target_id: invite.id,
      result: 'failure',
      reason: failureReason,
      details: { email, role_key: roleKey },
      ...authorization.auditContext,
    });
    return Response.json({ error: failureReason }, { status: 400 });
  }

  const { error: profileError } = await authorization.service
    .from('profiles')
    .update({ role_key: roleKey, role: roleKey, display_name: displayName, email })
    .eq('id', invited.user.id);

  if (profileError) {
    await authorization.service.auth.admin.deleteUser(invited.user.id);
    await authorization.service.from('employee_invites').update({ status: 'failed', failure_reason: profileError.message }).eq('id', invite.id);
    await authorization.service.from('audit_logs').insert({
      actor_profile_id: authorization.user.id,
      action: 'employee.invite_failed',
      target_type: 'employee_invite',
      target_id: invite.id,
      result: 'failure',
      reason: profileError.message,
      details: { email, role_key: roleKey },
      ...authorization.auditContext,
    });
    return Response.json({ error: 'Invitation could not be assigned to an employee profile.' }, { status: 500 });
  }

  await authorization.service.from('employee_invites')
    .update({ auth_user_id: invited.user.id, status: 'invited' })
    .eq('id', invite.id);

  if (body.request_id) {
    await authorization.service.from('employee_invite_requests')
      .update({ status: 'approved', reviewed_by: authorization.user.id, review_reason: reason, reviewed_at: new Date().toISOString() })
      .eq('id', body.request_id)
      .eq('status', 'pending');
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'employee.invited',
    target_type: 'profile',
    target_id: invited.user.id,
    result: 'success',
    reason,
    details: { email, role_key: roleKey, invite_id: invite.id },
    ...authorization.auditContext,
  });

  return Response.json({ id: invited.user.id, status: 'invited' }, { status: 201 });
}
