import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { DEFAULT_FESTIVE_SETTINGS, getFestiveSettings, type FestiveCelebrationSettings } from '@/lib/festive';

const ALLOWED_ROLES = ['owner', 'superadmin', 'admin', 'editor'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const settings = await getFestiveSettings(authorization.service);

  return Response.json({
    celebrations: settings,
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify festive celebration settings.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Partial<FestiveCelebrationSettings> & { reason?: string };
  try {
    body = (await request.json()) as Partial<FestiveCelebrationSettings> & { reason?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const current = await getFestiveSettings(authorization.service);
  const updated: FestiveCelebrationSettings = {
    enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
    force_active_now: typeof body.force_active_now === 'boolean' ? body.force_active_now : current.force_active_now,
    mode: body.mode === 'manual' || body.mode === 'scheduled' ? body.mode : current.mode,
    start_date: body.start_date || current.start_date,
    end_date: body.end_date || current.end_date,
    occasion_name: body.occasion_name?.trim() || current.occasion_name,
    greeting_title: body.greeting_title?.trim() || current.greeting_title,
    greeting_message: body.greeting_message?.trim() || current.greeting_message,
    effect_type: body.effect_type || current.effect_type,
    colors: Array.isArray(body.colors) && body.colors.length > 0 ? body.colors : current.colors,
    duration_seconds: typeof body.duration_seconds === 'number' && body.duration_seconds >= 3 && body.duration_seconds <= 30
      ? body.duration_seconds
      : current.duration_seconds,
    play_frequency: body.play_frequency || current.play_frequency,
    show_greeting_banner: typeof body.show_greeting_banner === 'boolean' ? body.show_greeting_banner : current.show_greeting_banner,
    sound_enabled: typeof body.sound_enabled === 'boolean' ? body.sound_enabled : current.sound_enabled,
    created_at: current.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const reason = body.reason?.trim() || `Updated festive celebration overlay: ${updated.occasion_name}`;

  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'festive_celebration',
      value: updated,
      description: 'Festive celebration overlay, firelight particle effects, and cultural greetings',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Celebrations API] Database update failed:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'site_settings.festive_updated',
    target_type: 'site_settings',
    target_id: 'festive_celebration',
    result: 'success',
    reason,
    details: {
      role_key: authorization.profile.role_key,
      occasion_name: updated.occasion_name,
      enabled: updated.enabled,
      mode: updated.mode,
      effect_type: updated.effect_type,
      start_date: updated.start_date,
      end_date: updated.end_date,
      colors: updated.colors,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: 'Festive celebration settings updated and auto-synced successfully.',
    celebrations: updated,
  });
}
