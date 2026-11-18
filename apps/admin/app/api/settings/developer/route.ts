import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import {
  DEFAULT_DEVELOPER_SUPPORT,
  sanitizeDeveloperSupportSettings,
  validateEmail,
  validatePhone,
  validateUrl,
  type DeveloperSupportSettings,
} from '@/lib/developer-support';

const ALLOWED_ROLES = ['owner', 'superadmin', 'admin'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const { data: settingRow, error } = await authorization.service
    .from('site_settings')
    .select('key, value, updated_at, updated_by')
    .eq('key', 'developer_support')
    .maybeSingle();

  if (error) {
    return Response.json({ error: 'Failed to retrieve developer support settings.' }, { status: 500 });
  }

  const rawValue = settingRow?.value as Partial<DeveloperSupportSettings> | null;
  const developerSupport = sanitizeDeveloperSupportSettings(rawValue || DEFAULT_DEVELOPER_SUPPORT);

  return Response.json({
    developer_support: developerSupport,
    updated_at: settingRow?.updated_at || null,
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify developer & technical support settings.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Partial<DeveloperSupportSettings> & { reason?: string };
  try {
    body = (await request.json()) as Partial<DeveloperSupportSettings> & { reason?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  // Field validation
  if (body.support_email && !validateEmail(body.support_email)) {
    return Response.json({ error: 'Invalid support email address format.' }, { status: 400 });
  }

  if (body.support_phone && !validatePhone(body.support_phone)) {
    return Response.json({ error: 'Invalid support telephone number format.' }, { status: 400 });
  }

  if (body.developer_website && !validateUrl(body.developer_website)) {
    return Response.json({ error: 'Invalid developer website URL. Must begin with http:// or https://' }, { status: 400 });
  }

  const sanitized = sanitizeDeveloperSupportSettings(body);
  const reason = body.reason?.trim() || 'Updated website developer attribution and technical support settings';

  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'developer_support',
      value: sanitized,
      description: 'Website development team attribution, developer website, and technical support hotlines',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Developer Support API] Failed to update site_settings:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'site_settings.developer_support_updated',
    target_type: 'site_settings',
    target_id: 'developer_support',
    result: 'success',
    reason,
    details: {
      role_key: authorization.profile.role_key,
      show_developer_section: sanitized.show_developer_section,
      developer_name: sanitized.developer_name,
      support_email: sanitized.support_email,
      support_phone: sanitized.support_phone,
      footer_position: sanitized.footer_position,
      show_on_mobile: sanitized.show_on_mobile,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: 'Developer attribution and technical support settings updated successfully.',
    developer_support: sanitized,
  });
}
