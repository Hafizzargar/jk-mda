'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function MFAChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [status, setStatus] = useState('Checking MFA status...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    async function initChallenge() {
      try {
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (aalError) {
          setErrorMsg(aalError.message);
          return;
        }

        // If they are already AAL2, they are fully authenticated
        if (aalData.currentLevel === 'aal2') {
          setStatus('MFA is already verified. Redirecting...');
          const nextUrl = searchParams.get('next');
          // Ensure it is a relative path to prevent open redirects
          if (nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//')) {
            setTimeout(() => router.push(nextUrl), 500);
          } else {
            setTimeout(() => router.push('/'), 500);
          }
          return;
        }

        // If nextLevel is aal1, they don't have MFA enrolled!
        if (aalData.nextLevel === 'aal1') {
          setStatus('MFA is not enrolled. Redirecting to setup...');
          setTimeout(() => router.push('/mfa/enroll'), 500);
          return;
        }

        // Find their existing TOTP factor
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          setErrorMsg(factorsError.message);
          setStatus('');
          return;
        }

        const totpFactor = factorsData.totp.find((f) => f.status === 'verified');
        if (!totpFactor) {
          setStatus('No verified TOTP factor found. Redirecting to enrollment...');
          setTimeout(() => router.push('/mfa/enroll'), 500);
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

  const auditMfa = async (action: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/employees/mfa/audit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ action }),
      });
    } catch {
      // Best effort audit
    }
  };

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
      
      const verifyResponse = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeResponse.data.id,
        code: verificationCode,
      });
      
      if (verifyResponse.error) {
        throw new Error('Invalid code. Please check your authenticator app and try again.');
      }
      
      // Verify the session actually became aal2
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (sessionError || !session || aalData?.currentLevel !== 'aal2') {
        throw new Error('Session did not reach required security level.');
      }

      await auditMfa('employee.mfa_challenge_success');
      
      setStatus('Verification successful! Redirecting...');
      const nextUrl = searchParams.get('next');
      if (nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//')) {
        setTimeout(() => router.push(nextUrl), 500);
      } else {
        setTimeout(() => router.push('/'), 500);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid code or verification failed.');
      await auditMfa('employee.mfa_challenge_failed');
    } finally {
      setIsVerifying(false);
      setVerificationCode('');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
              <button
                type="submit"
                disabled={isVerifying || verificationCode.length !== 6}
                className="w-full rounded-full bg-cyan-500 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50 disabled:hover:bg-cyan-500"
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          </div>
        )}
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
