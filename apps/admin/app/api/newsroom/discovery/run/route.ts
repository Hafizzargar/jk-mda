import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import {
  runAutonomousNewsDiscovery,
  getDailyRegionalStats,
  KJIN_REGIONAL_TARGETS,
} from '@/lib/newsroom/autonomous-discovery';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    let beatId: string | undefined;
    let force = false;

    try {
      const body = await request.json();
      if (body?.beat_id) beatId = body.beat_id;
      if (body?.force) force = Boolean(body.force);
    } catch {
      // Empty or non-JSON body is allowed
    }

    const result = await runAutonomousNewsDiscovery(auth.service, { beatId, force });

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

    const [dailyStats, recentResult] = await Promise.all([
      getDailyRegionalStats(auth.service),
      auth.service
        .from('articles')
        .select('id, title, slug, status, category, district, created_at, source_name, source_url')
        .or('author_display_name.eq.KJIN AI Discovery,status.eq.review')
        .order('created_at', { ascending: false })
        .limit(12),
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
        policy: '100% Pending Approval (0 Auto-Publish)',
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
      recentDiscoveries: recentResult.data || [],
    });
  } catch (error: any) {
    console.error('Error getting discovery status:', error);
    return Response.json({ success: false, error: error.message || 'Failed to fetch status.' }, { status: 500 });
  }
}
