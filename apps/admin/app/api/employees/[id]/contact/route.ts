import { authorizeEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeEmployeeRequest(request, 'employee.contact.update');
  if (!isEmployeeAuthorization(authorization)) return authorization;

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
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const reason = body.reason?.trim();
  if (!reason) return Response.json({ error: 'A reason is required for a login contact change request.' }, { status: 400 });

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'employee.contact_update_deferred',
    target_type: 'profile',
    target_id: id,
    result: 'denied',
    reason,
    details: { reason_code: 'requires_target_verification_and_recent_reauthentication' },
    ...authorization.auditContext,
  });

  return Response.json(
    { error: 'Login contact changes are temporarily unavailable until target verification and recent reauthentication are implemented.' },
    { status: 501 }
  );
}
