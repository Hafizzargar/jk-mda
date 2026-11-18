'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import {
  DEFAULT_DEVELOPER_SUPPORT,
  sanitizeDeveloperSupportSettings,
  validateEmail,
  validatePhone,
  validateUrl,
  type DeveloperSupportSettings,
} from '@/lib/developer-support';
import { Button } from '@/components/Button';
import { SITE_URL } from '@/lib/config';

export default function DeveloperSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState<DeveloperSupportSettings>(DEFAULT_DEVELOPER_SUPPORT);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');

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

        if (role !== 'owner' && role !== 'superadmin' && role !== 'admin') {
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

        // Fetch current developer_support from site_settings directly
        const { data: settingRow } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'developer_support')
          .maybeSingle();

        if (settingRow?.value) {
          setForm(sanitizeDeveloperSupportSettings(settingRow.value as Partial<DeveloperSupportSettings>));
        }

        // Fetch via API to verify permission & headers
        const res = await fetch('/api/settings/developer', {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (json?.developer_support) {
            setForm(sanitizeDeveloperSupportSettings(json.developer_support));
          }
          setCanManage(Boolean(json?.can_manage));
        } else {
          setCanManage(role === 'owner' || role === 'superadmin' || role === 'admin');
        }
      } catch (err) {
        console.error('Failed to load developer settings:', err);
        setErrorMsg('Failed to load developer settings');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [router]);

  const handleChange = (field: keyof DeveloperSupportSettings, val: unknown) => {
    setForm((prev) => ({
      ...prev,
      [field]: val,
    }));
    setErrorMsg(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    // Frontend validation
    if (form.support_email && !validateEmail(form.support_email)) {
      setErrorMsg('Please enter a valid support email address (e.g. dev@kjcpl.site).');
      return;
    }

    if (form.support_phone && !validatePhone(form.support_phone)) {
      setErrorMsg('Please enter a valid telephone number (e.g. +91 6005950197).');
      return;
    }

    if (form.developer_website && !validateUrl(form.developer_website)) {
      setErrorMsg('Please enter a valid website URL starting with http:// or https://');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch('/api/settings/developer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to save developer support settings');
      }

      setSuccessMsg('Developer & Technical Support settings saved successfully to the public website!');
      if (json?.developer_support) {
        setForm(sanitizeDeveloperSupportSettings(json.developer_support));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error saving developer settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-sm text-slate-400">Loading developer support settings...</span>
        </div>
      </div>
    );
  }

  const hasMail = form.show_mail_us && Boolean(form.support_email?.trim());
  const hasPhone = form.show_call_us && Boolean(form.support_phone?.trim());

  return (
    <div className="p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">Site Settings</span>
              <span className="text-slate-600">•</span>
              <Link href="/settings/footer" className="text-xs text-slate-400 hover:text-slate-200 hover:underline">
                Footer &amp; Contacts
              </Link>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-300">Developer &amp; Technical Support</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Developer &amp; Technical Support
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Live
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Configure platform maintainer attribution, technology descriptions, and visitor technical support hotlines (Mail Us / Call Us).
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canManage && (
              <Button
                type="submit"
                form="developer-settings-form"
                disabled={saving}
                isLoading={saving}
                variant="primary"
                size="md"
                icon="💾"
              >
                {saving ? 'Saving...' : 'Save & Broadcast'}
              </Button>
            )}
            <Button
              href={SITE_URL}
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
              <span className="font-bold">✓ Success:</span>
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">&times;</button>
          </div>
        )}

        {/* Main 2-Column Grid: Form & Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Settings Form (7 cols) */}
          <form
            id="developer-settings-form"
            onSubmit={handleSubmit}
            className="lg:col-span-7 space-y-6"
          >
            {/* Card 1: Master Attribution & Team Profile */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>💻</span>
                    <span>Website Development Attribution</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Control how the development and platform engineering team is credited.
                  </p>
                </div>
              </div>

              {/* Master Section Toggle */}
              <label className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={form.show_developer_section}
                  onChange={(e) => handleChange('show_developer_section', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                <div>
                  <span className="text-xs text-white font-semibold block">
                    Show Developer Section in Footer
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Master toggle. When switched off, the entire Website Development &amp; Support block is hidden.
                  </span>
                </div>
              </label>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Development Team Name
                  </label>
                  <input
                    type="text"
                    value={form.developer_name}
                    onChange={(e) => handleChange('developer_name', e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                    placeholder="e.g. KJCPL Development Team"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Displayed under &quot;Developed &amp; Maintained By&quot;.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Developer Description &amp; Scope
                  </label>
                  <textarea
                    rows={2}
                    value={form.developer_description}
                    onChange={(e) => handleChange('developer_description', e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none text-xs"
                    placeholder="e.g. Website design, development, technology infrastructure and maintenance."
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Short description of engineering duties and platform operations.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Developer Website URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={form.developer_website}
                    onChange={(e) => handleChange('developer_website', e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono text-xs"
                    placeholder="https://kjcpl.site"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    When provided, the team name links to this destination with an external arrow.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Technical Support Hotlines & Email */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>🛠️</span>
                    <span>Technical Support Communications</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Provide direct escalation channels for readers encountering technical or platform bugs.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Email Support */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400">
                      Support Email Address
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.show_mail_us}
                        onChange={(e) => handleChange('show_mail_us', e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-cyan-500"
                      />
                      <span>Show &quot;Mail Us&quot;</span>
                    </label>
                  </div>
                  <input
                    type="email"
                    value={form.support_email}
                    onChange={(e) => handleChange('support_email', e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
                    placeholder="dev@kjcpl.site"
                  />
                  <p className="text-[11px] text-slate-500">
                    Clicking &quot;Mail Us&quot; opens visitor&apos;s email client with a <code className="text-slate-400">mailto:</code> link.
                  </p>
                </div>

                {/* Telephone Support */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Support Telephone Number
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.show_call_us}
                        onChange={(e) => handleChange('show_call_us', e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-cyan-500"
                      />
                      <span>Show &quot;Call Us&quot;</span>
                    </label>
                  </div>
                  <input
                    type="tel"
                    value={form.support_phone}
                    onChange={(e) => handleChange('support_phone', e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
                    placeholder="+91 6005950197"
                  />
                  <p className="text-[11px] text-slate-500">
                    Clicking &quot;Call Us&quot; triggers phone dialler with a <code className="text-slate-400">tel:</code> link.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Layout & Responsive Settings */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>📱</span>
                    <span>Layout &amp; Viewport Visibility</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Position the block and control mobile responsive behavior.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Footer Position
                  </label>
                  <select
                    value={form.footer_position}
                    onChange={(e) => handleChange('footer_position', e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="bottom">Dedicated Bottom Card (Recommended)</option>
                    <option value="column">Side Column within Footer Grid</option>
                    <option value="subfooter">Compact Inline Snippet in Sub-Footer</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Choose how prominently technical support is presented.
                  </p>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition w-full">
                    <input
                      type="checkbox"
                      checked={form.show_on_mobile}
                      onChange={(e) => handleChange('show_on_mobile', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                    />
                    <div>
                      <span className="text-xs text-white font-semibold block">
                        Show on Mobile Viewports
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        When unchecked, the section is hidden on mobile devices.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-between pt-2">
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
                {saving ? 'Publishing Changes...' : 'Save & Publish Support Info'}
              </Button>
            </div>
          </form>

          {/* Live Public Website Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Live Website Footer Preview
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTheme(prev => prev === 'light' ? 'dark' : 'light')}
                  className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
                >
                  Theme: {previewTheme === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                  Real-time
                </span>
              </div>
            </div>

            {/* Preview Container */}
            <div className={`rounded-2xl border p-6 space-y-6 shadow-xl text-xs transition-colors duration-200 ${
              previewTheme === 'dark'
                ? 'bg-[#05070a] border-slate-800 text-slate-300'
                : 'bg-[#f4efe8] border-stone-300 text-stone-800'
            }`}>
              {/* Context header */}
              <div className="border-b pb-3 border-current/10">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
                  KJCPL Website Footer (Preview)
                </span>
                <span className="text-xs font-bold opacity-75">
                  Editorial and statutory accreditation continues above...
                </span>
              </div>

              {!form.show_developer_section ? (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs text-center space-y-1">
                  <strong>Developer Section is currently OFF</strong>
                  <p className="text-[11px] text-amber-200/80">
                    This block will not be displayed to public visitors.
                  </p>
                </div>
              ) : (
                <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs ${
                  previewTheme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800'
                    : 'bg-white/90 border-stone-200'
                }`}>
                  <div className="flex flex-col gap-4">
                    {/* Header line */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${
                          previewTheme === 'dark' ? 'text-cyan-400' : 'text-blue-800'
                        } flex items-center gap-1.5`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                          Website Development &amp; Support
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                          previewTheme === 'dark'
                            ? 'bg-slate-800/60 text-slate-400 border-slate-700'
                            : 'bg-stone-100 text-stone-600 border-stone-200'
                        }`}>
                          Platform
                        </span>
                      </div>

                      <div className="text-xs pt-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">
                          Developed &amp; Maintained By
                        </span>
                        {form.developer_website ? (
                          <a
                            href={form.developer_website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-bold text-current hover:underline inline-flex items-center gap-1"
                          >
                            <span>{form.developer_name || 'KJCPL Development Team'}</span>
                            <span className="text-xs text-slate-400">&nearr;</span>
                          </a>
                        ) : (
                          <span className="text-sm font-bold text-current">
                            {form.developer_name || 'KJCPL Development Team'}
                          </span>
                        )}
                      </div>

                      {form.developer_description ? (
                        <p className="text-[11px] opacity-75 leading-relaxed pt-0.5">
                          {form.developer_description}
                        </p>
                      ) : null}
                    </div>

                    {/* Technical Support Action Buttons */}
                    {(hasMail || hasPhone) ? (
                      <div className="pt-3 border-t border-current/10 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                          Technical Support
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {hasMail ? (
                            <a
                              href={`mailto:${form.support_email}`}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                                previewTheme === 'dark'
                                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                              }`}
                            >
                              <span>✉</span>
                              <span>Mail Us</span>
                            </a>
                          ) : null}

                          {hasPhone ? (
                            <a
                              href={`tel:${form.support_phone.replace(/[^0-9+]/g, '')}`}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                                previewTheme === 'dark'
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              <span>📞</span>
                              <span>Call Us</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] opacity-50 italic pt-2 border-t border-current/10">
                        No support contact channels enabled
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-footer preview */}
              <div className="border-t pt-3 border-current/10 text-[10px] opacity-60 flex items-center justify-between">
                <span>Position: <strong>{form.footer_position}</strong></span>
                <span>Mobile: <strong>{form.show_on_mobile ? 'Visible' : 'Hidden'}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
