import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { DEFAULT_ADS_SETTINGS, type CustomAdsSettings } from '@/lib/ads';

const ALLOWED_ROLES = ['owner', 'superadmin', 'admin'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const { data: settingRow, error } = await authorization.service
    .from('site_settings')
    .select('key, value, updated_at, updated_by')
    .eq('key', 'custom_ads')
    .maybeSingle();

  if (error) {
    return Response.json({ error: 'Failed to retrieve custom ads settings.' }, { status: 500 });
  }

  const rawValue = settingRow?.value as Partial<CustomAdsSettings> | null;
  const adsSettings: CustomAdsSettings = {
    monetization_enabled: rawValue?.monetization_enabled ?? DEFAULT_ADS_SETTINGS.monetization_enabled,
    contact_email_for_ads: rawValue?.contact_email_for_ads || DEFAULT_ADS_SETTINGS.contact_email_for_ads,
    contact_phone_for_ads: rawValue?.contact_phone_for_ads || DEFAULT_ADS_SETTINGS.contact_phone_for_ads,
    pricing_badge: rawValue?.pricing_badge || DEFAULT_ADS_SETTINGS.pricing_badge,
    placements: Array.isArray(rawValue?.placements) && rawValue.placements.length > 0
      ? rawValue.placements
      : DEFAULT_ADS_SETTINGS.placements,
  };

  return Response.json({
    settings: adsSettings,
    updated_at: settingRow?.updated_at || null,
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify custom ads settings.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Partial<CustomAdsSettings>;
  try {
    body = (await request.json()) as Partial<CustomAdsSettings>;
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const sanitized: CustomAdsSettings = {
    monetization_enabled: body.monetization_enabled ?? true,
    contact_email_for_ads: body.contact_email_for_ads?.trim() || DEFAULT_ADS_SETTINGS.contact_email_for_ads,
    contact_phone_for_ads: body.contact_phone_for_ads?.trim() || DEFAULT_ADS_SETTINGS.contact_phone_for_ads,
    pricing_badge: body.pricing_badge?.trim() || DEFAULT_ADS_SETTINGS.pricing_badge,
    placements: Array.isArray(body.placements) && body.placements.length > 0
      ? body.placements
      : DEFAULT_ADS_SETTINGS.placements,
  };

  // Upsert into site_settings using service role client to avoid RLS permission issues on roles table
  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'custom_ads',
      value: sanitized,
      description: 'Custom direct monetization and advertising placements configuration',
      updated_at: new Date().toISOString(),
      updated_by: authorization.profile.id,
    }, { onConflict: 'key' });

  if (updateError) {
    console.error('Failed to update custom ads settings in database:', updateError);
    return Response.json({ error: 'Failed to update custom ads configuration in database.' }, { status: 500 });
  }

  // Record audit log via service role
  try {
    await authorization.service.from('audit_logs').insert({
      user_id: authorization.profile.id,
      action: 'UPDATE',
      entity_name: 'site_settings',
      entity_id: 'custom_ads',
      changes: {
        monetization_enabled: sanitized.monetization_enabled,
        placements_count: sanitized.placements.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (auditErr) {
    console.warn('Audit log write warning:', auditErr);
  }

  return Response.json({
    success: true,
    settings: sanitized,
  });
}
