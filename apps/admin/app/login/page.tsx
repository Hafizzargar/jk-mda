'use client';

import { FormEvent, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { requiresMfa } from '@/lib/mfa';

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Enter your editor credentials to continue.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated with AAL2 and not viewing an explicit logout alert, auto-forward to Dashboard
  useEffect(() => {
    async function checkExistingSession() {
      if (searchParams.get('alert')) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role_key')
        .eq('id', data.session.user.id)
        .single();

      const userRole = profile?.role_key || 'author';
      if (requiresMfa(userRole)) {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel !== 'aal2') {
          // Incomplete MFA session: prompt for challenge or enrollment immediately
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const allFactors = [...(factorsData?.all ?? []), ...(factorsData?.totp ?? [])];
          const hasVerified = allFactors.some((f) => f.factor_type === 'totp' && f.status === 'verified');
          if (hasVerified || aalData?.nextLevel === 'aal2') {
            window.location.href = '/mfa/challenge?reauth=true&next=/';
          } else {
            window.location.href = '/mfa/enroll?next=/';
          }
          return;
        }
      }

      window.location.href = '/';
    }
    checkExistingSession();
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus('Signing in with Supabase Auth...');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatus(error.message);
        setIsSubmitting(false);
        return;
      }

      setStatus('Checking authentication assurance level...');
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      const token = sessionData.session?.access_token;

      // Dispatch login security alert email asynchronously (zero wait time, does not delay dashboard entry)
      fetch('/api/auth/notify-login', {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email }),
      }).catch(() => {});

      if (!user) {
        setStatus('Signed in successfully. Opening dashboard...');
        window.location.href = '/';
        return;
      }

      // Fetch user profile to verify role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_key')
        .eq('id', user.id)
        .single();

      const userRole = profile?.role_key || 'author';

      if (requiresMfa(userRole)) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const allFactors = [...(factorsData?.all ?? []), ...(factorsData?.totp ?? [])];
        const hasVerifiedFactor = allFactors.some(
          (f) => f.factor_type === 'totp' && f.status === 'verified'
        );

        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (hasVerifiedFactor || aalData?.nextLevel === 'aal2') {
          setStatus('Two-factor verification required. Redirecting to 6-digit code verification...');
          window.location.href = '/mfa/challenge?reauth=true&next=/';
          return;
        } else {
          setStatus('Two-factor setup required. Redirecting to authenticator enrollment...');
          window.location.href = '/mfa/enroll?next=/';
          return;
        }
      }

      // Editorial / author roles without mandatory MFA go directly to dashboard
      setStatus('Signed in successfully. Opening dashboard...');
      window.location.href = '/';
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to sign in right now.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-cyan-950/20">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">KJIN Admin</p>
          <h1 className="mt-4 text-3xl font-bold">Sign in</h1>
        </div>

        {searchParams.get('alert') === 'all_sessions_revoked' && (
          <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-emerald-200">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
              <span>🛡️</span>
              <span>All Sessions Revoked</span>
            </div>
            <p className="mt-1 text-xs text-emerald-300/80 leading-relaxed">
              You have been successfully signed out across all devices and active browser sessions. Please log in with your credentials.
            </p>
          </div>
        )}

        {searchParams.get('alert') === 'signed_out' && (
          <div className="mb-6 rounded-2xl border border-cyan-500/40 bg-cyan-950/40 p-4 text-cyan-200">
            <div className="flex items-center gap-2 font-bold text-sm text-cyan-400">
              <span>👋</span>
              <span>Signed Out Successfully</span>
            </div>
            <p className="mt-1 text-xs text-cyan-300/80 leading-relaxed">
              You have been safely signed out. Enter your credentials when you're ready to sign back in.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-slate-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-0 transition focus:border-cyan-500"
              placeholder="editor@kjin.local"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-slate-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {isSubmitting ? 'Signing in...' : 'Continue to dashboard'}
          </Button>
        </form>

        <p className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">{status}</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-cyan-950/20">
          <p className="text-center text-slate-400">Loading...</p>
        </div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
