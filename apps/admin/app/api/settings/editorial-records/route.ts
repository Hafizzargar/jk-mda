import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { DEFAULT_EDITORIAL_DESK_SETTINGS, sanitizeEditorialDeskSettings, type EditorialDeskSettings } from '@/lib/editorial-desk';

const ALLOWED_ROLES = ['owner', 'superadmin', 'admin', 'editor'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  // 1. Fetch current settings from site_settings
  const { data: settingRow, error } = await authorization.service
    .from('site_settings')
    .select('key, value, updated_at, updated_by')
    .eq('key', 'editorial_desk_settings')
    .maybeSingle();

  if (error) {
    console.error('Failed to retrieve editorial desk settings:', error);
    return Response.json({ error: 'Failed to retrieve editorial desk settings.' }, { status: 500 });
  }

  const settings = settingRow?.value
    ? sanitizeEditorialDeskSettings(settingRow.value)
    : DEFAULT_EDITORIAL_DESK_SETTINGS;

  // 2. Fetch list of published articles for article dropdown selector (focusing on Opinion, Editorial, Special)
  const { data: candidateArticles } = await authorization.service
    .from('articles')
    .select('id, title, category, author_display_name, published_at, slug')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(40);

  return Response.json({
    settings,
    articles: candidateArticles || [],
    updated_at: settingRow?.updated_at || null,
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify Editorial Desk and Citizen Voices settings.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const sanitized: EditorialDeskSettings = sanitizeEditorialDeskSettings(body);

  // 1. Upsert into site_settings under 'editorial_desk_settings'
  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'editorial_desk_settings',
      value: sanitized,
      description: 'Official Editorial of Record (Op-Ed) and Citizen Voices of the Corridors configuration',
      updated_at: new Date().toISOString(),
      updated_by: authorization.profile.id,
    }, { onConflict: 'key' });

  if (updateError) {
    console.error('Failed to update editorial_desk_settings in database:', updateError);
    return Response.json({ error: 'Failed to save editorial desk settings in database.' }, { status: 500 });
  }

  // 2. Also keep telemetry_settings.voices_of_corridors in sync for backward compatibility
  try {
    const { data: telemetryRow } = await authorization.service
      .from('site_settings')
      .select('value')
      .eq('key', 'telemetry_settings')
      .maybeSingle();

    if (telemetryRow?.value && typeof telemetryRow.value === 'object') {
      const currentTelemetry = telemetryRow.value as Record<string, unknown>;
      await authorization.service
        .from('site_settings')
        .update({
          value: {
            ...currentTelemetry,
            voices_of_corridors: sanitized.voices_of_corridors,
          },
          updated_at: new Date().toISOString(),
          updated_by: authorization.profile.id,
        })
        .eq('key', 'telemetry_settings');
    }
  } catch (syncErr) {
    console.warn('Non-fatal: could not synchronize voices_of_corridors to telemetry_settings:', syncErr);
  }

  return Response.json({
    success: true,
    settings: sanitized,
    message: 'Editorial Desk and Citizen Voices updated successfully.',
  });
}

