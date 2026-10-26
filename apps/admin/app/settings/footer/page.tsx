'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { DEFAULT_FOOTER_CONTACT, type FooterContactSettings } from '@/lib/contact';
import { Button } from '@/components/Button';

export default function FooterSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState<FooterContactSettings>(DEFAULT_FOOTER_CONTACT);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bureaus' | 'phones' | 'emails' | 'statutory' | 'social'>('bureaus');

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

        const role = profile.role_key;
        setUserRole(role);

        if (role !== 'owner' && role !== 'superadmin' && requiresMfa(role)) {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aalData?.currentLevel !== 'aal2') {
            router.push('/mfa/challenge');
            return;
          }
        }

        const token = sessionData.session?.access_token;

        // Fetch current footer_contact from site_settings
        const { data: settingRow } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'footer_contact')
          .maybeSingle();

        if (settingRow?.value) {
          setForm({ ...DEFAULT_FOOTER_CONTACT, ...(settingRow.value as Partial<FooterContactSettings>) });
        }

        // Also fetch brand from navbar_settings to keep organization_name synced
        try {
          const { data: navRow } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'navbar_settings')
            .maybeSingle();

          const navBrand = (navRow?.value as { brand?: { name?: string; full_name?: string } } | null)?.brand;
          if (navBrand?.name && navBrand?.full_name) {
            const syncedName = `${navBrand.name} (${navBrand.full_name})`;
            setForm((prev) => ({
              ...prev,
              organization_name: prev.organization_name === DEFAULT_FOOTER_CONTACT.organization_name ? syncedName : (prev.organization_name || syncedName),
            }));
          }
        } catch {
          // fallback
        }

        const res = await fetch('/api/settings/footer', {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.footer_contact) {
            setForm({ ...DEFAULT_FOOTER_CONTACT, ...json.footer_contact });
          }
          setCanManage(Boolean(json.can_manage));
        } else {
          // If role allows, enable canManage based on profile
          setCanManage(['owner', 'superadmin', 'admin', 'editor'].includes(role));
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Error loading settings');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [router]);

  const handleChange = (field: keyof FooterContactSettings, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      setErrorMsg('You do not have permission to modify contact settings.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/footer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save settings');
      }

      setSuccessMsg('Footer and contact details saved successfully to the public website!');
      if (json.footer_contact) {
        setForm(json.footer_contact);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm text-slate-400">Loading footer contact settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">Settings</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">Public Contact & Disclosures</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Footer & Bureaus
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Live
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Bureau addresses, editorial hotlines, and public legal disclosures.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canManage && (
              <Button
                type="submit"
                form="footer-settings-form"
                disabled={saving}
                isLoading={saving}
                variant="primary"
                size="md"
                icon="💾"
              >
                {saving ? 'Saving...' : 'Save Footer Changes'}
              </Button>
            )}
            <Button
              href="http://localhost:3000"
              external
              variant="secondary"
              size="md"
            >
              Public Site →
            </Button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold">Error:</span>
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">&times;</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>&#10003;</span>
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">&times;</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-px">
          {[
            { id: 'bureaus', label: 'Bureaus & Addresses', icon: '📍' },
            { id: 'phones', label: 'Newsdesk & Phones', icon: '📞' },
            { id: 'emails', label: 'Emails & Grievance', icon: '✉️' },
            { id: 'statutory', label: 'Statutory & Policy', icon: '⚖️' },
            { id: 'social', label: 'Social Channels', icon: '🌐' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-300 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Form & Live Preview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Edit Form */}
          <form id="footer-settings-form" onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
            {activeTab === 'bureaus' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Bureau Offices & Addresses</h2>
                  <p className="text-xs text-slate-400">Configure headquarters and regional bureau locations shown in the footer.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Organization Display Name
                      </label>
                      <Link
                        href="/settings/navbar"
                        className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                      >
                        <span>🔗 Synced with Brand Settings</span>
                        <span>&rarr;</span>
                      </Link>
                    </div>
                    <input
                      type="text"
                      value={form.organization_name}
                      onChange={(e) => handleChange('organization_name', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                      placeholder="e.g. KCPL (Kashmir Central Press & Journalistic Leadership Network)"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>Full entity name shown in footer identity &amp; legal copyright. Controlled centrally from <Link href="/settings/navbar" className="text-cyan-400 underline">Brand &amp; Logo Settings</Link>.</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Journalism Tagline
                    </label>
                    <input
                      type="text"
                      value={form.tagline}
                      onChange={(e) => handleChange('tagline', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                      placeholder="e.g. Verified Journalism & Public Affairs across Jammu & Kashmir"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Primary Bureau Label
                      </label>
                      <input
                        type="text"
                        value={form.primary_address_label}
                        onChange={(e) => handleChange('primary_address_label', e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                        placeholder="e.g. Srinagar Central Bureau"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Regional Bureau Label
                      </label>
                      <input
                        type="text"
                        value={form.bureau_address_label}
                        onChange={(e) => handleChange('bureau_address_label', e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                        placeholder="e.g. Jammu Regional Bureau"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Primary Bureau Address (Srinagar HQ)
                    </label>
                    <textarea
                      rows={2}
                      value={form.primary_address}
                      onChange={(e) => handleChange('primary_address', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                      placeholder="e.g. Press Enclave, Residency Road, Srinagar, J&K 190001"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Regional Bureau Address (Jammu)
                    </label>
                    <textarea
                      rows={2}
                      value={form.bureau_address}
                      onChange={(e) => handleChange('bureau_address', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                      placeholder="e.g. Bahu Plaza Complex, Rail Head, Jammu, J&K 180012"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Operating & Newsroom Hours
                    </label>
                    <input
                      type="text"
                      value={form.operating_hours}
                      onChange={(e) => handleChange('operating_hours', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                      placeholder="e.g. Newsdesk: 24/7 Wire Operations • Admin: Mon–Sat 9:30 AM – 6:00 PM IST"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'phones' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Newsdesk & Tip Hotlines</h2>
                  <p className="text-xs text-slate-400">Direct phone numbers and encrypted WhatsApp lines for whistleblowers and readers.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Primary Phone Label
                      </label>
                      <input
                        type="text"
                        value={form.phone_primary_label}
                        onChange={(e) => handleChange('phone_primary_label', e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                        placeholder="e.g. Editorial Newsdesk Hotline"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Primary Phone Number
                      </label>
                      <input
                        type="text"
                        value={form.phone_primary}
                        onChange={(e) => handleChange('phone_primary', e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
                        placeholder="e.g. +91 194 245 7800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Secondary Phone Label
                      </label>
                      <input
                        type="text"
                        value={form.phone_secondary_label}
                        onChange={(e) => handleChange('phone_secondary_label', e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                        placeholder="e.g. WhatsApp Secure Tip Line"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Secondary Phone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={form.phone_secondary}
                        onChange={(e) => handleChange('phone_secondary', e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
                        placeholder="e.g. +91 94190 12345"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'emails' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Official Emails & Grievances</h2>
                  <p className="text-xs text-slate-400">Addresses for editorial inquiries, press communications, and statutory complaints.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Editorial Newsdesk Email
                    </label>
                    <input
                      type="email"
                      value={form.email_editorial}
                      onChange={(e) => handleChange('email_editorial', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
                      placeholder="e.g. editorial@kjin.org"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Press Releases & Media Email
                    </label>
                    <input
                      type="email"
                      value={form.email_press}
                      onChange={(e) => handleChange('email_press', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
                      placeholder="e.g. press@kjin.org"
                    />
                  </div>

                  <div className="border-t border-slate-800 pt-4 space-y-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200">
                      <strong>Statutory Redressal:</strong> In accordance with Digital Media Ethics Code Rules, the Grievance Officer details are mandatorily published.
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Grievance Officer Name / Designation
                      </label>
                      <input
                        type="text"
                        value={form.grievance_officer_name}
                        onChange={(e) => handleChange('grievance_officer_name', e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                        placeholder="e.g. Adv. Bashir Ahmad (Public Grievance Redressal Officer)"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Public Grievance Email
                      </label>
                      <input
                        type="email"
                        value={form.email_grievance}
                        onChange={(e) => handleChange('email_grievance', e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
                        placeholder="e.g. grievance@kjin.org"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'statutory' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Statutory Registrations & Disclosures</h2>
                  <p className="text-xs text-slate-400">Public disclosures, entity registration numbers, and publisher ethics compliance statements.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Statutory Registration & Compliance Notice
                    </label>
                    <textarea
                      rows={3}
                      value={form.registration_number}
                      onChange={(e) => handleChange('registration_number', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono text-xs"
                      placeholder="e.g. JK/REG/2026/0842 • Compliant with Information Technology Rules, 2021"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Journalistic Mission Statement
                    </label>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none text-xs"
                      placeholder="Summary of newsroom principles, non-partisanship, and verification standards."
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'social' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Social Media & Broadcast Channels</h2>
                  <p className="text-xs text-slate-400">Direct broadcast links displayed in the footer and communication hubs.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      X / Twitter URL
                    </label>
                    <input
                      type="url"
                      value={form.social_twitter}
                      onChange={(e) => handleChange('social_twitter', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono text-xs"
                      placeholder="https://twitter.com/kjin_live"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Facebook Page URL
                    </label>
                    <input
                      type="url"
                      value={form.social_facebook}
                      onChange={(e) => handleChange('social_facebook', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono text-xs"
                      placeholder="https://facebook.com/kjinnews"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      WhatsApp Channel URL
                    </label>
                    <input
                      type="url"
                      value={form.social_whatsapp}
                      onChange={(e) => handleChange('social_whatsapp', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono text-xs"
                      placeholder="https://whatsapp.com/channel/..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Telegram Channel URL
                    </label>
                    <input
                      type="url"
                      value={form.social_telegram}
                      onChange={(e) => handleChange('social_telegram', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono text-xs"
                      placeholder="https://t.me/kjin_wire"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      YouTube Broadcast URL
                    </label>
                    <input
                      type="url"
                      value={form.social_youtube}
                      onChange={(e) => handleChange('social_youtube', e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono text-xs"
                      placeholder="https://youtube.com/@kjin_live"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Action */}
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-slate-500">
                Logged in as: <strong className="text-slate-300 capitalize">{userRole}</strong>
              </span>

              <Button
                type="submit"
                disabled={saving || !canManage}
                isLoading={saving}
                variant="primary"
                size="md"
              >
                {saving ? 'Publishing Changes...' : 'Save & Publish Footer Info'}
              </Button>
            </div>
          </form>

          {/* Live Public Footer Card Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Live Public Footer Preview
              </h2>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                Real-time
              </span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0c1017] p-6 space-y-6 shadow-xl text-xs text-slate-300">
              <div>
                <div className="text-base font-black text-white tracking-tight uppercase">
                  {form.organization_name || 'KJIN'}
                </div>
                <div className="text-[11px] text-cyan-400 font-medium mt-0.5">
                  {form.tagline}
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  {form.description}
                </p>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Bureau Locations
                </div>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="font-bold text-slate-200 block text-[11px]">{form.primary_address_label}</span>
                    <span className="text-slate-400 text-[11px]">{form.primary_address}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="font-bold text-slate-200 block text-[11px]">{form.bureau_address_label}</span>
                    <span className="text-slate-400 text-[11px]">{form.bureau_address}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Direct Communications
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{form.phone_primary_label}:</span>
                  <span className="font-mono text-cyan-300 font-semibold">{form.phone_primary}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{form.phone_secondary_label}:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{form.phone_secondary}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Editorial:</span>
                  <span className="font-mono text-slate-200">{form.email_editorial}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Grievances:</span>
                  <span className="font-mono text-amber-300">{form.email_grievance}</span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 text-[10px] text-slate-500 space-y-1">
                <div><strong>Hours:</strong> {form.operating_hours}</div>
                <div><strong>Registration:</strong> {form.registration_number}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
