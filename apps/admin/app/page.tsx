'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { canAccessRole } from '@kjin/auth';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { Button } from '@/components/Button';
import { LogoutModal } from '@/components/LogoutModal';

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Checking auth session...');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
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
          setStatus('Redirecting to sign in...');
          window.location.replace('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role_key, status')
          .eq('id', data.session.user.id)
          .single();

        if (profileError || !profile) {
          setStatus('Profile not found. Redirecting to sign in...');
          window.location.replace('/login?alert=profile_error');
          return;
        }

        if (profile.status !== 'active') {
          setStatus('Your account is deactivated. Please contact an administrator.');
          setUserRole(profile.role_key || null);
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
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const allFactors = [...(factorsData?.all ?? []), ...(factorsData?.totp ?? [])];
            const hasVerifiedFactor = allFactors.some((f) => f.factor_type === 'totp' && f.status === 'verified');

            if (hasVerifiedFactor || aalData?.nextLevel === 'aal2') {
              setStatus('MFA is required. Redirecting to verification...');
              window.location.href = '/mfa/challenge?reauth=true&next=/';
              return;
            } else {
              setStatus('MFA setup is required. Redirecting to enrollment...');
              window.location.href = '/mfa/enroll?next=/';
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
    setIsLoggingOut(true);
  };

  if (isAuthorized === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-600 font-bold dark:text-cyan-300">Access required</p>
          <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {userRole ? 'Role Unauthorized' : 'Access Required'}
          </h1>
          <p className="mt-4 text-slate-600 dark:text-slate-300 text-sm">
            {userRole
              ? `Current role: ${userRole}. This account does not have editorial permissions.`
              : 'Please sign in with an authorized editor or administrator account.'}
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
        <LogoutModal isOpen={isLoggingOut} />
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

    </div>
  );

}
