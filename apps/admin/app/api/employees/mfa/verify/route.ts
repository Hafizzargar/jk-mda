import { authenticateEmployeeRequest } from '@/lib/employee-server';

export async function POST(request: Request) {
  const auth = await authenticateEmployeeRequest(request);
  if (auth instanceof Response) return auth;

  let body: { factorId: string; challengeId: string; code: string };
  try {
    body = (await request.json()) as { factorId: string; challengeId: string; code: string };
    if (!body.factorId || !body.challengeId || !body.code) throw new Error();
  } catch {
    return Response.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  // Rate Limiting: count failed attempts in the last 15 minutes
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count, error: countError } = await auth.service
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('actor_profile_id', auth.user.id)
    .eq('action', 'employee.mfa_challenge_failed')
    .gt('created_at', fifteenMinsAgo);

  if (countError) {
    return Response.json({ error: 'Internal server error during rate limit check.' }, { status: 500 });
  }

  if (count !== null && count >= 5) {
    return Response.json({ error: 'Too many failed verification attempts. Please try again later.' }, { status: 429 });
  }

  // Use the user's client (which has their current token) to call verify
  const { data: verifyData, error: verifyError } = await auth.userClient.auth.mfa.verify({
    factorId: body.factorId,
    challengeId: body.challengeId,
    code: body.code,
  });

  if (verifyError) {
    // Log failure securely server-side
    await auth.service.from('audit_logs').insert({
      actor_profile_id: auth.user.id,
      action: 'employee.mfa_challenge_failed',
      target_type: 'profile',
      target_id: auth.user.id,
      result: 'denied',
      reason: 'Invalid TOTP code',
      details: { method: request.method, path: new URL(request.url).pathname },
      ...auth.auditContext,
    });
    return Response.json({ error: 'Invalid code. Please check your authenticator app and try again.' }, { status: 400 });
  }

  // Log success securely server-side
  await auth.service.from('audit_logs').insert({
    actor_profile_id: auth.user.id,
    action: 'employee.mfa_challenge_success',
    target_type: 'profile',
    target_id: auth.user.id,
    result: 'success',
    reason: 'TOTP verified',
    details: { method: request.method, path: new URL(request.url).pathname },
    ...auth.auditContext,
  });

  // Return the upgraded session to the client
  return Response.json({ data: verifyData });
}
