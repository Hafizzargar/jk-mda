'use client';

import { useEffect, useState, FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import {
  DEFAULT_NAVBAR_SETTINGS,
  type NavbarSettings,
  type NavItemConfig,
} from '@/lib/navbar';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { toast } from '@/components/Toast';

export default function NavbarSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState<NavbarSettings>(DEFAULT_NAVBAR_SETTINGS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'brand' | 'categories' | 'languages' | 'tools'>('brand');

  // Add Category Modal State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatEnabled, setNewCatEnabled] = useState(true);
  const [newCatError, setNewCatError] = useState<string | null>(null);

  // Category deletion state
  const [categoryToDelete, setCategoryToDelete] = useState<{ index: number; item: NavItemConfig } | null>(null);

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
            setForm(json.navbar_settings);
          }
          setCanManage(Boolean(json.can_manage));
        } else {
          const allowed = ['owner', 'superadmin'].includes(role);
          setCanManage(allowed);
        }
      } catch (err: unknown) {
        console.error('[NavbarSettingsPage] Load error:', err);
        setErrorMsg('Failed to load navbar settings.');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
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

      const res = await fetch('/api/settings/navbar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to update navbar settings.');
      }

      setForm(json.navbar_settings);
      setSuccessMsg('Navbar and navigation settings saved successfully! Changes are live on the website.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kjin-brand-updated', { detail: json.navbar_settings?.brand }));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Are you sure you want to reset all navbar settings to default values?')) {
      setForm(DEFAULT_NAVBAR_SETTINGS);
      setSuccessMsg('Defaults restored in editor. Click "Save Navbar Changes" to publish.');
    }
  };

  // Category item handlers
  const toggleCategory = (index: number) => {
    const updated = [...form.nav_items];
    const newStatus = !updated[index].enabled;
    updated[index] = { ...updated[index], enabled: newStatus };
    setForm({ ...form, nav_items: updated });
    toast.info(`"${updated[index].label}" set to ${newStatus ? 'Active' : 'Inactive'}. Save changes to publish.`);
  };

  const updateCategoryLabel = (index: number, newLabel: string) => {
    const updated = [...form.nav_items];
    updated[index] = { ...updated[index], label: newLabel };
    setForm({ ...form, nav_items: updated });
  };

  const openAddCategoryModal = () => {
    setNewCatTitle('');
    setNewCatSlug('');
    setNewCatEnabled(true);
    setNewCatError(null);
    setShowAddCategoryModal(true);
  };

  const handleTitleChangeForNewCat = (val: string) => {
    setNewCatTitle(val);
    const autoSlug = val
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setNewCatSlug(autoSlug);
  };

  const handleConfirmAddCategory = () => {
    if (!newCatTitle.trim()) {
      setNewCatError('Please enter a category title.');
      return;
    }
    const cleanSlug = (newCatSlug.trim() || newCatTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))
      .replace(/(^-|-$)+/g, '');
    if (!cleanSlug) {
      setNewCatError('A valid URL slug is required.');
      return;
    }

    // Check duplicate slug
    const exists = form.nav_items.some(
      (item) => item.slug?.toLowerCase() === cleanSlug.toLowerCase() || item.id?.toLowerCase() === cleanSlug.toLowerCase()
    );
    if (exists) {
      setNewCatError(`A category with slug "${cleanSlug}" already exists.`);
      return;
    }

    const newItem: NavItemConfig = {
      id: cleanSlug,
      label: newCatTitle.trim(),
      slug: cleanSlug,
      enabled: newCatEnabled,
    };

    setForm({ ...form, nav_items: [...form.nav_items, newItem] });
    setShowAddCategoryModal(false);
    toast.success(`Category "${newCatTitle.trim()}" created! Click "Save Navbar Changes" to publish.`);
  };

  const requestDeleteCategory = (index: number, item: NavItemConfig) => {
    setCategoryToDelete({ index, item });
  };

  const handleConfirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const { index, item } = categoryToDelete;
    const updated = form.nav_items.filter((_, i) => i !== index);
    setForm({ ...form, nav_items: updated });
    setCategoryToDelete(null);
    toast.info(`Category "${item.label}" removed. Click "Save Navbar Changes" to sync.`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-mono">Loading Navigation Controls...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Compact Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🧭</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Header &amp; Navigation Controls
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleResetDefaults}
              disabled={!canManage || saving}
            >
              Reset Defaults
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon="💾"
              onClick={handleSubmit}
              disabled={!canManage || saving}
              isLoading={saving}
            >
              {saving ? 'Saving...' : 'Save Navbar Changes'}
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

        {/* Real-time Interactive Visual Preview */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Navbar Preview (What Readers See)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Updates in real time</span>
          </div>

          <div className="rounded-xl border border-slate-300 bg-white text-slate-900 shadow-md overflow-hidden">
            {/* Top strip preview */}
            {form.top_strip.enabled && (
              <div className="border-b border-slate-200 px-4 py-1 text-[10px] font-sans flex items-center justify-between bg-slate-50 text-slate-600">
                <div className="flex items-center gap-2">
                  {form.top_strip.show_date && <span className="font-semibold">Sat, Oct 24, 2026</span>}
                  {form.top_strip.show_live_wire && (
                    <span className="flex items-center gap-1 text-emerald-700 font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {form.top_strip.live_wire_label}
                    </span>
                  )}
                </div>

                {form.top_strip.show_center_banner && (
                  <div className="hidden sm:block text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                    {form.top_strip.center_banner_text}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {form.languages.enabled && (
                    <div className="flex items-center gap-1 font-mono text-[9px]">
                      {form.languages.en && <span className="font-bold bg-slate-200 px-1 rounded">EN</span>}
                      {form.languages.ur && <span>اردو</span>}
                      {form.languages.ks && <span>कॉशور</span>}
                      {form.languages.hi && <span>हिन्दी</span>}
                    </div>
                  )}
                  {form.actions.show_submit_tip && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border border-slate-300 text-slate-700">
                      {form.actions.submit_tip_label}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Main nav bar preview */}
            <div className="px-4 py-2.5 flex items-center justify-between gap-4">
              {/* Brand section */}
              <div className="flex items-center gap-2.5">
                {form.brand.show_logo_image && (
                  <div className="relative w-9 h-9 shrink-0">
                    <Image
                      src={form.brand.logo_url || '/kjin-emblem.png'}
                      alt="Brand"
                      fill
                      className="object-contain"
                    />
                  </div>
                )}
                <div>
                  {form.brand.show_name && (
                    <div className="text-xl font-black font-serif tracking-tight leading-none text-slate-900">
                      {form.brand.name || 'KJIN'}
                    </div>
                  )}
                  {form.brand.show_tagline && (
                    <div className="text-[8px] font-mono tracking-widest uppercase font-semibold text-slate-500 leading-tight">
                      {form.brand.tagline || 'J&K Journal of Record'}
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation items preview */}
              <div className="hidden md:flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                {form.nav_items.filter((i) => i.enabled).map((item) => (
                  <span key={item.id} className="px-2 py-1 rounded hover:bg-slate-100 cursor-default">
                    {item.label}
                  </span>
                ))}
                {form.actions.show_regions_dropdown && (
                  <span className="px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-0.5 text-slate-600">
                    Regions ▾
                  </span>
                )}
                {form.actions.show_latest_wire_badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                    ● {form.actions.latest_wire_label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('brand')}
            className={`px-4 py-2 rounded-[8px] text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'brand'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            🎨 Brand &amp; Logo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-[8px] text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'categories'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            📑 Navigation Topics &amp; Links ({form.nav_items.filter(i => i.enabled).length}/{form.nav_items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('languages')}
            className={`px-4 py-2 rounded-[8px] text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'languages'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            🌐 Languages ({form.languages.enabled ? 'Active' : 'Hidden'})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-2 rounded-[8px] text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'tools'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            ⚡ Header Utility &amp; Tip Button
          </button>
        </div>

        {/* Tab 1: Brand & Logo Identity */}
        {activeTab === 'brand' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🎨</span> Central Brand &amp; Identity Control Hub
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control your brand acronym, legal company full form, official emblem, and animated loader from one unified location.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 shrink-0 self-start">
                One-Place Unified Control
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Brand Short Name Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300 font-semibold flex items-center justify-between">
                  <span>Brand / Logo Name (Acronym)</span>
                  <span className="text-[10px] text-cyan-400 font-normal">Navbar &amp; Loader Wordmark</span>
                </label>
                <input
                  type="text"
                  value={form.brand.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      brand: { ...form.brand, name: e.target.value },
                    })
                  }
                  placeholder="e.g. KCPL, KJIN"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                <p className="text-[11px] text-slate-500">
                  Short brand acronym shown in bold across the Navbar, mobile drawer, and animated page loader (e.g. KCPL).
                </p>
              </div>

              {/* Full Organization Name Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300 font-semibold flex items-center justify-between">
                  <span>Full Organization Name (Company Full Form)</span>
                  <span className="text-[10px] text-emerald-400 font-normal">Footer &amp; Legal Only</span>
                </label>
                <input
                  type="text"
                  value={form.brand.full_name || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      brand: { ...form.brand, full_name: e.target.value },
                    })
                  }
                  placeholder="e.g. Kashmir Central Press & Journalistic Leadership Network"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                <p className="text-[11px] text-slate-500">
                  Full form displayed cleanly in the Footer and Legal Copyright — automatically excluded from crowding the Navbar.
                </p>
              </div>

              {/* Subtitle / Tagline Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300 font-semibold">
                  Subtitle / Tagline
                </label>
                <input
                  type="text"
                  value={form.brand.tagline}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      brand: { ...form.brand, tagline: e.target.value },
                    })
                  }
                  placeholder="e.g. J&K Journal of Record"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                <p className="text-[11px] text-slate-500">
                  Brand motto underneath the logo wordmark and in the footer mission statement.
                </p>
              </div>

              {/* Official Logo Emblem URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300 font-semibold flex items-center justify-between">
                  <span>Official Logo Emblem Image Path</span>
                  <span className="text-[10px] text-slate-400 font-normal">Navbar &amp; Loader Emblem</span>
                </label>
                <input
                  type="text"
                  value={form.brand.logo_url}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      brand: { ...form.brand, logo_url: e.target.value },
                    })
                  }
                  placeholder="/kjin-emblem.png"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white font-mono text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                <p className="text-[11px] text-slate-500">
                  Official circular emblem displayed in the Navbar and inside the animated page loader.
                </p>
              </div>

              {/* Page Loader Subtitle Input */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-mono uppercase text-slate-300 font-semibold flex items-center justify-between">
                  <span>Page Loader Subtitle / Status Message</span>
                  <span className="text-[10px] text-amber-400 font-normal">Animated Loader</span>
                </label>
                <input
                  type="text"
                  value={form.brand.loader_text || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      brand: { ...form.brand, loader_text: e.target.value },
                    })
                  }
                  placeholder="Leave blank to use Subtitle / Tagline"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                <p className="text-[11px] text-slate-500">
                  Custom descriptor shown beneath the spinning emblem while visitors load articles (defaults to Subtitle / Tagline).
                </p>
              </div>

              {/* Logo Emblem Switch */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Show Logo Emblem Image</div>
                  <div className="text-xs text-slate-400">Display the official circular emblem in header and loader</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.brand.show_logo_image}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        brand: { ...form.brand, show_logo_image: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Show Logo Text Switch */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Show Logo Name Text</div>
                  <div className="text-xs text-slate-400">Display the brand title wordmark in header</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.brand.show_name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        brand: { ...form.brand, show_name: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Show Tagline Switch */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between md:col-span-2">
                <div>
                  <div className="font-semibold text-sm text-white">Show Tagline Subtitle</div>
                  <div className="text-xs text-slate-400">Display the tagline under the logo wordmark</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.brand.show_tagline}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        brand: { ...form.brand, show_tagline: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            </div>

            {/* Side-by-Side Real-time Verification Preview: Navbar vs Footer vs Loader */}
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>Live Synchronized Identity Previews</span>
              </h4>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 1. Navbar View Preview */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 font-semibold">
                    <span>1. Navbar Brand View</span>
                    <span className="text-[10px] text-slate-500">Short Wordmark Only</span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white text-slate-900 flex items-center gap-2.5">
                    {form.brand.show_logo_image && (
                      <div className="relative w-8 h-8 shrink-0">
                        <Image
                          src={form.brand.logo_url || '/kjin-emblem.png'}
                          alt="Brand Logo"
                          fill
                          className="object-contain"
                        />
                      </div>
                    )}
                    <div>
                      {form.brand.show_name && (
                        <div className="text-lg font-black font-serif tracking-tight leading-none text-slate-900">
                          {form.brand.name || 'KJIN'}
                        </div>
                      )}
                      {form.brand.show_tagline && (
                        <div className="text-[8px] font-mono tracking-widest uppercase font-semibold text-slate-500 leading-tight mt-0.5">
                          {form.brand.tagline || 'J&K Journal of Record'}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    &bull; Kept compact so category navigation has maximum space.
                  </p>
                </div>

                {/* 2. Footer Identity View Preview */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 font-semibold">
                    <span>2. Footer Identity &amp; Legal View</span>
                    <span className="text-[10px] text-slate-500">Brand + Full Form</span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-[#f4efe8] text-slate-900 space-y-1">
                    <div className="text-lg font-black uppercase font-serif tracking-tight leading-tight text-slate-900">
                      {form.brand.name || 'KJIN'}
                    </div>
                    {form.brand.full_name && (
                      <div className="text-[10px] font-semibold text-slate-600 leading-tight">
                        {form.brand.full_name}
                      </div>
                    )}
                    <div className="text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-300">
                      &copy; 2026 {form.brand.name || 'KJIN'}{form.brand.full_name ? ` (${form.brand.full_name})` : ''}. All rights reserved.
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    &bull; Automatically rendered in footer — no duplicate retyping needed.
                  </p>
                </div>

                {/* 3. Animated Loader View Preview */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-amber-400 font-semibold">
                    <span>3. Page Loader View</span>
                    <span className="text-[10px] text-slate-500">Live Spinner</span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white text-slate-900 flex flex-col items-center justify-center text-center">
                    {/* Mini Animated Spinner */}
                    <div className="relative w-12 h-12 flex items-center justify-center mb-1.5">
                      <div
                        className="absolute inset-0 rounded-full border border-red-200/60"
                        style={{ animation: 'spin 18s linear infinite' }}
                      />
                      <div
                        className="absolute inset-0.5 rounded-full border border-dashed border-amber-300/50"
                        style={{ animation: 'spin 10s linear infinite reverse' }}
                      />
                      <div
                        className="absolute inset-1 rounded-full"
                        style={{
                          background: 'conic-gradient(from 0deg, #dc2626 0%, #f59e0b 45%, transparent 65%)',
                          animation: 'spin 1.4s linear infinite',
                          borderRadius: '9999px',
                          mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), white calc(100% - 1px))',
                          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), white calc(100% - 1px))',
                        }}
                      />
                      {form.brand.show_logo_image && (
                        <div className="relative w-7 h-7 rounded-full overflow-hidden bg-white shadow-sm ring-1 ring-slate-100 flex items-center justify-center">
                          <Image
                            src={form.brand.logo_url || '/kjin-emblem.png'}
                            alt="Emblem"
                            fill
                            className="object-contain p-0.5"
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-black uppercase tracking-wider text-slate-800 font-serif">
                      {form.brand.name || 'KJIN'}
                    </div>
                    <div className="text-[8px] font-mono text-slate-400 uppercase tracking-widest mt-0.5 truncate max-w-[200px]">
                      {form.brand.loader_text || form.brand.tagline || 'Jammu & Kashmir Journal of Record'}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    &bull; Instantly reflects your brand name, emblem, and loader text.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Navigation Categories & Links */}
        {activeTab === 'categories' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📑</span> Navigation Topics &amp; Categories
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Show, hide, or rename categories (Politics, Economy, Sports, International, etc.) in the navbar.
                </p>
              </div>
              <Button
                type="button"
                onClick={openAddCategoryModal}
                variant="cyan"
                size="sm"
                icon={<span>➕</span>}
                className="self-start"
              >
                Add Custom Topic
              </Button>
            </div>

            {/* Category Cards List */}
            <div className="space-y-3">
              {form.nav_items.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400">
                  <p className="text-sm font-semibold">No categories defined yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Add custom topics to organize news articles and navigation.</p>
                  <Button
                    type="button"
                    onClick={openAddCategoryModal}
                    variant="cyan"
                    size="sm"
                    className="mt-3"
                    icon={<span>➕</span>}
                  >
                    Add First Topic
                  </Button>
                </div>
              ) : (
                form.nav_items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      item.enabled
                        ? 'border-slate-700 bg-slate-950/80 shadow-xs'
                        : 'border-slate-850 bg-slate-950/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      {/* Order number */}
                      <span className="w-7 h-7 rounded-[8px] bg-slate-800 border border-slate-700/80 text-[11px] font-mono font-bold text-slate-400 flex items-center justify-center shrink-0">
                        #{index + 1}
                      </span>

                      {/* Status indicator button */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(index)}
                        className={`w-9 h-9 rounded-[8px] flex items-center justify-center font-bold text-sm transition shrink-0 ${
                          item.enabled
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-slate-800 border border-slate-700 text-slate-500 hover:bg-slate-750'
                        }`}
                        title={item.enabled ? 'Click to make Inactive' : 'Click to make Active'}
                      >
                        {item.enabled ? '👁️' : '🚫'}
                      </button>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateCategoryLabel(index, e.target.value)}
                            className="bg-transparent font-bold text-sm text-white focus:outline-none focus:border-b-2 border-cyan-500 max-w-[220px]"
                            title="Click to rename category label"
                          />

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-[8px] bg-slate-800 border border-slate-700 text-slate-300">
                            {item.slug === 'india' || item.id === 'national'
                              ? '/india'
                              : item.slug === 'international' || item.id === 'international'
                              ? '/international'
                              : `/category/${item.slug}`}
                          </span>

                          {/* Dynamic Active/Inactive Badge */}
                          {item.enabled ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Active (Articles &amp; Navbar)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
                              Inactive (Hidden)
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400">
                          {item.enabled
                            ? 'Available in article creation and visible in public website navigation.'
                            : 'Hidden from navigation and omitted from new article category selections.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-850">
                      {/* Active toggle switch */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-400">
                          {item.enabled ? 'Active' : 'Inactive'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={() => toggleCategory(index)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </div>

                      {/* Delete category button */}
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        icon="🗑️"
                        onClick={() => requestDeleteCategory(index, item)}
                        title={`Delete ${item.label}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Special Nav Elements */}
            <div className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Regions Dropdown */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Show &quot;Regions&quot; 5-Division Dropdown</div>
                  <div className="text-xs text-slate-400">Kashmir, Jammu, Chenab Valley, Pir Panjal, Ladakh</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.actions.show_regions_dropdown}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        actions: { ...form.actions, show_regions_dropdown: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Latest Wire Badge */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Show &quot;Latest Wire&quot; Pulse Pill</div>
                  <div className="text-xs text-slate-400">Pulsing red live dispatch badge on navbar right</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.actions.show_latest_wire_badge}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        actions: { ...form.actions, show_latest_wire_badge: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Language Switcher Controls */}
        {activeTab === 'languages' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🌐</span> Multilingual Switcher Controls
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Control the multilingual language options (EN / اردو / कॉशुर / हिन्दी) displayed in the top header strip.
              </p>
            </div>

            {/* Master Language Switcher Toggle */}
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-between">
              <div>
                <div className="font-bold text-base text-white">Enable Language Switcher in Header</div>
                <div className="text-xs text-slate-400">Turn multilingual switching on or off across the whole website</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.languages.enabled}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      languages: { ...form.languages, enabled: e.target.checked },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Individual Language Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* English */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">English</div>
                  <div className="text-[11px] font-mono text-slate-500">Code: en (EN)</div>
                </div>
                <input
                  type="checkbox"
                  checked={form.languages.en}
                  disabled={!form.languages.enabled}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      languages: { ...form.languages, en: e.target.checked },
                    })
                  }
                  className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                />
              </div>

              {/* Urdu */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Urdu (اردو)</div>
                  <div className="text-[11px] font-mono text-slate-500">Code: ur (RTL)</div>
                </div>
                <input
                  type="checkbox"
                  checked={form.languages.ur}
                  disabled={!form.languages.enabled}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      languages: { ...form.languages, ur: e.target.checked },
                    })
                  }
                  className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                />
              </div>

              {/* Kashmiri */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Kashmiri (कॉशुर)</div>
                  <div className="text-[11px] font-mono text-slate-500">Code: ks (Devanagari)</div>
                </div>
                <input
                  type="checkbox"
                  checked={form.languages.ks}
                  disabled={!form.languages.enabled}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      languages: { ...form.languages, ks: e.target.checked },
                    })
                  }
                  className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                />
              </div>

              {/* Hindi */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-white">Hindi (हिन्दी)</div>
                  <div className="text-[11px] font-mono text-slate-500">Code: hi (Devanagari)</div>
                </div>
                <input
                  type="checkbox"
                  checked={form.languages.hi}
                  disabled={!form.languages.enabled}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      languages: { ...form.languages, hi: e.target.checked },
                    })
                  }
                  className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Top Strip & Submit Tip Tools */}
        {activeTab === 'tools' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⚡</span> Top Strip &amp; Submit Tip Button
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure the thin top dateline strip, &quot;Submit Tip&quot; dispatch button, and publication text.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Show Top Utility Strip */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Enable Top Utility Strip</div>
                  <div className="text-xs text-slate-400">Thin strip above navbar containing date and tips</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.top_strip.enabled}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        top_strip: { ...form.top_strip, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Show Live Pulse */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Show Live Verified Wire Pulse</div>
                  <div className="text-xs text-slate-400">Green pulsing dot next to dateline</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.top_strip.show_live_wire}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        top_strip: { ...form.top_strip, show_live_wire: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Submit Tip Button Toggle */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-white">Show &quot;Submit Tip&quot; Button</div>
                  <div className="text-xs text-slate-400">Allows whistleblowers/readers to send dispatches</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.actions.show_submit_tip}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        actions: { ...form.actions, show_submit_tip: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Submit Tip Button Label */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-slate-300 font-semibold">
                  Submit Tip Button Text
                </label>
                <input
                  type="text"
                  value={form.actions.submit_tip_label}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      actions: { ...form.actions, submit_tip_label: e.target.value },
                    })
                  }
                  placeholder="Submit Tip"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>

              {/* Submit Tip Destination URL */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-xs font-mono uppercase text-slate-300 font-semibold">
                  Submit Tip Destination Link (Email or Form)
                </label>
                <input
                  type="text"
                  value={form.actions.submit_tip_url}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      actions: { ...form.actions, submit_tip_url: e.target.value },
                    })
                  }
                  placeholder="mailto:editorial@kjin.org?subject=News%20Tip%20Dispatch"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white font-mono text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                <p className="text-[11px] text-slate-500">Supports mailto: links or direct secure whistleblower form URLs</p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Bar */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Changes take effect immediately on public site across all 10 presentation templates.
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!canManage || saving}
            isLoading={saving}
          >
            {saving ? 'Saving...' : 'Save & Publish Navbar'}
          </Button>
        </div>

        {/* Add Custom Category Modal */}
        {showAddCategoryModal && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAddCategoryModal(false);
            }}
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 space-y-5 text-slate-100 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📑</span>
                  <h3 className="text-base font-bold text-white">Add Custom Topic &amp; Category</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="text-slate-400 hover:text-white transition text-sm"
                >
                  ✕
                </button>
              </div>

              {newCatError && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/50 text-red-300 text-xs">
                  {newCatError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Category Name / Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCatTitle}
                    onChange={(e) => handleTitleChangeForNewCat(e.target.value)}
                    placeholder="e.g. Science & Tech, Climate, Health"
                    className="w-full rounded-[8px] border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    URL Slug <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center rounded-[8px] border border-slate-700 bg-slate-950 px-3 py-2">
                    <span className="text-xs font-mono text-slate-500 mr-1">/category/</span>
                    <input
                      type="text"
                      value={newCatSlug}
                      onChange={(e) => setNewCatSlug(e.target.value)}
                      placeholder="science-tech"
                      className="flex-1 bg-transparent font-mono text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Public readers will view this category at <code>/category/{newCatSlug || 'your-slug'}</code>
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Active Status</div>
                    <div className="text-[11px] text-slate-400">
                      Immediately show in navbar and article creation
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCatEnabled}
                      onChange={(e) => setNewCatEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddCategoryModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="cyan"
                  size="sm"
                  icon={<span>➕</span>}
                  onClick={handleConfirmAddCategory}
                >
                  Create Category
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Category Confirmation Modal */}
        {categoryToDelete && (
          <ConfirmModal
            isOpen={true}
            onClose={() => setCategoryToDelete(null)}
            onConfirm={handleConfirmDeleteCategory}
            title={`Remove Category "${categoryToDelete.item.label}"`}
            description={
              <div className="space-y-2">
                <p>
                  Are you sure you want to remove <strong>&quot;{categoryToDelete.item.label}&quot;</strong> from navigation topics?
                </p>
                <p className="text-xs text-slate-400">
                  This will hide it from the website navigation. Any existing articles previously tagged with this category will retain their text label, but this category will no longer appear in new article category selections.
                </p>
              </div>
            }
            confirmText="Remove Category"
            cancelText="Keep Category"
            variant="red"
            icon="🗑️"
          />
        )}

      </div>
    </div>
  );
}
