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
          .select('role, status')
          .eq('id', data.session.user.id)
          .single();

        if (profileError || profile.status !== 'active') {
          setStatus('No active KJIN profile is associated with this account.');
          setIsAuthorized(false);
          return;
        }

        const sessionUserRole = profile.role;
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
              router.push('/mfa/challenge'); // We will build this later
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
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Access required</p>
          <h1 className="mt-4 text-3xl font-bold">Signed in, but not authorized.</h1>
          <p className="mt-4 text-slate-300">
            {userRole ? `Current role: ${userRole}.` : 'No valid editor role is associated with this account.'}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 rounded-full bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (isAuthorized !== true) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-200">{status}</div>
      </main>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Executive Welcome Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-[#030914] p-6 sm:p-8 shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
                Editorial Control Center
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              KJIN Newsroom Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400 max-w-xl">
              Kashmir Journalist Information Network editorial desk. Real-time verification, district coverage, and civic grievances dispatch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/articles?category=Local"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-200 hover:border-amber-400 hover:bg-amber-500/20 transition-all shadow-sm"
            >
              <span>🏛️</span>
              <span>Area Problems</span>
            </Link>
            <Link
              href="/articles"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/40 hover:bg-slate-800 transition-all shadow-sm"
            >
              <span>📰</span>
              <span>Manage Stories</span>
            </Link>
            <Link
              href="/articles/new"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:from-cyan-300 hover:to-sky-300 shadow-md shadow-cyan-950/40 transition-all active:scale-95"
            >
              <span>✍️</span>
              <span>New Story</span>
            </Link>
          </div>
        </div>

        {/* Auth Status Capsule */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-cyan-300">Session Status:</span>
            <span className="font-mono text-slate-300">{status}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-slate-500">Active Role:</span>
            <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 font-mono text-[11px] text-cyan-300 capitalize">
              {userRole ?? 'editor'}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Overview Cards */}
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
              ? 'border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-500/50'
              : item.label === 'Pending review'
                ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'
                : item.label === 'Published today'
                  ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                  : 'border-red-500/30 bg-red-500/5 hover:border-red-500/50';

          return (
            <div
              key={item.label}
              className={`group relative overflow-hidden rounded-2xl border p-5 transition-all shadow-lg ${accentColor}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                <span className="text-xl opacity-80 group-hover:scale-110 transition-transform">{icon}</span>
              </div>
              <p className="mt-4 text-3xl font-black text-white">{item.value}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>Real-time count</span>
                <span className="text-cyan-400 group-hover:translate-x-0.5 transition-transform">View →</span>
              </div>
            </div>
          );
        })}
      </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Editorial queue</h2>
            <ul className="mt-6 space-y-4 text-slate-300">
              {queue.map((item) => {
                const tagClass =
                  item.status === 'review'
                    ? 'bg-amber-500/15 text-amber-300'
                    : item.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-cyan-500/15 text-cyan-300';

                return (
                  <li key={`${item.id ?? item.title}-${item.status}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Link href={item.id ? `/articles/${item.id}/review` : '#'} className="font-medium text-white hover:text-cyan-300">
                          {item.title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-400">{item.summary}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${tagClass}`}>
                        {item.status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Operational checks</h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm text-slate-400">Fact verification</p>
                <p className="mt-2 text-lg font-semibold">92% complete</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm text-slate-400">AI source monitor</p>
                <p className="mt-2 text-lg font-semibold">3 active jobs</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm text-slate-400">Verification queue</p>
                <p className="mt-2 text-lg font-semibold">6 awaiting sign-off</p>
              </div>
            </div>
          </div>
        </section>
      </div>
  );
}
