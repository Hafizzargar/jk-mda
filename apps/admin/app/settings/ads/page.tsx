'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { ImageUploader } from '@/components/ImageUploader';
import {
  DEFAULT_ADS_SETTINGS,
  type CustomAdsSettings,
  type CustomAdPlacement,
  type AdThemeAccent,
  getThemeStyles,
} from '@/lib/ads';

const ACCENT_OPTIONS: { id: AdThemeAccent; label: string; badgeClass: string; desc: string }[] = [
  { id: 'gold', label: 'Imperial Gold', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40', desc: 'Warm amber glow. Ideal for luxury crafts, jewellery & carpets.' },
  { id: 'emerald', label: 'Valley Emerald', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', desc: 'Vibrant green glow. Ideal for healthcare, diagnostics & organics.' },
  { id: 'cyan', label: 'Glacier Cyan', badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', desc: 'Crisp electric cyan glow. Ideal for resorts, tourism & technology.' },
  { id: 'ruby', label: 'Chinar Ruby', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40', desc: 'Rich crimson glow. Ideal for real estate, events & promotions.' },
  { id: 'indigo', label: 'Kashmir Indigo', badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', desc: 'Deep royal blue glow. Ideal for banking, education & corporate.' },
];

export default function AdsSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState<CustomAdsSettings>(DEFAULT_ADS_SETTINGS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string>('leaderboard_top');

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
          .select('role, status')
          .eq('id', sessionData.session.user.id)
          .single();

        if (!profile || profile.status !== 'active') {
          router.push('/login');
          return;
        }

        const role = profile.role;
        setUserRole(role);

        if (requiresMfa(role)) {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aalData?.currentLevel !== 'aal2') {
            router.push('/mfa/challenge');
            return;
          }
        }

        const hasAccess = ['owner', 'superadmin', 'admin'].includes(role);
        setCanManage(hasAccess);

        // Fetch current custom_ads from site_settings
        const { data: settingRow } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'custom_ads')
          .maybeSingle();

        if (settingRow?.value) {
          const raw = settingRow.value as Partial<CustomAdsSettings>;
          setForm({
            monetization_enabled: raw.monetization_enabled ?? true,
            contact_email_for_ads: raw.contact_email_for_ads || DEFAULT_ADS_SETTINGS.contact_email_for_ads,
            contact_phone_for_ads: raw.contact_phone_for_ads || DEFAULT_ADS_SETTINGS.contact_phone_for_ads,
            pricing_badge: raw.pricing_badge || DEFAULT_ADS_SETTINGS.pricing_badge,
            placements: Array.isArray(raw.placements) && raw.placements.length > 0
              ? (raw.placements as CustomAdPlacement[])
              : DEFAULT_ADS_SETTINGS.placements,
          });
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

  const handlePlacementChange = <K extends keyof CustomAdPlacement>(
    placementId: string,
    field: K,
    value: CustomAdPlacement[K]
  ) => {
    setForm((prev: CustomAdsSettings) => ({
      ...prev,
      placements: prev.placements.map((p: CustomAdPlacement) =>
        p.id === placementId ? { ...p, [field]: value } : p
      ),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      setErrorMsg('You do not have permission to modify custom ad settings.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user.id;

      // Upsert into site_settings
      const { error: upsertError } = await supabase
        .from('site_settings')
        .upsert(
          {
            key: 'custom_ads',
            value: form,
            updated_at: new Date().toISOString(),
            updated_by: userId || null,
          },
          { onConflict: 'key' }
        );

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      // Log to audit_logs
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'UPDATE',
        entity_name: 'site_settings',
        entity_id: 'custom_ads',
        changes: {
          monetization_enabled: form.monetization_enabled,
          placements_count: form.placements.length,
          timestamp: new Date().toISOString(),
        },
      });

      setSuccessMsg('Monetization settings & attractive custom ads saved successfully!');
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

  const activePlacement = form.placements.find((p: CustomAdPlacement) => p.id === selectedPlacementId) || form.placements[0];
  const activeStyles = getThemeStyles(activePlacement.theme_accent);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Custom Ads & Monetization</h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-mono font-medium text-emerald-400 border border-emerald-500/20">
              Direct Revenue
            </span>
            {userRole && (
              <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono uppercase text-slate-300 border border-slate-700/60">
                {userRole}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Earn revenue with high-impact, beautifully styled local sponsor dispatches, banners, and partner placements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/settings/footer"
            className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
          >
            Footer & Bureaus &rarr;
          </Link>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition"
          >
            Preview on Reader Site ↗
          </a>
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

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Master Monetization Switch & Inquiries */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-white">Enable Site-Wide Monetization</span>
                {form.monetization_enabled ? (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Active & Serving
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Paused
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                When enabled, active sponsor banners and cards are presented to readers across KJIN pages.
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
              <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Advertiser Contact & Rate Card Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Ad Sales Email
              </label>
              <input
                type="email"
                value={form.contact_email_for_ads}
                onChange={(e) => setForm({ ...form, contact_email_for_ads: e.target.value })}
                disabled={!canManage}
                placeholder="advertise@kjin.org"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Ad Sales Desk Phone
              </label>
              <input
                type="text"
                value={form.contact_phone_for_ads}
                onChange={(e) => setForm({ ...form, contact_phone_for_ads: e.target.value })}
                disabled={!canManage}
                placeholder="+91 194 245 7777"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Media Kit / Reach Badge
              </label>
              <input
                type="text"
                value={form.pricing_badge}
                onChange={(e) => setForm({ ...form, pricing_badge: e.target.value })}
                disabled={!canManage}
                placeholder="Reach 50,000+ J&K Readers Daily"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Ad Placements Selector & Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Placement Navigation */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Available Ad Slots
            </h3>
            {form.placements.map((placement: CustomAdPlacement) => {
              const isSelected = placement.id === selectedPlacementId;
              const pStyles = getThemeStyles(placement.theme_accent);

              return (
                <button
                  key={placement.id}
                  type="button"
                  onClick={() => setSelectedPlacementId(placement.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-cyan-400/80 bg-slate-900 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-400/50'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">{placement.name}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${pStyles.badgeBg}`}>
                      {placement.theme_accent}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1">{placement.title}</div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{placement.sponsor_name}</span>
                    <span className={placement.enabled ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                      {placement.enabled ? '● Active' : '○ Disabled'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Placement Editor */}
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
              {/* Placement Title & Enable Toggle */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white">{activePlacement.name}</h2>
                  <p className="text-xs text-slate-400">Position ID: <code className="text-cyan-400 font-mono">{activePlacement.id}</code></p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-300">
                    {activePlacement.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <input
                    type="checkbox"
                    checked={activePlacement.enabled}
                    onChange={(e) => handlePlacementChange(activePlacement.id, 'enabled', e.target.checked)}
                    disabled={!canManage}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
                  />
                </label>
              </div>

              {/* Attractive Color Accent Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Attractive Color Scheme & Radiant Glow
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ACCENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handlePlacementChange(activePlacement.id, 'theme_accent', opt.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        activePlacement.theme_accent === opt.id
                          ? 'border-white bg-slate-800/90 ring-2 ring-white/20'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${opt.badgeClass}`}>
                          {opt.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sponsor & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Sponsor / Client Name
                  </label>
                  <input
                    type="text"
                    value={activePlacement.sponsor_name}
                    onChange={(e) => handlePlacementChange(activePlacement.id, 'sponsor_name', e.target.value)}
                    disabled={!canManage}
                    placeholder="e.g. Valley MedX Diagnostic Laboratories"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    value={activePlacement.badge_label}
                    onChange={(e) => handlePlacementChange(activePlacement.id, 'badge_label', e.target.value)}
                    disabled={!canManage}
                    placeholder="e.g. Official Partner / Health Sponsor"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Headline & Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Ad Headline / Campaign Title
                  </label>
                  <input
                    type="text"
                    value={activePlacement.title}
                    onChange={(e) => handlePlacementChange(activePlacement.id, 'title', e.target.value)}
                    disabled={!canManage}
                    placeholder="e.g. Comprehensive 72-Parameter Full Body Health Checkup"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Description & Value Proposition
                  </label>
                  <textarea
                    rows={3}
                    value={activePlacement.description}
                    onChange={(e) => handlePlacementChange(activePlacement.id, 'description', e.target.value)}
                    disabled={!canManage}
                    placeholder="Provide details about the service, accreditation, local branch, or special reader discount."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Destination URL & CTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Call To Action Text
                  </label>
                  <input
                    type="text"
                    value={activePlacement.cta_text}
                    onChange={(e) => handlePlacementChange(activePlacement.id, 'cta_text', e.target.value)}
                    disabled={!canManage}
                    placeholder="e.g. Book Home Sample Pickup"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Destination / Sponsor URL
                  </label>
                  <input
                    type="url"
                    value={activePlacement.destination_url}
                    onChange={(e) => handlePlacementChange(activePlacement.id, 'destination_url', e.target.value)}
                    disabled={!canManage}
                    placeholder="https://valleymedx.in"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Image Upload with System File Support */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Ad Banner / Product Creative
                </label>
                <p className="text-[11px] text-slate-400 mb-3">
                  Upload a high-resolution 16:9 or square banner from your computer or pick a web preset.
                </p>
                <ImageUploader
                  value={activePlacement.image_url || ''}
                  onChange={(url: string) => handlePlacementChange(activePlacement.id, 'image_url', url || null)}
                />
              </div>

              {/* Live Preview Card */}
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Live Appearance Preview
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400">
                    Theme: {activePlacement.theme_accent.toUpperCase()}
                  </span>
                </div>

                <div
                  className={`p-6 rounded-2xl border ${activeStyles.borderColor} ${activeStyles.cardBg} ${activeStyles.glow} transition-all duration-300`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${activeStyles.badgeBg}`}>
                      {activePlacement.badge_label || 'Sponsored'}
                    </span>
                    <span className={`text-xs font-semibold ${activeStyles.sponsorText}`}>
                      {activePlacement.sponsor_name}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                    {activePlacement.title || 'Your Eye-Catching Ad Title Here'}
                  </h3>

                  <p className="text-xs text-slate-300 mb-4 line-clamp-2 leading-relaxed">
                    {activePlacement.description || 'Campaign description highlighting key features and reader benefits.'}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                      🔗 {activePlacement.destination_url || 'https://example.com'}
                    </span>
                    <button
                      type="button"
                      className={`px-5 py-2 rounded-xl text-xs uppercase tracking-wider ${activeStyles.ctaButton}`}
                    >
                      {activePlacement.cta_text || 'Learn More'} &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Buttons */}
            {canManage && (
              <div className="flex items-center justify-end gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-950/40 hover:from-emerald-300 hover:to-teal-300 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving Settings...' : 'Save Monetization Settings'}
                </button>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
