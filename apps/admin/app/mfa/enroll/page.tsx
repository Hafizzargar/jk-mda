'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function MFAEnrollmentPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Checking MFA status...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [secretString, setSecretString] = useState<string | null>(null);
  
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    async function initMFA() {
      try {
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (aalError) {
          setErrorMsg(aalError.message);
          return;
        }

        // If they are already AAL2, they are fully authenticated and enrolled
        if (aalData.currentLevel === 'aal2') {
          setStatus('MFA is already configured and verified. Redirecting...');
          setTimeout(() => router.push('/'), 1500);
          return;
        }

        // If nextLevel is aal2, they have enrolled but just need to verify (Login challenge)
        if (aalData.nextLevel === 'aal2') {
          setStatus('MFA is already enrolled. Redirecting to verification...');
          setTimeout(() => router.push('/mfa/challenge'), 500);
          return;
        }

        // Otherwise, they need to enroll
        setStatus('Generating MFA factor...');
        const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
        });

        if (enrollError) {
          setErrorMsg(enrollError.message);
          setStatus('');
          return;
        }

        setFactorId(enrollData.id);
        setQrCodeSvg(enrollData.totp.qr_code);
        setSecretString(enrollData.totp.secret);
        setStatus('');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize MFA.');
        setStatus('');
      }
    }
    
    initMFA();
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || verificationCode.length !== 6) return;
    
    setIsVerifying(true);
    setErrorMsg(null);
    
    try {
      const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
      
      if (challengeResponse.error) {
        throw new Error(challengeResponse.error.message);
      }
      
      const verifyResponse = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeResponse.data.id,
        code: verificationCode,
      });
      
      if (verifyResponse.error) {
        throw new Error(verifyResponse.error.message);
      }
      
      // Successfully verified and session is upgraded to AAL2!
      const { data: { session } } = await supabase.auth.getSession();
      
      // Audit the enrollment
      await fetch('/api/employees/mfa/audit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ action: 'employee.mfa_enrolled' }),
      });
      
      setStatus('MFA successfully enrolled! Redirecting...');
      setTimeout(() => router.push('/'), 1500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid code or verification failed.');
    } finally {
      setIsVerifying(false);
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
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Security Setup</p>
          <button 
            onClick={handleSignOut}
            className="text-sm text-slate-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
        
        <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
        <p className="mt-2 text-slate-300 text-sm">
          Your role requires two-factor authentication (MFA) to continue. Use an authenticator app (like Google or Microsoft Authenticator) to scan the QR code below.
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

        {qrCodeSvg && !status.includes('Redirecting') && (
          <div className="mt-8 flex flex-col items-center">
            <div 
              className="rounded-xl bg-white p-4"
              dangerouslySetInnerHTML={{ __html: qrCodeSvg }} 
            />
            
            <div className="mt-6 w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
              <p className="text-xs text-slate-400">Manual setup secret:</p>
              <code className="mt-1 block font-mono text-cyan-300 tracking-wider">
                {secretString}
              </code>
            </div>

            <form onSubmit={handleVerify} className="mt-8 w-full space-y-4">
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
                />
              </div>
              <button
                type="submit"
                disabled={isVerifying || verificationCode.length !== 6}
                className="w-full rounded-full bg-cyan-500 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50 disabled:hover:bg-cyan-500"
              >
                {isVerifying ? 'Verifying...' : 'Complete Setup'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
