'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';

interface ViewAnalytics {
  overview: {
    totalViews: number;
    totalArticles: number;
    verifiedViewsCount: number;
    todayViews: number;
    topRegion: string;
    topRegionViews: number;
    topRegionPercent: number;
  };
  byRegion: Record<string, number>;
  byCategory: Record<string, number>;
  topArticles: Array<{
    id: string;
    title: string;
    slug: string;
    category: string;
    district: string;
    views: number;
    publishedAt: string;
  }>;
  recentLogs: Array<{
    id: string;
    article_id: string;
    viewed_at: string;
  }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<ViewAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'kashmir' | 'jammu' | 'chenab' | 'pir_panjal' | 'ladakh'>('all');

  async function fetchAnalytics() {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/analytics/views');
      if (!res.ok) {
        throw new Error(`Failed to load view analytics (HTTP ${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching analytics');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalViews = data?.overview?.totalViews || 0;
  const byRegion = data?.byRegion || {};
  const topArticles = data?.topArticles || [];

  const filteredArticles = topArticles.filter((article) => {
    if (selectedFilter === 'all') return true;
    const d = (article.district || '').toLowerCase();
    if (selectedFilter === 'kashmir') {
      return ['srinagar', 'baramulla', 'anantnag', 'pulwama', 'budgam', 'ganderbal', 'bandipora', 'kupwara', 'kulgam', 'shopian'].includes(d);
    }
    if (selectedFilter === 'jammu') {
      return ['jammu', 'samba', 'kathua', 'udhampur', 'reasi'].includes(d);
    }
    if (selectedFilter === 'chenab') {
      return ['doda', 'kishtwar', 'ramban'].includes(d);
    }
    if (selectedFilter === 'pir_panjal') {
      return ['rajouri', 'poonch'].includes(d);
    }
    if (selectedFilter === 'ladakh') {
      return ['leh', 'kargil'].includes(d);
    }
    return true;
  });

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-7xl w-full mx-auto min-w-0">
      {/* Streamlined Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 dark:border-slate-800 pb-3 sm:pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Audience &amp; Website Views
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Tracking verified reader page views, regional corridor engagement, and top stories
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            Updated: {lastRefreshed.toLocaleTimeString()}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={isLoading ? '⏳' : '🔄'}
            onClick={fetchAnalytics}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/40 text-red-200 text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Views Card */}
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-slate-900 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-cyan-400">
            <span>Total Website Views</span>
            <span className="text-xl">👁️</span>
          </div>
          <p className="mt-3 text-2xl sm:text-4xl font-black text-white">
            {totalViews.toLocaleString()}
          </p>
          <p className="mt-2 text-[11px] text-cyan-300/80 font-medium">
            Across {data?.overview?.totalArticles || 0} published stories
          </p>
        </div>

        {/* Today's Views Card */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-slate-900 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-400">
            <span>Readers Today</span>
            <span className="text-xl">📈</span>
          </div>
          <p className="mt-3 text-2xl sm:text-4xl font-black text-white">
            {(data?.overview?.todayViews || 0).toLocaleString()}
          </p>
          <p className="mt-2 text-[11px] text-emerald-300/80 font-medium">
            Active today (IST)
          </p>
        </div>

        {/* Top Bureau Card */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-slate-900 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-400">
            <span>Leading Corridor</span>
            <span className="text-xl">🏔️</span>
          </div>
          <p className="mt-3 text-2xl sm:text-4xl font-black text-white capitalize">
            {data?.overview?.topRegion || 'N/A'}
          </p>
          <p className="mt-2 text-[11px] text-amber-300/80 font-medium">
            {(data?.overview?.topRegionViews ?? 0).toLocaleString()} views ({data?.overview?.topRegionPercent ?? 0}%)
          </p>
        </div>

        {/* Verified IP Visitors Card */}
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-slate-900 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-purple-400">
            <span>Verified Unique Views</span>
            <span className="text-xl">🛡️</span>
          </div>
          <p className="mt-3 text-2xl sm:text-4xl font-black text-white">
            {(data?.overview?.verifiedViewsCount || 0).toLocaleString()}
          </p>
          <p className="mt-2 text-[11px] text-purple-300/80 font-medium">
            Deduplicated anti-abuse logs
          </p>
        </div>
      </div>

      {/* Regional Corridor Breakdown */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Views by Regional Bureau & Corridor
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Audience interest distribution across the Western Himalayan corridors.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: 'kashmir', name: 'Kashmir Valley', color: 'from-cyan-500 to-blue-600', count: byRegion.kashmir || 0 },
            { key: 'jammu', name: 'Jammu Plains', color: 'from-emerald-500 to-teal-600', count: byRegion.jammu || 0 },
            { key: 'chenab', name: 'Chenab Valley', color: 'from-amber-500 to-orange-600', count: byRegion.chenab || 0 },
            { key: 'pir_panjal', name: 'Pir Panjal', color: 'from-rose-500 to-pink-600', count: byRegion.pir_panjal || 0 },
            { key: 'ladakh', name: 'Ladakh Plateau', color: 'from-indigo-500 to-purple-600', count: byRegion.ladakh || 0 },
            { key: 'national_international', name: 'National/Global', color: 'from-violet-500 to-fuchsia-600', count: byRegion.national_international || 0 },
          ].map((r) => {
            const pct = totalViews > 0 ? Math.round((r.count / totalViews) * 100) : 0;
            return (
              <div
                key={r.key}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/60"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="truncate">{r.name}</span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400">{pct}%</span>
                </div>
                <p className="mt-2 text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {r.count.toLocaleString()}
                </p>
                <div className="mt-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${r.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Stories Leaderboard */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🏆 Top Most Read Stories</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                ({filteredArticles.length} stories)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ranked by verified reader view counts.
            </p>
          </div>

          {/* Region Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Regions' },
              { id: 'kashmir', label: 'Kashmir' },
              { id: 'jammu', label: 'Jammu' },
              { id: 'chenab', label: 'Chenab' },
              { id: 'pir_panjal', label: 'Pir Panjal' },
              { id: 'ladakh', label: 'Ladakh' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFilter(f.id as typeof selectedFilter)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  selectedFilter === f.id
                    ? 'bg-cyan-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Story Title</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">District</th>
                <th className="py-2.5 px-3 text-right">Views</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredArticles.map((article, idx) => (
                <tr
                  key={article.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                >
                  <td className="py-3 px-3 font-mono font-bold text-slate-400">
                    #{idx + 1}
                  </td>
                  <td className="py-3 px-3 max-w-md">
                    <p className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {article.title}
                    </p>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold capitalize text-[10px]">
                      {article.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 capitalize font-mono text-slate-500 dark:text-slate-400">
                    {article.district || 'Regional'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-cyan-700 dark:text-cyan-300 text-sm">
                    {article.views.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`http://localhost:3000/en/${article.category.toLowerCase()}/${article.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View story on reader site"
                        className="p-1 rounded text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300"
                      >
                        🌐
                      </a>
                      <Link
                        href={`/articles/${article.id}`}
                        title="Edit story in admin"
                        className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        ✏️
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
