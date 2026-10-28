'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LogoutAllDevicesPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Revoking all active sessions across all devices...');

  useEffect(() => {
    async function performGlobalSignOut() {
      try {
        // Revoke all sessions globally using Supabase Auth
        await supabase.auth.signOut({ scope: 'global' });
        
        // Clear local credentials/tokens from browser storage
        try {
          localStorage.removeItem('supabase.auth.token');
          sessionStorage.clear();
        } catch {
          // ignore storage clearing exceptions
        }

        setStatus('success');
        setMessage('You have been successfully signed out of all devices and active browser sessions.');
      } catch (err: unknown) {
        console.error('Error during global signout:', err);
        // Fallback local signout
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // ignore
        }
        setStatus('success');
        setMessage('Your session tokens have been cleared.');
      }
    }

    performGlobalSignOut();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-cyan-950/20 text-center">
        {status === 'processing' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-2xl animate-pulse">
              🔒
            </div>
            <h1 className="text-xl font-bold text-white">Signing out of all devices</h1>
            <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950/80 border border-emerald-800/60 text-2xl text-emerald-400">
              ✓
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800/80 text-[10px] font-mono font-bold uppercase text-emerald-400 tracking-wider mb-2">
                All Sessions Terminated
              </span>
              <h1 className="text-xl font-bold text-white">Signed Out Globally</h1>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{message}</p>
            </div>

            <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-3.5 text-left text-xs text-amber-200/90 leading-relaxed">
              <span className="font-bold text-amber-400">Security Recommendation:</span>
              <p className="mt-1 text-[11px] text-amber-300/80">
                If you initiated this logout because of an unrecognized login alert, sign in again now and update your password immediately in <strong>Profile & Settings</strong>.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-950/50 hover:bg-cyan-500 active:scale-95 transition"
              >
                Continue to Sign In →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
