'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { LogoutModal } from '@/components/LogoutModal';
import { requiresMfa } from '@/lib/mfa';
import { toast } from '@/components/Toast';

function MFAChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [status, setStatus] = useState('Checking MFA status...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const [factorId, setFactorId] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Email OTP via Nodemailer state
  const [userEmail, setUserEmail] = useState<string>('');
  const [isEmailOtp, setIsEmailOtp] = useState<boolean>(true);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [otpSentFeedback, setOtpSentFeedback] = useState<string | null>(null);

  const verificationCode = digits.join('');

  // Lock window scroll and force dark theme on auth screens
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalTheme = document.documentElement.getAttribute('data-theme');

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      if (originalTheme) {
        document.documentElement.setAttribute('data-theme', originalTheme);
        if (originalTheme !== 'dark') {
          document.documentElement.classList.remove('dark');
        }
      }
    };
  }, []);

  const handleDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    const char = cleaned[cleaned.length - 1];
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);

    const nextFocusIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  // Self-service recovery state for lost authenticator app
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null);

  const handleResendEmailOtp = async () => {
    setIsSendingOtp(true);
    setErrorMsg(null);
    setOtpSentFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code.');
      setOtpSentFeedback(data.message || 'Fresh 6-digit code sent to your email.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

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

        const email = sessionData.session.user.email || '';
        setUserEmail(email);

        // Check actual enrolled factors from listFactors()
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const allFactors = [...(factorsData?.all ?? []), ...(factorsData?.totp ?? [])];
        const totpFactor = allFactors.find((f) => f.factor_type === 'totp' && f.status === 'verified');
        if (totpFactor) {
          setFactorId(totpFactor.id);
          setIsEmailOtp(false);
        } else {
          // Default to Email OTP via Nodemailer
          setIsEmailOtp(true);
        }

        setStatus('');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize verification.');
        setStatus('');
      }
    }
    
    initChallenge();
  }, [router, searchParams]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) return;
    
    setIsVerifying(true);
    setErrorMsg(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // 1. Try Email OTP verification first (Nodemailer code)
      const otpVerifyRes = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          code: verificationCode,
          email: userEmail,
        }),
      });

      if (otpVerifyRes.ok) {
        setStatus('Verification successful! Redirecting to dashboard...');

        // Dispatch security notification email for completing OTP login verification
        const token = session?.access_token;
        fetch('/api/auth/notify-login', {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            email: userEmail,
          }),
        }).catch(() => {});

        const nextUrl = searchParams.get('next');
        const target = nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//') && !nextUrl.startsWith('/auth') && nextUrl !== '/login' ? nextUrl : '/';
        setTimeout(() => {
          window.location.href = target;
        }, 300);
        return;
      }

      // 2. If factorId exists, try TOTP factor verification
      if (factorId) {
        const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
        if (challengeResponse.error) {
          throw new Error('Authentication challenge failed. Please try again.');
        }

        const verifyResponse = await fetch('/api/employees/mfa/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            factorId,
            challengeId: challengeResponse.data.id,
            code: verificationCode,
          }),
        });

        const verifyResult = await verifyResponse.json();
        if (!verifyResponse.ok) {
          throw new Error(verifyResult.error ?? 'Invalid verification code.');
        }

        const newSession = verifyResult.data?.session || verifyResult.data;
        if (newSession?.access_token && newSession?.refresh_token) {
          await supabase.auth.setSession({
            access_token: newSession.access_token,
            refresh_token: newSession.refresh_token,
          });
        }

        setStatus('Verification successful! Redirecting to dashboard...');

        // Dispatch security notification email for completing TOTP MFA verification
        const token = newSession?.access_token || session?.access_token;
        fetch('/api/auth/notify-login', {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            email: userEmail,
          }),
        }).catch(() => {});

        const nextUrl = searchParams.get('next');
        const target = nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//') && !nextUrl.startsWith('/auth') && nextUrl !== '/login' ? nextUrl : '/';
        setTimeout(() => {
          window.location.href = target;
        }, 300);
        return;
      }

      const otpResult = await otpVerifyRes.json().catch(() => ({}));
      throw new Error(otpResult.error || 'Invalid code. Please check your email and try again.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid code or verification failed.');
    } finally {
      setIsVerifying(false);
      setDigits(['', '', '', '', '', '']);
    }
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
  };

  return (
    <main id="login-page-root" className="fixed inset-0 w-screen h-screen max-h-[100dvh] flex items-center justify-center overflow-hidden bg-[#060a12] text-white p-4 sm:p-6 select-none">
      <div className="w-full max-w-[480px] rounded-2xl md:rounded-3xl border border-slate-800/80 bg-[#0a1220]/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/20">
        {/* Top Bar: Brand Emblem & Title + Sign Out */}
        <div className="flex items-center justify-between pb-5 sm:pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-400/20 shrink-0">
              <span className="font-extrabold text-slate-950 text-base leading-none">K</span>
            </div>
            <span className="font-bold text-base sm:text-lg text-white tracking-tight">
              KJCPL Admin
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs sm:text-sm text-slate-400 hover:text-white transition font-medium cursor-pointer"
          >
            Sign out
          </button>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Enter the 6-digit code
          </h1>
          <p className="mt-1 text-slate-400 text-xs sm:text-sm leading-relaxed">
            {isEmailOtp ? (
              <>
                A verification code was sent to your email{' '}
                <strong className="text-cyan-400">{userEmail || 'registered inbox'}</strong> via Nodemailer.
              </>
            ) : (
              'Please enter the 6-digit code from your email or authenticator app to continue.'
            )}
          </p>
        </div>

        {otpSentFeedback && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs text-center">
            {otpSentFeedback}
          </div>
        )}

        {status && !factorId && !isEmailOtp && (
          <div className="py-8 text-center space-y-3">
            <div className="w-8 h-8 mx-auto border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs sm:text-sm text-slate-400">{status}</p>
          </div>
        )}

        {(factorId || isEmailOtp) && !status.includes('Redirecting') && (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            {/* 6 Individual Digit Inputs */}
            <div className="flex items-center justify-between gap-1.5 sm:gap-2">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  autoFocus={idx === 0}
                  className="w-10 h-12 sm:w-11 sm:h-13 rounded-xl border border-slate-800 bg-[#070e1b] text-center text-lg sm:text-xl font-bold font-mono text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                />
              ))}
            </div>

            {errorMsg && (
              <p className="text-[11px] text-red-400 font-medium text-center">{errorMsg}</p>
            )}

            {/* Verify Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isVerifying || verificationCode.length !== 6}
                className={`w-full rounded-xl py-2.5 sm:py-3 px-4 text-sm sm:text-base font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  verificationCode.length === 6 && !isVerifying
                    ? 'bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 text-slate-950 shadow-[0_8px_20px_-4px_rgba(34,211,238,0.45)] hover:shadow-[0_12px_24px_-4px_rgba(34,211,238,0.6)] cursor-pointer'
                    : 'bg-[#102a36] text-cyan-600/70 cursor-not-allowed border border-cyan-900/40'
                }`}
              >
                {isVerifying ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-slate-950"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Continue to dashboard</span>
                )}
              </button>
            </div>

            {/* Footnote & Resend Email OTP */}
            <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs text-slate-400">
              <span>Didn&apos;t receive the code?</span>
              <button
                type="button"
                onClick={handleResendEmailOtp}
                disabled={isSendingOtp}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {isSendingOtp ? 'Sending...' : 'Resend Code via Email →'}
              </button>
            </div>

            {/* Lost Authenticator / Reset MFA Option */}
            <div className="border-t border-slate-800/80 pt-4 text-center">
              <p className="text-xs text-slate-400">
                Deleted your authenticator app or lost your phone?
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowRecovery(true);
                  setErrorMsg(null);
                }}
                className="mt-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline transition cursor-pointer"
              >
                Reset Authenticator via Registered Email →
              </button>
            </div>
          </form>
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
