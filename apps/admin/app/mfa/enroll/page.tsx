'use client';

import { FormEvent, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { LogoutModal } from '@/components/LogoutModal';
import { requiresMfa } from '@/lib/mfa';
import { toast } from '@/components/Toast';

export default function MFAEnrollmentPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Checking MFA status...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [secretString, setSecretString] = useState<string | null>(null);

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  useEffect(() => {
    async function initMFA() {
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
          router.push('/');
          return;
        }

        const { data: aalData, error: aalError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError) {
          setErrorMsg(aalError.message);
          return;
        }

        // If they are already AAL2, they are fully authenticated and enrolled
        if (aalData.currentLevel === 'aal2') {
          setStatus('MFA is already configured and verified. Redirecting...');
          setTimeout(() => router.push('/'), 1200);
          return;
        }

        // Check actual enrolled factors from listFactors()
        const { data: existingFactors } = await supabase.auth.mfa.listFactors();
        const allFactors = [...(existingFactors?.all ?? []), ...(existingFactors?.totp ?? [])];
        const hasVerifiedFactor = allFactors.some((f) => f.status === 'verified');

        if (hasVerifiedFactor || aalData.nextLevel === 'aal2') {
          setStatus('MFA is already enrolled. Redirecting to verification...');
          const search = typeof window !== 'undefined' ? window.location.search : '';
          setTimeout(() => {
            window.location.href = `/mfa/challenge${search}`;
          }, 300);
          return;
        }

        // Check if we already have an active, unverified factor cached for this session
        // Discard any stale factors from localhost or mismatched environments
        const cached = typeof window !== 'undefined' ? sessionStorage.getItem('kjin_pending_mfa_factor') : null;
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (
              parsed?.factorId &&
              parsed?.totpUri &&
              parsed?.secretString &&
              !parsed.totpUri.includes('localhost') &&
              !parsed.totpUri.includes('127.0.0.1')
            ) {
              const stillExists = allFactors.some((f) => f.id === parsed.factorId && f.status === 'unverified');
              if (stillExists) {
                setFactorId(parsed.factorId);
                setTotpUri(parsed.totpUri);
                setSecretString(parsed.secretString);
                setStatus('');
                return;
              }
            } else {
              sessionStorage.removeItem('kjin_pending_mfa_factor');
            }
          } catch {
            sessionStorage.removeItem('kjin_pending_mfa_factor');
          }
        }

        // Clean up any stale unverified factors from previous incomplete sessions
        if (existingFactors?.all) {
          for (const factor of existingFactors.all) {
            if (factor.status === 'unverified') {
              await supabase.auth.mfa.unenroll({ factorId: factor.id });
            }
          }
        }

        // Generate new TOTP factor with explicit KJIN Newsroom branding
        setStatus('Generating MFA factor...');
        const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'KJIN Newsroom',
        });

        if (enrollError) {
          setErrorMsg(enrollError.message);
          setStatus('');
          return;
        }

        setFactorId(enrollData.id);
        setTotpUri(enrollData.totp.uri);
        setSecretString(enrollData.totp.secret);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            'kjin_pending_mfa_factor',
            JSON.stringify({
              factorId: enrollData.id,
              totpUri: enrollData.totp.uri,
              secretString: enrollData.totp.secret,
            })
          );
        }
        setStatus('');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize MFA.');
        setStatus('');
      }
    }

    initMFA();
  }, [router]);

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

  const handleCopySecret = async () => {
    if (!secretString) return;
    try {
      await navigator.clipboard.writeText(secretString);
      setCopied(true);
      toast.success('Key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy key');
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!factorId || verificationCode.length !== 6) return;

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const challengeResponse = await supabase.auth.mfa.challenge({ factorId });

      if (challengeResponse.error) {
        throw new Error(challengeResponse.error.message);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const verifyResponse = await fetch('/api/employees/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: session ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({
          factorId,
          challengeId: challengeResponse.data.id,
          code: verificationCode,
        }),
      });

      if (!verifyResponse.ok) {
        const errData = await verifyResponse.json();
        throw new Error(errData.error || 'Verification failed.');
      }

      const { data } = await verifyResponse.json();
      const newSession = data?.session || data;
      if (newSession?.access_token && newSession?.refresh_token) {
        await supabase.auth.setSession({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token,
        });
      }

      setStatus('MFA successfully enrolled! Redirecting...');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('kjin_pending_mfa_factor');
      }

      // Dispatch single security notification for completing MFA enrollment and entering dashboard
      const token = newSession?.access_token || session?.access_token;
      fetch('/api/auth/notify-login', {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: session?.user?.email }),
      }).catch(() => {});

      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid code or verification failed.';
      setErrorMsg(msg);
      toast.error(msg, { title: 'Setup Failed' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRegenerateFactor = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kjin_pending_mfa_factor');
    }
    if (factorId) {
      try {
        await supabase.auth.mfa.unenroll({ factorId });
      } catch {}
    }
    window.location.reload();
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
  };

  return (
    <main id="login-page-root" className="fixed inset-0 w-screen h-screen max-h-[100dvh] flex items-center justify-center overflow-hidden bg-[#060a12] text-white p-4 sm:p-6 select-none">
      {/* Centered Modal Card */}
      <div className="w-full max-w-[740px] rounded-2xl md:rounded-3xl border border-slate-800/80 bg-[#0a1220]/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/20">
        {/* Top Bar: Brand Emblem & Title + Sign Out */}
        <div className="flex items-center justify-between pb-5 sm:pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-400/20 shrink-0">
              <span className="font-extrabold text-slate-950 text-base leading-none">K</span>
            </div>
            <span className="font-bold text-base sm:text-lg text-white tracking-tight">
              Kjin Admin
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

        {/* Loading / Status message if factor is generating */}
        {status && !totpUri && (
          <div className="py-12 text-center space-y-3">
            <div className="w-8 h-8 mx-auto border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs sm:text-sm text-slate-400">{status}</p>
          </div>
        )}

        {/* Main 2-Column Content */}
        {totpUri && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start pt-1">
            {/* Left Column: QR Code & Manual Secret */}
            <div className="space-y-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Scan the QR code
                </h1>
                <p className="mt-1 text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Open an authenticator app such as Google or Microsoft Authenticator and scan this
                  code.
                </p>
              </div>

              {/* White QR Code container */}
              <div className="rounded-2xl bg-white p-3.5 shadow-xl flex items-center justify-center w-fit mx-auto md:mx-0">
                <QRCodeSVG value={totpUri} size={170} level="M" />
              </div>

              {/* Manual Secret Box */}
              <div className="w-full rounded-xl border border-slate-800/80 bg-[#060c18] p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 pr-2">
                  <p className="text-[11px] text-slate-400">Can&apos;t scan? Enter this key manually</p>
                  <code className="mt-0.5 block font-mono text-xs text-cyan-400 font-semibold tracking-wider select-all truncate">
                    {secretString}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="shrink-0 rounded-lg bg-[#0e1b2e] hover:bg-[#162740] border border-slate-700/60 px-3 py-1.5 text-xs text-slate-200 hover:text-white font-medium transition cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Regenerate fresh QR link */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5 pt-0.5">
                <span>Key mismatch?</span>
                <button
                  type="button"
                  onClick={handleRegenerateFactor}
                  className="text-cyan-400 hover:text-cyan-300 hover:underline transition font-semibold cursor-pointer"
                >
                  Generate fresh QR code
                </button>
              </div>
            </div>

            {/* Right Column: 6-Digit Code Input & Complete Setup */}
            <div className="md:border-l md:border-slate-800/70 md:pl-8 flex flex-col justify-between h-full space-y-4">
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    Enter the 6-digit code
                  </h2>
                  <p className="mt-1 text-slate-400 text-xs sm:text-sm leading-relaxed">
                    Your role requires two-factor authentication. Type the code your app shows to
                    finish setup.
                  </p>

                  {/* 6 Individual Digit Inputs */}
                  <div className="mt-5 flex items-center justify-between gap-1.5 sm:gap-2">
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
                        className="w-10 h-12 sm:w-11 sm:h-13 rounded-xl border border-slate-800 bg-[#070e1b] text-center text-lg sm:text-xl font-bold font-mono text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                      />
                    ))}
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-[11px] text-red-400 font-medium text-center">{errorMsg}</p>
                )}

                {/* Complete Setup Button */}
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
                      <span>Complete setup</span>
                    )}
                  </button>
                </div>

                {/* Footnote */}
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed pt-1">
                  The code refreshes every 30 seconds. If it fails, check that your phone&apos;s
                  clock is set automatically.
                </p>
              </form>
            </div>
          </div>
        )}

        <LogoutModal isOpen={isLoggingOut} />
      </div>
    </main>
  );
}
