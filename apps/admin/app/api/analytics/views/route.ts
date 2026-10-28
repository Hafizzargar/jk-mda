import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const REGION_DISTRICT_MAP: Record<string, string[]> = {
  kashmir: ['srinagar', 'baramulla', 'anantnag', 'pulwama', 'budgam', 'ganderbal', 'bandipora', 'kupwara', 'kulgam', 'shopian'],
  jammu: ['jammu', 'samba', 'kathua', 'udhampur', 'reasi'],
  chenab: ['doda', 'kishtwar', 'ramban'],
  pir_panjal: ['rajouri', 'poonch'],
  ladakh: ['leh', 'kargil'],
};

export async function GET() {
  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 1. Fetch all published articles with their view counts and metadata
    const { data: articles, error: articlesError } = await client
      .from('articles')
      .select('id, title, slug, category, district, view_count, status, published_at')
      .eq('status', 'published')
      .order('view_count', { ascending: false });

    if (articlesError) {
      console.error('Error fetching articles for view analytics:', articlesError);
      return NextResponse.json({ error: 'Failed to query article views' }, { status: 500 });
    }

    const allArticles = articles ?? [];
    const totalViews = allArticles.reduce((sum, a) => sum + (a.view_count || 0), 0);

    // 2. Query article_views_log for unique visitors and today's activity
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { count: totalLogsCount } = await client
      .from('article_views_log')
      .select('*', { count: 'exact', head: true });

    const { count: todayLogsCount } = await client
      .from('article_views_log')
      .select('*', { count: 'exact', head: true })
      .gte('viewed_at', todayStart);

    // 3. Compute Regional Breakdown
    const byRegion: Record<string, number> = {
      kashmir: 0,
      jammu: 0,
      chenab: 0,
      pir_panjal: 0,
      ladakh: 0,
      national_international: 0,
    };

    const byCategory: Record<string, number> = {};

    allArticles.forEach((a) => {
      const d = (a.district || '').toLowerCase().trim();
      const c = (a.category || 'General').trim();
      const views = a.view_count || 0;

      // Region aggregation
      if (REGION_DISTRICT_MAP.kashmir.includes(d)) {
        byRegion.kashmir += views;
      } else if (REGION_DISTRICT_MAP.jammu.includes(d)) {
        byRegion.jammu += views;
      } else if (REGION_DISTRICT_MAP.chenab.includes(d)) {
        byRegion.chenab += views;
      } else if (REGION_DISTRICT_MAP.pir_panjal.includes(d)) {
        byRegion.pir_panjal += views;
      } else if (REGION_DISTRICT_MAP.ladakh.includes(d)) {
        byRegion.ladakh += views;
      } else {
        byRegion.national_international += views;
      }

      // Category aggregation
      const catKey = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
      byCategory[catKey] = (byCategory[catKey] || 0) + views;
    });

    // 4. Top 10 Most Read Stories
    const topArticles = allArticles.slice(0, 10).map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      category: a.category,
      district: a.district,
      views: a.view_count || 0,
      publishedAt: a.published_at,
    }));

    // 5. Recent view logs
    const { data: recentLogs } = await client
      .from('article_views_log')
      .select('id, article_id, viewed_at')
      .order('viewed_at', { ascending: false })
      .limit(8);

    // 4. Determine leading corridor dynamically from actual database counts
    let topRegion = 'N/A';
    let maxRegionViews = 0;
    for (const [regionName, count] of Object.entries(byRegion)) {
      if (count > maxRegionViews) {
        maxRegionViews = count;
        topRegion = regionName.charAt(0).toUpperCase() + regionName.slice(1).replace('_', ' ');
      }
    }
    const topRegionPercent = totalViews > 0 ? Math.round((maxRegionViews / totalViews) * 100) : 0;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      overview: {
        totalViews,
        totalArticles: allArticles.length,
        verifiedViewsCount: totalLogsCount || 0,
        todayViews: todayLogsCount || 0,
        topRegion,
        topRegionViews: maxRegionViews,
        topRegionPercent,
      },
      byRegion,
      byCategory,
      topArticles,
      recentLogs: recentLogs ?? [],
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/analytics/views:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal analytics error' },
      { status: 500 }
    );
  }
}
