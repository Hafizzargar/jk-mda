import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import {
  runAutonomousNewsDiscovery,
  getDailyRegionalStats,
  getAutoPublishConfig,
  processPendingAutoPublishes,
  getCivicProblemsDailyStatus,
  KJIN_REGIONAL_TARGETS,
} from '@/lib/newsroom/autonomous-discovery';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    let beatId: string | undefined;
    let districtId: string | undefined;
    let topic: 'general' | 'civic_problems' | undefined;
    let force = false;

    try {
      const body = await request.json();
      if (body?.beat_id) beatId = body.beat_id;
      if (body?.district_id) districtId = body.district_id;
      if (body?.topic) topic = body.topic;
      if (body?.force) force = Boolean(body.force);
    } catch {
      // Empty or non-JSON body is allowed
    }

    const result = await runAutonomousNewsDiscovery(auth.service, { beatId, districtId, topic, force });

    return Response.json(result);
  } catch (error: any) {
    console.error('Error triggering autonomous news discovery:', error);
    return Response.json({ success: false, error: error.message || 'Discovery run failed.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    // Proactively process any pending auto-publishes whose 5-min grace window elapsed
    await processPendingAutoPublishes(auth.service).catch(() => null);

    const [dailyStats, recentResult, autoPublishConfig, civicProblems] = await Promise.all([
      getDailyRegionalStats(auth.service),
      auth.service
        .from('articles')
        .select('id, title, slug, status, category, district, created_at, source_name, source_url')
        .or('author_display_name.eq.KJIN AI Discovery,status.eq.review')
        .order('created_at', { ascending: false })
        .limit(12),
      getAutoPublishConfig(auth.service),
      getCivicProblemsDailyStatus(auth.service).catch(() => null),
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
    });
  } catch (error: any) {
    console.error('Error getting discovery status:', error);
    return Response.json({ success: false, error: error.message || 'Failed to fetch status.' }, { status: 500 });
  }
}
