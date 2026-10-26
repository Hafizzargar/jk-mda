'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';

interface ProfileData {
  id: string;
  email: string;
  display_name: string;
  role_key: string;
  role: string;
  status: string;
  phone?: string | null;
  created_at: string;
  updated_at: string;
  aal: string;
  articles_count: number;
  last_sign_in?: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Author name form
  const [displayName, setDisplayName] = useState('');
  const [updateArticles, setUpdateArticles] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setIsLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          router.push('/login');
          return;
        }

        const res = await fetch('/api/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to load profile details.');
        }

        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          setDisplayName(data.profile.display_name || '');
        }
      } catch (err: unknown) {
        setNameError(err instanceof Error ? err.message : 'Error loading profile.');
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleUpdateName = async (e: FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(null);

    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length > 120) {
      setNameError('Author display name must be between 1 and 120 characters.');
      return;
    }

    setSavingName(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: trimmed,
          update_articles: updateArticles,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update author name.');
      }

      setProfile((prev) => (prev ? { ...prev, display_name: trimmed } : null));
      setNameSuccess(
        updateArticles
          ? 'Author name updated! All your authored articles have been synchronized with your new byline.'
          : 'Author profile updated successfully.'
      );
    } catch (err: unknown) {
      setNameError(err instanceof Error ? err.message : 'Failed to update author name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please re-enter.');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setPasswordSuccess('Password successfully updated! Use your new password on your next login.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="text-sm font-medium text-slate-400">Loading your profile details...</span>
        </div>
      </div>
    );
  }

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.email
      ? profile.email.slice(0, 2).toUpperCase()
      : 'ED';

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      {/* Compact Profile Header Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-base font-black text-slate-950 shadow-xs ring-1 ring-cyan-400/30">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  {profile?.display_name || profile?.email}
                </h1>
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{profile?.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
              Role: {profile?.role_key || profile?.role}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              {profile?.aal === 'aal2' ? '🛡️ AAL2' : '🔒 AAL1'}
            </span>
            <Link
              href="/articles"
              className="rounded-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-cyan-600 transition"
            >
              {profile?.articles_count ?? 0} stories
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Section 1: Edit Author Name & Byline */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">✍️</span>
              <h2 className="text-lg font-bold text-white">Author Byline & Display Name</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This name will be displayed as the author byline on all public news reports and articles published under your account.
            </p>

            {nameSuccess && (
              <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs text-emerald-200">
                ✓ {nameSuccess}
              </div>
            )}

            {nameError && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/60 p-3 text-xs text-red-200">
                ! {nameError}
              </div>
            )}

            <form onSubmit={handleUpdateName} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Author Display Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Hafiz Zargar"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
                <p className="mt-1 text-[11px] text-slate-500">1 to 120 characters</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateArticles}
                    onChange={(e) => setUpdateArticles(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-200">Update existing authored stories</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Automatically retroactively updates the author byline on all your past published and draft articles to match this new name.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={savingName}
                  isLoading={savingName}
                >
                  {savingName ? 'Saving Changes...' : 'Save Author Name'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Section 2: Security & Password */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔐</span>
              <h2 className="text-lg font-bold text-white">Change Account Password</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Update your password to keep your newsroom account safe. Minimum 8 characters.
            </p>

            {passwordSuccess && (
              <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs text-emerald-200">
                ✓ {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/60 p-3 text-xs text-red-200">
                ! {passwordError}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  New Password <span className="text-red-400">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Confirm New Password <span className="text-red-400">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400"
                  />
                  <span>Show password</span>
                </label>
                <span className="text-[11px] text-slate-500">Min 8 characters</span>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  disabled={savingPassword || !newPassword}
                  isLoading={savingPassword}
                >
                  {savingPassword ? 'Updating Password...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
