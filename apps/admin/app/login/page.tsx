'use client';

import { FormEvent, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { toast } from '@/components/Toast';

function LoginForm() {
  const searchParams = useSearchParams();
  const alertParam = searchParams.get('alert');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Dispatch toasts for alert parameters without pushing the form layout or causing scrollbars
  useEffect(() => {
    if (alertParam === 'signed_out') {
      toast.info("You've been safely signed out. Enter your credentials when you're ready to sign back in.", {
        title: 'Signed out successfully',
        id: 'signed-out-alert',
        duration: 5000,
      });
    } else if (alertParam === 'all_sessions_revoked') {
      toast.warning('You have been signed out across all devices. Please enter your credentials to log in.', {
        title: 'All Sessions Revoked',
        id: 'revoked-alert',
        duration: 5000,
      });
    } else if (alertParam === 'account_disabled') {
      toast.error('Your staff login access has been blocked by an administrator.', {
        title: 'Account Disabled',
        id: 'disabled-alert',
        duration: 6000,
      });
    }
  }, [alertParam]);

  // If already authenticated with AAL2 and not viewing an explicit logout alert, auto-forward to Dashboard
  useEffect(() => {
    async function checkExistingSession() {
      if (searchParams.get('alert')) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role_key, status')
        .eq('id', data.session.user.id)
        .single();

      if (!profile || profile.status !== 'active') {
        // Disabled or missing staff account -> immediately purge session to prevent redirect loops
        await supabase.auth.signOut();
        return;
      }

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

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message, { title: 'Authentication Failed' });
        setIsSubmitting(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      const token = sessionData.session?.access_token;

      if (!user) {
        window.location.href = '/';
        return;
      }

      // Fetch user profile to verify role and active account status
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_key, status')
        .eq('id', user.id)
        .single();

      if (!profile || profile.status !== 'active') {
        await supabase.auth.signOut();
        toast.error('Your staff login access has been blocked by an administrator.', {
          title: 'Account Disabled',
        });
        setIsSubmitting(false);
        return;
      }

      const userRole = profile?.role_key || 'author';

      if (requiresMfa(userRole)) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const allFactors = [...(factorsData?.all ?? []), ...(factorsData?.totp ?? [])];
        const hasVerifiedFactor = allFactors.some(
          (f) => f.factor_type === 'totp' && f.status === 'verified'
        );

        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        // For MFA-enforced accounts, do NOT send login alert here yet.
        // The one-and-only email will be dispatched once 2FA TOTP verification succeeds on /mfa/challenge.
        if (hasVerifiedFactor || aalData?.nextLevel === 'aal2') {
          window.location.href = '/mfa/challenge?reauth=true&next=/';
          return;
        } else {
          window.location.href = '/mfa/enroll?next=/';
          return;
        }
      }

      // Dispatch 6-digit verification code to email via Nodemailer
      try {
        await fetch('/api/auth/otp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ email }),
        });
      } catch (e) {
        console.warn('Failed to dispatch initial OTP email:', e);
      }

      window.location.href = '/mfa/challenge?next=/';
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in right now.', {
        title: 'Sign In Error',
      });
      setIsSubmitting(false);
    }
  }

  const handleForgotPassword = () => {
    toast.info('To reset your credentials, please contact your workspace administrator or owner directly.', {
      title: 'Password Assistance',
    });
  };

  return (
    <main
      id="login-page-root"
      className="fixed inset-0 w-screen h-screen max-h-[100dvh] flex overflow-hidden bg-[#060a12] text-white select-none"
    >
      {/* Left Column: Brand Showcase (Hidden on Mobile, Displayed on Large Screens) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-6 xl:p-10 2xl:p-12 h-full max-h-[100dvh] overflow-hidden bg-gradient-to-br from-[#0c192d] via-[#091120] to-[#050912] border-r border-slate-800/60 shrink-0">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none translate-x-1/3" />

        {/* Top: Logo & Title */}
        <div className="relative z-10 flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-400/20 shrink-0">
            <span className="font-extrabold text-slate-950 text-base leading-none">K</span>
          </div>
          <span className="font-bold text-base xl:text-lg text-white tracking-tight">Kjin Admin</span>
        </div>

        {/* Center: Hero Heading, Subtitle & Stepped Cascading Cards */}
        <div className="relative z-10 my-auto py-1 space-y-4 xl:space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl xl:text-4xl 2xl:text-5xl font-extrabold tracking-tight text-white leading-[1.14]">
              Publish with<br />confidence.
            </h1>
            <p className="mt-2 xl:mt-2.5 text-slate-400 text-xs sm:text-sm xl:text-base max-w-sm leading-relaxed">
              Review drafts, schedule posts and keep your team in sync from one dashboard.
            </p>
          </div>

          {/* Stepped Floating Feature Cards */}
          <div className="space-y-2 xl:space-y-2.5 max-w-md pt-0.5">
            {/* Card 1: Spring launch post */}
            <div className="w-full rounded-xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-md px-4 py-2 xl:py-2.5 shadow-lg flex items-center justify-between transition-all hover:border-cyan-500/40">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] shrink-0" />
                <span className="text-xs xl:text-sm font-medium text-white">Spring launch post</span>
              </div>
              <span className="text-[11px] xl:text-xs font-medium text-slate-400">Live</span>
            </div>

            {/* Card 2: Weekly newsletter (Indented) */}
            <div className="w-full rounded-xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-md px-4 py-2 xl:py-2.5 shadow-lg flex items-center justify-between transition-all hover:border-cyan-500/40 ml-4 xl:ml-6">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] shrink-0" />
                <span className="text-xs xl:text-sm font-medium text-white">Weekly newsletter</span>
              </div>
              <span className="text-[11px] xl:text-xs font-medium text-slate-400">Scheduled</span>
            </div>

            {/* Card 3: Pricing page update (Indented further) */}
            <div className="w-full rounded-xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-md px-4 py-2 xl:py-2.5 shadow-lg flex items-center justify-between transition-all hover:border-slate-700 ml-8 xl:ml-12">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                <span className="text-xs xl:text-sm font-medium text-slate-200">Pricing page update</span>
              </div>
              <span className="text-[11px] xl:text-xs font-medium text-slate-400">Draft</span>
            </div>
          </div>
        </div>

        {/* Bottom: Footnote */}
        <div className="relative z-10 text-[11px] xl:text-xs text-slate-500 tracking-wide font-normal shrink-0">
          Authorized editors only.
        </div>
      </div>

      {/* Right Column: Sign In Form (Constrained to 100dvh, Zero Scroll on All Screens) */}
      <div className="w-full lg:w-1/2 h-full max-h-[100dvh] overflow-hidden flex flex-col justify-center items-center px-4 sm:px-8 xl:px-12 bg-[#060a12] relative shrink-0">
        {/* Mobile Header Logo */}
        <div className="lg:hidden w-full max-w-[360px] mb-3 flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-400/20 shrink-0">
            <span className="font-extrabold text-slate-950 text-base leading-none">K</span>
          </div>
          <span className="font-bold text-base text-white tracking-tight">Kjin Admin</span>
        </div>

        <div className="w-full max-w-[360px] xl:max-w-[380px] my-auto space-y-3 xl:space-y-3.5">
          {/* Header */}
          <div>
            <h2 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-white tracking-tight">
              Welcome back
            </h2>
            <p className="mt-1 text-slate-400 text-xs sm:text-sm">
              Sign in to continue to your dashboard.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5 xl:space-y-3 pt-0.5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs xl:text-sm font-semibold text-slate-200 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="editor@kjin.local"
                className="w-full rounded-xl border border-slate-800 bg-[#0d1524] px-3.5 py-2 xl:py-2.5 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition text-xs xl:text-sm"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs xl:text-sm font-semibold text-slate-200 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-800 bg-[#0d1524] px-3.5 py-2 xl:py-2.5 pr-14 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition text-xs xl:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-white transition px-2 py-0.5 rounded cursor-pointer"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs pt-0.5 select-none">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-300 transition text-[11px] xl:text-xs">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-[#0d1524] text-cyan-400 focus:ring-cyan-400/30 focus:ring-offset-0 cursor-pointer"
                />
                <span>Keep me signed in</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline transition text-[11px] xl:text-xs cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button with Radiant Cyan Glow */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 text-slate-950 font-bold py-2.5 xl:py-3 px-4 text-sm xl:text-base tracking-wide transition-all duration-200 shadow-[0_8px_20px_-4px_rgba(34,211,238,0.45)] hover:shadow-[0_12px_24px_-4px_rgba(34,211,238,0.6)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Continue to dashboard</span>
                )}
              </button>
            </div>
          </form>

          {/* Footnote */}
          <p className="text-center text-[11px] xl:text-xs text-slate-400 pt-1">
            Need access? <span className="text-slate-300">Ask your workspace admin.</span>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-[#060a12] text-white overflow-hidden">
          <div className="text-slate-400 text-xs">Loading workspace...</div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
