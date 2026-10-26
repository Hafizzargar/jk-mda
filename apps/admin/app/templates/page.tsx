'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AVAILABLE_TEMPLATES, type TemplateDefinition, type TemplateId } from '@/lib/templates';
import { requiresMfa } from '@/lib/mfa';
import { TemplateMockupPreview } from './TemplateMockupPreview';
import { Button } from '@/components/Button';

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
    isLight: boolean;
    titleColor: string;
    descColor: string;
    featureTextColor: string;
    featureCheckColor: string;
    headerBg: string;
    headerBorder: string;
    previewBtnClass: string;
    activateBtnClass: string;
  }
> = {
  'classic-editorial': {
    category: 'light',
    canvasBg: '#FAF8F5',
    canvasName: 'Broadsheet Cream',
    typography: 'Editorial Serif',
    borderAccent: 'border-amber-900/30 hover:border-amber-900/60 shadow-md',
    taglineColor: 'text-amber-900 font-serif italic',
    isLight: true,
    titleColor: 'text-slate-950 font-serif',
    descColor: 'text-slate-700 font-serif',
    featureTextColor: 'text-slate-800 font-serif',
    featureCheckColor: 'text-red-800',
    headerBg: 'bg-[#f4efe8]/90',
    headerBorder: 'border-b-2 border-slate-900',
    previewBtnClass: 'bg-white border border-slate-300 text-slate-900 hover:bg-slate-100 hover:text-black shadow-sm',
    activateBtnClass: 'bg-slate-950 text-white hover:bg-slate-800 font-serif shadow-sm',
  },
  'clean-nordic-white': {
    category: 'light',
    canvasBg: '#FFFFFF',
    canvasName: '100% Pure White',
    typography: 'Nordic Sans',
    borderAccent: 'border-neutral-200 hover:border-neutral-400 shadow-md',
    taglineColor: 'text-neutral-500 font-sans',
    isLight: true,
    titleColor: 'text-neutral-900 font-sans',
    descColor: 'text-neutral-700 font-sans',
    featureTextColor: 'text-neutral-800 font-sans',
    featureCheckColor: 'text-neutral-900',
    headerBg: 'bg-neutral-50',
    headerBorder: 'border-b border-neutral-200',
    previewBtnClass: 'bg-white border border-neutral-200 text-neutral-900 hover:bg-neutral-100 hover:text-black shadow-sm',
    activateBtnClass: 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm',
  },
  'minimal-focus': {
    category: 'light',
    canvasBg: '#FAFAF9',
    canvasName: 'Warm Stone Paper',
    typography: 'Substack Longform',
    borderAccent: 'border-stone-300 hover:border-stone-500 shadow-md',
    taglineColor: 'text-stone-500 font-sans',
    isLight: true,
    titleColor: 'text-stone-900 font-sans',
    descColor: 'text-stone-700 font-sans',
    featureTextColor: 'text-stone-800 font-sans',
    featureCheckColor: 'text-stone-900',
    headerBg: 'bg-stone-100/80',
    headerBorder: 'border-b border-stone-200',
    previewBtnClass: 'bg-white border border-stone-200 text-stone-900 hover:bg-stone-100 shadow-sm',
    activateBtnClass: 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm',
  },
  'genz-neo-brutalist': {
    category: 'light',
    canvasBg: '#FEF08A',
    canvasName: 'Acid Pop Yellow',
    typography: 'Neo-Brutalist',
    borderAccent: 'border-2 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px]',
    taglineColor: 'text-black font-black uppercase text-[11px]',
    isLight: true,
    titleColor: 'text-black font-black uppercase',
    descColor: 'text-neutral-900 font-bold',
    featureTextColor: 'text-black font-bold',
    featureCheckColor: 'text-black font-black',
    headerBg: 'bg-lime-300',
    headerBorder: 'border-b-2 border-black',
    previewBtnClass: 'bg-white border-2 border-black text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-neutral-100',
    activateBtnClass: 'bg-black text-lime-300 font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-neutral-900',
  },
  'modern-magazine': {
    category: 'dark',
    canvasBg: '#020617',
    canvasName: 'Deep Navy Slate',
    typography: 'Dynamic Visual',
    borderAccent: 'border-blue-500/40 hover:border-blue-400 shadow-md',
    taglineColor: 'text-blue-300 font-medium',
    isLight: false,
    titleColor: 'text-white font-sans',
    descColor: 'text-slate-300 font-sans',
    featureTextColor: 'text-slate-300 font-sans',
    featureCheckColor: 'text-blue-400',
    headerBg: 'bg-slate-900/80',
    headerBorder: 'border-b border-slate-800',
    previewBtnClass: 'bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white',
    activateBtnClass: 'bg-blue-600 text-white font-bold hover:bg-blue-500 shadow-lg shadow-blue-600/30',
  },
  'bento-grid': {
    category: 'dark',
    canvasBg: '#0F172A',
    canvasName: 'Modular Slate',
    typography: 'Modern Bento',
    borderAccent: 'border-cyan-500/40 hover:border-cyan-400 shadow-md',
    taglineColor: 'text-cyan-300 font-medium',
    isLight: false,
    titleColor: 'text-white font-sans',
    descColor: 'text-slate-300 font-sans',
    featureTextColor: 'text-slate-300 font-sans',
    featureCheckColor: 'text-cyan-400',
    headerBg: 'bg-slate-950/70',
    headerBorder: 'border-b border-slate-800',
    previewBtnClass: 'bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white',
    activateBtnClass: 'bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 shadow-lg shadow-cyan-500/30',
  },
  'breaking-wire': {
    category: 'dark',
    canvasBg: '#171717',
    canvasName: 'Newsroom Charcoal',
    typography: 'Wire Dispatch',
    borderAccent: 'border-red-500/40 hover:border-red-400 shadow-md',
    taglineColor: 'text-red-300 font-medium',
    isLight: false,
    titleColor: 'text-white font-sans',
    descColor: 'text-neutral-300 font-sans',
    featureTextColor: 'text-neutral-300 font-sans',
    featureCheckColor: 'text-red-400',
    headerBg: 'bg-neutral-950/80',
    headerBorder: 'border-b border-neutral-800',
    previewBtnClass: 'bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-white',
    activateBtnClass: 'bg-red-600 text-white font-bold hover:bg-red-500 shadow-lg shadow-red-600/30',
  },
  'visual-stories-deck': {
    category: 'dark',
    canvasBg: '#0C0A09',
    canvasName: 'Darkroom Stone',
    typography: 'Reels & Stories',
    borderAccent: 'border-rose-500/40 hover:border-rose-400 shadow-md',
    taglineColor: 'text-rose-300 font-medium',
    isLight: false,
    titleColor: 'text-white font-sans',
    descColor: 'text-stone-300 font-sans',
    featureTextColor: 'text-stone-300 font-sans',
    featureCheckColor: 'text-rose-400',
    headerBg: 'bg-stone-950/80',
    headerBorder: 'border-b border-stone-800',
    previewBtnClass: 'bg-stone-800/80 border border-stone-700 text-stone-200 hover:bg-stone-700 hover:text-white',
    activateBtnClass: 'bg-rose-600 text-white font-bold hover:bg-rose-500 shadow-lg shadow-rose-600/30',
  },
  'tech-terminal-wire': {
    category: 'special',
    canvasBg: '#050805',
    canvasName: 'CRT Green Pitch',
    typography: 'CLI Monospace',
    borderAccent: 'border-[#14532d] hover:border-[#22c55e] shadow-md',
    taglineColor: 'text-[#4ade80] font-mono',
    isLight: false,
    titleColor: 'text-[#22c55e] font-mono',
    descColor: 'text-[#86efac]/90 font-mono text-xs',
    featureTextColor: 'text-[#86efac] font-mono',
    featureCheckColor: 'text-[#22c55e]',
    headerBg: 'bg-[#020402]',
    headerBorder: 'border-b border-[#14532d]',
    previewBtnClass: 'bg-[#0a140a] border border-[#14532d] text-[#4ade80] hover:bg-[#14532d] hover:text-[#22c55e] font-mono',
    activateBtnClass: 'bg-[#22c55e] text-black font-black font-mono hover:bg-[#4ade80] shadow-lg shadow-[#22c55e]/20',
  },
  'hyperlocal-community': {
    category: 'special',
    canvasBg: '#F8FAFC',
    canvasName: 'Civic Soft Slate',
    typography: 'Community Sans',
    borderAccent: 'border-emerald-300 hover:border-emerald-500 shadow-md',
    taglineColor: 'text-emerald-700 font-sans',
    isLight: true,
    titleColor: 'text-slate-900 font-sans',
    descColor: 'text-slate-700 font-sans',
    featureTextColor: 'text-slate-800 font-sans',
    featureCheckColor: 'text-emerald-700',
    headerBg: 'bg-emerald-50/80',
    headerBorder: 'border-b border-emerald-200',
    previewBtnClass: 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 shadow-sm',
    activateBtnClass: 'bg-emerald-700 text-white font-bold hover:bg-emerald-600 shadow-sm',
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
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header Breadcrumb & Actions */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">Design System</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">Public Presentation</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Website Presentation Templates</h1>
            <p className="mt-1 text-sm text-slate-400">
              Control the layout, typography, and visual design of the public website in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="↻"
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
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
            <Button
              href="http://localhost:3000"
              external
              variant="secondary"
              size="md"
            >
              Open Active Website ↗
            </Button>
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
                  className={`px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition flex items-center gap-1.5 ${
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
                style={{ backgroundColor: meta.canvasBg }}
                className={`rounded-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                  isActive
                    ? 'border-2 border-cyan-400 shadow-2xl ring-4 ring-cyan-400/40'
                    : `${meta.borderAccent}`
                }`}
              >
                <div>
                  {/* Card Visual Header Bar with template's authentic styling */}
                  <div className={`p-4 ${meta.headerBg} ${meta.headerBorder} space-y-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          meta.isLight
                            ? 'bg-slate-900/10 text-slate-900 border border-slate-900/20'
                            : 'bg-white/10 text-white border border-white/20'
                        }`}
                      >
                        {tmpl.badge}
                      </span>

                      {/* Canvas Color Pill */}
                      <div
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                          meta.isLight
                            ? 'bg-white/90 border-slate-300 text-slate-800'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-slate-400 shrink-0"
                          style={{ backgroundColor: meta.canvasBg }}
                        />
                        <span className="truncate font-semibold">{meta.canvasName}</span>
                      </div>

                      {isActive ? (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          ACTIVE
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className={`text-base font-extrabold tracking-tight ${meta.titleColor}`}>
                          {tmpl.name}
                        </h3>
                        <span
                          className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                            meta.isLight
                              ? 'bg-white/80 border-slate-300 text-slate-800'
                              : 'bg-slate-900/80 border-slate-700 text-cyan-300'
                          }`}
                        >
                          {meta.typography}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${meta.taglineColor}`}>
                        {tmpl.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Visual Blueprint Wireframe Mockup Preview */}
                  <div className="p-3.5 border-b border-black/10">
                    <TemplateMockupPreview templateId={tmpl.id} />
                  </div>

                  {/* Card Description & Details */}
                  <div className="p-5 space-y-4">
                    <p className={`text-xs leading-relaxed ${meta.descColor}`}>
                      {tmpl.description}
                    </p>

                    <div>
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${
                          meta.isLight ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        Key Features:
                      </p>
                      <ul className="space-y-1 text-xs">
                        {tmpl.features.map((feat, i) => (
                          <li key={i} className={`flex items-start gap-2 ${meta.featureTextColor}`}>
                            <span className={`font-bold text-xs shrink-0 ${meta.featureCheckColor}`}>✓</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div
                      className={`rounded-xl border p-2.5 text-[11px] ${
                        meta.isLight
                          ? 'bg-white/70 border-slate-200/80 text-slate-700'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400'
                      }`}
                    >
                      <strong className={meta.isLight ? 'text-slate-950' : 'text-slate-200'}>
                        Layout style:
                      </strong>{' '}
                      {tmpl.layoutStyle}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div
                  className={`p-4 pt-3 border-t mt-2 flex items-center gap-2.5 ${
                    meta.isLight ? 'border-slate-200/80 bg-white/40' : 'border-slate-800/60 bg-black/20'
                  }`}
                >
                  <Button
                    href={`http://localhost:3000/?preview=${tmpl.id}`}
                    external
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                  >
                    Live Preview ↗
                  </Button>

                  {canManage && !isActive ? (
                    <Button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setSelectedForActivation(tmpl);
                        setActivationReason(`Switching site layout to ${tmpl.name}`);
                        setModalError(null);
                      }}
                      variant="cyan"
                      size="sm"
                      className="flex-1"
                    >
                      Activate
                    </Button>
                  ) : isActive ? (
                    <div
                      className={`flex-1 py-1.5 text-center text-xs font-bold rounded-[8px] border ${
                        meta.isLight
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'
                      }`}
                    >
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
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedForActivation(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                >
                  {isSubmitting ? 'Activating...' : 'Confirm & Activate'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
