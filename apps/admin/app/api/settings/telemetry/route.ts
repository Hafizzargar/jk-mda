import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { DEFAULT_TELEMETRY_SETTINGS, getTelemetrySettings, type TelemetrySettings } from '@/lib/telemetry';

const EDIT_ROLES = ['owner', 'superadmin', 'admin', 'editor'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const telemetry = await getTelemetrySettings(authorization.service);

  return Response.json({
    telemetry,
    can_manage: EDIT_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!EDIT_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify regional telemetry settings.' },
      { status: 403 }
    );
  }

  // Require fresh MFA session for high-privilege configuration changes
  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Partial<TelemetrySettings> & { reason?: string };
  try {
    body = (await request.json()) as Partial<TelemetrySettings> & { reason?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const current = await getTelemetrySettings(authorization.service);
  const updated: TelemetrySettings = {
    live_wire: {
      ...current.live_wire,
      ...(body.live_wire || {}),
    },
    corridors_at_a_glance: body.corridors_at_a_glance || current.corridors_at_a_glance,
    mountain_passes: body.mountain_passes || current.mountain_passes,
    emergency_hotlines: body.emergency_hotlines || current.emergency_hotlines,
    offline_sos_message: body.offline_sos_message || current.offline_sos_message,
    mandi_commodities: body.mandi_commodities || current.mandi_commodities,
    voices_of_corridors: body.voices_of_corridors || current.voices_of_corridors,
    civic_initiative: {
      ...current.civic_initiative,
      ...(body.civic_initiative || {}),
    },
    convoy_slots: body.convoy_slots || current.convoy_slots,
    field_sensors: body.field_sensors || current.field_sensors,
    bureau_contacts: body.bureau_contacts || current.bureau_contacts,
  };

  const reason = body.reason?.trim() || 'Updated regional corridor telemetry & pass transit status via Admin Portal';

  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'telemetry_config',
      value: updated,
      description: 'Regional corridor diagnostics, mountain passes, road transit telemetry, and mandi spot prices',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Telemetry Settings API] Failed to update site_settings:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'site_settings.telemetry_updated',
    target_type: 'site_settings',
    target_id: 'telemetry_config',
    result: 'success',
    reason,
    details: {
      role_key: authorization.profile.role_key,
      passes_count: updated.mountain_passes.length,
      commodities_count: updated.mandi_commodities.length,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: 'Regional corridor telemetry updated successfully.',
    telemetry: updated,
  });
}
