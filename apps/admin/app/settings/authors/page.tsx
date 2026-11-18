'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TRUSTED_CORRESPONDENTS, type CorrespondentConfig } from '@/lib/correspondents';
import { Button } from '@/components/Button';

export default function AuthorsSettingsPage() {
  const router = useRouter();
  const [correspondents, setCorrespondents] = useState<CorrespondentConfig[]>(TRUSTED_CORRESPONDENTS);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalArticles, setTotalArticles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Bulk rename state
  const [renameTarget, setRenameTarget] = useState('Hafeez Zargar');
  const [renameReplacement, setRenameReplacement] = useState(TRUSTED_CORRESPONDENTS[0].name);

  // Load data
  async function loadData() {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/settings/authors', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load author settings');
      }

      const data = await res.json();
      if (Array.isArray(data.correspondents)) {
        setCorrespondents(data.correspondents);
      }
      if (data.counts) {
        setCounts(data.counts);
      }
      if (typeof data.totalArticles === 'number') {
        setTotalArticles(data.totalArticles);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading author settings';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Save Roster
  async function handleSaveRoster() {
    setSaving(true);
    setFeedback(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch('/api/settings/authors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'save_roster',
          correspondents,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save roster');

      setFeedback({ type: 'success', message: 'Correspondent roster saved successfully!' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  }

  // Auto-Rebalance
  async function handleRebalance() {
    if (!window.confirm('Distribute articles attributed to Hafeez Zargar across the 5 regional correspondents based on their district/topic?')) {
      return;
    }

    setRebalancing(true);
    setFeedback(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch('/api/settings/authors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({ action: 'rebalance' }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Rebalance failed');

      setFeedback({ type: 'success', message: result.message || 'Articles rebalanced successfully!' });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rebalance failed';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setRebalancing(false);
    }
  }

  // Bulk Rename
  async function handleBulkRename() {
    if (!renameTarget || !renameReplacement) return;
    if (!window.confirm(`Rename all articles by "${renameTarget}" to "${renameReplacement}"?`)) {
      return;
    }

    setRenaming(true);
    setFeedback(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch('/api/settings/authors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'rename_author',
          targetAuthor: renameTarget,
          newAuthor: renameReplacement,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Rename failed');

      setFeedback({ type: 'success', message: result.message || 'Author renamed successfully!' });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rename failed';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setRenaming(false);
    }
  }

  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">✍️</span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Correspondents &amp; Author Bylines
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Control the journalists and regional bureau correspondents credited on the public news site to ensure authentic credibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveRoster}
            variant="primary"
            size="md"
            disabled={saving || loading}
            isLoading={saving}
            icon={<span>💾</span>}
          >
            Save Roster
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Grid 1: Live Byline Distribution & Rebalance Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Byline Breakdown */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📊 Live Byline Distribution</span>
                <span className="text-xs font-mono font-normal text-slate-500">
                  ({totalArticles} total articles)
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Number of stories currently attributed to each byline across the website.
              </p>
            </div>
            {counts['Hafeez Zargar'] && counts['Hafeez Zargar'] > 10 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                Action Recommended
              </span>
            )}
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {sortedCounts.map(([author, count]) => {
              const pct = totalArticles > 0 ? Math.round((count / totalArticles) * 100) : 0;
              const isDominant = pct > 40;
              return (
                <div key={author} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {author[0] || 'K'}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {author}
                    </span>
                    {isDominant && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        {pct}% of all stories
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <span className="text-slate-400">{pct}%</span>
                    <span className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      {count} {count === 1 ? 'story' : 'stories'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Smart Rebalance Tool */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
              <span>⚖️</span>
              <span>Intelligent Regional Rebalance</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Instantly redistributes all stories attributed to <strong>Hafeez Zargar</strong> across the 5 regional correspondents based on their designated beat, corridor, and district.
            </p>
            <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
              <li>Kashmir districts &rarr; <strong>Dr. Tariq Ahmad Lone</strong></li>
              <li>Jammu &amp; Economy &rarr; <strong>Pooja Jamwal</strong></li>
              <li>Pir Panjal &rarr; <strong>Showkat Ahmad Mir</strong></li>
              <li>Chenab &amp; Passes &rarr; <strong>Tariq Ahmad Mir</strong></li>
              <li>National &amp; Science &rarr; <strong>Dr. Sunita Pandita</strong></li>
            </ul>
          </div>

          <div className="pt-4 mt-4 border-t border-amber-200 dark:border-amber-800/80">
            <Button
              onClick={handleRebalance}
              variant="primary"
              size="sm"
              disabled={rebalancing || loading}
              isLoading={rebalancing}
              className="w-full justify-center bg-amber-600 hover:bg-amber-500 text-white font-bold"
            >
              Distribute Articles Now
            </Button>
          </div>
        </div>
      </div>

      {/* Grid 2: Bulk Rename Tool */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
          <span>🔄 Bulk Rename Any Author</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Replace an existing author byline across all matching stories in a single operation.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
              Replace This Author:
            </label>
            <input
              value={renameTarget}
              onChange={(e) => setRenameTarget(e.target.value)}
              placeholder="e.g. Hafeez Zargar"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
              With New Byline Name:
            </label>
            <input
              value={renameReplacement}
              onChange={(e) => setRenameReplacement(e.target.value)}
              placeholder="e.g. Dr. Tariq Ahmad Lone"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white font-semibold"
            />
          </div>

          <div>
            <Button
              onClick={handleBulkRename}
              variant="secondary"
              size="md"
              disabled={renaming || !renameTarget || !renameReplacement}
              isLoading={renaming}
              className="w-full justify-center"
            >
              Apply Replacement
            </Button>
          </div>
        </div>
      </div>

      {/* Grid 3: Correspondent Roster Configuration */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>👥 Trusted Correspondent Team (5 Byline Roster)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              These correspondents appear in the dropdown selector when drafting or editing articles in the Admin Portal.
            </p>
          </div>

          <button
            onClick={() => {
              setCorrespondents([
                ...correspondents,
                { name: 'New Correspondent', role: 'Staff Reporter', beat: 'General News', region: 'All J&K' },
              ]);
            }}
            className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            + Add Another Correspondent
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {correspondents.map((corr, idx) => {
            const count = counts[corr.name] || 0;
            return (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-300 font-bold text-xs flex items-center justify-center">
                      {corr.name[0] || 'C'}
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Correspondent #{idx + 1}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                    {count} stories
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-medium text-slate-400 block">Journalist Name:</label>
                    <input
                      value={corr.name}
                      onChange={(e) => {
                        const updated = [...correspondents];
                        updated[idx].name = e.target.value;
                        setCorrespondents(updated);
                      }}
                      className="w-full text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-slate-400 block">Editorial Role / Title:</label>
                    <input
                      value={corr.role}
                      onChange={(e) => {
                        const updated = [...correspondents];
                        updated[idx].role = e.target.value;
                        setCorrespondents(updated);
                      }}
                      className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1 text-slate-700 dark:text-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 block">Region:</label>
                      <input
                        value={corr.region}
                        onChange={(e) => {
                          const updated = [...correspondents];
                          updated[idx].region = e.target.value;
                          setCorrespondents(updated);
                        }}
                        className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 block">Beat / Focus:</label>
                      <input
                        value={corr.beat}
                        onChange={(e) => {
                          const updated = [...correspondents];
                          updated[idx].beat = e.target.value;
                          setCorrespondents(updated);
                        }}
                        className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
                      />
                    </div>
                  </div>
                </div>

                {correspondents.length > 1 && (
                  <button
                    onClick={() => {
                      setCorrespondents(correspondents.filter((_, i) => i !== idx));
                    }}
                    className="text-[10px] text-rose-500 hover:underline pt-1 block"
                  >
                    Remove from Roster
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
