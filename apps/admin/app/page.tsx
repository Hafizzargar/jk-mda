'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { canAccessRole } from '@kjin/auth';
import { summarizeArticleQueue } from '@kjin/db';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';

const fallbackQueue = [
  { id: 'fallback-review-1', title: 'District update: Srinagar power outage', status: 'review', summary: 'Awaiting editorial sign-off.' },
  { id: 'fallback-draft-1', title: 'Election monitoring brief', status: 'draft', summary: 'Ready for final review.' },
  { id: 'fallback-published-1', title: 'Local development coverage', status: 'published', summary: 'Published to the public desk.' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Checking auth session...');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<Array<{ id?: string; title: string; status: string; summary: string }>>(fallbackQueue);
  const [stats, setStats] = useState([
    { label: 'Drafts', value: 1 },
    { label: 'Pending review', value: 1 },
    { label: 'Published today', value: 1 },
    { label: 'Alerts', value: 0 },
  ]);

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
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(6);

        if (error) {
          return;
        }

        const summary = summarizeArticleQueue(data ?? []);
        if (summary.queue.length > 0) {
          setQueue(summary.queue);
          setStats(summary.stats);
        }
      } catch {
        // keep the fallback data when the table is unavailable
      }
    }

    loadQueue();
  }, [isAuthorized]);

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
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 rounded-full bg-cyan-600 px-6 py-2.5 font-bold text-white hover:bg-cyan-500 shadow-sm"
          >
            Sign out
          </button>
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
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Compact Action & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Newsdesk Live
            </span>
          </div>
          {userRole && (
            <span className="rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 font-mono text-[10px] font-bold text-cyan-800 uppercase dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-300">
              Role: {userRole}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/articles?category=Local"
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20 transition-all shadow-2xs"
          >
            <span>🏛️</span>
            <span>Area Problems</span>
          </Link>
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 transition-all shadow-2xs"
          >
            <span>📰</span>
            <span>Manage Stories</span>
          </Link>
          <Link
            href="/articles/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-500 shadow-2xs transition-all active:scale-95"
          >
            <span>✍️</span>
            <span>New Story</span>
          </Link>
        </div>
      </div>

      {/* Metrics Overview Cards with Light Styling */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              ? 'border-slate-200 hover:border-cyan-500/60 bg-white'
              : item.label === 'Pending review'
                ? 'border-slate-200 hover:border-amber-500/60 bg-white'
                : item.label === 'Published today'
                  ? 'border-slate-200 hover:border-emerald-500/60 bg-white'
                  : 'border-slate-200 hover:border-red-500/60 bg-white';

          return (
            <div
              key={item.label}
              className={`group relative overflow-hidden rounded-2xl border p-5 transition-all shadow-xs hover:shadow-md ${accentColor}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                <span className="text-xl opacity-90 group-hover:scale-110 transition-transform">{icon}</span>
              </div>
              <p className="mt-4 text-3xl font-black text-slate-900">{item.value}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>Real-time count</span>
                <span className="text-cyan-700 font-bold group-hover:translate-x-0.5 transition-transform">View →</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Editorial Queue & Operational Checks */}
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Editorial queue</h2>
            <span className="text-xs text-slate-500 font-medium">{queue.length} articles in queue</span>
          </div>
          <ul className="mt-6 space-y-3">
            {queue.map((item) => {
              const tagClass =
                item.status === 'review'
                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                  : item.status === 'published'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-cyan-100 text-cyan-900 border border-cyan-200';

              return (
                <li
                  key={`${item.id ?? item.title}-${item.status}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={item.id ? `/articles/${item.id}/review` : '#'}
                        className="font-bold text-slate-900 hover:text-cyan-700 transition-colors truncate block"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-1 text-xs text-slate-600 truncate">{item.summary}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${tagClass}`}>
                      {item.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Operational checks</h2>
          <div className="mt-6 space-y-3.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold text-slate-500">Fact verification</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-lg font-bold text-slate-900">92% complete</p>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                  On Track
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold text-slate-500">AI source monitor</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-lg font-bold text-slate-900">3 active jobs</p>
                <span className="rounded-full bg-cyan-100 text-cyan-800 px-2 py-0.5 text-[10px] font-bold">
                  Running
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold text-slate-500">Verification queue</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-lg font-bold text-slate-900">6 awaiting sign-off</p>
                <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                  Pending
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
