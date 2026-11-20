export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import {
  runAutonomousNewsDiscovery,
  getDailyRegionalStats,
  getAutoPublishConfig,
  processPendingAutoPublishes,
  getCivicProblemsDailyStatus,
  getRecentScanLogs,
  clearScanLogs,
  KJIN_REGIONAL_TARGETS,
} from '@/lib/newsroom/autonomous-discovery';

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const cronHeader = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('Authorization');
  if (cronHeader === cronSecret) return true;
  if (authHeader && authHeader.replace(/^Bearer\s+/i, '').trim() === cronSecret) return true;
  return false;
}

async function resolveService(request: Request) {
  if (isCronAuthorized(request)) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return { error: Response.json({ error: 'Supabase credentials missing.' }, { status: 500 }) };
    }
    return { service: createClient(url, key, { auth: { persistSession: false } }) };
  }
  const auth = await authorizeEmployeeRequest(request, 'article.review');
  if (!isEmployeeAuthorization(auth)) {
    return { error: auth };
  }
  return { service: auth.service };
}

export async function POST(request: Request) {
  try {
    const { service, error } = await resolveService(request);
    if (error) return error;

    let beatId: string | undefined;
    let districtId: string | undefined;
    let topic: 'general' | 'civic_problems' | undefined;
    let force = false;
    let freshnessHours: number | undefined;
    let action: string | undefined;

    try {
      const body = await request.json();
      if (body?.action) action = body.action;
      if (body?.beat_id) beatId = body.beat_id;
      if (body?.district_id) districtId = body.district_id;
      if (body?.topic) topic = body.topic;
      if (body?.force) force = Boolean(body.force);
      if (body?.freshness_hours) freshnessHours = Number(body.freshness_hours);
    } catch {
      // Empty or non-JSON body is allowed
    }

    if (action === 'clear_logs') {
      await clearScanLogs(service);
      return Response.json({ success: true, scanLogs: [] });
    }

    const result = await runAutonomousNewsDiscovery(service, { beatId, districtId, topic, force, freshnessHours });

    // Update backend scan schedule timestamps in site_settings
    let nextScanAt: string | undefined;
    try {
      const { data: currentSettings } = await service
        .from('site_settings')
        .select('value')
        .eq('key', 'newsroom_auto_pilot')
        .maybeSingle();

      const intervalMinutes = Number(currentSettings?.value?.interval_minutes) || 3;
      const now = new Date();
      nextScanAt = new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString();

      await service.from('site_settings').upsert({
        key: 'newsroom_auto_pilot',
        value: {
          ...(currentSettings?.value || {}),
          last_scan_at: now.toISOString(),
          next_scan_at: nextScanAt,
        },
        updated_at: now.toISOString(),
      });
    } catch (settErr) {
      console.warn('Failed to update next_scan_at in site_settings:', settErr);
    }

    return Response.json({
      ...result,
      next_scan_at: nextScanAt,
    });
  } catch (error: any) {
    console.error('Error triggering autonomous news discovery:', error);
    return Response.json({ success: false, error: error.message || 'Discovery run failed.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { service, error } = await resolveService(request);
    if (error) return error;

    // Proactively process any pending auto-publishes whose 5-min grace window elapsed
    await processPendingAutoPublishes(service).catch(() => null);

    const [dailyStats, recentResult, autoPublishConfig, civicProblems, scanLogs] = await Promise.all([
      getDailyRegionalStats(service),
      service
        .from('articles')
        .select('id, title, slug, status, category, district, created_at, source_name, source_url')
        .or('author_display_name.eq.KJCPL AI Discovery,author_display_name.eq.KJIN AI Discovery,status.eq.review')
        .order('created_at', { ascending: false })
        .limit(12),
      getAutoPublishConfig(service),
      getCivicProblemsDailyStatus(service).catch(() => null),
      getRecentScanLogs(service).catch(() => []),
    ]);

    return Response.json({
      success: true,
      stats: {
        publishedToday: dailyStats.totalPublishedToday ?? 0,
        discoveredToday: dailyStats.totalDiscoveredToday,
        regionalCount: dailyStats.regionalDiscoveredToday,
        nationalInternationalCount: dailyStats.nationalInternationalDiscoveredToday,
        regionalSharePercent: dailyStats.regionalSharePercent,
        dailyTarget: dailyStats.targetOverview.preferredOperatingTarget,
        minDailyTotal: dailyStats.targetOverview.minDailyTotal,
        maxDailyTotal: dailyStats.targetOverview.maxDailyTotal,
        remainingToday: Math.max(0, dailyStats.targetOverview.preferredOperatingTarget - dailyStats.totalDiscoveredToday),
        scheduleMinutes: 60,
        policy: autoPublishConfig.enabled
          ? `Auto-Publish Active (${autoPublishConfig.delayMinutes}m Grace • Advance Email Alert)`
          : '100% Pending Approval (0 Auto-Publish)',
      },
      autoPublish: {
        enabled: autoPublishConfig.enabled,
        delayMinutes: autoPublishConfig.delayMinutes,
        scheduledQueue: autoPublishConfig.queue,
      },
      regions: dailyStats.regions,
      beats: KJIN_REGIONAL_TARGETS.map((b) => ({
        id: b.id,
        name: b.name,
        shortName: b.shortName,
        scope: b.scope,
        min: b.min,
        max: b.max,
        weight: b.weight,
        isRegional: b.isRegional,
      })),
      civicProblems: civicProblems || {
        currentToday: 0,
        maxDaily: 2,
        lastProblemAt: null,
        canDiscoverNow: true,
        hoursSinceLastProblem: null,
        hoursUntilNextAllowed: 0,
      },
      recentDiscoveries: recentResult.data || [],
      scanLogs: scanLogs || [],
    });
  } catch (error: any) {
    console.error('Error getting discovery status:', error);
    return Response.json({ success: false, error: error.message || 'Failed to fetch status.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { service, error } = await resolveService(request);
    if (error) return error;
    await clearScanLogs(service);
    return Response.json({ success: true, scanLogs: [] });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message || 'Failed to clear logs.' }, { status: 500 });
  }
}
