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

    const intervalMinutes = data?.value?.interval_minutes !== undefined && !isNaN(Number(data.value.interval_minutes))
      ? Math.max(1, Number(data.value.interval_minutes))
      : 3;
    const autoPilotEnabled = data?.value?.auto_pilot_enabled !== false;
    const autoPublishEnabled = Boolean(data?.value?.auto_publish_enabled);
    const autoPublishDelayMinutes = Math.max(1, Number(data?.value?.auto_publish_delay_minutes) || 5);
    const scheduledQueue = Array.isArray(data?.value?.scheduled_queue) ? data.value.scheduled_queue : [];
    const beatQuotas = data?.value?.beat_quotas || null;
    const civicMaxDaily = data?.value?.civic_max_daily !== undefined
      ? Math.max(1, Math.min(10, Number(data.value.civic_max_daily)))
      : 2;
    const civicIntervalHours = data?.value?.civic_interval_hours !== undefined
      ? Math.max(1, Math.min(24, Number(data.value.civic_interval_hours)))
      : 6;

    const nowMs = Date.now();
    const lastScanAt = data?.value?.last_scan_at || null;
    let nextScanAt = data?.value?.next_scan_at || null;

    // Calculate reliable server-side countdown window
    if (!nextScanAt || new Date(nextScanAt).getTime() <= nowMs) {
      if (lastScanAt) {
        const lastMs = new Date(lastScanAt).getTime();
        const cycleMs = intervalMinutes * 60 * 1000;
        const cyclesPassed = Math.floor((nowMs - lastMs) / cycleMs);
        nextScanAt = new Date(lastMs + (cyclesPassed + 1) * cycleMs).toISOString();
      } else {
        nextScanAt = new Date(nowMs + intervalMinutes * 60 * 1000).toISOString();
      }
    }

    const remainingSeconds = Math.max(0, Math.ceil((new Date(nextScanAt).getTime() - nowMs) / 1000));

    return Response.json({
      interval_minutes: intervalMinutes,
      auto_pilot_enabled: autoPilotEnabled,
      auto_publish_enabled: autoPublishEnabled,
      auto_publish_delay_minutes: autoPublishDelayMinutes,
      scheduled_queue: scheduledQueue,
      beat_quotas: beatQuotas,
      civic_max_daily: civicMaxDaily,
      civic_interval_hours: civicIntervalHours,
      last_scan_at: lastScanAt,
      next_scan_at: nextScanAt,
      remaining_seconds: remainingSeconds,
      server_time: new Date().toISOString(),
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
    const intervalMinutes = Math.max(1, Number(body.interval_minutes) || 3);
    const autoPilotEnabled = body.auto_pilot_enabled !== false;
    const beatQuotas = body.beat_quotas !== undefined ? body.beat_quotas : undefined;
    const autoPublishEnabled = body.auto_publish_enabled !== undefined ? Boolean(body.auto_publish_enabled) : undefined;
    const autoPublishDelayMinutes = body.auto_publish_delay_minutes !== undefined ? Math.max(1, Number(body.auto_publish_delay_minutes) || 5) : undefined;
    const civicMaxDaily = body.civic_max_daily !== undefined ? Math.max(1, Math.min(10, Number(body.civic_max_daily))) : undefined;
    const civicIntervalHours = body.civic_interval_hours !== undefined ? Math.max(1, Math.min(24, Number(body.civic_interval_hours))) : undefined;
    const nextScanAt = body.next_scan_at !== undefined ? body.next_scan_at : undefined;
    const lastScanAt = body.last_scan_at !== undefined ? body.last_scan_at : undefined;

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
    if (nextScanAt !== undefined) {
      mergedValue.next_scan_at = nextScanAt;
    }
    if (lastScanAt !== undefined) {
      mergedValue.last_scan_at = lastScanAt;
    }
    if (beatQuotas !== undefined) {
      mergedValue.beat_quotas = beatQuotas;
    }
    if (autoPublishEnabled !== undefined) {
      mergedValue.auto_publish_enabled = autoPublishEnabled;
    }
    if (autoPublishDelayMinutes !== undefined) {
      mergedValue.auto_publish_delay_minutes = autoPublishDelayMinutes;
    }
    if (civicMaxDaily !== undefined) {
      mergedValue.civic_max_daily = civicMaxDaily;
    }
    if (civicIntervalHours !== undefined) {
      mergedValue.civic_interval_hours = civicIntervalHours;
    }

    const { error } = await service.from('site_settings').upsert({
      key: 'newsroom_auto_pilot',
      value: mergedValue,
      description: 'Newsroom YouTube Autonomous Surveillance Auto-Pilot schedule configuration, beat quotas and auto-publish',
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
      auto_publish_enabled: mergedValue.auto_publish_enabled ?? false,
      auto_publish_delay_minutes: mergedValue.auto_publish_delay_minutes ?? 5,
      beat_quotas: mergedValue.beat_quotas || null,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to update settings.' }, { status: 500 });
  }
}

