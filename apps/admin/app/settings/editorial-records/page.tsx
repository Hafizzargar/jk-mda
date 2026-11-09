'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DEFAULT_EDITORIAL_DESK_SETTINGS,
  DEFAULT_EDITORIAL_OF_RECORD,
  DEFAULT_VOICES_OF_CORRIDORS,
  type EditorialDeskSettings,
  type EditorialOfRecordSetting,
  type CorridorVoiceItem,
} from '@/lib/editorial-desk';

interface ArticleOption {
  id: string;
  title: string;
  category: string;
  author_display_name?: string | null;
  slug: string;
}

export default function EditorialRecordsPage() {
  const [settings, setSettings] = useState<EditorialDeskSettings>(DEFAULT_EDITORIAL_DESK_SETTINGS);
  const [candidateArticles, setCandidateArticles] = useState<ArticleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'editorial' | 'voices'>('editorial');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Modal / Form state for adding a new citizen voice
  const [newVoiceModalOpen, setNewVoiceModalOpen] = useState(false);
  const [newVoiceSpeaker, setNewVoiceSpeaker] = useState('');
  const [newVoiceLocation, setNewVoiceLocation] = useState('');
  const [newVoiceQuote, setNewVoiceQuote] = useState('');

  // Fetch current settings on load
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch('/api/settings/editorial-records');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        if (isMounted) {
          if (data.settings) setSettings(data.settings);
          if (data.articles) setCandidateArticles(data.articles);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setFeedback({ type: 'error', message: 'Could not load settings from server. Showing local defaults.' });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save changes to backend API
  const handleSave = async () => {
    try {
      setSaving(true);
      setFeedback(null);

      const res = await fetch('/api/settings/editorial-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSettings(data.settings);
      setIsDirty(false);
      setFeedback({ type: 'success', message: 'Editorial Desk & Citizen Voices successfully updated in database!' });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'An error occurred while saving.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Editorial of Record field updates
  const updateEditorial = (field: keyof EditorialOfRecordSetting, val: unknown) => {
    setSettings((prev) => ({
      ...prev,
      editorial_of_record: {
        ...prev.editorial_of_record,
        [field]: val,
      },
    }));
    setIsDirty(true);
  };

  // Add new citizen voice
  const handleAddVoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoiceQuote.trim() || !newVoiceSpeaker.trim()) return;

    const newVoice: CorridorVoiceItem = {
      id: `voice-${Date.now()}`,
      speaker: newVoiceSpeaker.trim(),
      location: newVoiceLocation.trim() || 'J&K Territorial Corridor',
      quote: newVoiceQuote.trim(),
      enabled: true,
      order: settings.voices_of_corridors.length + 1,
    };

    setSettings((prev) => ({
      ...prev,
      voices_of_corridors: [...prev.voices_of_corridors, newVoice],
    }));

    setNewVoiceSpeaker('');
    setNewVoiceLocation('');
    setNewVoiceQuote('');
    setNewVoiceModalOpen(false);
    setIsDirty(true);
  };

  // Delete voice
  const handleDeleteVoice = (id: string) => {
    if (!confirm('Are you sure you want to delete this citizen voice entry?')) return;
    setSettings((prev) => ({
      ...prev,
      voices_of_corridors: prev.voices_of_corridors.filter((v) => v.id !== id),
    }));
    setIsDirty(true);
  };

  // Move voice order
  const handleMoveVoice = (index: number, direction: 'up' | 'down') => {
    const list = [...settings.voices_of_corridors];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // re-assign order property
    const reordered = list.map((item, idx) => ({ ...item, order: idx + 1 }));
    setSettings((prev) => ({ ...prev, voices_of_corridors: reordered }));
    setIsDirty(true);
  };

  // Toggle voice active state
  const handleToggleVoice = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      voices_of_corridors: prev.voices_of_corridors.map((v) =>
        v.id === id ? { ...v, enabled: !v.enabled } : v
      ),
    }));
    setIsDirty(true);
  };

  // Update existing voice inline
  const handleUpdateVoiceField = (id: string, field: keyof CorridorVoiceItem, val: unknown) => {
    setSettings((prev) => ({
      ...prev,
      voices_of_corridors: prev.voices_of_corridors.map((v) =>
        v.id === id ? { ...v, [field]: val } : v
      ),
    }));
    setIsDirty(true);
  };

  // Restore defaults
  const handleRestoreDefaults = () => {
    if (activeTab === 'editorial') {
      if (!confirm('Reset Editorial of Record to standard newspaper defaults?')) return;
      setSettings((prev) => ({ ...prev, editorial_of_record: DEFAULT_EDITORIAL_OF_RECORD }));
      setIsDirty(true);
    } else {
      if (!confirm('Reset Voices of the Corridors to standard citizen testimonies?')) return;
      setSettings((prev) => ({ ...prev, voices_of_corridors: DEFAULT_VOICES_OF_CORRIDORS }));
      setIsDirty(true);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const ed = settings.editorial_of_record;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight">
              Voices &amp; Editorial Desk
            </h1>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              Live Broadsheet Controls
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage the right-column <strong>Editorial of Record</strong> and the <strong>Voices of the Corridors</strong> citizen testimonies.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Restore Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 text-xs font-bold rounded-xl text-white shadow-sm transition flex items-center gap-1.5 ${
              isDirty
                ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400/50'
                : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900'
            }`}
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving to Database...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>{isDirty ? 'Save Changes *' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('editorial')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
            activeTab === 'editorial'
              ? 'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>📜</span>
          <span>Editorial of Record (Op-Ed)</span>
        </button>
        <button
          onClick={() => setActiveTab('voices')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
            activeTab === 'voices'
              ? 'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>🗣️</span>
          <span>Voices of the Corridors ({settings.voices_of_corridors.filter(v => v.enabled).length} Active)</span>
        </button>
      </div>

      {/* TAB 1: EDITORIAL OF RECORD */}
      {activeTab === 'editorial' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form: 7 cols */}
          <div className="lg:col-span-7 space-y-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-900 dark:text-white">
                  Editorial Dispatch Details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Institutional voice representing the collective editorial stance of the network.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ed.enabled}
                  onChange={(e) => updateEditorial('enabled', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {ed.enabled ? 'Enabled on Homepage' : 'Hidden'}
                </span>
              </label>
            </div>

            {/* Volume Badge */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Volume / Edition Badge
              </label>
              <input
                type="text"
                value={ed.volume_badge}
                onChange={(e) => updateEditorial('volume_badge', e.target.value)}
                placeholder="e.g. Vol. LXXIV or Autumn 2026 Edition"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Displayed in top-right of the card.</span>
            </div>

            {/* Title / Headline */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Editorial Headline / Title
              </label>
              <input
                type="text"
                value={ed.title}
                onChange={(e) => updateEditorial('title', e.target.value)}
                placeholder="Title of the editorial dispatch..."
                className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Featured Quote / Excerpt */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Featured Editorial Excerpt / Core Thesis
              </label>
              <textarea
                rows={4}
                value={ed.quote}
                onChange={(e) => updateEditorial('quote', e.target.value)}
                placeholder="Core thesis quote surrounded by quotation marks..."
                className="w-full px-3.5 py-2 text-xs italic font-serif rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white leading-relaxed"
              />
            </div>

            {/* Author Byline & Initials */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Author / Byline
                </label>
                <input
                  type="text"
                  value={ed.author_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    updateEditorial('author_name', name);
                    const initials = name
                      .split(' ')
                      .filter(Boolean)
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 3)
                      .toUpperCase();
                    if (initials) updateEditorial('author_initials', initials);
                  }}
                  placeholder="e.g. Editorial Board"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Avatar Initials
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={ed.author_initials}
                  onChange={(e) => updateEditorial('author_initials', e.target.value.toUpperCase())}
                  placeholder="EB"
                  className="w-full px-3.5 py-2 text-xs font-bold uppercase rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-center font-mono"
                />
              </div>
            </div>

            {/* Institutional Subtext */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Institutional Desk / Location Subtext
              </label>
              <input
                type="text"
                value={ed.institution_subtext}
                onChange={(e) => updateEditorial('institution_subtext', e.target.value)}
                placeholder="e.g. Srinagar & Jammu Joint Chancellery"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Link Mode & Target */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Link Destination
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateEditorial('link_mode', 'opinion_category')}
                  className={`py-2 px-2 text-center text-xs font-bold rounded-xl border transition ${
                    ed.link_mode === 'opinion_category'
                      ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Opinion Archive
                </button>
                <button
                  type="button"
                  onClick={() => updateEditorial('link_mode', 'article')}
                  className={`py-2 px-2 text-center text-xs font-bold rounded-xl border transition ${
                    ed.link_mode === 'article'
                      ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Specific Article
                </button>
                <button
                  type="button"
                  onClick={() => updateEditorial('link_mode', 'custom')}
                  className={`py-2 px-2 text-center text-xs font-bold rounded-xl border transition ${
                    ed.link_mode === 'custom'
                      ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Custom URL
                </button>
              </div>

              {ed.link_mode === 'article' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Select Published Op-Ed / Editorial Article:
                  </label>
                  <select
                    value={ed.article_id || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      updateEditorial('article_id', id);
                      const art = candidateArticles.find((a) => a.id === id);
                      if (art) {
                        updateEditorial('title', art.title);
                        if (art.author_display_name) updateEditorial('author_name', art.author_display_name);
                      }
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Choose from Published Articles ({candidateArticles.length}) --</option>
                    {candidateArticles.map((art) => (
                      <option key={art.id} value={art.id}>
                        [{art.category}] {art.title.slice(0, 75)}... ({art.author_display_name || 'Desk'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {ed.link_mode === 'custom' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Custom URL / Path:
                  </label>
                  <input
                    type="text"
                    value={ed.custom_url || ''}
                    onChange={(e) => updateEditorial('custom_url', e.target.value)}
                    placeholder="e.g. /category/opinion or https://..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Preview: 5 cols */}
          <div className="lg:col-span-5 space-y-4 sticky top-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Broadsheet Preview
              </span>
              <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200">
                {ed.enabled ? '● Active' : '○ Disabled'}
              </span>
            </div>

            {/* Broadsheet Card Preview (matches homepage pixel-for-pixel) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-serif">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-[#0F172A] text-white">
                  Editorial of Record
                </span>
                <span className="text-[11px] text-slate-400 font-serif">
                  {ed.volume_badge || 'Vol. LXXIV'}
                </span>
              </div>

              <h3 className="font-serif text-lg font-bold text-[#0F172A] leading-tight mb-2">
                <span className="hover:text-[#0891B2] transition cursor-pointer">
                  {ed.title || 'Untitled Editorial'}
                </span>
              </h3>

              <p className="text-xs text-slate-600 italic font-serif leading-relaxed mb-3">
                “{ed.quote.replace(/^["“]|["”]$/g, '')}”
              </p>

              <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 font-sans">
                <div className="w-7 h-7 rounded-full bg-[#1E293B] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {ed.author_initials || 'EB'}
                </div>
                <div className="text-[11px] min-w-0">
                  <span className="font-bold text-[#0F172A] block truncate">
                    {ed.author_name || 'Editorial Board'}
                  </span>
                  <span className="text-slate-400 block truncate">
                    {ed.institution_subtext || 'Srinagar & Jammu Joint Chancellery'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">💡 How it works on the reader's screen:</p>
              <p>
                When a reader visits the homepage broadsheet, this card is positioned prominently in the right editorial rail. Changes saved here update immediately across all readers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VOICES OF THE CORRIDORS */}
      {activeTab === 'voices' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-serif font-bold text-base text-slate-900 dark:text-white">
                Citizen Testimonies &amp; Voices of the Corridors
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Direct quotes from farmers, artisans, traders, and civic voices across J&amp;K's 22 districts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewVoiceModalOpen(true)}
              className="px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold rounded-xl hover:opacity-90 transition shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <span>+ Add Citizen Voice</span>
            </button>
          </div>

          {/* Voices List */}
          <div className="space-y-4">
            {settings.voices_of_corridors.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                <p className="text-sm text-slate-500">No citizen voices configured.</p>
                <button
                  onClick={() => setNewVoiceModalOpen(true)}
                  className="mt-3 text-xs font-bold text-amber-600 hover:underline"
                >
                  + Add First Voice
                </button>
              </div>
            ) : (
              settings.voices_of_corridors.map((voice, idx) => (
                <div
                  key={voice.id}
                  className={`p-5 rounded-2xl border transition bg-white dark:bg-slate-900 shadow-xs space-y-3 ${
                    voice.enabled
                      ? 'border-slate-200 dark:border-slate-800'
                      : 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold flex items-center justify-center text-slate-600">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white font-serif">
                        {voice.speaker}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        • {voice.location}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Reorder buttons */}
                      <button
                        type="button"
                        onClick={() => handleMoveVoice(idx, 'up')}
                        disabled={idx === 0}
                        title="Move Up"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveVoice(idx, 'down')}
                        disabled={idx === settings.voices_of_corridors.length - 1}
                        title="Move Down"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                      >
                        ↓
                      </button>

                      {/* Enable/Disable Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleVoice(voice.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                          voice.enabled
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {voice.enabled ? 'Active' : 'Hidden'}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteVoice(voice.id)}
                        title="Delete Entry"
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                        Speaker Name
                      </label>
                      <input
                        type="text"
                        value={voice.speaker}
                        onChange={(e) => handleUpdateVoiceField(voice.id, 'speaker', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                        Location / Sub-Region
                      </label>
                      <input
                        type="text"
                        value={voice.location}
                        onChange={(e) => handleUpdateVoiceField(voice.id, 'location', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                      Citizen Quote
                    </label>
                    <textarea
                      rows={2}
                      value={voice.quote}
                      onChange={(e) => handleUpdateVoiceField(voice.id, 'quote', e.target.value)}
                      className="w-full px-3 py-2 text-xs italic font-serif rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white leading-relaxed"
                    />
                  </div>

                  {/* Preview of this voice item as rendered on broadsheet */}
                  <div className="pt-2">
                    <span className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                      Broadsheet Preview:
                    </span>
                    <div className="p-3 bg-[#f5f3f0] dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700">
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-serif mb-2 leading-relaxed">
                        “{voice.quote.replace(/^["“]|["”]$/g, '')}”
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                        <span className="font-bold text-[#0891B2] dark:text-cyan-400">{voice.speaker}</span>
                        <span>{voice.location}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add New Citizen Voice Modal */}
      {newVoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="font-serif font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>🗣️</span>
                <span>Add New Citizen Voice</span>
              </h3>
              <button
                onClick={() => setNewVoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVoice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Citizen / Speaker Name *
                </label>
                <input
                  type="text"
                  required
                  value={newVoiceSpeaker}
                  onChange={(e) => setNewVoiceSpeaker(e.target.value)}
                  placeholder="e.g. Ghulam Rasool Wani or Saffron Farmer"
                  className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Location &amp; Corridor / Sub-Region *
                </label>
                <input
                  type="text"
                  required
                  value={newVoiceLocation}
                  onChange={(e) => setNewVoiceLocation(e.target.value)}
                  placeholder="e.g. Padder, Kishtwar or Surankote, Poonch"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Citizen Quote / Testimony *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newVoiceQuote}
                  onChange={(e) => setNewVoiceQuote(e.target.value)}
                  placeholder="Enter the citizen's authentic statement or observation..."
                  className="w-full px-3.5 py-2 text-xs italic font-serif rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewVoiceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                >
                  Add Voice to List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

