'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { Button } from '@/components/Button';

type AdThemeAccent = 'gold' | 'emerald' | 'cyan' | 'ruby' | 'indigo';

interface CustomAdPlacement {
  id: string;
  name: string;
  enabled: boolean;
  sponsor_name: string;
  badge_label: string;
  title: string;
  description: string;
  cta_text: string;
  destination_url: string;
  image_url: string | null;
  theme_accent: AdThemeAccent;
}

interface CustomAdsSettings {
  monetization_enabled: boolean;
  contact_email_for_ads: string;
  contact_phone_for_ads: string;
  pricing_badge: string;
  placements: CustomAdPlacement[];
}

const DEFAULT_ADS_SETTINGS: CustomAdsSettings = {
  monetization_enabled: true,
  contact_email_for_ads: 'advertise@kjin.org',
  contact_phone_for_ads: '+91 194 245 7777',
  pricing_badge: 'Reach 50,000+ J&K Readers Daily',
  placements: [
    {
      id: 'leaderboard_top',
      name: 'Homepage Top Leaderboard (Front Page Header)',
      enabled: true,
      sponsor_name: 'Kashmir Artisans & Heritage Guild',
      badge_label: 'Official Partner',
      title: 'Authentic Hand-Knotted Silk Carpets & Pashmina Shawls',
      description: 'Geographical Indication (GI) certified crafts delivered worldwide directly from valley master craftsmen.',
      cta_text: 'Shop Verified Collection',
      destination_url: 'https://kashmircrafts.org',
      image_url: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=600&q=80',
      theme_accent: 'gold',
    },
    {
      id: 'sidebar_banner',
      name: 'Right Rail Sidebar Sponsor (Right Side of Page)',
      enabled: true,
      sponsor_name: 'Valley MedX Diagnostic Laboratories',
      badge_label: 'Health Sponsor',
      title: 'Comprehensive 72-Parameter Full Body Health Checkup',
      description: 'NABL Accredited center at Residency Road, Srinagar. Same-day digital reports & free home sample pickup.',
      cta_text: 'Book Home Pickup',
      destination_url: 'https://valleymedx.in',
      image_url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80',
      theme_accent: 'emerald',
    },
    {
      id: 'in_article_native',
      name: 'In-Article Mid-Reading Sponsor (In Between Paragraphs)',
      enabled: true,
      sponsor_name: 'Gulmarg Alpine Eco-Resorts',
      badge_label: 'Winter Season 2026',
      title: 'Experience First Snow in Gondola Valley: Early Bird Suites Open',
      description: 'Centrally heated pine chalets with panoramic views of Apharwat peak. Complimentary airport transfers included.',
      cta_text: 'Check Availability',
      destination_url: 'https://gulmargresorts.com',
      image_url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80',
      theme_accent: 'cyan',
    },
  ],
};

export default function AdsSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState<CustomAdsSettings>(DEFAULT_ADS_SETTINGS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role_key, status')
          .eq('id', sessionData.session.user.id)
          .single();

        if (!profile || profile.status !== 'active') {
          router.push('/login');
          return;
        }

        const role = (profile as { role_key?: string }).role_key || 'staff';
        setUserRole(role);

        if (role !== 'owner' && role !== 'superadmin') {
          router.push('/');
          return;
        }

        if (requiresMfa(role)) {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aalData?.currentLevel !== 'aal2') {
            router.push('/mfa/challenge');
            return;
          }
        }

        const hasAccess = ['owner', 'superadmin'].includes(role);
        setCanManage(hasAccess);

        // Fetch current custom_ads from API route
        const token = sessionData.session.access_token;
        const res = await fetch('/api/settings/ads', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          if (json.settings) {
            setForm(json.settings);
          }
          if (typeof json.can_manage === 'boolean') {
            setCanManage(json.can_manage);
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load ads settings:', err);
        setErrorMsg('Failed to load current ads configuration.');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save monetization settings');
      }

      if (json.settings) {
        setForm(json.settings);
      }

      setSuccessMsg('Monetization settings & advertiser contact info saved successfully!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error('Error saving ads:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-xs text-slate-400 font-mono">Loading revenue & ads configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      {/* Header with Sticky Top Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Custom Ads & Monetization</h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              Direct Revenue
            </span>
            {userRole && (
              <span className="rounded-full bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono uppercase text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/60">
                {userRole}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Control site-wide monetization status, direct sponsor desk contact, and reader reach badge.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManage && (
            <Button
              type="submit"
              form="ads-settings-form"
              variant="cyan"
              size="md"
              disabled={saving}
              isLoading={saving}
              icon={<span>💾</span>}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          )}
          <Button
            href="http://localhost:3000"
            external
            variant="secondary"
            size="md"
          >
            Public Site ↗
          </Button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-200 shadow-md">
          <div className="flex items-center gap-2 font-bold text-red-400 mb-1">
            <span>⚠️</span> Error
          </div>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-200 shadow-md">
          <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
            <span>✓</span> Success
          </div>
          {successMsg}
        </div>
      )}

      <form id="ads-settings-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Master Monetization Switch & Inquiries */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 shadow-xs backdrop-blur-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Enable Site-Wide Monetization</span>
                {form.monetization_enabled ? (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/20">
                    Active & Serving
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Paused
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                When enabled, verified partner inquiries and sponsor placements are served to readers across KJIN pages.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.monetization_enabled}
                onChange={(e) => setForm({ ...form, monetization_enabled: e.target.checked })}
                disabled={!canManage}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Advertiser Contact & Rate Card Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Ad Sales Email
              </label>
              <input
                type="email"
                value={form.contact_email_for_ads}
                onChange={(e) => setForm({ ...form, contact_email_for_ads: e.target.value })}
                disabled={!canManage}
                placeholder="advertise@kjin.org"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-cyan-500 focus:outline-none shadow-2xs transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Ad Sales Desk Phone
              </label>
              <input
                type="text"
                value={form.contact_phone_for_ads}
                onChange={(e) => setForm({ ...form, contact_phone_for_ads: e.target.value })}
                disabled={!canManage}
                placeholder="+91 194 245 7777"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-cyan-500 focus:outline-none shadow-2xs transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Media Kit / Reach Badge
              </label>
              <input
                type="text"
                value={form.pricing_badge}
                onChange={(e) => setForm({ ...form, pricing_badge: e.target.value })}
                disabled={!canManage}
                placeholder="Reach 50,000+ J&K Readers Daily"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-cyan-500 focus:outline-none shadow-2xs transition"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
