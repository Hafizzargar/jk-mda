import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeEmployeeRequest(request, 'employee.contact.update');
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const { id } = await context.params;
  let body: { email?: string; phone?: string; reason?: string };
  try {
    body = (await request.json()) as { email?: string; phone?: string; reason?: string };
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { data: target } = await authorization.service
    .from('profiles')
    .select('id, role_key')
    .eq('id', id)
    .maybeSingle();
  const { data: actorRole } = await authorization.service.from('roles').select('hierarchy_rank').eq('role_key', authorization.profile.role_key).single();
  const { data: targetRole } = target
    ? await authorization.service.from('roles').select('hierarchy_rank').eq('role_key', target.role_key).single()
    : { data: null };

  if (!target || !actorRole || !targetRole || id === authorization.user.id || target.role_key === 'owner' || targetRole.hierarchy_rank >= actorRole.hierarchy_rank) {
    return Response.json({ error: 'You cannot change this employee contact information.' }, { status: 403 });
  }

  const attributes: { email?: string; phone?: string } = {};
  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
    attributes.email = email;
  }
  if (body.phone !== undefined) {
    const phone = body.phone.trim();
    if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) return Response.json({ error: 'Enter a valid phone number.' }, { status: 400 });
    attributes.phone = phone;
  }
  if (Object.keys(attributes).length === 0) return Response.json({ error: 'Provide an email or phone number.' }, { status: 400 });

  const { error } = await authorization.service.auth.admin.updateUserById(id, attributes);
  if (error) {
    await authorization.service.from('audit_logs').insert({
      actor_profile_id: authorization.user.id,
      action: 'employee.contact_update_failed',
      target_type: 'profile',
      target_id: id,
      result: 'failure',
      reason: body.reason ?? '',
      details: { fields: Object.keys(attributes), error: error.message },
      ...authorization.auditContext,
    });
    return Response.json({ error: error.message }, { status: 400 });
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'employee.contact_updated',
    target_type: 'profile',
    target_id: id,
    result: 'success',
    reason: body.reason ?? '',
    details: { fields: Object.keys(attributes) },
    ...authorization.auditContext,
  });

  return Response.json({ status: 'updated' });
}
