'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import {
  getRecommendedEditorialImage,
  EditorialImageOption,
} from '@/lib/newsroom/ai-synthesizer';

interface YouTubeSource {
  id: string;
  channel_name: string;
  channel_url: string;
  channel_id: string;
  country: string;
  region: string;
  language: string;
  category: string;
  is_active: boolean;
  collection_frequency_minutes: number;
  last_checked_at: string | null;
  last_video_published_at: string | null;
  last_error: string | null;
  video_count?: number;
  created_at: string;
}

interface YouTubeVideo {
  id: string;
  source_id: string;
  video_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  published_at: string;
  processing_status: 'discovered' | 'analyzing' | 'draft_proposed' | 'approved' | 'rejected' | 'manual_review_needed' | 'failed';
  has_transcript: boolean;
  proposed_headline: string | null;
  proposed_summary: string | null;
  proposed_category: string | null;
  article_id: string | null;
  ai_analysis: {
    headline?: string;
    summary?: string;
    category?: string;
    scope?: 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley';
    district?: string | null;
    division?: string;
    keyFacts?: string[];
    articleBodyMarkdown?: string;
    featured_image_url?: string;
    uncertaintyNotes?: string;
  } | null;
  youtube_sources?: {
    channel_name: string;
    country: string;
    region: string;
    language: string;
    category: string;
  };
}

export default function YouTubeMonitorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'drafts' | 'channels'>('drafts');
  const [channels, setChannels] = useState<YouTubeSource[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Add Channel Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addName, setAddName] = useState('');
  const [addCountry, setAddCountry] = useState('India');
  const [addRegion, setAddRegion] = useState('Jammu & Kashmir');
  const [addLanguage, setAddLanguage] = useState('Hindi / Urdu / English');
  const [addCategory, setAddCategory] = useState('General News');
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  // Review & Approve Draft Modal State
  const [reviewVideo, setReviewVideo] = useState<YouTubeVideo | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editScope, setEditScope] = useState<'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley'>('National');
  const [editDistrict, setEditDistrict] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editImage, setEditImage] = useState('');
  const [imageAlternatives, setImageAlternatives] = useState<EditorialImageOption[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }
      const token = sessionData.session.access_token;

      const [channelsRes, videosRes] = await Promise.all([
        fetch('/api/newsroom/youtube/channels', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/newsroom/youtube/videos?limit=40', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (channelsRes.ok) {
        const cData = await channelsRes.json();
        setChannels(cData.channels || []);
      }

      if (videosRes.ok) {
        const vData = await videosRes.json();
        setVideos(vData.videos || []);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ text: 'Failed to load YouTube monitor data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/youtube/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          text: `Sync complete! Checked ${data.channelsChecked} channels. Discovered ${data.newVideosFound} new videos (${data.draftsProposed} Gemini drafts generated).`,
          type: 'success',
        });
        await loadData();
      } else {
        setFeedback({ text: data.error || 'Sync failed.', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Sync network error.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleAddChannel(e: FormEvent) {
    e.preventDefault();
    if (!addUrl.trim()) return;

    setIsAddingChannel(true);
    setFeedback(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/youtube/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          url: addUrl.trim(),
          channel_name: addName.trim() || undefined,
          country: addCountry,
          region: addRegion,
          language: addLanguage,
          category: addCategory,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          text: `Channel "${data.channel.channel_name}" successfully registered for surveillance!`,
          type: 'success',
        });
        setShowAddModal(false);
        setAddUrl('');
        setAddName('');
        await loadData();
      } else {
        setFeedback({ text: data.error || 'Failed to add channel.', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Network error.', type: 'error' });
    } finally {
      setIsAddingChannel(false);
    }
  }

  async function handleToggleChannel(channel: YouTubeSource) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const nextActive = !channel.is_active;
      const res = await fetch('/api/newsroom/youtube/channels', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ id: channel.id, is_active: nextActive }),
      });

      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) => (c.id === channel.id ? { ...c, is_active: nextActive } : c))
        );
        setFeedback({
          text: `Channel ${channel.channel_name} is now ${nextActive ? 'Active' : 'Paused'}.`,
          type: 'success',
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteChannel(channel: YouTubeSource) {
    if (!confirm(`Are you sure you want to remove ${channel.channel_name}? Previously drafted articles will remain intact.`)) {
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch(`/api/newsroom/youtube/channels?id=${channel.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== channel.id));
        setFeedback({ text: `Channel ${channel.channel_name} removed.`, type: 'success' });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSynthesizeWithAi(targetVideo?: YouTubeVideo) {
    const video = targetVideo || reviewVideo;
    if (!video) return;

    setIsSynthesizing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/youtube/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ video_id: video.id }),
      });

      const data = await res.json();
      if (res.ok && data.draft) {
        setEditHeadline(data.draft.headline);
        setEditSummary(data.draft.summary);
        setEditCategory(data.draft.category);
        setEditScope(data.draft.scope);
        setEditDistrict(data.draft.district || '');
        setEditBody(data.draft.body_markdown);
        setEditImage(data.draft.featured_image_url);
        setImageAlternatives(data.draft.alternative_images || []);

        setVideos((prev) =>
          prev.map((v) =>
            v.id === video.id
              ? {
                  ...v,
                  proposed_headline: data.draft.headline,
                  proposed_summary: data.draft.summary,
                  proposed_category: data.draft.category,
                  ai_analysis: {
                    ...v.ai_analysis,
                    headline: data.draft.headline,
                    summary: data.draft.summary,
                    category: data.draft.category,
                    scope: data.draft.scope,
                    articleBodyMarkdown: data.draft.body_markdown,
                    featured_image_url: data.draft.featured_image_url,
                  },
                }
              : v
          )
        );
      } else {
        alert(data.error || 'Failed to synthesize English draft.');
      }
    } catch (err: any) {
      alert(err.message || 'Translation/Synthesis error.');
    } finally {
      setIsSynthesizing(false);
    }
  }

  function openReviewModal(video: YouTubeVideo) {
    setReviewVideo(video);

    // Auto-detect scope
    const scope = (video.ai_analysis?.scope as any) || (
      video.youtube_sources?.region?.toLowerCase().includes('chenab')
        ? 'Chenab Valley'
        : video.youtube_sources?.country?.toLowerCase() !== 'india'
        ? 'International'
        : video.youtube_sources?.region?.toLowerCase().includes('kashmir') || video.youtube_sources?.region?.toLowerCase().includes('jammu')
        ? 'State (Jammu & Kashmir)'
        : 'National'
    );
    setEditScope(scope);
    const cat = video.proposed_category || video.youtube_sources?.category || 'General';
    setEditCategory(cat);
    setEditDistrict(video.ai_analysis?.district || '');

    // Curate clean editorial news image instead of raw YouTube thumbnail
    const recommended = getRecommendedEditorialImage(scope, cat);
    setImageAlternatives(recommended.alternatives);
    const initialImage = video.ai_analysis?.featured_image_url || recommended.featuredImage;
    setEditImage(initialImage);

    // Ensure 100% link-free script without hashtags
    const rawBody = video.ai_analysis?.articleBodyMarkdown || video.description || '';
    const cleanBody = rawBody
      .replace(/#[a-zA-Z0-9_\u0900-\u097F]+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();

    setEditHeadline(video.proposed_headline || video.title);
    setEditSummary(video.proposed_summary || video.description?.slice(0, 300) || '');
    setEditBody(cleanBody);

    // If non-English characters or hashtags are detected, automatically run AI English synthesis
    const hasNonEnglish = /[\u0900-\u097F\u0600-\u06FF]/.test(
      (video.proposed_headline || video.title) + (video.proposed_summary || video.description)
    );
    const hasHashtags = (video.ai_analysis?.articleBodyMarkdown || video.description || '').includes('#');

    if (hasNonEnglish || hasHashtags || !video.ai_analysis?.articleBodyMarkdown) {
      handleSynthesizeWithAi(video);
    }
  }

  async function handleApproveDraft(targetStatus: 'review' | 'draft') {
    if (!reviewVideo) return;
    setIsApproving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/youtube/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          video_id: reviewVideo.id,
          headline: editHeadline,
          summary: editSummary,
          category: editCategory,
          scope: editScope,
          district: editDistrict || null,
          body_markdown: editBody,
          featured_image_url: editImage,
          target_status: targetStatus,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          text: `Draft approved into official articles (${targetStatus === 'review' ? 'Awaiting Editorial Approval' : 'Saved as Draft'})!`,
          type: 'success',
        });
        setReviewVideo(null);
        await loadData();
      } else {
        alert(data.error || 'Failed to approve draft.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error.');
    } finally {
      setIsApproving(false);
    }
  }

  const filteredVideos = videos.filter((v) => {
    if (filterStatus !== 'all' && v.processing_status !== filterStatus) return false;
    if (filterScope !== 'all') {
      const scope = v.ai_analysis?.scope || (
        v.youtube_sources?.region?.toLowerCase().includes('chenab')
          ? 'Chenab Valley'
          : v.youtube_sources?.country?.toLowerCase() !== 'india'
          ? 'International'
          : v.youtube_sources?.region?.toLowerCase().includes('kashmir') || v.youtube_sources?.region?.toLowerCase().includes('jammu')
          ? 'State (Jammu & Kashmir)'
          : 'National'
      );
      if (scope !== filterScope) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / itemsPerPage));
  const paginatedVideos = filteredVideos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeChannelsCount = channels.filter((c) => c.is_active).length;
  const pendingDraftsCount = videos.filter((v) => v.processing_status === 'draft_proposed').length;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📺</span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              YouTube News Monitoring
            </h1>
            <span className="rounded-full bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300 text-xs font-bold px-2.5 py-0.5 border border-red-200 dark:border-red-500/30">
              Surveillance Engine
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Monitors world & regional YouTube channels every 60 minutes. Gemini extracts facts and drafts stories for your editorial review.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon="🔄"
            disabled={isSyncing}
            isLoading={isSyncing}
            onClick={handleSyncNow}
            title="Poll active YouTube feeds right now"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now (60m)'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            icon="➕"
            onClick={() => setShowAddModal(true)}
          >
            Add Channel
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-4 text-sm font-medium flex items-center justify-between ${
            feedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-red-500/40 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 ml-4 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Monitored Sources
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {channels.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {activeChannelsCount} active surveillance channels
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            Discovered Videos
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {videos.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ingested & deduplicated by video ID
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Proposed Gemini Drafts
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {pendingDraftsCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Awaiting editorial approval
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Railway Schedule
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
            0 * * * *
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Hourly automated background worker
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('drafts')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            activeTab === 'drafts'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📰 Incoming Broadcasts & AI Drafts</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">
            {videos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            activeTab === 'channels'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>⚙️ Monitored Channels Registry</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">
            {channels.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Incoming Broadcasts & Gemini Drafts */}
      {activeTab === 'drafts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Statuses ({videos.length})</option>
                  <option value="draft_proposed">Proposed Drafts ({pendingDraftsCount})</option>
                  <option value="approved">Approved</option>
                  <option value="analyzing">Analyzing</option>
                  <option value="manual_review_needed">Needs Review</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">News Scope:</span>
                <select
                  value={filterScope}
                  onChange={(e) => {
                    setFilterScope(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Scopes</option>
                  <option value="International">🌍 International</option>
                  <option value="National">🇮🇳 National</option>
                  <option value="State (Jammu & Kashmir)">🏔️ J&K State</option>
                  <option value="Chenab Valley">🏞️ Chenab Valley</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click &quot;Review &amp; Approve&quot; to review the original headline &amp; script before editorial publication.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading incoming broadcasts...</div>
          ) : filteredVideos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
              <span className="text-3xl">📡</span>
              <h3 className="mt-2 text-base font-bold text-slate-800 dark:text-slate-200">
                No videos in this view
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Click &quot;Sync Now&quot; above to poll active YouTube channels for newly uploaded news reports.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedVideos.map((video) => {
                  const statusBadge =
                  video.processing_status === 'draft_proposed'
                    ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                    : video.processing_status === 'approved'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                    : 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30';

                  // Determine Scope Badge
                  const scope = video.ai_analysis?.scope || (
                    video.youtube_sources?.region?.toLowerCase().includes('chenab')
                      ? 'Chenab Valley'
                      : video.youtube_sources?.country?.toLowerCase() !== 'india'
                      ? 'International'
                      : video.youtube_sources?.region?.toLowerCase().includes('kashmir') || video.youtube_sources?.region?.toLowerCase().includes('jammu')
                      ? 'State (Jammu & Kashmir)'
                      : 'National'
                  );
                  const badgeMap: Record<string, { label: string; icon: string; cls: string }> = {
                    'International': { label: 'International', icon: '🌍', cls: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30' },
                    'National': { label: 'National', icon: '🇮🇳', cls: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30' },
                    'State (Jammu & Kashmir)': { label: 'J&K State', icon: '🏔️', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30' },
                    'Chenab Valley': { label: 'Chenab Valley', icon: '🏞️', cls: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30' },
                  };
                  const scopeMeta = badgeMap[scope] || badgeMap['National'];

                return (
                  <div
                    key={video.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition hover:border-cyan-500/50"
                  >
                    <div>
                      {/* Video Header Meta */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {video.youtube_sources?.channel_name || 'YouTube'}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border flex items-center gap-1 ${scopeMeta.cls}`}>
                            <span>{scopeMeta.icon}</span>
                            <span>{scopeMeta.label}</span>
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(video.published_at).toLocaleDateString()}
                          </span>
                        </div>

                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border capitalize ${statusBadge}`}>
                          {video.processing_status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Video Thumbnail + Original Broadcast Reference */}
                      <div className="flex gap-3.5 mb-3">
                        {video.thumbnail_url && (
                          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-slate-950 border border-slate-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={video.thumbnail_url}
                              alt={video.title}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <span className="text-white text-xs opacity-90">▶</span>
                            </div>
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Original Broadcast Title (Raw Source):
                          </div>
                          <a
                            href={video.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-xs text-slate-700 dark:text-slate-300 hover:text-cyan-500 transition line-clamp-2 mt-0.5"
                            title="Open original video on YouTube"
                          >
                            {video.title} ↗
                          </a>
                        </div>
                      </div>

                      {/* KJIN Synthesized Original Story (From Scratch) */}
                      {video.proposed_headline && (
                        <div className="mt-2 rounded-xl bg-cyan-950/20 border border-cyan-500/20 p-3 text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                            <span>✨ KJIN Original Headline (Formulated from scratch):</span>
                          </div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            {video.proposed_headline}
                          </p>
                          {video.proposed_summary && (
                            <p className="text-slate-600 dark:text-slate-300 text-xs line-clamp-2">
                              {video.proposed_summary}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        {video.has_transcript ? '🎙️ Transcript Analyzed' : '📝 Metadata Synthesized'}
                      </span>

                      {video.processing_status === 'approved' ? (
                        <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                          ✓ Article Created
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="cyan"
                          size="sm"
                          icon="✍️"
                          onClick={() => openReviewModal(video)}
                        >
                          Review &amp; Approve
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                <p className="text-xs text-slate-500">
                  Showing <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredVideos.length)}</span> of{' '}
                  <span className="font-bold text-slate-800 dark:text-slate-200">{filteredVideos.length}</span> videos
                </p>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </Button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                          currentPage === pageNumber
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Tab 2: Monitored Channels Registry */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Registered YouTube Sources ({channels.length})
            </h3>
            <p className="text-xs text-slate-500">
              Only active channels are polled every 60 minutes.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-400">
                  <th className="px-4 py-3">Channel Name</th>
                  <th className="px-4 py-3">Region &amp; Country</th>
                  <th className="px-4 py-3">Language / Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Polled</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {channels.map((ch) => (
                  <tr key={ch.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        <a
                          href={ch.channel_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-cyan-500 transition"
                        >
                          {ch.channel_name} ↗
                        </a>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400">
                        {ch.channel_id}
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-800 dark:text-slate-200 font-semibold">{ch.region}</div>
                      <div className="text-[11px] text-slate-400">{ch.country}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-800 dark:text-slate-200">{ch.category}</div>
                      <div className="text-[11px] text-slate-400">{ch.language}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold border ${
                          ch.is_active
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {ch.is_active ? 'Active' : 'Paused'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {ch.last_checked_at ? new Date(ch.last_checked_at).toLocaleTimeString() : 'Never'}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleToggleChannel(ch)}
                        >
                          {ch.is_active ? 'Pause' : 'Resume'}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteChannel(ch)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Add Monitored YouTube Channel
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddChannel} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  YouTube Channel URL or Handle (@name)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. https://www.youtube.com/@abhisar_sharma or @razagraphy"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  The system automatically resolves channel handles and extracts the canonical Channel ID (UC...).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Custom Channel Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-detected if left blank"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Country
                  </label>
                  <select
                    value={addCountry}
                    onChange={(e) => setAddCountry(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                  >
                    <option value="India">India</option>
                    <option value="International">International</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Middle East">Middle East</option>
                    <option value="Pakistan">Pakistan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Region
                  </label>
                  <select
                    value={addRegion}
                    onChange={(e) => setAddRegion(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                  >
                    <option value="Jammu & Kashmir">Jammu &amp; Kashmir</option>
                    <option value="Chenab Valley">Chenab Valley</option>
                    <option value="Kashmir Valley">Kashmir Valley</option>
                    <option value="Jammu Division">Jammu Division</option>
                    <option value="Pir Panjal">Pir Panjal</option>
                    <option value="National">National (India)</option>
                    <option value="Global">Global</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Broadcast Language
                  </label>
                  <input
                    type="text"
                    value={addLanguage}
                    onChange={(e) => setAddLanguage(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    News Category
                  </label>
                  <input
                    type="text"
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isAddingChannel}
                  isLoading={isAddingChannel}
                >
                  {isAddingChannel ? 'Resolving Channel...' : 'Register Channel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review & Approve Draft Modal */}
      {reviewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Review &amp; Approve Broadcast Story Draft
                </h3>
                <p className="text-xs text-slate-500">
                  Channel: {reviewVideo.youtube_sources?.channel_name} · Independent Newsroom Synthesis
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewVideo(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* AI English Synthesis Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-cyan-950/60 via-blue-950/40 to-slate-900 border border-cyan-800/50 p-3.5 shadow-inner">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-cyan-400">⚡ AI English Newsroom Engine</span>
                  {/[\u0900-\u097F\u0600-\u06FF]/.test(editHeadline + editBody + reviewVideo.title) ? (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                      ⚠️ Non-English Source Detected
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                      ✓ 100% English Script
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Translates foreign/regional speech, removes clickbait &amp; hashtags, and generates a structured English news report with clean editorial photography.
                </p>
              </div>
              <button
                type="button"
                disabled={isSynthesizing}
                onClick={() => handleSynthesizeWithAi()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition"
              >
                {isSynthesizing ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    Translating &amp; Rewriting...
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    AI Translate &amp; Rewrite to English
                  </>
                )}
              </button>
            </div>

            {/* Raw Reference Card (For editorial inspection only) */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Raw Broadcast Title (Reference only - do not publish verbatim):
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-medium">
                {reviewVideo.title}
              </p>
            </div>

            <div className="space-y-3.5 text-sm">
              {/* Scope & Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    News Scope
                  </label>
                  <select
                    value={editScope}
                    onChange={(e: any) => {
                      const newScope = e.target.value;
                      setEditScope(newScope);
                      const rec = getRecommendedEditorialImage(newScope, editCategory);
                      setImageAlternatives(rec.alternatives);
                      if (!editImage || editImage === reviewVideo.thumbnail_url) {
                        setEditImage(rec.featuredImage);
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-cyan-500"
                  >
                    <option value="International">🌍 International</option>
                    <option value="National">🇮🇳 National</option>
                    <option value="State (Jammu & Kashmir)">🏔️ J&K State</option>
                    <option value="Chenab Valley">🏞️ Chenab Valley</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-cyan-500"
                  >
                    <option value="Politics">Politics</option>
                    <option value="International">International</option>
                    <option value="Economy">Economy</option>
                    <option value="Local">Local</option>
                    <option value="Investigation">Investigation</option>
                    <option value="General">General</option>
                    <option value="Security">Security</option>
                    <option value="Environment">Environment</option>
                    <option value="Sports">Sports</option>
                    <option value="Education">Education</option>
                    <option value="Culture">Culture</option>
                    <option value="Opinion">Opinion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    District (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Doda, Kishtwar, Srinagar..."
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Original Headline */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Original KJIN Headline
                  </label>
                  <span className="text-[11px] text-cyan-500 font-semibold">
                    Written from zero in English (No Hindi/Urdu)
                  </span>
                </div>
                <input
                  type="text"
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white font-bold outline-none focus:border-cyan-500"
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Article Summary / Excerpt
                </label>
                <textarea
                  rows={2}
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white outline-none focus:border-cyan-500 text-xs"
                />
              </div>

              {/* Original Script */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Original News Script (Markdown · Zero external links · No hashtags)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Synthesized journalistic report
                  </span>
                </div>
                <textarea
                  rows={9}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="mt-1 w-full font-mono text-xs rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                />
              </div>

              {/* Featured Article Image Selection */}
              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Featured Article Image
                  </label>
                  <span className="text-[11px] text-cyan-400 font-medium">
                    Clean editorial photo recommended (no YouTube text overlays)
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  {/* Current Image Preview */}
                  <div className="relative w-36 h-24 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shrink-0 shadow-md">
                    {editImage ? (
                      <Image
                        src={editImage}
                        alt="Featured preview"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                        No Image
                      </div>
                    )}
                    {editImage === reviewVideo.thumbnail_url ? (
                      <span className="absolute bottom-1 right-1 rounded bg-amber-600/90 px-1 py-0.5 text-[9px] font-semibold text-white">
                        YouTube Thumbnail
                      </span>
                    ) : (
                      <span className="absolute bottom-1 right-1 rounded bg-cyan-600/90 px-1 py-0.5 text-[9px] font-semibold text-white">
                        Clean Editorial
                      </span>
                    )}
                  </div>

                  {/* Image Options */}
                  <div className="flex-1 space-y-2 text-xs w-full">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const recommended = getRecommendedEditorialImage(editScope, editCategory);
                          setEditImage(recommended.featuredImage);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                          editImage && editImage !== reviewVideo.thumbnail_url
                            ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                            : 'border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        📸 Clean Editorial Photo
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditImage(reviewVideo.thumbnail_url)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                          editImage === reviewVideo.thumbnail_url
                            ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                            : 'border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        📺 YouTube Thumbnail
                      </button>
                    </div>

                    {/* Alternative Editorial Photos Gallery */}
                    {imageAlternatives.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto py-1">
                        <span className="text-[10px] text-slate-400 shrink-0">Gallery:</span>
                        {imageAlternatives.map((alt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditImage(alt.url)}
                            className={`relative w-14 h-9 rounded-lg overflow-hidden border shrink-0 transition ${
                              editImage === alt.url ? 'border-cyan-400 ring-2 ring-cyan-400' : 'border-slate-700 hover:border-slate-500'
                            }`}
                            title={alt.label}
                          >
                            <Image src={alt.url} alt={alt.label} fill className="object-cover" unoptimized />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Manual URL input fallback */}
                    <input
                      type="url"
                      placeholder="Or paste custom image HTTPS URL..."
                      value={editImage}
                      onChange={(e) => setEditImage(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setReviewVideo(null)}
              >
                Cancel
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={isApproving}
                  onClick={() => handleApproveDraft('draft')}
                >
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={isApproving}
                  isLoading={isApproving}
                  onClick={() => handleApproveDraft('review')}
                >
                  Approve to Editorial Review →
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
