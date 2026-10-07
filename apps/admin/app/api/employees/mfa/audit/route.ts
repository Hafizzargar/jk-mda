import { authenticateEmployeeRequest } from '@/lib/employee-server';

export async function POST(request: Request) {
  const auth = await authenticateEmployeeRequest(request);
  if (auth instanceof Response) return auth;

  let body: { action: string };
  try {
    body = (await request.json()) as { action: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const allowedActions = [
    'employee.mfa_enrolled',
    'employee.mfa_challenge_success',
    'employee.mfa_challenge_failed',
  ];

  if (!allowedActions.includes(body.action)) {
    return Response.json({ error: 'Invalid audit action.' }, { status: 400 });
  }

  if (body.action !== 'employee.mfa_challenge_failed' && auth.aal !== 'aal2') {
    return Response.json({ error: 'MFA not fully verified.' }, { status: 400 });
  }

  // Check if we already audited this factor recently to prevent spam
  const { data: recentAudit } = await auth.service
    .from('audit_logs')
    .select('id')
    .eq('actor_profile_id', auth.user.id)
    .eq('action', body.action)
    .gt('created_at', new Date(Date.now() - 5000).toISOString())
    .maybeSingle();

  if (!recentAudit) {
    await auth.service.from('audit_logs').insert({
      actor_profile_id: auth.user.id,
      action: body.action,
      target_type: 'profile',
      target_id: auth.user.id,
      result: body.action.includes('failed') ? 'denied' : 'success',
      reason: 'TOTP MFA verification attempt',
      details: { method: request.method, path: new URL(request.url).pathname },
      ...auth.auditContext,
    });
  }

  return Response.json({ success: true });
}
