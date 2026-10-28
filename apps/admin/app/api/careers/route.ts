import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { DEFAULT_CAREERS_SETTINGS, sanitizeCareersSettings, type CareersSettings } from '@/lib/careers';

const ALLOWED_ROLES = ['owner', 'superadmin', 'admin'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const { data: settingRow, error } = await authorization.service
    .from('site_settings')
    .select('key, value, updated_at, updated_by')
    .eq('key', 'careers_settings')
    .maybeSingle();

  if (error) {
    return Response.json({ error: 'Failed to retrieve careers settings.' }, { status: 500 });
  }

  const rawValue = settingRow?.value as Partial<CareersSettings> | null;
  const careersSettings = sanitizeCareersSettings(rawValue || DEFAULT_CAREERS_SETTINGS);

  return Response.json({
    careers_settings: careersSettings,
    updated_at: settingRow?.updated_at || null,
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to manage careers and newsroom hiring.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Partial<CareersSettings> & { reason?: string };
  try {
    body = (await request.json()) as Partial<CareersSettings> & { reason?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const sanitized = sanitizeCareersSettings(body);
  const reason = body.reason?.trim() || 'Updated careers and job postings via Admin Portal';

  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'careers_settings',
      value: sanitized,
      description: 'Public newspaper careers page, newsroom job openings, and candidate applications',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Careers API] Failed to update site_settings:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'careers.updated',
    target_type: 'site_settings',
    target_id: 'careers_settings',
    result: 'success',
    reason,
    details: {
      role_key: authorization.profile.role_key,
      total_jobs: sanitized.jobs.length,
      active_jobs: sanitized.jobs.filter((j) => j.status === 'active').length,
      total_applications: sanitized.applications.length,
      hiring_status: sanitized.hiring_status,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: 'Careers and hiring configuration updated successfully.',
    careers_settings: sanitized,
  });
}
