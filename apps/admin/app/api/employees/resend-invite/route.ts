import { authorizeEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { generateSecurePassword, sendEmployeeInviteEmail } from '@/lib/mailer';

export async function POST(request: Request) {
  const authorization = await authorizeEmployeeRequest(request, 'employee.invite');
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: { employee_id?: string; reason?: string };
  try {
    body = (await request.json()) as { employee_id?: string; reason?: string };
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const employeeId = body.employee_id;
  const reason = body.reason?.trim();

  if (!employeeId) {
    return Response.json({ error: 'Employee ID is required.' }, { status: 400 });
  }
  if (!reason) {
    return Response.json({ error: 'A reason is required to resend an invitation.' }, { status: 400 });
  }
  if (reason.length > 1000) {
    return Response.json({ error: 'Reason cannot exceed 1000 characters.' }, { status: 400 });
  }

  // Fetch the employee profile
  const { data: targetProfile, error: profileError } = await authorization.service
    .from('profiles')
    .select('id, email, display_name, role_key, status')
    .eq('id', employeeId)
    .single();

  if (profileError || !targetProfile) {
    return Response.json({ error: 'Employee not found.' }, { status: 404 });
  }

  if (targetProfile.status !== 'invited') {
    return Response.json({ error: 'Only employees with status "invited" can have invitations resent.' }, { status: 400 });
  }

  if (!targetProfile.email) {
    return Response.json({ error: 'Employee does not have an email address.' }, { status: 400 });
  }

  // Hierarchy check: actor must be owner OR have higher rank than target
  const isOwner = authorization.profile.role_key === 'owner';
  if (!isOwner) {
    const { data: actorRole } = await authorization.service
      .from('roles')
      .select('hierarchy_rank')
      .eq('role_key', authorization.profile.role_key)
      .single();
    const { data: targetRole } = await authorization.service
      .from('roles')
      .select('hierarchy_rank')
      .eq('role_key', targetProfile.role_key)
      .single();

    if (!actorRole || !targetRole || targetRole.hierarchy_rank >= actorRole.hierarchy_rank) {
      await authorization.service.from('audit_logs').insert({
        actor_profile_id: authorization.user.id,
        action: 'employee.resend_invite_denied',
        target_type: 'profile',
        target_id: targetProfile.id,
        result: 'denied',
        reason,
        details: { email: targetProfile.email, role_key: targetProfile.role_key },
        ...authorization.auditContext,
      });
      return Response.json({ error: 'You do not have permission to resend an invite to this role.' }, { status: 403 });
    }
  }

  // Generate a new secure temporary password
  const temporaryPassword = generateSecurePassword();

  // Update credentials in Auth
  try {
    await authorization.service.auth.admin.updateUserById(targetProfile.id, {
      password: temporaryPassword,
      email_confirm: true,
    });
  } catch (authErr) {
    console.error('[Resend Invite] Failed to update user credentials:', authErr);
    return Response.json({ error: 'Unable to update credentials for this employee.' }, { status: 500 });
  }

  // Refresh expires_at on active employee_invites record
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await authorization.service
    .from('employee_invites')
    .update({ expires_at: newExpiresAt, status: 'invited' })
    .eq('auth_user_id', targetProfile.id);

  // Send the invite email via Nodemailer
  const mailResult = await sendEmployeeInviteEmail({
    to: targetProfile.email,
    displayName: targetProfile.display_name || targetProfile.email,
    roleKey: targetProfile.role_key,
    temporaryPassword,
    reason,
  });

  // Log audit event
  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'employee.invite_resent',
    target_type: 'profile',
    target_id: targetProfile.id,
    result: 'success',
    reason,
    details: {
      email: targetProfile.email,
      role_key: targetProfile.role_key,
      email_sent: mailResult.success,
      email_skipped: mailResult.skipped ?? false,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    email: targetProfile.email,
    email_sent: mailResult.success,
    temporary_password: temporaryPassword,
  });
}
