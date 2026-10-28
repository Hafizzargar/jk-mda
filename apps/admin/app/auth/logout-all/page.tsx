'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LogoutAllDevicesPage() {
  const [countdown, setCountdown] = useState(3);
  const [status, setStatus] = useState<'revoking' | 'completed'>('revoking');

  useEffect(() => {
    async function revokeAllSessions() {
      try {
        // 1. Global Supabase Auth signout (invalidates all refresh tokens for this user on server)
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        console.warn('Client sign-out exception (falling back to storage purge):', err);
      }

      // 2. Clear all local browser tokens and cached sessions
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }

      setStatus('completed');
    }

    revokeAllSessions();
  }, []);

  // Automatic redirect timer once sessions are revoked
  useEffect(() => {
    if (status !== 'completed') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Hard navigation to reset all client memory and shell state
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
        {status === 'revoking' ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-2xl animate-pulse">
              🔒
            </div>
            <h1 className="text-xl font-bold text-white">Terminating All Sessions</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Disconnecting your account from all phones, laptops, and active browsers...
            </p>
          </div>
        ) : (
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
                All active sessions across all devices have been terminated.
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
      </div>
    </main>
  );
}
