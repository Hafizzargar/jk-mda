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

  // Rate Limiting: Atomic DB claim (inserts employee.mfa_challenge_attempt)
  const { error: claimError } = await auth.userClient.rpc('claim_mfa_challenge_attempt');
  if (claimError) {
    if (claimError.message.includes('Too many failed verification attempts')) {
      return Response.json({ error: claimError.message }, { status: 429 });
    }
    return Response.json({ error: 'Internal server error during rate limit check.' }, { status: 500 });
  }

  // Determine if this is a new enrollment by checking the current factor status
  const { data: factors } = await auth.userClient.auth.mfa.listFactors();
  const targetFactor = factors?.totp.find(f => f.id === body.factorId);
  const isEnrollment = targetFactor && (targetFactor.status as string) === 'unverified';

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
  const successAction = isEnrollment ? 'employee.mfa_enrolled' : 'employee.mfa_challenge_success';
  await auth.service.from('audit_logs').insert({
    actor_profile_id: auth.user.id,
    action: successAction,
    target_type: 'profile',
    target_id: auth.user.id,
    result: 'success',
    reason: isEnrollment ? 'TOTP enrolled' : 'TOTP verified',
    details: { method: request.method, path: new URL(request.url).pathname },
    ...auth.auditContext,
  });

  // Return the upgraded session to the client
  return Response.json({ data: verifyData });
}
