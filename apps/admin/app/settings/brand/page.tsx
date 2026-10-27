'use client';

import { useEffect, useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import {
  DEFAULT_NAVBAR_SETTINGS,
  type NavbarSettings,
  type NavbarBrandConfig,
} from '@/lib/navbar';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';

const PRESET_LOGOS = [
  {
    name: 'KCPJLN Emblem Symbol (WebP)',
    url: '/kcpjln-symbol.webp',
    desc: 'Tri-symbol representing Kashmir Valley, Chenab River & Leh/Ladakh Heritage',
  },
  {
    name: 'KCPJLN Full Panoramic Banner (WebP)',
    url: '/kcpjln-wide-banner.webp',
    desc: 'Official widescreen masthead banner with 5 regional divisions',
  },
  {
    name: 'Classic KJIN River Emblem (PNG)',
    url: '/kjin-emblem.png',
    desc: 'Classic circular mountain river heritage emblem',
  },
];

export default function BrandSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [fullNavSettings, setFullNavSettings] = useState<NavbarSettings>(DEFAULT_NAVBAR_SETTINGS);
  const [brand, setBrand] = useState<NavbarBrandConfig>(DEFAULT_NAVBAR_SETTINGS.brand);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadBrandConfig() {
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

        const role = profile.role_key;
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

        const token = sessionData.session?.access_token;
        const res = await fetch('/api/settings/navbar', {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.navbar_settings) {
            setFullNavSettings(json.navbar_settings);
            if (json.navbar_settings.brand) {
              setBrand(json.navbar_settings.brand);
            }
          }
          setCanManage(Boolean(json.can_manage));
        } else {
          const allowed = ['owner', 'superadmin'].includes(role);
          setCanManage(allowed);
        }
      } catch (err: unknown) {
        console.error('[BrandSettingsPage] Load error:', err);
        setErrorMsg('Failed to load branding identity settings.');
      } finally {
        setLoading(false);
      }
    }

    loadBrandConfig();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const payload: NavbarSettings = {
        ...fullNavSettings,
        brand: {
          ...brand,
          name: brand.name.trim() || 'KCPJLN',
          full_name: brand.full_name?.trim() || '',
          tagline: brand.tagline.trim(),
          logo_url: brand.logo_url.trim() || '/kcpjln-symbol.webp',
          loader_text: brand.loader_text?.trim() || brand.full_name?.trim() || brand.name.trim(),
        },
      };

      const res = await fetch('/api/settings/navbar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update brand identity.');
      }

      setFullNavSettings(json.navbar_settings);
      setBrand(json.navbar_settings.brand);
      setSuccessMsg('Brand identity saved and broadcast everywhere! Changes are live across the entire website and admin portal.');
      toast.success('Brand identity updated everywhere successfully!');

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('kjin_brand_config', JSON.stringify(json.navbar_settings.brand));
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('kjin-brand-updated', { detail: json.navbar_settings?.brand }));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while saving.';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const applyKCPJLNPreset = () => {
    setBrand({
      ...brand,
      name: 'KCPJLN',
      full_name: 'Kashmir Chenab Panjal Jammu Ladakh Network',
      tagline: 'One Region, Many Voices, Trusted News',
      logo_url: '/kcpjln-symbol.webp',
      loader_text: 'Kashmir Chenab Panjal Jammu Ladakh Network',
      show_name: true,
      show_tagline: true,
      show_logo_image: true,
    });
    toast.info('Applied KCPJLN identity preset. Click "Save & Broadcast Changes" to publish.');
  };

  const applyKJINPreset = () => {
    setBrand({
      ...brand,
      name: 'KJIN',
      full_name: 'Kashmir & Jammu Information Network',
      tagline: 'J&K Journal of Record',
      logo_url: '/kjin-emblem.png',
      loader_text: 'Jammu & Kashmir Journal of Record',
      show_name: true,
      show_tagline: true,
      show_logo_image: true,
    });
    toast.info('Applied KJIN identity preset. Click "Save & Broadcast Changes" to publish.');
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          <p className="text-xs font-mono uppercase tracking-wider text-slate-400">Loading Brand Identity Control Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold mb-1">
            <Link href="/" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <Link href="/settings/navbar" className="hover:underline">Site Settings</Link>
            <span>/</span>
            <span>Brand Identity</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>🎨</span> One-Place Brand &amp; Identity Control
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Control the site short acronym (e.g. <strong>KCPJLN</strong> or <strong>KJIN</strong>), company full name, official tagline, and emblem logo from this single hub. Any modification saved here is automatically and immediately reflected across the web frontend, mobile drawer, page titles, footer, and admin portal.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Button
            type="button"
            variant="primary"
            size="md"
            icon="💾"
            onClick={handleSubmit}
            disabled={!canManage || saving}
            isLoading={saving}
            className="w-full sm:w-auto justify-center font-bold"
          >
            {saving ? 'Publishing...' : 'Save & Broadcast Everywhere'}
          </Button>
        </div>
      </div>

      {/* Status Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-center gap-3 animate-in fade-in">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in">
          <span className="text-xl">✅</span>
          <div className="flex-1">{successMsg}</div>
        </div>
      )}

      {/* Instant Identity Presets Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5">
            <span>⚡</span>
            <span>Quick 1-Click Identity Presets</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Switch between the official KCPJLN network identity and legacy KJIN identity with one click:
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={applyKCPJLNPreset}
            className="px-3.5 py-1.5 rounded-xl border border-cyan-500/60 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 transition flex items-center gap-2 shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Apply KCPJLN Preset</span>
          </button>
          <button
            type="button"
            onClick={applyKJINPreset}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-2xs"
          >
            <span>Apply KJIN Preset</span>
          </button>
        </div>
      </div>

      {/* Live Visual Preview Card */}
      <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Brand Card Preview (What Readers See)</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Updates live as you type</span>
        </div>

        {/* Masthead Preview */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            {brand.show_logo_image && (
              <div className="relative w-12 h-12 shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 shadow-sm overflow-hidden">
                <Image
                  src={brand.logo_url || '/kcpjln-symbol.webp'}
                  alt={brand.name || 'Brand Logo'}
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div>
              {brand.show_name && (
                <div className="text-2xl font-black font-serif tracking-tight text-slate-950 dark:text-white uppercase leading-none">
                  {brand.name || 'KCPJLN'}
                </div>
              )}
              {brand.full_name && (
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide mt-0.5">
                  {brand.full_name}
                </div>
              )}
              {brand.show_tagline && brand.tagline && (
                <div className="text-[10px] font-mono uppercase font-bold text-cyan-600 dark:text-cyan-400 tracking-widest mt-1">
                  {brand.tagline}
                </div>
              )}
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-500 font-mono hidden md:block">
            <div>Scope: Jammu, Kashmir, Chenab, Pir Panjal &amp; Ladakh</div>
            <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">&#10003; 100% Verified Editorial Network</div>
          </div>
        </div>
      </div>

      {/* Main Editing Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 space-y-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <span>⚙️</span> Core Brand Identity Fields
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Brand Short Name (Acronym) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between">
                <span>Brand Acronym / Short Name *</span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-normal">Navbar &amp; Byline Wordmark</span>
              </label>
              <input
                type="text"
                value={brand.name}
                onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                placeholder="e.g. KCPJLN or KJIN"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                required
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Primary wordmark displayed in the Navbar, mobile drawer, article bylines, templates, and admin sidebar header.
              </p>
            </div>

            {/* 2. Full Organization Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between">
                <span>Full Legal Organization Name *</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">Footer, Masthead &amp; Legal</span>
              </label>
              <input
                type="text"
                value={brand.full_name || ''}
                onChange={(e) => setBrand({ ...brand, full_name: e.target.value })}
                placeholder="e.g. Kashmir Chenab Panjal Jammu Ladakh Network"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Full legal name displayed in the footer masthead, statutory accreditation box, and copyright statements.
              </p>
            </div>

            {/* 3. Subtitle / Tagline */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-slate-700 dark:text-slate-300 font-semibold">
                Official Motto / Tagline
              </label>
              <input
                type="text"
                value={brand.tagline}
                onChange={(e) => setBrand({ ...brand, tagline: e.target.value })}
                placeholder="e.g. One Region, Many Voices, Trusted News"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Motto displayed underneath the navbar emblem and in the mission summary of the footer.
              </p>
            </div>

            {/* 4. Loader Screen Text */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-slate-700 dark:text-slate-300 font-semibold">
                Animated Loader Text
              </label>
              <input
                type="text"
                value={brand.loader_text || ''}
                onChange={(e) => setBrand({ ...brand, loader_text: e.target.value })}
                placeholder="e.g. Kashmir Chenab Panjal Jammu Ladakh Network"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Text displayed beneath the spinning orbital logo during page transitions and initial application boot.
              </p>
            </div>
          </div>

          {/* 5. Emblem Logo Image Path */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-mono uppercase text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between">
              <span>Official Emblem Logo Image Path</span>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-normal">PNG / WebP / SVG / HTTPS</span>
            </label>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={brand.logo_url}
                onChange={(e) => setBrand({ ...brand, logo_url: e.target.value })}
                placeholder="/kcpjln-symbol.webp"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
              <div className="relative w-11 h-11 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-1 flex items-center justify-center overflow-hidden">
                <Image
                  src={brand.logo_url || '/kcpjln-symbol.webp'}
                  alt="Preview"
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            {/* Quick logo selector pills */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Available Built-in Image Assets:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PRESET_LOGOS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => {
                      setBrand({ ...brand, logo_url: preset.url });
                      toast.info(`Selected ${preset.name}`);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      brand.logo_url === preset.url
                        ? 'border-cyan-500 bg-cyan-500/10 dark:bg-cyan-950/40'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="relative w-8 h-8 shrink-0 bg-white dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <Image src={preset.url} alt={preset.name} fill className="object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{preset.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{preset.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visibility Toggles */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-mono uppercase text-slate-700 dark:text-slate-300 font-semibold">
              Visibility &amp; Display Preferences
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/60 transition">
                <input
                  type="checkbox"
                  checked={brand.show_name}
                  onChange={(e) => setBrand({ ...brand, show_name: e.target.checked })}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Show Brand Name</div>
                  <div className="text-[10px] text-slate-500">Show text wordmark next to logo</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/60 transition">
                <input
                  type="checkbox"
                  checked={brand.show_tagline}
                  onChange={(e) => setBrand({ ...brand, show_tagline: e.target.checked })}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Show Motto / Tagline</div>
                  <div className="text-[10px] text-slate-500">Display tagline below wordmark</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/60 transition">
                <input
                  type="checkbox"
                  checked={brand.show_logo_image}
                  onChange={(e) => setBrand({ ...brand, show_logo_image: e.target.checked })}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Show Logo Emblem</div>
                  <div className="text-[10px] text-slate-500">Display official symbol in navbar</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
          <p className="text-xs text-slate-500">
            Saving here immediately updates the website navigation, footer, page titles, and admin portal.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon="💾"
            disabled={!canManage || saving}
            isLoading={saving}
          >
            {saving ? 'Publishing...' : 'Save & Broadcast Everywhere'}
          </Button>
        </div>
      </form>
    </div>
  );
}
