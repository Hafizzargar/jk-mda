import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';

export async function POST(request: Request) {
  try {
    const authorization = await authenticateEmployeeRequest(request);
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    const reauth = await requireRecentAuthentication(authorization, request);
    if (reauth) return reauth;

    // Only owner and superadmin can reset staff MFA
    const userRole = authorization.profile.role_key;
    if (!['owner', 'superadmin'].includes(userRole)) {
      return Response.json(
        { error: 'Only owners and superadmins are authorized to reset employee MFA.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { target_id?: string; reason?: string };
    const { target_id, reason } = body;

    if (!target_id || typeof target_id !== 'string') {
      return Response.json({ error: 'Target employee ID is required.' }, { status: 400 });
    }

    const { service } = authorization;

    // Fetch target profile
    const { data: targetProfile, error: profileErr } = await service
      .from('profiles')
      .select('id, email, display_name, role_key')
      .eq('id', target_id)
      .maybeSingle();

    if (profileErr || !targetProfile) {
      return Response.json({ error: 'Employee not found.' }, { status: 404 });
    }

    // Owners cannot have their MFA reset by a subordinate superadmin
    if (targetProfile.role_key === 'owner' && userRole !== 'owner') {
      return Response.json({ error: 'Only the Owner can reset an Owner account MFA.' }, { status: 403 });
    }

    // 1. Fetch factor IDs for this user
    const { data: factors, error: factorsErr } = await service
      .from('mfa_factors')
      .select('id')
      .eq('user_id', target_id);

    // If query table directly or via RPC:
    // In Supabase, mfa_factors is in auth schema. Service role can run deletion:
    // We can run deletion on auth.mfa_factors using rpc or direct delete:
    const factorIds = (factors || []).map((f) => f.id);

    if (factorIds.length > 0) {
      await service.from('mfa_challenges').delete().in('factor_id', factorIds);
      await service.from('mfa_factors').delete().eq('user_id', target_id);
    }

    // Also call Supabase admin auth API listFactors & deleteFactor
    try {
      const { data: userFactors } = await service.auth.admin.mfa.listFactors({
        userId: target_id,
      });

      const all = [...(userFactors?.factors ?? [])];
      for (const factor of all) {
        await service.auth.admin.mfa.deleteFactor({
          id: factor.id,
          userId: target_id,
        });
      }
    } catch (adminErr) {
      console.warn('admin.mfa.deleteFactor fallback:', adminErr);
    }

    // Record audit event
    await service.from('audit_logs').insert({
      actor_profile_id: authorization.user.id,
      action: 'employee.mfa_reset',
      target_type: 'profile',
      target_id,
      result: 'success',
      reason: reason || 'MFA factors reset by administrator',
      details: {
        target_name: targetProfile.display_name,
        target_email: targetProfile.email,
        target_role: targetProfile.role_key,
        reset_by_role: userRole,
      },
      ...authorization.auditContext,
    });

    return Response.json({
      success: true,
      message: `MFA factors for ${targetProfile.display_name} have been reset. They will see the QR code on their next login.`,
    });
  } catch (err) {
    console.error('Admin reset MFA error:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
