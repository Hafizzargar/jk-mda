'use client';

import Link from 'next/link';
import { useAdmin } from './AdminShell';

export interface DashboardStat {
  label: string;
  value: number;
}

export interface DashboardTopArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  district: string;
  views: number;
  publishedAt: string;
}

export interface DashboardViewProps {
  pendingAiCount: number;
  stats: DashboardStat[];
  viewAnalytics: {
    totalViews: number;
    todayViews: number;
    totalArticles: number;
    topRegion: string;
    topRegionViews: number;
    topRegionPercent: number;
    topArticles: DashboardTopArticle[];
  };
}

export function DashboardView({ pendingAiCount, stats, viewAnalytics }: DashboardViewProps) {
  const { userRole } = useAdmin();

  // Editors and authors have restricted visibility (no autonomous radar, no telemetry, no pending queue)
  const isRestrictedStaff = userRole === 'editor' || userRole === 'author';

  // For editors & authors, only show Drafts and Published Today (Pending review and alerts hidden)
  const visibleStats = isRestrictedStaff
    ? stats.filter((s) => s.label === 'Drafts' || s.label === 'Published today')
    : stats;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto min-w-0">
      {/* Streamlined Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 dark:border-slate-800 pb-3 sm:pb-4 min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            {isRestrictedStaff
              ? 'Newsroom editorial desk — create and edit live reporting'
              : 'Newsroom editorial overview, real-time metrics, and reader traffic'}
          </p>
        </div>

        {isRestrictedStaff && (
          <div className="flex items-center gap-2">
            <Link
              href="/articles/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm transition active:scale-95"
            >
              <span className="text-sm leading-none">+</span>
              <span>Create New Story</span>
            </Link>
          </div>
        )}
      </div>

      {/* AI Newsroom Alert Banner — Hidden for Editor & Author */}
      {!isRestrictedStaff && pendingAiCount > 0 && (
        <div className="rounded-2xl border border-purple-200 dark:border-purple-800/80 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  AI Newsroom Surveillance
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                  Action Required
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {pendingAiCount} {pendingAiCount === 1 ? 'Story' : 'Stories'} Synthesized by Gemini 2.5 Flash Awaiting Approval
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Rewritten from scratch (zero copyright) with 80/10/10 regional weightage. Review and verify to publish live.
              </p>
            </div>
          </div>
          <Link
            href="/newsroom/youtube"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition shrink-0"
          >
            Verify &amp; Approve AI Stories →
          </Link>
        </div>
      )}

      {/* Metrics Overview Cards */}
      <section
        className={`grid gap-2.5 sm:gap-4 min-w-0 ${
          isRestrictedStaff
            ? 'grid-cols-2 max-w-2xl'
            : 'grid-cols-2 xl:grid-cols-4'
        }`}
      >
        {visibleStats.map((item) => {
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

          const targetHref =
            item.label === 'Drafts'
              ? '/articles?status=draft'
              : item.label === 'Published today'
                ? '/articles?status=published'
                : item.label === 'Pending review'
                  ? '/articles?status=review'
                  : '/articles?status=archived';

          return (
            <Link
              key={item.label}
              href={targetHref}
              className={`group relative overflow-hidden rounded-xl sm:rounded-2xl border p-3.5 sm:p-5 transition-all shadow-2xs hover:shadow-md min-w-0 block ${accentColor}`}
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
            </Link>
          );
        })}
      </section>

      {/* Editor & Author Specific View: Live Published Stories with One-Click Edit */}
      {isRestrictedStaff && (
        <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 text-lg">
                📡
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Live News &amp; Active Publications
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select any live article below to update editorial copy, corrections, or images.
                </p>
              </div>
            </div>

            <Link
              href="/articles?status=published"
              className="text-xs font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:underline shrink-0"
            >
              All Live News →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {viewAnalytics.topArticles.length > 0 ? (
              viewAnalytics.topArticles.slice(0, 6).map((story) => (
                <div
                  key={story.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Live
                      </span>
                      {story.category && (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {story.category}
                        </span>
                      )}
                      {story.district && (
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          • {story.district}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/articles/${story.id}/edit`}
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors line-clamp-1"
                    >
                      {story.title}
                    </Link>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/articles/${story.id}/edit`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-xs font-bold transition"
                    >
                      <span>✏️</span>
                      <span>Edit Story</span>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No published stories yet. Click &quot;Create New Story&quot; above to publish your first article.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Website Views & Audience Telemetry Section — Hidden for Editor & Author */}
      {!isRestrictedStaff && (
        <section className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-4 sm:p-6 text-white shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xl">
                👁️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    Website Views &amp; Audience Telemetry
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
      )}
    </div>
  );
}
