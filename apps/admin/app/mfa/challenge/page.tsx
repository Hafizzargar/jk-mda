'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { LogoutModal } from '@/components/LogoutModal';
import { requiresMfa } from '@/lib/mfa';

function MFAChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [status, setStatus] = useState('Checking MFA status...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Self-service recovery state for lost authenticator app
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null);

  const handleRequestRecoveryCode = async () => {
    setIsSendingCode(true);
    setErrorMsg(null);
    setRecoveryFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const res = await fetch('/api/employees/mfa/self-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'request-code' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send recovery code.');

      setRecoverySent(true);
      setRecoveryFeedback(data.message || 'Recovery code sent to your email.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send recovery code.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryCode.length !== 6) return;

    setIsResetting(true);
    setErrorMsg(null);
    setRecoveryFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const res = await fetch('/api/employees/mfa/self-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'verify-and-reset', code: recoveryCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Recovery verification failed.');

      setRecoveryFeedback(data.message || 'Authenticator unlinked successfully!');
      setTimeout(() => {
        window.location.href = data.redirect || '/mfa/enroll';
      }, 1000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid code or recovery failed.');
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    async function initChallenge() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role_key')
          .eq('id', sessionData.session.user.id)
          .single();

        const role = profile?.role_key || 'author';
        if (!requiresMfa(role)) {
          const nextUrl = searchParams.get('next');
          const destination = nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//') ? nextUrl : '/';
          router.push(destination);
          return;
        }

        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (aalError) {
          setErrorMsg(aalError.message);
          return;
        }

        const isReauth = searchParams.get('reauth') === 'true';

        // Check whether user's TOTP authentication is fresh (< 15 mins)
        let isFresh = false;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) {
            const raw = token.split('.')[1];
            const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
            const claims = JSON.parse(decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
            const totpEntry = claims.amr?.find((m: { method: string; timestamp: number }) => m.method === 'totp' || m.method === 'mfa');
            const freshThreshold = 900; // 15 minutes maximum freshness window
            if (totpEntry && (Date.now() / 1000 - totpEntry.timestamp < freshThreshold)) {
              isFresh = true;
            }
          }
        } catch {
          isFresh = false;
        }

        // Only auto-redirect if they are ALREADY AAL2 AND their TOTP is fresh AND not re-authenticating
        if (aalData.currentLevel === 'aal2' && isFresh && !isReauth) {
          setStatus('MFA is already verified. Redirecting...');
          const nextUrl = searchParams.get('next');
          // Ensure it is a relative path to prevent open redirects
          if (nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//')) {
            setTimeout(() => router.push(nextUrl), 300);
          } else {
            setTimeout(() => router.push('/'), 300);
          }
          return;
        }

        // Check actual enrolled factors from listFactors()
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          setErrorMsg(factorsError.message);
          setStatus('');
          return;
        }

        const allFactors = [...(factorsData?.all ?? []), ...(factorsData?.totp ?? [])];
        const totpFactor = allFactors.find((f) => f.factor_type === 'totp' && f.status === 'verified');
        if (!totpFactor) {
          setStatus('MFA is not enrolled. Redirecting to setup...');
          const search = typeof window !== 'undefined' ? window.location.search : '';
          setTimeout(() => {
            window.location.href = `/mfa/enroll${search}`;
          }, 300);
          return;
        }

        setFactorId(totpFactor.id);
        setStatus('');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize MFA.');
        setStatus('');
      }
    }
    
    initChallenge();
  }, [router, searchParams]);



  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || verificationCode.length !== 6) return;
    
    setIsVerifying(true);
    setErrorMsg(null);
    
    try {
      const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
      
      if (challengeResponse.error) {
        throw new Error('Authentication challenge failed. Please try again.');
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const verifyResponse = await fetch('/api/employees/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          factorId,
          challengeId: challengeResponse.data.id,
          code: verificationCode,
        }),
      });
      
      const verifyResult = await verifyResponse.json();
      
      if (!verifyResponse.ok) {
        throw new Error(verifyResult.error ?? 'Invalid code. Please check your authenticator app and try again.');
      }
      
      // The API returns the upgraded session. We MUST set it so the browser knows we are AAL2.
      const newSession = verifyResult.data?.session || verifyResult.data;
      if (newSession?.access_token && newSession?.refresh_token) {
        await supabase.auth.setSession({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token,
        });
      }
      
      // Verify the session actually became aal2
      const { data: updatedSessionData, error: sessionError } = await supabase.auth.getSession();
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (sessionError || !updatedSessionData.session || aalData?.currentLevel !== 'aal2') {
        throw new Error('Session did not reach required security level.');
      }
      
      setStatus('Verification successful! Redirecting...');
      
      // Dispatch security notification for 2FA session verification (survives page navigation)
      const token = updatedSessionData.session?.access_token;
      fetch('/api/auth/notify-login', {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: updatedSessionData.session?.user?.email }),
      }).catch(() => {});

      const nextUrl = searchParams.get('next');
      const target = nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//') && !nextUrl.startsWith('/auth') && nextUrl !== '/login' ? nextUrl : '/';
      setTimeout(() => {
        window.location.href = target;
      }, 500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid code or verification failed.');
    } finally {
      setIsVerifying(false);
      setVerificationCode('');
    }
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Security Challenge</p>
          <button 
            onClick={handleSignOut}
            className="text-sm text-slate-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
        
        <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
        <p className="mt-2 text-slate-300 text-sm">
          Please enter the 6-digit code from your authenticator app to continue.
        </p>

        {status && (
          <div className="mt-6 rounded-lg bg-slate-800 p-4 text-center text-sm text-slate-300">
            {status}
          </div>
        )}

        {errorMsg && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        {factorId && !status.includes('Redirecting') && (
          <div className="mt-8 flex flex-col items-center">
            <form onSubmit={handleVerify} className="w-full space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-slate-300">
                  Verification Code
                </label>
                <input
                  id="code"
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-center text-2xl font-mono tracking-widest text-white placeholder-slate-600 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  required
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={isVerifying || verificationCode.length !== 6}
                isLoading={isVerifying}
                variant="primary"
                size="lg"
                className="w-full"
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </Button>
            </form>

            {/* Lost Authenticator / Reset MFA Option */}
            <div className="mt-6 w-full border-t border-slate-800/80 pt-4 text-center">
              <p className="text-xs text-slate-400">
                Deleted your authenticator app or lost your phone?
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowRecovery(true);
                  setErrorMsg(null);
                }}
                className="mt-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 underline transition"
              >
                Reset Authenticator via Registered Email →
              </button>
            </div>
          </div>
        )}

        {/* Self-Service Email Recovery Panel */}
        {showRecovery && (
          <div className="mt-6 rounded-xl border border-cyan-500/30 bg-slate-950 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📧</span>
                <h3 className="text-sm font-bold text-white">Reset Authenticator via Email</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRecovery(false);
                  setRecoveryFeedback(null);
                  setErrorMsg(null);
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Back to Code
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-300 leading-relaxed">
              We can send a secure 6-digit recovery code to your registered staff email address to unlink your old device and generate a fresh QR scanner.
            </p>

            {recoveryFeedback && (
              <div className="mt-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 p-2.5 text-xs text-cyan-300">
                {recoveryFeedback}
              </div>
            )}

            {!recoverySent ? (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="cyan"
                  size="md"
                  className="w-full justify-center text-xs font-bold"
                  disabled={isSendingCode}
                  isLoading={isSendingCode}
                  onClick={handleRequestRecoveryCode}
                >
                  Send 6-Digit Code to My Email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleVerifyRecoveryCode} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="recovery-code" className="block text-xs font-medium text-slate-300">
                    Enter 6-Digit Email Code
                  </label>
                  <input
                    id="recovery-code"
                    type="text"
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-center text-xl font-mono tracking-widest text-white placeholder-slate-600 outline-none focus:border-cyan-500"
                    required
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isResetting || recoveryCode.length !== 6}
                  isLoading={isResetting}
                  variant="primary"
                  size="md"
                  className="w-full justify-center text-xs font-bold"
                >
                  Verify Code & Show New QR Code
                </Button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    disabled={isSendingCode}
                    onClick={handleRequestRecoveryCode}
                    className="text-[11px] text-slate-400 hover:text-cyan-400 underline"
                  >
                    Resend email code
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <LogoutModal isOpen={isLoggingOut} />
      </div>
    </main>
  );
}

export default function MFAChallengePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading...</div>}>
      <MFAChallengeForm />
    </Suspense>
  );
}
