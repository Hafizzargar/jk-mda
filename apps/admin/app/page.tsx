'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canAccessRole } from '@kjin/auth';
import { supabase } from '@/lib/supabase';

const stats = [
  { label: 'Drafts', value: '24' },
  { label: 'Pending review', value: '8' },
  { label: 'Published today', value: '12' },
  { label: 'Alerts', value: '3' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Checking auth session...');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setStatus(`Auth session error: ${error.message}`);
          setIsAuthorized(false);
          return;
        }

        const sessionUserRole = data.session?.user?.app_metadata?.role ?? 'editor';
        setUserRole(sessionUserRole);

        if (!data.session) {
          setStatus('No active session. Redirecting to sign in.');
          setIsAuthorized(false);
          router.push('/login');
          return;
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
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Admin Portal</p>
            <h1 className="mt-2 text-3xl font-bold">KJIN newsroom dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
              {userRole ?? 'editor'}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-slate-700 px-5 py-2.5 font-semibold text-white hover:border-slate-500 hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="mb-8 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-100">
          <strong>Supabase auth:</strong> {status}
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">{item.label}</p>
              <p className="mt-4 text-3xl font-bold text-white">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Editorial queue</h2>
            <ul className="mt-6 space-y-4 text-slate-300">
              <li className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span>District update: Srinagar power outage</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-300">Review</span>
              </li>
              <li className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span>Election monitoring brief</span>
                <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-xs text-cyan-300">Ready</span>
              </li>
              <li className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span>Local development coverage</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">Published</span>
              </li>
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
    </main>
  );
}
