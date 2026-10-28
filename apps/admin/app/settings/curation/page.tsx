'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { DEFAULT_CURATION_SETTINGS, type HomepageCurationSettings } from '@/lib/curation';
import { getDailyRotatedCorridors } from '@/lib/navbar';
import { Button } from '@/components/Button';

interface PublishedArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  district: string | null;
  published_at: string;
  view_count: number;
  author_display_name: string | null;
  featured_image_url: string | null;
}

type SlotTarget =
  | 'lead_hero'
  | 'sub_lead_0'
  | 'sub_lead_1'
  | 'wire_0'
  | 'wire_1'
  | 'wire_2'
  | 'wire_3'
  | 'wire_4'
  | 'dossier_0'
  | 'dossier_1'
  | 'dossier_2'
  | 'editorial'
  | 'developing'
  | 'corridor_kashmir'
  | 'corridor_jammu'
  | 'corridor_chenab'
  | 'corridor_panjal'
  | 'corridor_ladakh';

export default function HomepageCuratorPage() {
  const [curation, setCuration] = useState<HomepageCurationSettings>(DEFAULT_CURATION_SETTINGS);
  const [articles, setArticles] = useState<PublishedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter bank state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [draggedArticleId, setDraggedArticleId] = useState<string | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);
  const [selectedArticleForModal, setSelectedArticleForModal] = useState<PublishedArticle | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [brand, setBrand] = useState<{ name: string; est_badge_text?: string; show_est_badge?: boolean; tagline?: string }>({
    name: 'KCPJLN',
    est_badge_text: 'EST. 1948',
    show_est_badge: true,
    tagline: '',
  });

  useEffect(() => {
    fetchCurationData();
  }, []);

  const fetchCurationData = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/curation', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        // Fallback directly to client Supabase session if session exists or local dev
        const { data: dbArticles } = await supabase
          .from('articles')
          .select('id, slug, title, category, district, published_at, view_count, author_display_name, featured_image_url')
          .eq('status', 'published')
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(80);

        const { data: settingData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'homepage_curation')
          .maybeSingle();

        setCuration(settingData?.value ? (settingData.value as HomepageCurationSettings) : DEFAULT_CURATION_SETTINGS);
        setArticles(dbArticles || []);
        return;
      }

      const data = await res.json();
      setCuration(data.curation || DEFAULT_CURATION_SETTINGS);
      setArticles(data.articles || []);
    } catch (err: unknown) {
      console.warn('[Curation] fetch error, using client fallback:', err);
      // Fallback query directly via Supabase client
      try {
        const { data: dbArticles } = await supabase
          .from('articles')
          .select('id, slug, title, category, district, published_at, view_count, author_display_name, featured_image_url')
          .eq('status', 'published')
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(80);

        const { data: settingData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'homepage_curation')
          .maybeSingle();

        setCuration(settingData?.value ? (settingData.value as HomepageCurationSettings) : DEFAULT_CURATION_SETTINGS);
        setArticles(dbArticles || []);
      } catch (innerErr: unknown) {
        const msg = innerErr instanceof Error ? innerErr.message : 'Error loading curation data';
        setFeedback({ type: 'error', message: msg });
      }

      try {
        const { data: navData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'navbar_settings')
          .maybeSingle();
        const brandVal = ((navData?.value as Record<string, unknown> | null)?.brand) as {
          name?: string;
          est_badge_text?: string;
          show_est_badge?: boolean;
          tagline?: string;
        } | undefined;
        if (brandVal) {
          setBrand({
            name: brandVal.name || 'KCPJLN',
            est_badge_text: brandVal.est_badge_text || 'EST. 1948',
            show_est_badge: brandVal.show_est_badge ?? true,
            tagline: brandVal.tagline || '',
          });
        }
      } catch {
        // fallback brand default
      }
    } finally {
      setLoading(false);
    }
  };

  const getArticleById = (id?: string | null): PublishedArticle | undefined => {
    if (!id) return undefined;
    return articles.find((a) => a.id === id);
  };

  const handleSave = async () => {
    if (!curation) return;
    try {
      setSaving(true);
      setFeedback(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/curation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(curation),
      });

      if (!res.ok) {
        // Fallback to client-side Supabase write if staff has active session
        const { error: dbError } = await supabase
          .from('site_settings')
          .upsert({
            key: 'homepage_curation',
            value: {
              ...curation,
              last_curated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          });

        if (dbError) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || dbError.message || 'Failed to save layout');
        }
      } else {
        const data = await res.json();
        if (data.curation) setCuration(data.curation);
      }

      setFeedback({ type: 'success', message: 'Homepage layout and story slotting published live!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving layout';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToAuto = () => {
    if (!confirm('Revert all slots to algorithmic auto-trending? Articles with highest reader engagement and latest publish dates will fill the slots automatically.')) return;
    if (!curation) return;
    setCuration({
      ...curation,
      lead_hero_id: null,
      sub_lead_ids: [],
      wire_ids: [],
      dossier_ids: [],
      editorial_id: null,
      developing_article_id: null,
      corridor_assignments: {},
    });
  };

  // Slotting Assignment Logic
  const assignArticleToSlot = (target: SlotTarget, articleId: string) => {
    if (!curation) return;
    const next = { ...curation };

    if (target === 'lead_hero') {
      next.lead_hero_id = articleId;
    } else if (target === 'editorial') {
      next.editorial_id = articleId;
    } else if (target === 'developing') {
      next.developing_article_id = articleId;
      const art = getArticleById(articleId);
      if (art && !next.developing_headline) {
        next.developing_headline = art.title;
      }
      next.developing_is_active = true;
    } else if (target.startsWith('sub_lead_')) {
      const idx = parseInt(target.replace('sub_lead_', ''), 10);
      const copy = [...(next.sub_lead_ids || [])];
      copy[idx] = articleId;
      next.sub_lead_ids = copy.filter(Boolean).slice(0, 2);
    } else if (target.startsWith('wire_')) {
      const idx = parseInt(target.replace('wire_', ''), 10);
      const copy = [...(next.wire_ids || [])];
      copy[idx] = articleId;
      next.wire_ids = copy.filter(Boolean).slice(0, 5);
    } else if (target.startsWith('dossier_')) {
      const idx = parseInt(target.replace('dossier_', ''), 10);
      const copy = [...(next.dossier_ids || [])];
      copy[idx] = articleId;
      next.dossier_ids = copy.filter(Boolean).slice(0, 3);
    } else if (target.startsWith('corridor_')) {
      const corridorKey = target.replace('corridor_', '');
      next.corridor_assignments = {
        ...(next.corridor_assignments || {}),
        [corridorKey]: articleId,
      };
    }

    setCuration(next);
  };

  const clearSlot = (target: SlotTarget) => {
    if (!curation) return;
    const next = { ...curation };

    if (target === 'lead_hero') {
      next.lead_hero_id = null;
    } else if (target === 'editorial') {
      next.editorial_id = null;
    } else if (target === 'developing') {
      next.developing_article_id = null;
    } else if (target.startsWith('sub_lead_')) {
      const idx = parseInt(target.replace('sub_lead_', ''), 10);
      const copy = [...(next.sub_lead_ids || [])];
      copy.splice(idx, 1);
      next.sub_lead_ids = copy;
    } else if (target.startsWith('wire_')) {
      const idx = parseInt(target.replace('wire_', ''), 10);
      const copy = [...(next.wire_ids || [])];
      copy.splice(idx, 1);
      next.wire_ids = copy;
    } else if (target.startsWith('dossier_')) {
      const idx = parseInt(target.replace('dossier_', ''), 10);
      const copy = [...(next.dossier_ids || [])];
      copy.splice(idx, 1);
      next.dossier_ids = copy;
    } else if (target.startsWith('corridor_')) {
      const corridorKey = target.replace('corridor_', '');
      const map = { ...(next.corridor_assignments || {}) };
      delete map[corridorKey];
      next.corridor_assignments = map;
    }

    setCuration(next);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, articleId: string) => {
    e.dataTransfer.setData('text/plain', articleId);
    setDraggedArticleId(articleId);
  };

  const handleDragOver = (e: React.DragEvent, zoneId: string) => {
    e.preventDefault();
    if (activeDropZone !== zoneId) {
      setActiveDropZone(zoneId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setActiveDropZone(null);
  };

  const handleDrop = (e: React.DragEvent, target: SlotTarget) => {
    e.preventDefault();
    setActiveDropZone(null);
    const articleId = e.dataTransfer.getData('text/plain') || draggedArticleId;
    if (articleId) {
      assignArticleToSlot(target, articleId);
    }
    setDraggedArticleId(null);
  };

  // Filter articles in bank
  const filteredArticles = articles.filter((art) => {
    const matchesSearch =
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (art.district && art.district.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (art.author_display_name && art.author_display_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'all' || art.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(articles.map((a) => a.category.toLowerCase()))).sort();

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-500">Loading Homepage Layout Desk...</span>
        </div>
      </div>
    );
  }


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📰</span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-serif">
              Broadsheet Front Page Curator
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              Drag &amp; Drop Visual Desk
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visually arrange where stories appear across the newspaper front page. Drag stories from the bank or click to slot.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon="↺"
            onClick={handleResetToAuto}
            title="Clear all manual pins and restore dynamic trending algorithm"
          >
            Reset to Auto-Trending
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            href="http://localhost:3000/en"
            external
            icon="↗"
          >
            Live Broadsheet
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon="💾"
            onClick={handleSave}
            disabled={saving}
            isLoading={saving}
          >
            {saving ? 'Publishing...' : 'Save & Publish Layout'}
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-sm font-bold opacity-70 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* Main Grid: Visual Broadsheet Layout (Left 8 cols) + News Bank Drawer (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT 8 COLS: VISUAL NEWSPAPER BROADSHEET WIREFRAME DESK */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 space-y-5 bg-[#FAF8F5] dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="text-xs uppercase font-bold tracking-widest text-[#0F172A] dark:text-white flex items-center gap-1.5">
                <span>📰</span>
                <span>Front Page Layout Canvas</span>
              </span>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {previewMode === 'desktop' ? 'Visual 3-Column Broadsheet' : 'Interactive Mobile Dispatch Stream'}
              </p>
            </div>

            {/* View Switcher: Desktop vs Mobile */}
            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  previewMode === 'desktop'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>💻</span>
                <span>Desktop Broadsheet</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  previewMode === 'mobile'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>📱</span>
                <span>Mobile Stream</span>
              </button>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* A. DESKTOP BROADSHEET CANVAS (3 Columns)                             */}
          {/* ===================================================================== */}
          {previewMode === 'desktop' && (
            <div className="space-y-5 animate-in fade-in duration-150">

          {/* 1. TOP RIBBON: Developing News Wire */}
          <div
            onDragOver={(e) => handleDragOver(e, 'developing')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'developing')}
            className={`p-3 rounded-xl border transition-all ${
              activeDropZone === 'developing'
                ? 'border-red-500 bg-red-500/10 scale-[1.01]'
                : 'border-slate-800 bg-[#0F172A] text-white'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>TOP RIBBON: DEVELOPING WIRE ALERT</span>
              </span>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={curation.developing_is_active}
                  onChange={(e) => setCuration({ ...curation, developing_is_active: e.target.checked })}
                  className="rounded text-red-600 focus:ring-0"
                />
                <span>Active on Home</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={curation.developing_headline || ''}
                onChange={(e) => setCuration({ ...curation, developing_headline: e.target.value })}
                placeholder="Drop a breaking story here or enter custom urgent wire alert text..."
                className="w-full bg-slate-800 text-xs text-white px-2.5 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-red-500"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/settings/telemetry/ai-generate', { method: 'POST' });
                    const data = await res.json();
                    if (data?.headline) {
                      setCuration(prev => ({
                        ...prev,
                        developing_headline: data.headline,
                        developing_is_active: true,
                        developing_article_id: data.article_id || null,
                      }));
                    }
                  } catch (err) {
                    console.error('Failed to generate AI developing headline:', err);
                  }
                }}
                className="px-2.5 py-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-[10px] font-bold rounded flex items-center gap-1 shrink-0 shadow-xs transition"
                title="Synthesize developing headline using Gemini AI"
              >
                <span>✨</span>
                <span>AI</span>
              </button>
              {curation.developing_article_id && (
                <button
                  onClick={() => clearSlot('developing')}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[11px] rounded"
                  title="Clear pinned article"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
              <span>Drop an article from the bank above, enter custom text, or click ✨ AI to synthesize.</span>
              <Link href="/settings/telemetry?tab=corridors" className="text-cyan-400 hover:underline">
                Full Wire &amp; Pass Controls →
              </Link>
            </div>
          </div>

          {/* 2. FIVE TERRITORIAL CORRIDORS AT A GLANCE DECK */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
              🧭 Five Territorial Corridors at a Glance (5 Horizon Slots)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'kashmir', name: 'Kashmir Valley', color: 'border-emerald-500' },
                { id: 'jammu', name: 'Jammu Plains', color: 'border-amber-500' },
                { id: 'chenab', name: 'Chenab Valley', color: 'border-cyan-500' },
                { id: 'panjal', name: 'Pir Panjal', color: 'border-purple-500' },
                { id: 'ladakh', name: 'Leh & Ladakh', color: 'border-blue-500' },
              ].map((corridor) => {
                const assignedId = curation.corridor_assignments?.[corridor.id];
                const assignedArticle = getArticleById(assignedId);
                const zoneId = `corridor_${corridor.id}`;
                const isHovered = activeDropZone === zoneId;

                return (
                  <div
                    key={corridor.id}
                    onDragOver={(e) => handleDragOver(e, zoneId)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, zoneId as SlotTarget)}
                    className={`p-2.5 rounded-xl border bg-white dark:bg-slate-900 flex flex-col justify-between transition-all min-h-[90px] ${
                      isHovered ? 'ring-2 ring-emerald-500 scale-105' : corridor.color
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <span>{corridor.name}</span>
                        {assignedArticle ? (
                          <button
                            onClick={() => clearSlot(zoneId as SlotTarget)}
                            className="text-red-500 hover:text-red-700 font-bold"
                            title="Unpin and revert to auto"
                          >
                            ×
                          </button>
                        ) : (
                          <span className="text-slate-400 font-normal">Auto</span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">
                        {assignedArticle ? assignedArticle.title : 'Auto-Trending Regional Dispatch'}
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 block truncate">
                      {assignedArticle ? `Pinned: ${assignedArticle.district || 'Corridor'}` : 'Drop story here'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. MAIN 3-COLUMN NEWSPAPER BROADSHEET BODY */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
            {/* LEFT COLUMN: Bureau Wire Stream (3 cols) */}
            <div className="md:col-span-3 space-y-2 bg-white dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
                  <span>●</span>
                  <span>LEFT: Bureau Wire</span>
                </span>
                <span className="text-[9px] text-slate-400">5 Slots</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Top chronological filings vetted by resident reporters.
              </p>

              <div className="space-y-1.5">
                {[0, 1, 2, 3, 4].map((idx) => {
                  const assignedId = curation.wire_ids?.[idx];
                  const assignedArticle = getArticleById(assignedId);
                  const zoneId = `wire_${idx}`;
                  const isHovered = activeDropZone === zoneId;

                  return (
                    <div
                      key={idx}
                      onDragOver={(e) => handleDragOver(e, zoneId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, zoneId as SlotTarget)}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        isHovered
                          ? 'border-[#0891B2] bg-cyan-50 dark:bg-cyan-950/30'
                          : assignedArticle
                          ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                          : 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-0.5">
                        <span>Wire Slot #{idx + 1}</span>
                        {assignedArticle && (
                          <button
                            onClick={() => clearSlot(zoneId as SlotTarget)}
                            className="text-red-500 font-bold hover:text-red-700"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                        {assignedArticle ? assignedArticle.title : 'Auto-filling chronological dispatch...'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CENTER COLUMN: Lead Hero & Sub-Leads (6 cols) */}
            <div className="md:col-span-6 space-y-3">
              {/* Lead Hero Center Slot */}
              {(() => {
                const assignedArticle = getArticleById(curation.lead_hero_id);
                const isHovered = activeDropZone === 'lead_hero';

                return (
                  <div
                    onDragOver={(e) => handleDragOver(e, 'lead_hero')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'lead_hero')}
                    className={`bg-white dark:bg-slate-900 p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                      isHovered
                        ? 'border-indigo-500 bg-indigo-50/20 scale-[1.01]'
                        : assignedArticle
                        ? 'border-[#0F172A] dark:border-slate-700 shadow-md'
                        : 'border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
                          ★ CENTER LEAD HERO STORY
                        </span>
                        {assignedArticle ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-emerald-600 font-bold">✓ Pinned</span>
                            <button
                              onClick={() => clearSlot('lead_hero')}
                              className="text-red-500 hover:text-red-700 text-xs font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Auto: Highest View Story</span>
                        )}
                      </div>

                      {assignedArticle?.featured_image_url && (
                        <div className="relative w-full h-32 rounded-lg overflow-hidden bg-slate-900 mb-2">
                          <Image
                            src={assignedArticle.featured_image_url}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}

                      <h3 className="font-serif text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">
                        {assignedArticle ? assignedArticle.title : 'Drop Primary Investigative/Lead Story Here'}
                      </h3>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {assignedArticle ? `Category: ${assignedArticle.category} • Author: ${assignedArticle.author_display_name || 'Staff'}` : 'Will automatically showcase top trending investigative dispatch if unassigned.'}
                      </p>
                    </div>

                    {/* Key Analytical Takeaways (3 Bullet Points) */}
                    <div className="mt-3 pt-2.5 border-t border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-2.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 mb-1.5">
                        <span>Key Analytical Takeaways (Bureau Economic Desk)</span>
                        <span className="text-[9px] text-slate-400 font-normal">3 Points</span>
                      </div>
                      <div className="space-y-1.5">
                        {[0, 1, 2].map((pIdx) => (
                          <div key={pIdx} className="flex items-center gap-1.5">
                            <span className="text-[10px] text-amber-700 font-bold shrink-0">•</span>
                            <input
                              type="text"
                              value={curation.takeaways?.[pIdx] || ''}
                              onChange={(e) => {
                                const copy = [...(curation.takeaways || ['', '', ''])];
                                copy[pIdx] = e.target.value;
                                setCuration({ ...curation, takeaways: copy });
                              }}
                              placeholder={`Takeaway bullet #${pIdx + 1}...`}
                              className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Front Page Center Banner Slot</span>
                      <span>Target: Lead Investigation Story</span>
                    </div>
                  </div>
                );
              })()}

              {/* Sub-Leads (2 Split Slots) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[0, 1].map((idx) => {
                  const assignedId = curation.sub_lead_ids?.[idx];
                  const assignedArticle = getArticleById(assignedId);
                  const zoneId = `sub_lead_${idx}`;
                  const isHovered = activeDropZone === zoneId;

                  return (
                    <div
                      key={idx}
                      onDragOver={(e) => handleDragOver(e, zoneId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, zoneId as SlotTarget)}
                      className={`p-3 rounded-xl border bg-white dark:bg-slate-900 flex flex-col justify-between transition-all min-h-[90px] ${
                        isHovered
                          ? 'border-indigo-500 bg-indigo-50/20'
                          : assignedArticle
                          ? 'border-slate-300 dark:border-slate-700'
                          : 'border-dashed border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          <span>Sub-Lead #{idx + 1}</span>
                          {assignedArticle && (
                            <button
                              onClick={() => clearSlot(zoneId as SlotTarget)}
                              className="text-red-500 font-bold hover:text-red-700"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                          {assignedArticle ? assignedArticle.title : 'Auto-filling secondary story...'}
                        </p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-2 block">
                        {assignedArticle ? `${assignedArticle.category}` : 'Drop story here'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Editorial Op-Ed & Transit Status (3 cols) */}
            <div className="md:col-span-3 space-y-3">
              {/* Editorial of Record Slot */}
              {(() => {
                const assignedArticle = getArticleById(curation.editorial_id);
                const isHovered = activeDropZone === 'editorial';

                return (
                  <div
                    onDragOver={(e) => handleDragOver(e, 'editorial')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'editorial')}
                    className={`p-3 rounded-xl border bg-white dark:bg-slate-900 transition-all ${
                      isHovered
                        ? 'border-purple-500 bg-purple-50/20'
                        : assignedArticle
                        ? 'border-slate-400 dark:border-slate-700'
                        : 'border-dashed border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-purple-600 mb-1">
                      <span>RIGHT: Editorial of Record</span>
                      {assignedArticle && (
                        <button
                          onClick={() => clearSlot('editorial')}
                          className="text-red-500 font-bold hover:text-red-700"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <p className="font-serif text-xs font-bold text-slate-900 dark:text-white line-clamp-3">
                      {assignedArticle ? assignedArticle.title : 'Drop Op-Ed or Editorial of Record Here'}
                    </p>
                    <span className="text-[9px] text-slate-400 mt-2 block">
                      {assignedArticle ? `Author: ${assignedArticle.author_display_name || 'Board'}` : 'Auto: Top Opinion Dispatch'}
                    </span>
                  </div>
                );
              })()}

              {/* Transit & Weather Indicator Box */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  🏔️ Transit Telemetry Indicator
                </span>
                <p className="text-[11px] leading-tight">
                  High-Altitude Pass Status &amp; Open-Meteo Regional Weather feeds stream live automatically.
                </p>
                <Link
                  href="/settings/telemetry"
                  className="mt-2 inline-block text-[10px] text-[#0891B2] font-semibold hover:underline"
                >
                  Manage Passes &amp; Convoys →
                </Link>
              </div>
            </div>
          </div>

          {/* 4. BOTTOM DECK: Multi-Corridor Feature Dossiers (3 Slots) */}
          <div className="pt-2 space-y-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
              📚 Corridor Feature Dossiers (3 In-Depth Regional Slots)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[0, 1, 2].map((idx) => {
                const assignedId = curation.dossier_ids?.[idx];
                const assignedArticle = getArticleById(assignedId);
                const zoneId = `dossier_${idx}`;
                const isHovered = activeDropZone === zoneId;

                return (
                  <div
                    key={idx}
                    onDragOver={(e) => handleDragOver(e, zoneId)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, zoneId as SlotTarget)}
                    className={`p-3 rounded-xl border bg-white dark:bg-slate-900 transition-all flex flex-col justify-between min-h-[90px] ${
                      isHovered
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : assignedArticle
                        ? 'border-slate-300 dark:border-slate-700'
                        : 'border-dashed border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        <span>Feature Dossier #{idx + 1}</span>
                        {assignedArticle && (
                          <button
                            onClick={() => clearSlot(zoneId as SlotTarget)}
                            className="text-red-500 font-bold hover:text-red-700"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                        {assignedArticle ? assignedArticle.title : 'Drop In-Depth Feature Story Here...'}
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-2 block">
                      {assignedArticle ? `${assignedArticle.district || assignedArticle.category}` : 'Auto: Culture & Environment'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

          {/* ===================================================================== */}
          {/* B. MOBILE DISPATCH STREAM CANVAS (Single Column iPhone Mockup)       */}
          {/* ===================================================================== */}
          {previewMode === 'mobile' && (
            <div className="animate-in fade-in duration-150 py-2">
              <div className="max-w-[420px] mx-auto bg-[#FAF8F5] dark:bg-stone-950 rounded-[40px] p-4 border-[6px] border-slate-800 shadow-2xl relative space-y-3.5 font-sans">
                {/* Mobile Device Status Bar & Dynamic Island */}
                <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-stone-200 dark:border-stone-800 text-[10px] font-mono text-stone-600 dark:text-stone-400">
                  <span>09:41</span>
                  <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto" />
                  <div className="flex items-center gap-1">
                    <span>5G</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Mobile Top Masthead Banner */}
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 via-amber-200 to-amber-700 p-0.5 shadow-sm shrink-0">
                      <div className="w-full h-full bg-stone-900 rounded-full flex items-center justify-center text-[10px] text-amber-300 font-bold">
                        KC
                      </div>
                    </div>
                    <div>
                      <div className="flex items-baseline space-x-1">
                        <span className="font-masthead font-black text-sm tracking-tight text-stone-900 dark:text-white">
                          {brand.name}
                        </span>
                        {(brand.show_est_badge ?? true) && (
                          <span className="text-[7.5px] font-serif font-bold text-amber-800 tracking-widest uppercase bg-amber-100/70 px-1 py-0.2 rounded">
                            {brand.est_badge_text || 'EST. 1948'}
                          </span>
                        )}
                      </div>
                      {Boolean(brand.tagline?.trim()) && (
                        <p className="text-[8px] font-serif italic text-stone-500 leading-tight">
                          {brand.tagline}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                    Live Wire
                  </span>
                </div>

                {/* Mobile Corridor Horizon Pills (Interactive Drag & Drop) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] font-mono uppercase text-stone-500 font-bold">
                    <span>Corridor Dispatches</span>
                    <span className="text-[8px] text-slate-400">5 Territorial Paths</span>
                  </div>
                  <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1">
                    {getDailyRotatedCorridors([
                      { id: 'kashmir', name: 'Kashmir Valley', color: 'border-emerald-500' },
                      { id: 'chenab', name: 'Chenab Valley', color: 'border-cyan-500' },
                      { id: 'panjal', name: 'Pir Panjal', color: 'border-purple-500' },
                      { id: 'jammu', name: 'Jammu Plains', color: 'border-amber-500' },
                      { id: 'ladakh', name: 'Leh & Ladakh', color: 'border-blue-500' },
                    ]).map((corridor) => {
                      const assignedId = curation.corridor_assignments?.[corridor.id];
                      const assignedArticle = getArticleById(assignedId);
                      const zoneId = `corridor_${corridor.id}`;
                      const isHovered = activeDropZone === zoneId;

                      return (
                        <div
                          key={corridor.id}
                          onDragOver={(e) => handleDragOver(e, zoneId)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, zoneId as SlotTarget)}
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[9.5px] font-bold border transition-all flex items-center space-x-1 ${
                            isHovered
                              ? 'ring-2 ring-emerald-500 bg-emerald-100'
                              : assignedArticle
                              ? `${corridor.color} bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs`
                              : 'border-stone-300 bg-stone-100 dark:bg-stone-800 text-stone-500'
                          }`}
                        >
                          <span>•</span>
                          <span className="truncate max-w-[90px]">{assignedArticle ? assignedArticle.title : corridor.name}</span>
                          {assignedArticle && (
                            <button
                              onClick={() => clearSlot(zoneId as SlotTarget)}
                              className="text-red-500 hover:text-red-700 ml-1 font-bold"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile Developing Wire Ribbon (Interactive Drop Zone) */}
                <div
                  onDragOver={(e) => handleDragOver(e, 'developing')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'developing')}
                  className={`p-2 rounded-lg border text-white transition-all ${
                    activeDropZone === 'developing'
                      ? 'border-red-400 bg-red-950/80 scale-[1.01]'
                      : 'border-slate-800 bg-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] mb-1">
                    <span className="flex items-center gap-1 font-bold text-red-400 tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      <span>DEVELOPING</span>
                    </span>
                    <span className="text-[8.5px] text-stone-400 font-mono">13:42 IST</span>
                  </div>
                  <input
                    type="text"
                    value={curation.developing_headline || ''}
                    onChange={(e) => setCuration({ ...curation, developing_headline: e.target.value })}
                    placeholder="Drop breaking dispatch here or type wire headline..."
                    className="w-full bg-slate-800/90 text-[10px] text-white px-2 py-1 rounded border border-slate-700 focus:outline-none"
                  />
                </div>

                {/* Mobile Mountain Pass Telemetry Strip */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-[9px]">
                  <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200 block truncate">NH-44 Tunnel</span>
                    <span className="text-[8px] text-emerald-700 dark:text-emerald-400 font-semibold">• CLEAR</span>
                  </div>
                  <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200 block truncate">Zojila Pass</span>
                    <span className="text-[8px] text-amber-700 dark:text-amber-400 font-semibold">• CHAINS REQ.</span>
                  </div>
                  <div className="p-1.5 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <span className="font-bold text-stone-800 dark:text-stone-200 block truncate">Peer Ki Gali</span>
                    <span className="text-[8px] text-red-700 dark:text-red-400 font-semibold">• SNOW BLOCK</span>
                  </div>
                </div>

                {/* Mobile Center Lead Hero Story Card (Interactive Drop Target) */}
                {(() => {
                  const assignedArticle = getArticleById(curation.lead_hero_id);
                  const isHovered = activeDropZone === 'lead_hero';

                  return (
                    <div
                      onDragOver={(e) => handleDragOver(e, 'lead_hero')}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'lead_hero')}
                      className={`p-3 rounded-xl border bg-white dark:bg-stone-900 transition-all ${
                        isHovered
                          ? 'border-indigo-500 bg-indigo-50/30 scale-[1.01]'
                          : assignedArticle
                          ? 'border-stone-300 dark:border-stone-700 shadow-sm'
                          : 'border-dashed border-indigo-300 dark:border-indigo-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider bg-cyan-100 text-cyan-900">
                          {assignedArticle?.category || 'CULTURE • SPECIAL INVESTIGATION'}
                        </span>
                        {assignedArticle ? (
                          <button
                            onClick={() => clearSlot('lead_hero')}
                            className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                          >
                            × Clear Lead
                          </button>
                        ) : (
                          <span className="text-[8.5px] text-stone-400 font-mono">Mobile Hero Slot</span>
                        )}
                      </div>

                      <h4 className="font-serif text-sm font-bold text-stone-900 dark:text-white leading-snug mb-1">
                        {assignedArticle ? assignedArticle.title : 'Drop Primary Lead Story Here (Mobile Hero Card)'}
                      </h4>

                      {assignedArticle?.featured_image_url && (
                        <div className="relative w-full h-28 rounded-lg overflow-hidden bg-stone-900 my-2">
                          <Image src={assignedArticle.featured_image_url} alt="" fill className="object-cover" />
                        </div>
                      )}

                      {/* 3 Key Takeaways bullets inside Mobile Hero */}
                      <div className="mt-2 pt-2 border-t border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/20 rounded-md p-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 block mb-1">
                          Key Analytical Takeaways (3 Bullets)
                        </span>
                        <div className="space-y-1">
                          {[0, 1, 2].map((pIdx) => (
                            <div key={pIdx} className="flex items-center gap-1">
                              <span className="text-[8.5px] text-amber-700 font-bold shrink-0">•</span>
                              <input
                                type="text"
                                value={curation.takeaways?.[pIdx] || ''}
                                onChange={(e) => {
                                  const copy = [...(curation.takeaways || ['', '', ''])];
                                  copy[pIdx] = e.target.value;
                                  setCuration({ ...curation, takeaways: copy });
                                }}
                                placeholder={`Takeaway bullet #${pIdx + 1}...`}
                                className="w-full text-[10px] bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded px-1.5 py-0.5 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Mobile Rapid Wire Dispatches (Slots 0 to 2) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] font-mono uppercase text-stone-500 font-bold">
                    <span className="flex items-center gap-1 text-red-600">
                      <span>⚡</span>
                      <span>Instant Wire Stream</span>
                    </span>
                    <span>3 Mobile Dispatches</span>
                  </div>
                  {[0, 1, 2].map((idx) => {
                    const assignedId = curation.wire_ids?.[idx];
                    const assignedArticle = getArticleById(assignedId);
                    const zoneId = `wire_${idx}`;
                    const isHovered = activeDropZone === zoneId;

                    return (
                      <div
                        key={idx}
                        onDragOver={(e) => handleDragOver(e, zoneId)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, zoneId as SlotTarget)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          isHovered
                            ? 'border-cyan-500 bg-cyan-50/40'
                            : assignedArticle
                            ? 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                            : 'border-dashed border-stone-300 dark:border-stone-700 bg-stone-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[8px] font-mono text-stone-400 mb-0.5">
                          <span>Dispatch #{idx + 1}</span>
                          {assignedArticle && (
                            <button
                              onClick={() => clearSlot(zoneId as SlotTarget)}
                              className="text-red-500 font-bold hover:text-red-700"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <p className="text-[10.5px] font-bold text-stone-800 dark:text-stone-200 line-clamp-1 leading-tight">
                          {assignedArticle ? assignedArticle.title : `Drop wire dispatch #${idx + 1} here...`}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Sub-Leads & Feature Dossiers Split */}
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1].map((idx) => {
                    const assignedId = curation.sub_lead_ids?.[idx];
                    const assignedArticle = getArticleById(assignedId);
                    const zoneId = `sub_lead_${idx}`;
                    const isHovered = activeDropZone === zoneId;

                    return (
                      <div
                        key={idx}
                        onDragOver={(e) => handleDragOver(e, zoneId)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, zoneId as SlotTarget)}
                        className={`p-2 rounded-lg border bg-white dark:bg-stone-900 transition-all ${
                          isHovered
                            ? 'border-indigo-500 bg-indigo-50/20'
                            : assignedArticle
                            ? 'border-stone-300 dark:border-stone-700'
                            : 'border-dashed border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[8px] font-mono text-stone-400 mb-0.5">
                          <span>Sub-Lead #{idx + 1}</span>
                          {assignedArticle && (
                            <button onClick={() => clearSlot(zoneId as SlotTarget)} className="text-red-500 font-bold">
                              ×
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-stone-800 dark:text-stone-200 line-clamp-2 leading-tight">
                          {assignedArticle ? assignedArticle.title : 'Secondary story...'}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Bottom Frosted Bar Preview */}
                <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-around text-center text-[8px] font-bold text-stone-600 dark:text-stone-400">
                  <div className="text-stone-900 dark:text-white">📰 Dispatch</div>
                  <div>⚡ Wire</div>
                  <div>🗺️ Corridors</div>
                  <div>📊 Mandi</div>
                  <div>🔖 Saved</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* RIGHT 4 COLS: UNASSIGNED PUBLISHED NEWS BANK DRAWER      */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#0F172A] dark:text-white">
                📦 Published News Bank
              </h2>
              <span className="text-[10px] text-slate-400">
                {filteredArticles.length} stories available to drag or slot
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
              Live DB
            </span>
          </div>

          {/* Search & Category Filter */}
          <div className="space-y-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search news by title or district..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Categories ({articles.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()} ({articles.filter((a) => a.category.toLowerCase() === c).length})
                </option>
              ))}
            </select>
          </div>

          {/* Draggable Articles List */}
          <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredArticles.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No matching articles found.</p>
            ) : (
              filteredArticles.map((art) => {
                const isHero = curation.lead_hero_id === art.id;
                const isSubLead = curation.sub_lead_ids?.includes(art.id);
                const isWire = curation.wire_ids?.includes(art.id);
                const isDossier = curation.dossier_ids?.includes(art.id);
                const isEditorial = curation.editorial_id === art.id;
                const isAssigned = isHero || isSubLead || isWire || isDossier || isEditorial;

                return (
                  <div
                    key={art.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, art.id)}
                    className={`p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing hover:shadow-md ${
                      isHero
                        ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
                        : isAssigned
                        ? 'border-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-[#FAF8F5] dark:bg-slate-800/40 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span className="font-bold uppercase tracking-wider text-[#0891B2]">
                        {art.district || art.category}
                      </span>
                      {isHero && <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.2 rounded">Lead Hero</span>}
                      {isSubLead && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.2 rounded">Sub-Lead</span>}
                      {isWire && <span className="text-[9px] font-bold text-cyan-600 bg-cyan-100 px-1.5 py-0.2 rounded">Wire</span>}
                      {isDossier && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.2 rounded">Dossier</span>}
                      {isEditorial && <span className="text-[9px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.2 rounded">Op-Ed</span>}
                    </div>

                    <h4 className="text-xs font-bold text-[#0F172A] dark:text-white leading-snug line-clamp-2 mb-1.5">
                      {art.title}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                      <span>{art.view_count} views</span>
                      <button
                        onClick={() => setSelectedArticleForModal(art)}
                        className="text-[#0891B2] font-semibold hover:underline"
                      >
                        Slot into... ▾
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 5. Mobile & One-Click Slotting Modal */}
      {selectedArticleForModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Slot Story into Broadsheet Layout
              </h3>
              <button
                onClick={() => setSelectedArticleForModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-[#0891B2] font-bold block mb-1">
                Selected Story:
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                {selectedArticleForModal.title}
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Choose Destination Newspaper Position:
              </span>
              {[
                { label: '★ Center Column: Lead Hero Story', target: 'lead_hero' },
                { label: 'Secondary Lead: Sub-Lead Slot 1', target: 'sub_lead_0' },
                { label: 'Secondary Lead: Sub-Lead Slot 2', target: 'sub_lead_1' },
                { label: 'Left Column: Bureau Wire Slot 1', target: 'wire_0' },
                { label: 'Left Column: Bureau Wire Slot 2', target: 'wire_1' },
                { label: 'Right Column: Editorial of Record (Op-Ed)', target: 'editorial' },
                { label: 'Bottom: Corridor Feature Dossier 1', target: 'dossier_0' },
                { label: 'Bottom: Corridor Feature Dossier 2', target: 'dossier_1' },
                { label: 'Top: Developing Wire Alert', target: 'developing' },
                { label: 'Territorial Corridor: Kashmir Valley', target: 'corridor_kashmir' },
                { label: 'Territorial Corridor: Jammu Plains', target: 'corridor_jammu' },
                { label: 'Territorial Corridor: Chenab Valley', target: 'corridor_chenab' },
                { label: 'Territorial Corridor: Pir Panjal', target: 'corridor_panjal' },
                { label: 'Territorial Corridor: Leh & Ladakh', target: 'corridor_ladakh' },
              ].map((opt) => (
                <button
                  key={opt.target}
                  onClick={() => {
                    assignArticleToSlot(opt.target as SlotTarget, selectedArticleForModal.id);
                    setSelectedArticleForModal(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition font-medium flex items-center justify-between"
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] text-slate-400">Assign →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
