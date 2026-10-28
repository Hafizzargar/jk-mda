'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { clearAuthStorage } from '@/lib/auth-storage';

function LogoutAllDevicesContent() {
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(2);
  const [status, setStatus] = useState<'revoking' | 'completed' | 'error'>('revoking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function revokeAllSessions() {
      try {
        const uid = searchParams.get('uid');
        const sig = searchParams.get('sig');
        const exp = searchParams.get('exp');

        // 1. Get current session token if available in this browser
        const { data: sessionData } = await supabase.auth.getSession();
        const localToken = sessionData.session?.access_token;

        // 2. Invoke server endpoint to purge sessions across all devices in postgres
        const res = await fetch('/api/auth/logout-all', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localToken ? { Authorization: `Bearer ${localToken}` } : {}),
          },
          body: JSON.stringify({
            uid: uid || undefined,
            sig: sig || undefined,
            exp: exp ? Number(exp) : undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to revoke remote sessions.');
        }

        // 3. Complete client-side signout and storage purge on this device
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // Ignore
        }

        try {
          clearAuthStorage();
        } catch {
          // Ignore
        }

        setStatus('completed');
      } catch (err: unknown) {
        console.error('Session revocation error:', err);
        const msg = err instanceof Error ? err.message : 'Error revoking sessions.';
        setErrorMsg(msg);
        // Still clear local auth tokens so this browser is safe
        try {
          clearAuthStorage();
        } catch {}
        setStatus('error');
      }
    }

    revokeAllSessions();
  }, [searchParams]);

  // Automatic redirect timer once sessions are revoked
  useEffect(() => {
    if (status !== 'completed') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = '/login?alert=all_sessions_revoked';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const handleImmediateRedirect = () => {
    window.location.href = '/login?alert=all_sessions_revoked';
  };

  return (
    <main className="fixed inset-0 z-[9999] flex min-h-screen w-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl text-center">
        {status === 'revoking' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-2xl animate-pulse">
              🔒
            </div>
            <h1 className="text-xl font-bold text-white">Revoking All Active Devices</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Disconnecting your account from all phones, laptops, and active browsers in the database...
            </p>
          </div>
        )}

        {status === 'completed' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950/80 border border-emerald-800/60 text-2xl text-emerald-400">
              ✓
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800/80 text-[10px] font-mono font-bold uppercase text-emerald-400 tracking-wider mb-2">
                All Devices Disconnected
              </span>
              <h1 className="text-xl font-bold text-white">Logged Out Globally</h1>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                All active sessions across all devices have been terminated. Anyone currently on your account has been kicked out immediately.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs text-emerald-300/90 text-center font-mono">
              Redirecting to sign-in in <span className="font-bold text-white">{countdown}s</span>...
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleImmediateRedirect}
                className="w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-cyan-500 active:scale-95 transition"
              >
                Sign In Now →
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-950/80 border border-rose-800/60 text-2xl text-rose-400">
              ⚠️
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Security Link Expired or Used</h1>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                {errorMsg || 'This security revocation link has expired or has already been used.'}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleImmediateRedirect}
                className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-700 transition"
              >
                Return to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LogoutAllDevicesPage() {
  return (
    <Suspense
      fallback={
        <main className="fixed inset-0 z-[9999] flex min-h-screen w-screen items-center justify-center bg-slate-950 text-white">
          <div className="text-sm text-slate-400">Loading session revocation...</div>
        </main>
      }
    >
      <LogoutAllDevicesContent />
    </Suspense>
  );
}
