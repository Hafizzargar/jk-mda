import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { DEFAULT_FOOTER_CONTACT, sanitizeContactSettings, type FooterContactSettings } from '@/lib/contact';

const ALLOWED_ROLES = ['owner', 'superadmin'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const { data: settingRow, error } = await authorization.service
    .from('site_settings')
    .select('key, value, updated_at, updated_by')
    .eq('key', 'footer_contact')
    .maybeSingle();

  if (error) {
    return Response.json({ error: 'Failed to retrieve footer contact settings.' }, { status: 500 });
  }

  const rawValue = settingRow?.value as Partial<FooterContactSettings> | null;
  const footerContact = sanitizeContactSettings(rawValue || DEFAULT_FOOTER_CONTACT);

  return Response.json({
    footer_contact: footerContact,
    updated_at: settingRow?.updated_at || null,
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify footer contact settings.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Partial<FooterContactSettings> & { reason?: string };
  try {
    body = (await request.json()) as Partial<FooterContactSettings> & { reason?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const sanitized = sanitizeContactSettings(body);
  const reason = body.reason?.trim() || 'Updated footer contact information via Admin Portal';

  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'footer_contact',
      value: sanitized,
      description: 'Public website footer contact info, bureau addresses, emails, and hotlines',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Footer Settings API] Failed to update site_settings:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'site_settings.footer_contact_updated',
    target_type: 'site_settings',
    target_id: 'footer_contact',
    result: 'success',
    reason,
    details: {
      role_key: authorization.profile.role_key,
      organization_name: sanitized.organization_name,
      primary_address: sanitized.primary_address,
      phone_primary: sanitized.phone_primary,
      email_editorial: sanitized.email_editorial,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: 'Footer contact information updated successfully.',
    footer_contact: sanitized,
  });
}
