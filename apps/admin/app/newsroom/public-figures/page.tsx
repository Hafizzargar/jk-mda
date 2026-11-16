'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';

interface PublicFigureItem {
  id: string;
  name: string;
  title: string;
  region: string;
  district: string;
  defaultDateline: string;
  category: string;
  topics: string[];
  searchQuery?: string;
  bio?: string;
  isMonitored?: boolean;
  priority?: 'high' | 'normal';
  trackingMode?: 'auto' | 'manual';
  approvalPolicy?: 'mandatory_review' | 'auto_publish';
  socialHandles?: {
    facebook?: string;
    youtube?: string;
    twitter?: string;
  };
}

interface SynthesizedArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  district: string | null;
  excerpt: string;
  content: string;
  claimsToVerify: string[];
  isLive: boolean;
  liveUrl: string | null;
}

interface ReviewQueueItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  district: string | null;
  excerpt: string | null;
  content: string | null;
  source_name: string | null;
  source_url: string | null;
  created_at: string;
  status: string;
}

export default function PublicFiguresDeskPage() {
  const router = useRouter();
  const [figures, setFigures] = useState<PublicFigureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState('all');

  // Review Queue state (Human Approval)
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [isScanningRadar, setIsScanningRadar] = useState(false);

  // Quick Synthesizer state
  const [selectedFigureId, setSelectedFigureId] = useState<string>('mehraj-malik');
  const [statementText, setStatementText] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<SynthesizedArticle | null>(null);

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingFigure, setEditingFigure] = useState<PublicFigureItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formRegion, setFormRegion] = useState('Chenab Valley');
  const [formDistrict, setFormDistrict] = useState('Doda');
  const [formDateline, setFormDateline] = useState('DODA –');
  const [formCategory, setFormCategory] = useState('Politics');
  const [formTopics, setFormTopics] = useState('');
  const [formSearchQuery, setFormSearchQuery] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formTrackingMode, setFormTrackingMode] = useState<'auto' | 'manual'>('auto');
  const [formApprovalPolicy, setFormApprovalPolicy] = useState<'mandatory_review' | 'auto_publish'>('mandatory_review');
  const [isSavingFigure, setIsSavingFigure] = useState(false);

  useEffect(() => {
    loadFigures();
    loadReviewQueue();
  }, []);

  async function loadReviewQueue() {
    try {
      setLoadingQueue(true);
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, slug, category, district, excerpt, content, source_name, source_url, created_at, status')
        .eq('status', 'review')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.warn('Queue fetch error:', error);
      } else {
        setReviewQueue((data as ReviewQueueItem[]) || []);
      }
    } catch (err) {
      console.error('Queue error:', err);
    } finally {
      setLoadingQueue(false);
    }
  }

  async function loadFigures() {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/newsroom/public-figures', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch public figures registry.');
      }

      const json = await res.json();
      if (Array.isArray(json.figures)) {
        setFigures(json.figures);
        if (json.figures.length > 0 && !selectedFigureId) {
          setSelectedFigureId(json.figures[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error loading public figures:', err);
      toast.error('Could not load public figures registry.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSynthesize(figureOverrideId?: string) {
    const targetId = figureOverrideId || selectedFigureId;
    if (!targetId) {
      toast.error('Please select a public representative.');
      return;
    }

    try {
      setIsSynthesizing(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const targetFigure = figures.find((f) => f.id === targetId);
      toast.info(`Gemini AI is researching & drafting news for ${targetFigure?.name || 'public figure'}...`);

      const res = await fetch('/api/newsroom/public-figures/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          figureId: targetId,
          statementText: statementText.trim() || undefined,
          customTopic: customTopic.trim() || undefined,
          autoPublish,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to synthesize story.');
      }

      if (json.article) {
        setGeneratedArticle(json.article);
        if (json.article.isLive) {
          toast.success(`Published live on website: "${json.article.title}"`);
        } else {
          toast.success(`Draft added to Editorial Approval Queue: "${json.article.title}"`);
        }
        await loadReviewQueue();
      }
    } catch (err: any) {
      console.error('Synthesis error:', err);
      toast.error(err.message || 'Gemini synthesis failed.');
    } finally {
      setIsSynthesizing(false);
    }
  }

  async function handleApproveAndPublish(articleId: string) {
    try {
      setApprovingId(articleId);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const { error } = await supabase
        .from('articles')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: sessionData.session.user.id,
        })
        .eq('id', articleId);

      if (error) throw error;

      toast.success('Approved! Story is now live on broadsheet website.');
      setReviewQueue((prev) => prev.filter((a) => a.id !== articleId));
    } catch (err: any) {
      console.error('Approval error:', err);
      toast.error('Failed to approve story: ' + (err.message || ''));
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectDraft(articleId: string) {
    if (!confirm('Discard and delete this AI draft from the review queue?')) return;
    try {
      const { error } = await supabase.from('articles').delete().eq('id', articleId);
      if (error) throw error;
      toast.info('Draft discarded.');
      setReviewQueue((prev) => prev.filter((a) => a.id !== articleId));
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error('Failed to discard draft.');
    }
  }

  async function handleRunAutonomousRadarScan() {
    try {
      setIsScanningRadar(true);
      const autoFigures = figures.filter((f) => f.trackingMode !== 'manual');
      const targetFigures = autoFigures.length > 0 ? autoFigures.slice(0, 3) : figures.slice(0, 3);

      toast.info(`Scanning latest statements & speeches for ${targetFigures.length} monitored leaders...`);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      let scannedCount = 0;
      for (const fig of targetFigures) {
        try {
          const res = await fetch('/api/newsroom/public-figures/synthesize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({
              figureId: fig.id,
              autoPublish: false, // Strictly false: MUST require human approval
            }),
          });
          if (res.ok) {
            scannedCount++;
          }
        } catch (err) {
          console.warn(`Error scanning for ${fig.name}:`, err);
        }
      }

      toast.success(`Autonomous radar scan completed. ${scannedCount} new drafts queued for human approval!`);
      await loadReviewQueue();
    } catch (err: any) {
      toast.error('Radar scan error: ' + err.message);
    } finally {
      setIsScanningRadar(false);
    }
  }

  async function handlePublishGeneratedArticle() {
    if (!generatedArticle) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const { error } = await supabase
        .from('articles')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: sessionData.session.user.id,
        })
        .eq('id', generatedArticle.id);

      if (error) throw error;

      const catSlug = generatedArticle.category.toLowerCase().replace(/\s+/g, '-');
      const liveUrl = `https://www.kjcpl.site/en/${catSlug}/${generatedArticle.slug}`;
      setGeneratedArticle({ ...generatedArticle, isLive: true, liveUrl });
      toast.success('Article published live to broadsheet website!');
      await loadReviewQueue();
    } catch (err: any) {
      console.error('Publish error:', err);
      toast.error('Failed to publish article.');
    }
  }

  function openAddModal() {
    setEditingFigure(null);
    setFormName('');
    setFormTitle('');
    setFormRegion('Chenab Valley');
    setFormDistrict('Doda');
    setFormDateline('DODA –');
    setFormCategory('Politics');
    setFormTopics('Healthcare, Public Works, Roads, Electricity, Assembly');
    setFormSearchQuery('');
    setFormBio('');
    setFormTrackingMode('auto');
    setFormApprovalPolicy('mandatory_review');
    setShowModal(true);
  }

  function openEditModal(f: PublicFigureItem) {
    setEditingFigure(f);
    setFormName(f.name);
    setFormTitle(f.title);
    setFormRegion(f.region);
    setFormDistrict(f.district);
    setFormDateline(f.defaultDateline);
    setFormCategory(f.category);
    setFormTopics(f.topics.join(', '));
    setFormSearchQuery(f.searchQuery || '');
    setFormBio(f.bio || '');
    setFormTrackingMode(f.trackingMode || 'auto');
    setFormApprovalPolicy(f.approvalPolicy || 'mandatory_review');
    setShowModal(true);
  }

  async function handleSaveFigure(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formTitle.trim()) {
      toast.error('Name and designation are required.');
      return;
    }

    try {
      setIsSavingFigure(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const topicsArray = formTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      let updatedList: PublicFigureItem[];
      if (editingFigure) {
        updatedList = figures.map((f) =>
          f.id === editingFigure.id
            ? {
                ...f,
                name: formName.trim(),
                title: formTitle.trim(),
                region: formRegion,
                district: formDistrict,
                defaultDateline: formDateline.trim(),
                category: formCategory,
                topics: topicsArray,
                searchQuery: formSearchQuery.trim() || undefined,
                bio: formBio.trim() || undefined,
                trackingMode: formTrackingMode,
                approvalPolicy: formApprovalPolicy,
              }
            : f
        );
      } else {
        const newId = formName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const newFigure: PublicFigureItem = {
          id: newId,
          name: formName.trim(),
          title: formTitle.trim(),
          region: formRegion,
          district: formDistrict,
          defaultDateline: formDateline.trim() || `${formDistrict.toUpperCase()} –`,
          category: formCategory,
          topics: topicsArray,
          searchQuery: formSearchQuery.trim() || undefined,
          bio: formBio.trim() || undefined,
          isMonitored: true,
          priority: 'high',
          trackingMode: formTrackingMode,
          approvalPolicy: formApprovalPolicy,
        };
        updatedList = [newFigure, ...figures];
      }

      const res = await fetch('/api/newsroom/public-figures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ figures: updatedList }),
      });

      if (!res.ok) throw new Error('Failed to save public figure.');

      setFigures(updatedList);
      setShowModal(false);
      toast.success(editingFigure ? 'Public figure updated.' : 'New public figure added to monitoring registry.');
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Failed to save figure.');
    } finally {
      setIsSavingFigure(false);
    }
  }

  const filteredFigures = figures.filter((f) => {
    if (regionFilter === 'all') return true;
    return f.region.toLowerCase().includes(regionFilter.toLowerCase());
  });

  const selectedFigure = figures.find((f) => f.id === selectedFigureId) || figures[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎙️</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Public Figures &amp; Leaders Desk
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Gemini AI Grounding
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              🛡️ Mandatory Human Approval
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            Autonomous statement tracking, viral speech synthesis, and verified newsroom reporting on public representatives like Mehraj Malik, regional MLAs, MPs, and civic leaders across J&amp;K.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="secondary"
            onClick={handleRunAutonomousRadarScan}
            isLoading={isScanningRadar}
          >
            🛰️ Scan Radar ({figures.filter(f => f.trackingMode !== 'manual').length} Auto Leaders)
          </Button>
          <Button variant="primary" onClick={openAddModal}>
            + Add Public Figure
          </Button>
        </div>
      </div>

      {/* 2. Quick Synthesizer Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>⚡</span> Instant Statement &amp; Speech Synthesizer
              </h2>
              <p className="text-xs text-slate-400">
                Transform a leader's raw speech, press briefing note, video quote, or latest web statement into a balanced KJCPL news article.
              </p>
            </div>
            {selectedFigure && (
              <span className="text-xs px-3 py-1 bg-slate-800 text-purple-300 rounded-full border border-slate-700 font-mono">
                Active Leader: {selectedFigure.name} ({selectedFigure.district || selectedFigure.region})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Select Public Representative
              </label>
              <select
                value={selectedFigureId}
                onChange={(e) => setSelectedFigureId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {figures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {f.title} ({f.district || f.region})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Specific Topic / Ground Issue (Optional)
              </label>
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. GMC Doda emergency wards, Batote highway landslide, water crisis in Gandoh..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Paste Raw Statement, Speech Transcript, or Social Post (Leave blank to auto-search web)
              </label>
              <span className="text-[11px] text-slate-400">
                {statementText.length > 0 ? `${statementText.length} characters` : 'Auto-search enabled'}
              </span>
            </div>
            <textarea
              rows={4}
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              placeholder="Paste raw quotes, speech transcript, Facebook live transcript, or press release from Mehraj Malik or the selected leader. If you leave this box empty, Gemini will search the web for their latest statements automatically..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Safety & Approval Policy */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Editorial Safety &amp; Mandatory Human Approval</span>
              </span>
              <p className="text-slate-400 text-[11px]">
                Statements from political representatives carry defamation and legal sensitivities. Synthesized stories are safely queued below for an editor to verify fact-checks before going live.
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300 shrink-0 select-none bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 h-4 w-4 bg-slate-800"
              />
              <span className="text-[11px] font-medium">
                Direct Publish Live (<span className="text-red-400">Bypasses Review</span>)
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-slate-800/80">
            <Button
              variant="primary"
              onClick={() => handleSynthesize()}
              isLoading={isSynthesizing}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-6 py-2.5 shadow-lg shadow-purple-900/30"
            >
              ⚡ Synthesize Story with Gemini
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Generated Story Preview Drawer / Card */}
      {generatedArticle && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-md border-2 border-purple-500/30 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  {generatedArticle.category} • {generatedArticle.district || 'Regional'}
                </span>
                {generatedArticle.isLive ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    LIVE ON WEBSITE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    PENDING EDITORIAL APPROVAL
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {generatedArticle.title}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!generatedArticle.isLive ? (
                <Button variant="emerald" onClick={handlePublishGeneratedArticle}>
                  ✅ Approve &amp; Publish Live
                </Button>
              ) : (
                <a
                  href={generatedArticle.liveUrl || `https://www.kjcpl.site/en`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                >
                  View on Website ↗
                </a>
              )}
              <Link
                href={`/articles/${generatedArticle.id}`}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                ✏️ Edit in Articles Desk
              </Link>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Summary Hook</h4>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 italic">
              {generatedArticle.excerpt}
            </p>
          </div>

          {generatedArticle.claimsToVerify?.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5">
                Fact-Check &amp; Verification Notes
              </h4>
              <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-1 list-disc list-inside">
                {generatedArticle.claimsToVerify.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Full Story Preview</h4>
            <div className="prose dark:prose-invert max-w-none text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 max-h-96 overflow-y-auto">
              {generatedArticle.content}
            </div>
          </div>
        </div>
      )}

      {/* 4. PENDING EDITORIAL APPROVAL QUEUE (Human-in-the-Loop) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Pending Editorial Approval Queue ({reviewQueue.length})
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Human Sign-off Required
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Political and leader drafts waiting for senior editor sign-off before publishing live to broadsheet.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadReviewQueue}
              isLoading={loadingQueue}
            >
              🔄 Refresh Queue
            </Button>
          </div>
        </div>

        {loadingQueue ? (
          <div className="text-center py-8 text-xs text-slate-400">Loading pending approval queue...</div>
        ) : reviewQueue.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <span className="text-3xl block mb-2">✅</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              All Public Figure Drafts Cleared
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              No drafts are currently waiting for sign-off. Synthesize a statement above or click "Scan Radar" to queue fresh leader speeches.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviewQueue.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 hover:border-purple-300 dark:hover:border-purple-900/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 max-w-3xl">
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                    {item.district && (
                      <>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          📍 {item.district}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span className="text-slate-400">
                      Drafted {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {item.source_name && (
                      <>
                        <span>•</span>
                        <span className="text-slate-500 italic">Source: {item.source_name}</span>
                      </>
                    )}
                  </div>

                  <h3 className="font-serif text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                    {item.title}
                  </h3>

                  {item.excerpt && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.excerpt}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap md:flex-col lg:flex-row">
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={() => handleApproveAndPublish(item.id)}
                    disabled={approvingId === item.id}
                    isLoading={approvingId === item.id}
                  >
                    ✅ Approve &amp; Publish Live
                  </Button>

                  <Link
                    href={`/articles/${item.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 transition"
                  >
                    ✏️ Edit Draft
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleRejectDraft(item.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                    title="Discard draft"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Monitored Figures Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>👥</span> Monitored Public Representatives ({filteredFigures.length})
            </h2>
            <p className="text-xs text-slate-500">
              Prominent MLAs, leaders, and community voices whose statements and grassroots interventions form news drivers.
            </p>
          </div>

          {/* Region Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
            {['all', 'Chenab Valley', 'Kashmir', 'Jammu', 'Pir Panjal', 'Ladakh'].map((reg) => (
              <button
                key={reg}
                type="button"
                onClick={() => setRegionFilter(reg)}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  regionFilter === reg
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {reg === 'all' ? 'All Regions' : reg}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-slate-500">Loading public figures registry...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFigures.map((figure) => {
              const isSelected = selectedFigureId === figure.id;
              const isAuto = figure.trackingMode !== 'manual';
              const needsReview = figure.approvalPolicy !== 'auto_publish';

              return (
                <div
                  key={figure.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                    isSelected
                      ? 'border-purple-500 ring-2 ring-purple-500/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-slate-900 dark:text-white">
                            {figure.name}
                          </h3>
                          {figure.priority === 'high' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              Top Priority
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-purple-700 dark:text-purple-400 font-medium">
                          {figure.title}
                        </p>
                      </div>

                      <span className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold shrink-0">
                        {figure.district || figure.region}
                      </span>
                    </div>

                    {/* Mode Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isAuto
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {isAuto ? '🤖 Auto Radar' : '✋ Manual'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        needsReview
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                      }`}>
                        {needsReview ? '🛡️ Needs Human Approval' : '⚡ Auto-Publish'}
                      </span>
                    </div>

                    {figure.bio && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                        {figure.bio}
                      </p>
                    )}

                    {figure.topics?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {figure.topics.slice(0, 4).map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                          >
                            {t}
                          </span>
                        ))}
                        {figure.topics.length > 4 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-slate-400">
                            +{figure.topics.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedFigureId(figure.id);
                        handleSynthesize(figure.id);
                      }}
                      isLoading={isSynthesizing && selectedFigureId === figure.id}
                      className="text-xs"
                    >
                      ⚡ Synthesize News
                    </Button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedFigureId(figure.id)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                          isSelected
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-bold'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isSelected ? '✓ Selected' : 'Select'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(figure)}
                        className="text-xs p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                        title="Edit public figure profile"
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Add / Edit Public Figure Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingFigure ? `Edit: ${editingFigure.name}` : 'Add Public Representative'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFigure} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Leader Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Mehraj Malik"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Designation / Affiliation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. MLA Doda / AAP Leader"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Region
                  </label>
                  <select
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="Chenab Valley">Chenab Valley</option>
                    <option value="Kashmir">Kashmir</option>
                    <option value="Jammu">Jammu</option>
                    <option value="Pir Panjal">Pir Panjal</option>
                    <option value="Leh / Ladakh">Leh / Ladakh</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Primary District
                  </label>
                  <input
                    type="text"
                    value={formDistrict}
                    onChange={(e) => setFormDistrict(e.target.value)}
                    placeholder="e.g. Doda"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Dateline
                  </label>
                  <input
                    type="text"
                    value={formDateline}
                    onChange={(e) => setFormDateline(e.target.value)}
                    placeholder="e.g. DODA –"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* AI Radar & Publishing Governance Settings */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
                  🤖 Autonomous AI Tracking &amp; Publishing Policy
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      AI Tracking Mode
                    </label>
                    <select
                      value={formTrackingMode}
                      onChange={(e) => setFormTrackingMode(e.target.value as 'auto' | 'manual')}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="auto">🤖 Auto Radar (Scans Web &amp; Social)</option>
                      <option value="manual">✋ Manual Trigger Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Publishing Governance
                    </label>
                    <select
                      value={formApprovalPolicy}
                      onChange={(e) => setFormApprovalPolicy(e.target.value as 'mandatory_review' | 'auto_publish')}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="mandatory_review">🛡️ Mandatory Review (Must Approve Before Live)</option>
                      <option value="auto_publish">⚡ Autonomous Instant Publish (High Risk)</option>
                    </select>
                  </div>
                </div>

                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-tight">
                  ⚠️ <strong>Editorial Safety:</strong> Statements from political figures often carry legal, communal, and defamation sensitivities. Keeping "Mandatory Review" guarantees human editorial sign-off before broadcast.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Key Topics &amp; Beats (Comma separated)
                </label>
                <input
                  type="text"
                  value={formTopics}
                  onChange={(e) => setFormTopics(e.target.value)}
                  placeholder="e.g. Healthcare, Batote Highway, Water Shortages, Assembly"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Google Search Grounding Query (Optional)
                </label>
                <input
                  type="text"
                  value={formSearchQuery}
                  onChange={(e) => setFormSearchQuery(e.target.value)}
                  placeholder="e.g. Mehraj Malik Doda statement OR speech OR assembly"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Biographical Context &amp; Political Focus
                </label>
                <textarea
                  rows={3}
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Brief background on the representative, their electoral base, and their key policy focus areas..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button variant="secondary" onClick={() => setShowModal(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={isSavingFigure}>
                  {editingFigure ? 'Save Changes' : 'Add to Monitoring Registry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
