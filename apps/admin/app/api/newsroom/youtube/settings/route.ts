import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function GET(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service } = auth;
    const { data } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_auto_pilot')
      .maybeSingle();

    const intervalMinutes = data?.value?.interval_minutes ? Number(data.value.interval_minutes) : 5;
    const autoPilotEnabled = data?.value?.auto_pilot_enabled !== false;
    const beatQuotas = data?.value?.beat_quotas || null;

    return Response.json({
      interval_minutes: intervalMinutes,
      auto_pilot_enabled: autoPilotEnabled,
      beat_quotas: beatQuotas,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to load settings.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const body = await request.json();
    const intervalMinutes = Math.max(1, Number(body.interval_minutes) || 5);
    const autoPilotEnabled = body.auto_pilot_enabled !== false;
    const beatQuotas = body.beat_quotas !== undefined ? body.beat_quotas : undefined;

    const { service, profile } = auth;

    // Load existing settings to merge safely
    const { data: existing } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_auto_pilot')
      .maybeSingle();

    const mergedValue: Record<string, any> = {
      ...(existing?.value || {}),
      interval_minutes: intervalMinutes,
      auto_pilot_enabled: autoPilotEnabled,
    };
    if (beatQuotas !== undefined) {
      mergedValue.beat_quotas = beatQuotas;
    }

    const { error } = await service.from('site_settings').upsert({
      key: 'newsroom_auto_pilot',
      value: mergedValue,
      description: 'Newsroom YouTube Autonomous Surveillance Auto-Pilot schedule configuration and beat quotas',
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    });

    if (error) {
      throw error;
    }

    return Response.json({
      success: true,
      interval_minutes: intervalMinutes,
      auto_pilot_enabled: autoPilotEnabled,
      beat_quotas: mergedValue.beat_quotas || null,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to update settings.' }, { status: 500 });
  }
}

