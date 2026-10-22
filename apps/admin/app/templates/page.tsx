'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AVAILABLE_TEMPLATES, type TemplateDefinition, type TemplateId } from '@/lib/templates';
import { requiresMfa } from '@/lib/mfa';
import { TemplateMockupPreview } from './TemplateMockupPreview';

const ALLOWED_ROLES = ['owner', 'superadmin', 'admin'];

const TEMPLATE_META: Record<
  TemplateId,
  {
    category: 'light' | 'dark' | 'special';
    canvasBg: string;
    canvasName: string;
    typography: string;
    borderAccent: string;
    taglineColor: string;
  }
> = {
  'classic-editorial': {
    category: 'light',
    canvasBg: '#FAF8F5',
    canvasName: 'Broadsheet Cream',
    typography: 'Editorial Serif',
    borderAccent: 'border-amber-700/50 hover:border-amber-500',
    taglineColor: 'text-amber-200',
  },
  'clean-nordic-white': {
    category: 'light',
    canvasBg: '#FFFFFF',
    canvasName: '100% Pure White',
    typography: 'Nordic Sans',
    borderAccent: 'border-slate-300 hover:border-white',
    taglineColor: 'text-slate-300',
  },
  'minimal-focus': {
    category: 'light',
    canvasBg: '#FAFAF9',
    canvasName: 'Warm Stone Paper',
    typography: 'Substack Longform',
    borderAccent: 'border-stone-600/60 hover:border-stone-400',
    taglineColor: 'text-stone-300',
  },
  'genz-neo-brutalist': {
    category: 'light',
    canvasBg: '#FEF08A',
    canvasName: 'Acid Pop Yellow',
    typography: 'Neo-Brutalist',
    borderAccent: 'border-yellow-400/80 hover:border-lime-400',
    taglineColor: 'text-yellow-300',
  },
  'modern-magazine': {
    category: 'dark',
    canvasBg: '#020617',
    canvasName: 'Deep Navy Slate',
    typography: 'Dynamic Visual',
    borderAccent: 'border-blue-500/50 hover:border-blue-400',
    taglineColor: 'text-blue-300',
  },
  'bento-grid': {
    category: 'dark',
    canvasBg: '#0F172A',
    canvasName: 'Modular Slate',
    typography: 'Modern Bento',
    borderAccent: 'border-cyan-500/50 hover:border-cyan-400',
    taglineColor: 'text-cyan-300',
  },
  'breaking-wire': {
    category: 'dark',
    canvasBg: '#171717',
    canvasName: 'Newsroom Charcoal',
    typography: 'Wire Dispatch',
    borderAccent: 'border-red-500/50 hover:border-red-400',
    taglineColor: 'text-red-300',
  },
  'visual-stories-deck': {
    category: 'dark',
    canvasBg: '#0C0A09',
    canvasName: 'Darkroom Stone',
    typography: 'Reels & Stories',
    borderAccent: 'border-rose-500/50 hover:border-rose-400',
    taglineColor: 'text-rose-300',
  },
  'tech-terminal-wire': {
    category: 'special',
    canvasBg: '#050805',
    canvasName: 'CRT Green Pitch',
    typography: 'CLI Monospace',
    borderAccent: 'border-emerald-500/50 hover:border-emerald-400',
    taglineColor: 'text-emerald-300',
  },
  'hyperlocal-community': {
    category: 'special',
    canvasBg: '#F8FAFC',
    canvasName: 'Civic Soft Slate',
    typography: 'Community Sans',
    borderAccent: 'border-emerald-600/50 hover:border-emerald-400',
    taglineColor: 'text-teal-300',
  },
};

export default function TemplatesManagementPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<TemplateId>('classic-editorial');
  const [activeTemplateName, setActiveTemplateName] = useState<string>('Classic Editorial Broadsheet');
  const [selectedForActivation, setSelectedForActivation] = useState<TemplateDefinition | null>(null);
  const [activationReason, setActivationReason] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'light' | 'dark' | 'special'>('all');

  useEffect(() => {
    async function init() {
      setIsLoading(true);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        router.push('/login');
        return;
      }

      // Query current user role
      const { data: roleData, error: roleError } = await supabase.rpc('current_user_role');
      if (roleError || !roleData) {
        setFeedback({ type: 'error', message: 'Unable to verify administrative role.' });
        setIsLoading(false);
        return;
      }

      const userRole = roleData as string;
      setRole(userRole);

      // Check MFA if required
      if (requiresMfa(userRole)) {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel !== 'aal2') {
          if (aalData?.nextLevel === 'aal2') {
            router.push('/mfa/challenge');
            return;
          } else {
            router.push('/mfa/enroll');
            return;
          }
        }
      }

      // Fetch active template setting
      const { data: settingRow } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'active_template')
        .maybeSingle();

      if (settingRow?.value) {
        const val = settingRow.value as { template_id?: TemplateId; name?: string };
        if (val.template_id) {
          setActiveTemplateId(val.template_id);
          setActiveTemplateName(val.name || val.template_id);
        }
      }

      setIsLoading(false);
    }

    init();
  }, [router]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForActivation) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          template_id: selectedForActivation.id,
          reason: activationReason.trim() || `Activated ${selectedForActivation.name} layout`,
        }),
      });

      const data = (await res.json()) as { error?: string; message?: string; success?: boolean };

      if (!res.ok) {
        setModalError(data.error || 'Failed to update template.');
        setIsSubmitting(false);
        return;
      }

      setActiveTemplateId(selectedForActivation.id);
      setActiveTemplateName(selectedForActivation.name);
      setFeedback({
        type: 'success',
        message: `Website template successfully changed to "${selectedForActivation.name}". All public visitors will now see this layout.`,
      });
      setSelectedForActivation(null);
      setActivationReason('');
      setIsSubmitting(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Network error during template activation.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Loading template configurations...
        </div>
      </main>
    );
  }

  const canManage = role && ALLOWED_ROLES.includes(role);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header Breadcrumb & Actions */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Link href="/" className="text-cyan-400 hover:underline">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-200">Site Settings</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold">Website Presentation Templates</h1>
            <p className="mt-1 text-sm text-slate-400">
              Control the layout, typography, and visual design of the public website in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold capitalize text-cyan-300">
              Role: {role}
            </span>
            <Link
              href="/employees"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-900"
            >
              Employees
            </Link>
            <Link
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 flex items-center gap-1.5"
            >
              <span>View Live Website</span>
              <span>↗</span>
            </Link>
          </div>
        </header>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mb-8 flex items-center justify-between rounded-xl border p-4 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            <div>{feedback.message}</div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="ml-4 font-bold opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Template Banner */}
        <div className="mb-10 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Currently Active On Website</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{activeTemplateName}</h2>
            <p className="text-sm text-slate-400">
              Public visitors on <span className="text-slate-300 font-mono text-xs">kjin.in</span> and localhost are seeing this presentation layout.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              Open Active Website ↗
            </Link>
          </div>
        </div>

        {/* Permission Notice for Subordinates */}
        {!canManage && (
          <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <strong>Read-only access:</strong> Your account role ({role}) allows previewing website templates, but only <strong>Owner</strong>, <strong>Superadmin</strong>, and <strong>Admin</strong> can switch the active template for all visitors.
          </div>
        )}

        {/* Category Filters Bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Styles (10)', icon: '🎨' },
              { id: 'light', label: 'Light & Paper (4)', icon: '📰' },
              { id: 'dark', label: 'Dark & Immersive (4)', icon: '🌙' },
              { id: 'special', label: 'Civic & Specialized (2)', icon: '⚡' },
            ].map((tab) => {
              const isSelected = filterCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterCategory(tab.id as 'all' | 'light' | 'dark' | 'special')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                      : 'bg-slate-850 border border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-400 font-mono">
            Click &ldquo;Live Preview ↗&rdquo; to test on public web
          </span>
        </div>

        {/* Template Catalog Grid with Distinct Visual Mockups */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {AVAILABLE_TEMPLATES.filter((tmpl) => {
            if (filterCategory === 'all') return true;
            return TEMPLATE_META[tmpl.id]?.category === filterCategory;
          }).map((tmpl) => {
            const isActive = tmpl.id === activeTemplateId;
            const meta = TEMPLATE_META[tmpl.id];

            return (
              <div
                key={tmpl.id}
                className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                  isActive
                    ? 'border-cyan-400 bg-slate-900 shadow-2xl shadow-cyan-500/10 ring-2 ring-cyan-400/40'
                    : `border-slate-800/80 bg-slate-900/60 ${meta?.borderAccent || ''} hover:bg-slate-900/90 hover:shadow-xl`
                }`}
              >
                <div>
                  {/* Card Visual Header Bar */}
                  <div className="p-4 border-b border-slate-800 bg-slate-950/70 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-slate-800/90 border border-slate-700/70 px-2.5 py-0.5 text-[11px] font-bold text-slate-200">
                        {tmpl.badge}
                      </span>

                      {/* Canvas Color Pill */}
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-slate-700 shrink-0"
                          style={{ backgroundColor: meta?.canvasBg || '#0f172a' }}
                        />
                        <span className="truncate">{meta?.canvasName || 'Custom'}</span>
                      </div>

                      {isActive ? (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 flex items-center gap-1 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                          ACTIVE
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-extrabold text-white tracking-tight">{tmpl.name}</h3>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-slate-700/60">
                          {meta?.typography || 'Typography'}
                        </span>
                      </div>
                      <p className={`text-xs font-medium mt-0.5 ${meta?.taglineColor || 'text-slate-400'}`}>
                        {tmpl.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Visual Blueprint Wireframe Mockup Preview */}
                  <div className="p-3.5 bg-slate-950/40 border-b border-slate-800/80">
                    <TemplateMockupPreview templateId={tmpl.id} />
                  </div>

                  {/* Card Description & Details */}
                  <div className="p-5 space-y-4">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {tmpl.description}
                    </p>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Key Features:
                      </p>
                      <ul className="space-y-1 text-xs text-slate-400">
                        {tmpl.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-cyan-400 font-bold text-xs shrink-0">✓</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 text-[11px] text-slate-400">
                      <strong className="text-slate-200">Layout style:</strong> {tmpl.layoutStyle}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 pt-0 border-t border-slate-800/60 mt-2 flex items-center gap-3">
                  <Link
                    href={`http://localhost:3000/?preview=${tmpl.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center rounded-xl border border-slate-700 bg-slate-800/60 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                  >
                    Live Preview ↗
                  </Link>

                  {canManage && !isActive ? (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setSelectedForActivation(tmpl);
                        setActivationReason(`Switching site layout to ${tmpl.name}`);
                        setModalError(null);
                      }}
                      className="flex-1 rounded-xl bg-cyan-500 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition disabled:opacity-50"
                    >
                      Activate
                    </button>
                  ) : isActive ? (
                    <div className="flex-1 py-2 text-center text-xs font-bold text-emerald-400 bg-emerald-950/30 rounded-xl border border-emerald-800/40">
                      Live on Web
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activation Confirmation Modal */}
      {selectedForActivation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">Activate Website Template</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Switch the public presentation layout to <strong className="text-cyan-400">{selectedForActivation.name}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForActivation(null)}
                disabled={isSubmitting}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleActivate} className="mt-5 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 space-y-2">
                <p>
                  <strong>Notice:</strong> This action will immediately change how all readers see the public KJIN news portal.
                </p>
                <p className="text-slate-400">
                  The switch is recorded in the operational audit trail.
                </p>
              </div>

              <label className="block text-sm text-slate-300">
                Reason for change <span className="text-xs text-slate-500">(Required for audit log)</span>
                <textarea
                  required
                  rows={3}
                  maxLength={500}
                  value={activationReason}
                  onChange={(e) => setActivationReason(e.target.value)}
                  placeholder="e.g. Refreshing homepage design for modern editorial layout"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none text-sm"
                />
              </label>

              {modalError && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedForActivation(null)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                >
                  {isSubmitting ? 'Activating...' : 'Confirm & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
