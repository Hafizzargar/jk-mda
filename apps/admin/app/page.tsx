import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

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
    const [statusResult, articlesResult, totalLogsResult, todayLogsResult] = await Promise.all([
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

    return {
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
  const { stats, viewAnalytics } = await getDashboardData();

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto min-w-0">
      {/* Streamlined Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 dark:border-slate-800 pb-3 sm:pb-4 min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Newsroom editorial overview, real-time metrics, and reader traffic
          </p>
        </div>
      </div>

      {/* Metrics Overview Cards — 2x2 Grid on Mobile, 4-col on Desktop */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4 min-w-0">
        {stats.map((item) => {
          const icon =
            item.label === 'Drafts'
              ? '📝'
              : item.label === 'Pending review'
                ? '⏳'
                : item.label === 'Published today'
                  ? '🟢'
                  : '🚨';

          const accentColor =
            item.label === 'Drafts'
              ? 'border-slate-200/90 dark:border-slate-800 hover:border-cyan-500/60 bg-white dark:bg-slate-900'
              : item.label === 'Pending review'
                ? 'border-slate-200/90 dark:border-slate-800 hover:border-amber-500/60 bg-white dark:bg-slate-900'
                : item.label === 'Published today'
                  ? 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/60 bg-white dark:bg-slate-900'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-red-500/60 bg-white dark:bg-slate-900';

          return (
            <div
              key={item.label}
              className={`group relative overflow-hidden rounded-xl sm:rounded-2xl border p-3.5 sm:p-5 transition-all shadow-2xs hover:shadow-md min-w-0 ${accentColor}`}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                  {item.label}
                </p>
                <span className="text-base sm:text-xl opacity-90 group-hover:scale-110 transition-transform shrink-0">
                  {icon}
                </span>
              </div>
              <p className="mt-2 sm:mt-4 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {item.value}
              </p>
              <div className="mt-2 sm:mt-3 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                <span className="truncate">Real-time</span>
                <span className="text-cyan-700 dark:text-cyan-400 font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
                  View →
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Website Views & Audience Telemetry Section */}
      <section className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-4 sm:p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xl">
              👁️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Website Views & Audience Telemetry
                </h2>
                <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time verified reader traffic across all public regional bureaus and stories.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/analytics"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-xs transition"
            >
              <span>Full View Analytics</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* 4 Audience Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 sm:p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400">
              Total Website Views
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-white">
              {viewAnalytics.totalViews.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Live reads on public website
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 sm:p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400">
              Active Readers Today
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-white">
              {viewAnalytics.todayViews.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Logged today (IST)
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 sm:p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400">
              Top Bureau by Views
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-white capitalize">
              {viewAnalytics.topRegion && viewAnalytics.topRegion !== 'N/A'
                ? `${viewAnalytics.topRegion} (${viewAnalytics.topRegionPercent}%)`
                : 'N/A'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {viewAnalytics.topRegionViews.toLocaleString()} reads
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 sm:p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-400">
              Stories Tracked
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-white">
              {viewAnalytics.totalArticles.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Active published reporting
            </p>
          </div>
        </div>

        {/* Top 3 Most Read Stories Preview */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 sm:p-4 min-h-[155px]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <span>🔥 Most Read Stories Today</span>
            </span>
            <Link href="/analytics" className="text-xs text-cyan-400 hover:underline font-bold">
              View all stories →
            </Link>
          </div>
          <div className="divide-y divide-slate-800/60">
            {viewAnalytics.topArticles.length > 0 ? (
              viewAnalytics.topArticles.slice(0, 3).map((story, i) => (
                <div key={story.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-bold text-slate-500">#{i + 1}</span>
                    <p className="font-semibold text-slate-200 truncate">{story.title}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono">
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 text-[11px] font-bold">
                      {story.views.toLocaleString()} views
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-2 text-xs text-slate-500">No read events logged yet today.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
