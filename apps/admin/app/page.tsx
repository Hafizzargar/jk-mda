import { createClient } from '@supabase/supabase-js';
import { DashboardView } from '@/components/DashboardView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REGION_DISTRICT_MAP: Record<string, string[]> = {
  kashmir: ['srinagar', 'baramulla', 'anantnag', 'pulwama', 'budgam', 'ganderbal', 'bandipora', 'kupwara', 'kulgam', 'shopian'],
  jammu: ['jammu', 'samba', 'kathua', 'udhampur', 'reasi'],
  chenab: ['doda', 'kishtwar', 'ramban'],
  pir_panjal: ['rajouri', 'poonch'],
  ladakh: ['leh', 'kargil'],
};

async function getDashboardData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  try {
    const [statusResult, articlesResult, totalLogsResult, todayLogsResult, pendingAiResult] = await Promise.all([
      client.from('articles').select('status'),
      client
        .from('articles')
        .select('id, title, slug, category, district, view_count, status, published_at')
        .eq('status', 'published')
        .order('view_count', { ascending: false }),
      client
        .from('article_views_log')
        .select('*', { count: 'exact', head: true }),
      client
        .from('article_views_log')
        .select('*', { count: 'exact', head: true })
        .gte('viewed_at', todayStart),
      client
        .from('youtube_videos')
        .select('id, proposed_headline, proposed_category, published_at', { count: 'exact' })
        .eq('processing_status', 'draft_proposed'),
    ]);

    const counts = { draft: 0, review: 0, published: 0, archived: 0 };
    if (statusResult.data) {
      statusResult.data.forEach((a) => {
        const s = (a.status || 'draft') as keyof typeof counts;
        if (s in counts) counts[s] += 1;
      });
    }

    const allArticles = articlesResult.data ?? [];
    const totalViews = allArticles.reduce((sum, a) => sum + (a.view_count || 0), 0);
    const todayLogsCount = todayLogsResult.count;

    const byRegion: Record<string, number> = {
      kashmir: 0,
      jammu: 0,
      chenab: 0,
      pir_panjal: 0,
      ladakh: 0,
      national_international: 0,
    };

    allArticles.forEach((a) => {
      const d = (a.district || '').toLowerCase().trim();
      const views = a.view_count || 0;

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
    });

    let topRegion = 'N/A';
    let maxRegionViews = 0;
    for (const [regionName, count] of Object.entries(byRegion)) {
      if (count > maxRegionViews) {
        maxRegionViews = count;
        topRegion = regionName.charAt(0).toUpperCase() + regionName.slice(1).replace('_', ' ');
      }
    }
    const topRegionPercent = totalViews > 0 ? Math.round((maxRegionViews / totalViews) * 100) : 0;

    const topArticles = allArticles.slice(0, 10).map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      category: a.category,
      district: a.district,
      views: a.view_count || 0,
      publishedAt: a.published_at,
    }));

    const pendingAiCount = pendingAiResult.count || (pendingAiResult.data?.length ?? 0);

    return {
      pendingAiCount,
      stats: [
        { label: 'Drafts', value: counts.draft },
        { label: 'Pending review', value: counts.review },
        { label: 'Published today', value: counts.published },
        { label: 'Alerts', value: counts.archived },
      ],
      viewAnalytics: {
        totalViews,
        todayViews: todayLogsCount || 0,
        totalArticles: allArticles.length,
        topRegion,
        topRegionViews: maxRegionViews,
        topRegionPercent,
        topArticles,
      },
    };
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    return {
      pendingAiCount: 0,
      stats: [
        { label: 'Drafts', value: 0 },
        { label: 'Pending review', value: 0 },
        { label: 'Published today', value: 0 },
        { label: 'Alerts', value: 0 },
      ],
      viewAnalytics: {
        totalViews: 0,
        todayViews: 0,
        totalArticles: 0,
        topRegion: 'N/A',
        topRegionViews: 0,
        topRegionPercent: 0,
        topArticles: [],
      },
    };
  }
}

export default async function DashboardPage() {
  const { pendingAiCount, stats, viewAnalytics } = await getDashboardData();

  return (
    <DashboardView
      pendingAiCount={pendingAiCount}
      stats={stats}
      viewAnalytics={viewAnalytics}
    />
  );
}
