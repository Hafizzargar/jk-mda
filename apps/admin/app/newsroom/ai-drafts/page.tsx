'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';

interface AIDraft {
  id: string;
  source_name: string;
  source_url: string;
  source_title: string;
  published_at: string | null;
  summary: string;
  summary_hi: string | null;
  summary_ur: string | null;
  category: string;
  district: string | null;
  tags: string[];
  claims: string[];
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  created_at: string;
}

interface DraftCounts {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export default function AIDraftsApprovalPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<AIDraft[]>([]);
  const [counts, setCounts] = useState<DraftCounts>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [tableReady, setTableReady] = useState(true);
  const [migrationSql, setMigrationSql] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  // State per draft: verification checkbox & edit state
  const [checkedClaims, setCheckedClaims] = useState<Record<string, boolean>>({});
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [editedSummaries, setEditedSummaries] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, 'approve' | 'reject' | null>>({});
  const [activeLangTab, setActiveLangTab] = useState<Record<string, 'en' | 'hi' | 'ur'>>({});

  useEffect(() => {
    loadDrafts();
  }, [activeTab]);

  async function loadDrafts() {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      params.set('status', activeTab);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/newsroom/ai-drafts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      const data = await res.json();
      if (data.tableReady === false) {
        setTableReady(false);
        setMigrationSql(data.migrationSql || '');
        setDrafts([]);
        return;
      }

      setTableReady(true);
      setDrafts(data.drafts || []);
      if (data.counts) {
        setCounts(data.counts);
      }
    } catch (err) {
      console.error('Error loading AI drafts:', err);
      toast.error('Failed to load drafts from server.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/ai-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ action: 'sync' }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to trigger news sync.');
      } else {
        toast.success(json.message || 'RSS feeds checked and new drafts generated!');
        loadDrafts();
      }
    } catch (err) {
      toast.error('Sync network request failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleApprove(draft: AIDraft) {
    if (!checkedClaims[draft.id]) {
      toast.error('You must tick the confirmation: "I checked the claims against the source" before approving.');
      return;
    }

    try {
      setActionLoading((prev) => ({ ...prev, [draft.id]: 'approve' }));
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/ai-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          action: 'approve',
          draftId: draft.id,
          verifiedClaimsChecked: true,
          editedTitle: editedTitles[draft.id] || draft.source_title,
          editedSummary: editedSummaries[draft.id] || draft.summary,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to publish story.');
      } else {
        toast.success(`Published successfully: "${json.article?.title || 'Story'}"`);
        setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
        setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), approved: c.approved + 1 }));
      }
    } catch (err) {
      toast.error('Approval request failed.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [draft.id]: null }));
    }
  }

  async function handleReject(draftId: string) {
    try {
      setActionLoading((prev) => ({ ...prev, [draftId]: 'reject' }));
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/ai-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          action: 'reject',
          draftId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to reject draft.');
      } else {
        toast.info('Draft has been rejected.');
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        setCounts((c) => ({ ...c, pending: Math.max(0, c.pending - 1), rejected: c.rejected + 1 }));
      }
    } catch (err) {
      toast.error('Reject request failed.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [draftId]: null }));
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedSql(true);
    toast.success('SQL snippet copied to clipboard!');
    setTimeout(() => setCopiedSql(false), 3000);
  }

  const filteredDrafts = drafts.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.source_title.toLowerCase().includes(q) ||
      d.source_name.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q) ||
      (d.tags && d.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-lg dark:bg-emerald-950">
              🤖
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Pending AI Drafts ($0 Autonomous Newsroom)
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Autonomous multi-feed intelligence. Editors verify factual claims against verified official dispatches before publishing with full source attribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="emerald"
            size="md"
            icon={syncing ? '⏳' : '⚡'}
            isLoading={syncing}
            onClick={handleSync}
          >
            {syncing ? 'Checking Feeds...' : 'Fetch Feeds Now'}
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon="🔄"
            onClick={loadDrafts}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Database Setup Banner (if tableReady is false) */}
      {!tableReady && (
        <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-6 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="flex items-start gap-4">
            <span className="text-3xl">⚠️</span>
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-200">
                Step 1: Database Setup Required in Supabase
              </h3>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                The <code className="rounded bg-amber-200/60 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/60">ai_drafts</code> table and duplicate detection extension have not yet been executed in your Supabase project. Copy the SQL below and run it once in your Supabase SQL Editor.
              </p>

              <div className="relative mt-4">
                <pre className="max-h-56 overflow-y-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100 dark:bg-black">
                  {migrationSql}
                </pre>
                <div className="absolute right-3 top-3">
                  <Button
                    variant="emerald"
                    size="sm"
                    icon={copiedSql ? '✓' : '📋'}
                    onClick={() => copyToClipboard(migrationSql)}
                  >
                    {copiedSql ? 'Copied!' : 'Copy SQL'}
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Button variant="primary" size="sm" onClick={loadDrafts}>
                  I Ran It, Check Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs & Search Filter Toolbar */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>⏳ Pending Review</span>
            <span className="rounded-full bg-black/20 px-1.5 py-0.2 font-mono text-[11px]">
              {counts.pending}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'approved'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>✅ Approved</span>
            <span className="rounded-full bg-black/20 px-1.5 py-0.2 font-mono text-[11px]">
              {counts.approved}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'rejected'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>❌ Rejected</span>
            <span className="rounded-full bg-black/20 px-1.5 py-0.2 font-mono text-[11px]">
              {counts.rejected}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>All Drafts</span>
            <span className="rounded-full bg-black/20 px-1.5 py-0.2 font-mono text-[11px]">
              {counts.total}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search headline, source, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Drafts List */}
      <div className="mt-6 space-y-6">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Loading AI pending news queue...
          </div>
        ) : filteredDrafts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <span className="mb-2 block text-3xl">✨</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No {activeTab} drafts found.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Click &quot;Fetch Feeds Now&quot; above or wait for the hourly GitHub Actions cron cycle to pull fresh official wire dispatches.
            </p>
          </div>
        ) : (
          filteredDrafts.map((draft) => {
            const isEditing = editingDraftId === draft.id;
            const currentTitle = editedTitles[draft.id] !== undefined ? editedTitles[draft.id] : draft.source_title;
            const currentSummary = editedSummaries[draft.id] !== undefined ? editedSummaries[draft.id] : draft.summary;
            const isChecked = Boolean(checkedClaims[draft.id]);
            const langTab = activeLangTab[draft.id] || 'en';
            const approving = actionLoading[draft.id] === 'approve';
            const rejecting = actionLoading[draft.id] === 'reject';

            return (
              <div
                key={draft.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Card Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800/80 dark:bg-slate-950/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-900 dark:bg-blue-950 dark:text-blue-200">
                      📡 {draft.source_name}
                    </span>

                    {draft.category && (
                      <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                        {draft.category}
                      </span>
                    )}

                    {draft.district && (
                      <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-900 dark:bg-purple-950 dark:text-purple-200">
                        📍 {draft.district}
                      </span>
                    )}

                    <span className="text-xs text-slate-500">
                      {draft.published_at ? new Date(draft.published_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : 'Recent'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={draft.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400"
                    >
                      View Original Source ↗
                    </a>

                    {draft.status === 'pending' && (
                      <button
                        onClick={() => {
                          if (isEditing) {
                            setEditingDraftId(null);
                          } else {
                            setEditingDraftId(draft.id);
                            setEditedTitles((p) => ({ ...p, [draft.id]: draft.source_title }));
                            setEditedSummaries((p) => ({ ...p, [draft.id]: draft.summary }));
                          }
                        }}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {isEditing ? 'Cancel Edit' : 'Edit Text ✏️'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  {/* Headline */}
                  {isEditing ? (
                    <div className="mb-3">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Headline:
                      </label>
                      <input
                        type="text"
                        value={currentTitle}
                        onChange={(e) =>
                          setEditedTitles((p) => ({ ...p, [draft.id]: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  ) : (
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      {currentTitle}
                    </h2>
                  )}

                  {/* Multilingual View Tabs */}
                  <div className="mt-4">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                      <button
                        onClick={() => setActiveLangTab((p) => ({ ...p, [draft.id]: 'en' }))}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                          langTab === 'en'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                        }`}
                      >
                        English Summary (Original)
                      </button>

                      {draft.summary_hi && (
                        <button
                          onClick={() => setActiveLangTab((p) => ({ ...p, [draft.id]: 'hi' }))}
                          className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                            langTab === 'hi'
                              ? 'bg-orange-600 text-white'
                              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                          }`}
                        >
                          Hindi Draft (हिंदी)
                        </button>
                      )}

                      {draft.summary_ur && (
                        <button
                          onClick={() => setActiveLangTab((p) => ({ ...p, [draft.id]: 'ur' }))}
                          className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                            langTab === 'ur'
                              ? 'bg-emerald-700 text-white'
                              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                          }`}
                        >
                          Urdu Draft (اردو)
                        </button>
                      )}
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
                      {langTab === 'en' && (
                        <div>
                          {isEditing ? (
                            <textarea
                              rows={3}
                              value={currentSummary}
                              onChange={(e) =>
                                setEditedSummaries((p) => ({ ...p, [draft.id]: e.target.value }))
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          ) : (
                            <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                              {currentSummary}
                            </p>
                          )}
                        </div>
                      )}

                      {langTab === 'hi' && (
                        <div>
                          <p className="font-serif text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                            {draft.summary_hi}
                          </p>
                          <span className="mt-2 block text-[11px] font-semibold text-orange-700 dark:text-orange-400">
                            ✓ Bilingual editor check recommended before publication
                          </span>
                        </div>
                      )}

                      {langTab === 'ur' && (
                        <div dir="rtl">
                          <p className="font-serif text-base leading-relaxed text-slate-800 dark:text-slate-200">
                            {draft.summary_ur}
                          </p>
                          <span className="mt-2 block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            ✓ Bilingual editor check recommended before publication
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Key Claims Box */}
                  {draft.claims && Array.isArray(draft.claims) && draft.claims.length > 0 && (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                        <span>🔍</span>
                        <span>Key Claims &amp; Concrete Facts Extracted</span>
                      </div>
                      <ul className="mt-2 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {draft.claims.map((claim, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>{claim}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tags */}
                  {draft.tags && Array.isArray(draft.tags) && draft.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {draft.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Mandatory Verification & Approval Section */}
                  {draft.status === 'pending' ? (
                    <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 transition hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-950">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setCheckedClaims((p) => ({ ...p, [draft.id]: e.target.checked }))
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-700"
                        />
                        <div className="text-xs">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            I checked the claims against the source
                          </span>
                          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                            Required by editorial policy. Ensures no hallucinated claims or incorrect numbers are published.
                          </p>
                        </div>
                      </label>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="emerald"
                            size="md"
                            icon="📰"
                            disabled={!isChecked || approving}
                            isLoading={approving}
                            onClick={() => handleApprove(draft)}
                          >
                            Approve &amp; Publish Article
                          </Button>

                          {!isChecked && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                              Tick checkbox to unlock publishing
                            </span>
                          )}
                        </div>

                        <Button
                          variant="danger"
                          size="sm"
                          icon="✕"
                          disabled={rejecting}
                          isLoading={rejecting}
                          onClick={() => handleReject(draft.id)}
                        >
                          Reject Draft
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Status:{' '}
                          <strong
                            className={
                              draft.status === 'approved' ? 'text-emerald-600' : 'text-rose-600'
                            }
                          >
                            {draft.status.toUpperCase()}
                          </strong>
                          {draft.reviewed_by ? ` by ${draft.reviewed_by}` : ''}
                        </span>
                        <span className="font-mono">
                          ID: {draft.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
