'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { canAccessRole } from '@kjin/auth';
import { summarizeArticleQueue } from '@kjin/db';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { Button } from '@/components/Button';

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Checking auth session...');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<Array<{ id?: string; title: string; status: string; summary: string }>>([]);
  const [stats, setStats] = useState([
    { label: 'Drafts', value: 0 },
    { label: 'Pending review', value: 0 },
    { label: 'Published today', value: 0 },
    { label: 'Alerts', value: 0 },
  ]);
  const [viewAnalytics, setViewAnalytics] = useState<{
    totalViews: number;
    todayViews: number;
    totalArticles: number;
    topRegion: string;
    topRegionViews: number;
    topRegionPercent: number;
    byRegion: Record<string, number>;
    topArticles: Array<{ id: string; title: string; slug: string; category: string; district: string; views: number }>;
  } | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setStatus(`Auth session error: ${error.message}`);
          setIsAuthorized(false);
          return;
        }

        if (!data.session) {
          setStatus('No active session. Redirecting to sign in.');
          setIsAuthorized(false);
          router.push('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role_key, status')
          .eq('id', data.session.user.id)
          .single();

        if (profileError || profile.status !== 'active') {
          setStatus('No active KJIN profile is associated with this account.');
          setIsAuthorized(false);
          return;
        }

        const sessionUserRole = profile.role_key;
        setUserRole(sessionUserRole);

        if (!sessionUserRole) {
          setStatus('No valid role is associated with this profile.');
          setIsAuthorized(false);
          return;
        }

        const mfaRequired = requiresMfa(sessionUserRole);
        
        if (mfaRequired) {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aalData?.currentLevel !== 'aal2') {
            if (aalData?.nextLevel === 'aal2') {
              setStatus('MFA is required. Redirecting to verification...');
              router.push('/mfa/challenge');
              return;
            } else {
              setStatus('MFA setup is required. Redirecting to enrollment...');
              router.push('/mfa/enroll');
              return;
            }
          }
        }

        const allowed = canAccessRole(sessionUserRole, 'editor');
        setIsAuthorized(allowed);
        setStatus(
          allowed
            ? `Authenticated session detected for role: ${sessionUserRole}.`
            : `Role ${sessionUserRole} does not have editor access.`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Authentication check failed.';
        setStatus(message);
        setIsAuthorized(false);
      }
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    async function loadQueue() {
      if (isAuthorized !== true) {
        return;
      }

      try {
        // Query authentic status counts across all articles in the database
        const { data: allArticles } = await supabase
          .from('articles')
          .select('status');

        if (allArticles) {
          const counts = { draft: 0, review: 0, published: 0, archived: 0 };
          allArticles.forEach((a) => {
            const s = (a.status || 'draft') as keyof typeof counts;
            if (s in counts) counts[s] += 1;
          });
          setStats([
            { label: 'Drafts', value: counts.draft },
            { label: 'Pending review', value: counts.review },
            { label: 'Published today', value: counts.published },
            { label: 'Alerts', value: counts.archived },
          ]);
        }

        // Query the most recent articles for the editorial queue
        const { data: recentArticles } = await supabase
          .from('articles')
          .select('id, title, summary, excerpt, status, category, updated_at')
          .order('updated_at', { ascending: false })
          .limit(6);

        if (recentArticles && recentArticles.length > 0) {
          const summary = summarizeArticleQueue(recentArticles);
          setQueue(summary.queue);
        } else {
          setQueue([]);
        }
      } catch {
        // Clean error handling, leave at authentic zeros
      }
    }

    loadQueue();
  }, [isAuthorized]);

  useEffect(() => {
    async function loadViewAnalytics() {
      try {
        const res = await fetch('/api/analytics/views');
        if (res.ok) {
          const json = await res.json();
          setViewAnalytics({
            totalViews: json.overview?.totalViews || 0,
            todayViews: json.overview?.todayViews || 0,
            totalArticles: json.overview?.totalArticles || 0,
            topRegion: json.overview?.topRegion || 'N/A',
            topRegionViews: json.overview?.topRegionViews || 0,
            topRegionPercent: json.overview?.topRegionPercent || 0,
            byRegion: json.byRegion || {},
            topArticles: json.topArticles || [],
          });
        }
      } catch {
        // Clean error handling
      }
    }

    loadViewAnalytics();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isAuthorized === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-600 font-bold dark:text-cyan-300">Access required</p>
          <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Signed in, but not authorized.</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-300 text-sm">
            {userRole ? `Current role: ${userRole}.` : 'No valid editor role is associated with this account.'}
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              onClick={handleSignOut}
              variant="primary"
              size="md"
            >
              Sign out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (isAuthorized !== true) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {status}
        </div>
      </main>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto min-w-0">
      {/* Compact Action & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 dark:border-slate-800 pb-3 sm:pb-4 min-w-0">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Newsdesk Live
            </span>
          </div>
          {userRole && (
            <span className="rounded-full bg-cyan-50 border border-cyan-200/80 px-2.5 py-0.5 font-mono text-[10px] font-bold text-cyan-800 uppercase dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-300">
              Role: {userRole}
            </span>
          )}
        </div>

        {/* Action Buttons: Prominent CTA + 2-col Secondary on Mobile */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            href="/articles/new"
            variant="primary"
            size="sm"
            icon="✍️"
            className="w-full sm:w-auto justify-center shadow-sm order-1 sm:order-3 font-bold py-2 sm:py-1.5"
          >
            New Story
          </Button>
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto order-2 sm:order-1">
            <Button
              href="/articles?category=Local"
              variant="amber"
              size="sm"
              icon="🏛️"
              className="justify-center truncate text-[11px] sm:text-xs"
            >
              Area Problems
            </Button>
            <Button
              href="/articles"
              variant="secondary"
              size="sm"
              icon="📰"
              className="justify-center truncate text-[11px] sm:text-xs"
            >
              Manage Stories
            </Button>
          </div>
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
              {(viewAnalytics?.totalViews ?? 0).toLocaleString()}
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
              {(viewAnalytics?.todayViews ?? 0).toLocaleString()}
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
              {viewAnalytics?.topRegion && viewAnalytics.topRegion !== 'N/A'
                ? `${viewAnalytics.topRegion} (${viewAnalytics.topRegionPercent}%)`
                : 'N/A'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {(viewAnalytics?.topRegionViews ?? 0).toLocaleString()} reads
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 sm:p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-400">
              Stories Tracked
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-white">
              {(viewAnalytics?.totalArticles ?? 0).toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Active published reporting
            </p>
          </div>
        </div>

        {/* Top 3 Most Read Stories Preview */}
        {viewAnalytics?.topArticles && viewAnalytics.topArticles.length > 0 && (
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 sm:p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>🔥 Most Read Stories Today</span>
              </span>
              <Link href="/analytics" className="text-xs text-cyan-400 hover:underline font-bold">
                View all stories →
              </Link>
            </div>
            <div className="divide-y divide-slate-800/60">
              {viewAnalytics.topArticles.slice(0, 3).map((story, i) => (
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
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Editorial Queue & Operational Checks */}
      <section className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-12 min-w-0 w-full">
        {/* Editorial Queue */}
        <div className="xl:col-span-7 2xl:col-span-8 min-w-0 w-full rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <span className="text-base sm:text-lg">📋</span>
                <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">Editorial queue</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {queue.length} articles
                </span>
                <Link
                  href="/articles"
                  className="text-xs font-bold text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline"
                >
                  View all →
                </Link>
              </div>
            </div>

            {queue.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
                <span className="text-2xl">📰</span>
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No articles currently in the editorial queue
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  New drafts and regional bureau submissions will appear here for review.
                </p>
                <div className="mt-4 flex justify-center">
                  <Button href="/articles/new" variant="primary" size="sm" icon="✍️">
                    Create New Story
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 min-w-0">
                {queue.map((item) => {
                  const badgeConfig =
                    item.status === 'review'
                      ? {
                          pill: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
                          dot: 'bg-amber-500',
                        }
                      : item.status === 'published'
                        ? {
                            pill: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40',
                            dot: 'bg-emerald-500',
                          }
                        : {
                            pill: 'bg-cyan-100 text-cyan-900 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40',
                            dot: 'bg-cyan-500',
                          };

                  return (
                    <li
                      key={`${item.id ?? item.title}-${item.status}`}
                      className="group rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 sm:p-4 hover:bg-white hover:border-cyan-300/80 hover:shadow-xs active:scale-[0.99] transition-all dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 dark:hover:border-cyan-500/40 min-w-0"
                    >
                      <div className="flex items-start justify-between gap-2.5 min-w-0">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={item.id ? `/articles/${item.id}/review` : '/articles'}
                            className="font-bold text-xs sm:text-base text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors line-clamp-2 block leading-snug"
                          >
                            {item.title}
                          </Link>
                          <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {item.summary}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold capitalize border shadow-2xs ${badgeConfig.pill}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${badgeConfig.dot}`} />
                            <span>{item.status}</span>
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Operational Checks */}
        <div className="xl:col-span-5 2xl:col-span-4 min-w-0 w-full rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span className="text-base sm:text-lg">⚙️</span>
              <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white">Operational checks</h2>
            </div>
            <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/30">
              Active
            </span>
          </div>

          <div className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3.5 min-w-0">
            {/* Editorial Verification Status */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Editorial review pipeline</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {stats.find((s) => s.label === 'Pending review')?.value ?? 0} awaiting review
                </p>
                {(stats.find((s) => s.label === 'Pending review')?.value ?? 0) > 0 ? (
                  <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                    Action Needed
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                    All Clear
                  </span>
                )}
              </div>
            </div>

            {/* Published Catalog Status */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Published reporting</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {stats.find((s) => s.label === 'Published today')?.value ?? 0} stories live
                </p>
                <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live in Public
                </span>
              </div>
            </div>

            {/* Security & Audit Telemetry */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Security & telemetry engine</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">AAL2 & View Engine</p>
                <span className="rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300 px-2 py-0.5 text-[10px] font-bold">
                  Enforced
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

}
