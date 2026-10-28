'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './Button';
import { clearAuthStorage } from '@/lib/auth-storage';

export interface LogoutModalProps {
  isOpen: boolean;
  onRedirect?: () => void;
}

export function LogoutModal({ isOpen, onRedirect }: LogoutModalProps) {
  const [phase, setPhase] = useState<'clearing' | 'done'>('clearing');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!isOpen) {
      setPhase('clearing');
      setCountdown(3);
      return;
    }

    let isMounted = true;

    async function performSignOut() {
      // 1. Invalidate session server-side and expire HttpOnly cookies
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.warn('[LogoutModal] Server logout call failed, proceeding with local cleanup:', err);
      }

      // 2. Client-side Supabase Auth state clearance
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Silently continue with local cleanup
      }

      // 3. Selectively remove auth keys while preserving user preferences (theme, sidebar, brand)
      try {
        clearAuthStorage();
      } catch (err) {
        console.warn('[LogoutModal] Error clearing auth storage:', err);
      }

      // Small delay so user sees smooth feedback loader
      setTimeout(() => {
        if (isMounted) {
          setPhase('done');
        }
      }, 700);
    }

    performSignOut();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleRedirect = useCallback(() => {
    if (onRedirect) {
      onRedirect();
    } else {
      window.location.href = '/login?alert=signed_out';
    }
  }, [onRedirect]);

  // Countdown timer for automatic redirect once sign-out completes
  useEffect(() => {
    if (phase !== 'done') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, handleRedirect]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 sm:p-8 text-center text-slate-900 dark:text-white shadow-2xl shadow-cyan-950/20 animate-in zoom-in-95 duration-200">
        {phase === 'clearing' && (
          <div className="space-y-4">
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800/60 text-2xl shadow-inner">
              {/* Spinning border ring */}
              <div className="absolute inset-0 rounded-2xl border-2 border-cyan-500 border-t-transparent animate-spin" />
              <span>🔒</span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Signing out...</h2>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Clearing your session data and securing your account...
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-2">
              <span className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce" />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/80 text-3xl text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-950/10 dark:shadow-emerald-950/40">
              ✓
            </div>

            <div>
              <span className="inline-block px-3 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800/80 text-[10px] font-mono font-bold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider mb-2">
                Session Terminated
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">You have been signed out</h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Your session has ended securely.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/80 p-2.5 text-xs text-slate-600 dark:text-slate-400 font-mono">
              Redirecting to sign-in in <span className="font-bold text-cyan-600 dark:text-cyan-300">{countdown}s</span>...
            </div>

            <div className="pt-1">
              <Button
                type="button"
                onClick={handleRedirect}
                variant="primary"
                size="md"
                className="w-full justify-center font-bold"
              >
                Continue to Login Now →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
