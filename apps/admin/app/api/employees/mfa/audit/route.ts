import { authenticateEmployeeRequest } from '@/lib/employee-server';

export async function POST(request: Request) {
  const auth = await authenticateEmployeeRequest(request);
  if (auth instanceof Response) return auth;

  if (auth.aal !== 'aal2') {
    return Response.json({ error: 'MFA not fully verified.' }, { status: 400 });
  }

  // Check if we already audited this factor to prevent spam
  const { data: recentAudit } = await auth.service
    .from('audit_logs')
    .select('id')
    .eq('actor_profile_id', auth.user.id)
    .eq('action', 'employee.mfa_enrolled')
    .gt('created_at', new Date(Date.now() - 5000).toISOString())
    .maybeSingle();

  if (!recentAudit) {
    await auth.service.from('audit_logs').insert({
      actor_profile_id: auth.user.id,
      action: 'employee.mfa_enrolled',
      target_type: 'profile',
      target_id: auth.user.id,
      result: 'success',
      reason: 'TOTP MFA configured',
      details: { method: request.method, path: new URL(request.url).pathname },
      ...auth.auditContext,
    });
  }

  return Response.json({ success: true });
}
