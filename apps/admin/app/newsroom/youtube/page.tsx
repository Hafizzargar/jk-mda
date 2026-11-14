'use client';

import { useState, useEffect, useRef, FormEvent, DragEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import {
  getRecommendedEditorialImage,
  determineDatelineForScope,
  sanitizeDatelineForScope,
  EditorialImageOption,
} from '@/lib/newsroom/ai-synthesizer';
import {
  getCanonicalCategory,
  DISTRICT_GROUPS,
  NEWS_SCOPES,
  NEWS_TOPICS,
} from '@/lib/taxonomy-options';

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
    scope?: 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley' | 'Local News (J&K)' | string;
    district?: string | null;
    division?: string;
    keyFacts?: string[];
    articleBodyMarkdown?: string;
    featured_image_url?: string;
    uncertaintyNotes?: string;
    is_multi_story_bulletin?: boolean;
    stories?: Array<{
      headline: string;
      scope: string;
      category: string;
      summary: string;
      keyFacts?: string[];
    }>;
  } | null;
  youtube_sources?: {
    channel_name: string;
    country: string;
    region: string;
    language: string;
    category: string;
  };
}

const DEFAULT_BEAT_QUOTAS: Record<string, { min: number; max: number; name: string; subtitle: string; priority?: boolean }> = {
  chenab_valley: { min: 3, max: 6, name: 'Chenab Valley', subtitle: 'Doda, Kishtwar, Ramban', priority: true },
  jammu: { min: 2, max: 5, name: 'Jammu Plains', subtitle: 'Jammu, Samba, Kathua' },
  kashmir: { min: 2, max: 5, name: 'Kashmir Valley', subtitle: 'Srinagar & Valley' },
  leh_ladakh: { min: 2, max: 3, name: 'Leh & Ladakh', subtitle: 'Leh, Kargil (UT)' },
  pir_panjal: { min: 2, max: 3, name: 'Pir Panjal', subtitle: 'Poonch, Rajouri' },
  national: { min: 2, max: 5, name: 'National (India)', subtitle: 'Pan-India Policy' },
  international: { min: 4, max: 5, name: 'International', subtitle: 'Global Diplomacy' },
};

export default function YouTubeMonitorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'drafts' | 'channels'>('drafts');
  const [channels, setChannels] = useState<YouTubeSource[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryStats, setDiscoveryStats] = useState<{
    publishedToday?: number;
    discoveredToday: number;
    regionalCount?: number;
    nationalInternationalCount?: number;
    regionalSharePercent?: number;
    dailyTarget: number;
    minDailyTotal?: number;
    maxDailyTotal?: number;
  } | null>(null);
  const [discoveryRegions, setDiscoveryRegions] = useState<Array<{
    id: string;
    name: string;
    shortName: string;
    current: number;
    published?: number;
    min: number;
    max: number;
    deficit: number;
    isMet: boolean;
    isMaxReached: boolean;
    isRegional: boolean;
  }>>([]);
  const [discoveredArticles, setDiscoveredArticles] = useState<Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    category: string;
    district: string | null;
    created_at: string;
    source_name: string | null;
    source_url: string | null;
  }>>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Top Stats & Overview Collapsible State (mostly hidden by default to keep news list front and center)
  const [showStats, setShowStats] = useState(false);

  // Add Channel Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addName, setAddName] = useState('');
  const [addCountry, setAddCountry] = useState('India');
  const [addRegion, setAddRegion] = useState('Jammu & Kashmir');
  const [addLanguage, setAddLanguage] = useState('Hindi / Urdu / English');
  const [addCategory, setAddCategory] = useState('Local News');
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  // Review & Approve Draft Modal State
  const [reviewVideo, setReviewVideo] = useState<YouTubeVideo | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editCategory, setEditCategory] = useState('Politics');
  const [editScope, setEditScope] = useState<'Local News (J&K)' | 'National' | 'International'>('National');
  const [editDistrict, setEditDistrict] = useState('');
  const [editBody, setEditBody] = useState('');
  const [showEditBody, setShowEditBody] = useState(false);
  const [editImage, setEditImage] = useState('');
  const [imageAlternatives, setImageAlternatives] = useState<EditorialImageOption[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadImageError, setUploadImageError] = useState<string | null>(null);
  const [isImageDragging, setIsImageDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Multi-Platform Social Ingestion State (Facebook, Instagram, YouTube)
  const [quickSocialUrl, setQuickSocialUrl] = useState('');
  const [quickSocialText, setQuickSocialText] = useState('');
  const [isQuickIngesting, setIsQuickIngesting] = useState(false);
  const [showQuickIngestBox, setShowQuickIngestBox] = useState(false);

  const [autoPilot, setAutoPilot] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kjin_autopilot_enabled');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const [autoPilotIntervalMinutes, setAutoPilotIntervalMinutes] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kjin_autopilot_interval');
      if (saved && !isNaN(Number(saved))) return Number(saved);
    }
    return 1;
  });
  const [countdown, setCountdown] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kjin_autopilot_interval');
      if (saved && !isNaN(Number(saved))) return Number(saved) * 60;
    }
    return 60;
  });
  const isSyncingRef = useRef(false);
  const isDiscoveringRef = useRef(false);

  // Dynamic Beat Target Quotas State (Min / Max per region)
  const [beatQuotas, setBeatQuotas] = useState<Record<string, { min: number; max: number }>>({
    chenab_valley: { min: 3, max: 6 },
    jammu: { min: 2, max: 5 },
    kashmir: { min: 2, max: 5 },
    leh_ladakh: { min: 2, max: 3 },
    pir_panjal: { min: 2, max: 3 },
    national: { min: 2, max: 5 },
    international: { min: 4, max: 5 },
  });
  const [isQuotasModalOpen, setIsQuotasModalOpen] = useState(false);
  const [isSavingQuotas, setIsSavingQuotas] = useState(false);
  const [editingQuotas, setEditingQuotas] = useState<Record<string, { min: number; max: number }>>({});
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  useEffect(() => {
    loadData();
    // Immediate background auto-discovery & auto-sync on page mount
    handleDiscoverNow(true);
    handleSyncNow(true);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (autoPilot) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // 1. Run autonomous web news discovery (Gemini Grounding across Google News & wires)
            if (!isDiscoveringRef.current) {
              handleDiscoverNow(true);
            }
            // 2. Run YouTube channel surveillance sync
            if (!isSyncingRef.current) {
              handleSyncNow(true);
            }
            return autoPilotIntervalMinutes * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoPilot, autoPilotIntervalMinutes]);

  function formatCountdownTime(totalSeconds: number): string {
    if (totalSeconds >= 3600) {
      const hours = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
    if (totalSeconds >= 60) {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${totalSeconds}s`;
  }

  async function handleUpdateAutoPilotSettings(newInterval: number, newEnabled: boolean) {
    setAutoPilotIntervalMinutes(newInterval);
    setAutoPilot(newEnabled);
    setCountdown(newInterval * 60);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kjin_autopilot_interval', String(newInterval));
      localStorage.setItem('kjin_autopilot_enabled', String(newEnabled));
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      await fetch('/api/newsroom/youtube/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          interval_minutes: newInterval,
          auto_pilot_enabled: newEnabled,
          beat_quotas: beatQuotas,
        }),
      });
      setFeedback({
        text: `Autonomous Radar schedule updated: Running discovery & sync every ${newInterval >= 60 ? `${newInterval / 60} hour(s)` : `${newInterval} minute(s)`} (${newEnabled ? 'Active' : 'Paused'}).`,
        type: 'success',
      });
      // If newly active, trigger immediate discovery run
      if (newEnabled) {
        handleDiscoverNow(true);
      }
    } catch (err) {
      console.error('Failed to save auto-pilot settings:', err);
    }
  }

  async function handleSaveBeatQuotas(newQuotas: Record<string, { min: number; max: number }>) {
    setIsSavingQuotas(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const res = await fetch('/api/newsroom/youtube/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          interval_minutes: autoPilotIntervalMinutes,
          auto_pilot_enabled: autoPilot,
          beat_quotas: newQuotas,
        }),
      });
      if (!res.ok) throw new Error('Failed to save beat quotas.');
      setBeatQuotas(newQuotas);
      setIsQuotasModalOpen(false);
      setFeedback({
        text: '✅ Editorial Beat Target Quotas updated! Radar will discover news according to your new regional limits.',
        type: 'success',
      });
      await loadData();
    } catch (err: any) {
      console.error('Failed to save beat quotas:', err);
      setFeedback({ text: err.message || 'Failed to save beat quotas.', type: 'error' });
    } finally {
      setIsSavingQuotas(false);
    }
  }

  async function handleTestEmail() {
    setIsTestingEmail(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setFeedback({ text: 'Authentication required to test email.', type: 'error' });
        return;
      }
      const res = await fetch('/api/newsroom/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({
          text: `Email alert failed: ${data.error || 'Google rejected credentials. Please update SMTP_PASS with a fresh App Password.'}`,
          type: 'error',
        });
      } else {
        setFeedback({
          text: `✅ ${data.message}`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setFeedback({ text: `Failed to test email: ${err.message}`, type: 'error' });
    } finally {
      setIsTestingEmail(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }
      const token = sessionData.session.access_token;

      const [channelsRes, videosRes, settingsRes, discoveryRes] = await Promise.all([
        fetch('/api/newsroom/youtube/channels', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/newsroom/youtube/videos?limit=40', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/newsroom/youtube/settings', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/newsroom/discovery/run', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (discoveryRes && discoveryRes.ok) {
        const dData = await discoveryRes.json();
        if (dData.stats) {
          setDiscoveryStats(dData.stats);
        }
        if (Array.isArray(dData.regions)) {
          setDiscoveryRegions(dData.regions);
        }
        if (Array.isArray(dData.recentDiscoveries)) {
          setDiscoveredArticles(dData.recentDiscoveries);
        }
      }

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        const mins = sData.interval_minutes !== undefined && !isNaN(Number(sData.interval_minutes))
          ? Number(sData.interval_minutes)
          : 1;
        const enabled = sData.auto_pilot_enabled !== false;
        setAutoPilotIntervalMinutes(mins);
        setAutoPilot(enabled);
        setCountdown(mins * 60);
        if (typeof window !== 'undefined') {
          localStorage.setItem('kjin_autopilot_interval', String(mins));
          localStorage.setItem('kjin_autopilot_enabled', String(enabled));
        }
        if (sData.beat_quotas) {
          setBeatQuotas((prev) => ({ ...prev, ...sData.beat_quotas }));
        }
      }

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

  async function handleSyncNow(silent = false) {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (!silent) {
      setIsSyncing(true);
      setFeedback(null);
    }
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
        if (!silent || (data.newVideosFound && data.newVideosFound > 0)) {
          setFeedback({
            text: `Sync complete! Checked ${data.channelsChecked} channels. Discovered ${data.newVideosFound} new videos (${data.draftsProposed} Gemini drafts generated, ${data.articlesPublished || 0} auto-published).`,
            type: 'success',
          });
        }
        await loadData();
      } else if (!silent) {
        setFeedback({ text: data.error || 'Sync failed.', type: 'error' });
      }
    } catch (err: any) {
      if (!silent) {
        setFeedback({ text: err.message || 'Sync network error.', type: 'error' });
      }
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }

  async function handleDiscoverNow(silent?: boolean | unknown) {
    const isSilent = silent === true;
    if (isDiscoveringRef.current || isDiscovering) return;
    isDiscoveringRef.current = true;
    if (!isSilent) {
      setIsDiscovering(true);
      setFeedback(null);
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const res = await fetch('/api/newsroom/discovery/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success && data.discovered) {
        setFeedback({
          text: `✨ Discovered breaking story: "${data.headline}" (${data.scope} • ${data.beat})! Sent to Pending Approval queue.`,
          type: 'success',
        });
        await loadData();
      } else if (!isSilent) {
        if (data.skipped) {
          setFeedback({ text: `ℹ️ ${data.reason}`, type: 'success' });
        } else {
          setFeedback({ text: data.reason || data.error || 'Discovery cycle finished. No new breaking events detected.', type: 'error' });
        }
      }
    } catch (err: any) {
      if (!isSilent) {
        setFeedback({ text: err.message || 'Discovery network error.', type: 'error' });
      }
    } finally {
      setIsDiscovering(false);
      isDiscoveringRef.current = false;
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
        let synthScope: 'Local News (J&K)' | 'National' | 'International' = 'National';
        const rawScope = (data.draft.scope || '').toLowerCase();
        if (rawScope.includes('international') || rawScope.includes('global') || rawScope.includes('world')) {
          synthScope = 'International';
        } else if (
          rawScope.includes('state') ||
          rawScope.includes('kashmir') ||
          rawScope.includes('jammu') ||
          rawScope.includes('chenab') ||
          rawScope.includes('local')
        ) {
          synthScope = 'Local News (J&K)';
        } else {
          synthScope = 'National';
        }

        const canonical = getCanonicalCategory(data.draft.category, synthScope);
        const topic = (canonical.name === 'National' || canonical.name === 'International') ? 'Politics' : canonical.name;

        setEditHeadline(data.draft.headline);
        setEditSummary(data.draft.summary);
        setEditCategory(topic);
        setEditScope(synthScope);
        setEditDistrict(synthScope === 'Local News (J&K)' ? (data.draft.district || '') : '');
        setEditBody(data.draft.body_markdown);
        setEditImage(data.draft.featured_image_url || '');
        setImageAlternatives(data.draft.alternative_images || []);

        setVideos((prev) =>
          prev.map((v) =>
            v.id === video.id
              ? {
                  ...v,
                  proposed_headline: data.draft.headline,
                  proposed_summary: data.draft.summary,
                  proposed_category: canonical.name,
                  ai_analysis: {
                    ...v.ai_analysis,
                    headline: data.draft.headline,
                    summary: data.draft.summary,
                    category: canonical.name,
                    scope: synthScope,
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

  async function handleQuickSocialIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!quickSocialUrl && !quickSocialText) {
      setFeedback({ text: 'Please enter a Facebook, Instagram, or YouTube URL or paste news text.', type: 'error' });
      return;
    }
    setIsQuickIngesting(true);
    setFeedback(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/newsroom/social/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: quickSocialUrl,
          raw_text: quickSocialText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to synthesize social post.');

      // Open the synthesized draft directly in the review modal!
      const mockVideo: any = {
        id: `social-${Date.now()}`,
        title: data.draft.headline,
        description: data.draft.summary,
        video_url: quickSocialUrl || 'https://kjin.in',
        published_at: new Date().toISOString(),
        processing_status: 'draft_proposed',
        proposed_headline: data.draft.headline,
        proposed_summary: data.draft.summary,
        proposed_category: data.draft.category,
        has_transcript: true,
        ai_analysis: {
          ...data.draft,
          articleBodyMarkdown: data.draft.articleBodyMarkdown,
        },
        youtube_sources: {
          channel_name: `${data.platform.toUpperCase()} Wire`,
          country: 'India',
          region: data.draft.division || 'Jammu & Kashmir',
          category: data.draft.category,
        },
      };

      setVideos((prev) => [mockVideo, ...prev]);
      openReviewModal(mockVideo);
      setQuickSocialUrl('');
      setQuickSocialText('');
      setShowQuickIngestBox(false);
      setFeedback({ text: `✨ Successfully synthesized ${data.platform.toUpperCase()} news draft! Review and approve below.`, type: 'success' });
    } catch (err: any) {
      setFeedback({ text: err.message || 'Error processing social news post.', type: 'error' });
    } finally {
      setIsQuickIngesting(false);
    }
  }

  function openReviewModal(video: YouTubeVideo) {
    setReviewVideo(video);
    setShowEditBody(false);

    // Auto-detect scope (Local News J&K, National, International)
    const rawScope = (video.ai_analysis?.scope as string) || '';
    let scope: 'Local News (J&K)' | 'National' | 'International' = 'National';
    if (
      rawScope === 'International' ||
      rawScope.toLowerCase().includes('international') ||
      rawScope.toLowerCase().includes('global') ||
      video.youtube_sources?.country?.toLowerCase() !== 'india'
    ) {
      scope = 'International';
    } else if (
      rawScope === 'State (Jammu & Kashmir)' ||
      rawScope === 'Chenab Valley' ||
      rawScope.toLowerCase().includes('kashmir') ||
      rawScope.toLowerCase().includes('chenab') ||
      rawScope.toLowerCase().includes('state')
    ) {
      scope = 'Local News (J&K)';
    } else {
      scope = 'National';
    }
    setEditScope(scope);

    // Normalize topic/category to official database taxonomy
    const canonical = getCanonicalCategory(
      video.proposed_category || video.youtube_sources?.category,
      scope
    );
    setEditCategory(canonical.name);

    // District: ONLY preserved if Local J&K, otherwise empty
    setEditDistrict(scope === 'Local News (J&K)' ? (video.ai_analysis?.district?.toLowerCase() || '') : '');

    // Curate clean editorial news image with content-aware topic matching (e.g. Doctor, Forest, Aviation)
    const contextForImage = `${video.proposed_headline || video.title} ${video.proposed_summary || video.description || ''}`;
    const recommended = getRecommendedEditorialImage(scope, canonical.name, contextForImage);
    setImageAlternatives(recommended.alternatives);
    const initialImage = video.ai_analysis?.featured_image_url || recommended.featuredImage || '';
    setEditImage(initialImage);

    // Ensure 100% link-free script without hashtags
    const rawBody = video.ai_analysis?.articleBodyMarkdown || video.description || '';
    const cleanBody = rawBody
      .replace(/#[a-zA-Z0-9_\u0900-\u097F]+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();

    setEditHeadline(video.proposed_headline || video.title);
    const targetDateline = determineDatelineForScope(
      scope === 'Local News (J&K)' ? 'State (Jammu & Kashmir)' : scope,
      `${video.proposed_headline || video.title} ${video.proposed_summary || video.description || ''}`
    );
    const cleanSummary = sanitizeDatelineForScope(
      video.proposed_summary || video.description?.slice(0, 300) || '',
      scope === 'Local News (J&K)' ? 'State (Jammu & Kashmir)' : scope,
      targetDateline
    );
    setEditSummary(cleanSummary);
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

  async function handleManualImageUpload(file: File) {
    setUploadImageError(null);
    if (!file.type.startsWith('image/')) {
      setUploadImageError('Please select a valid image file (JPG, PNG, WebP, AVIF, GIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadImageError('Image file size exceeds the 10 MB limit.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image.');
      }

      if (data.url) {
        setEditImage(data.url);
      }
    } catch (err: unknown) {
      console.error('Manual image upload error:', err);
      setUploadImageError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleApproveDraft(targetStatus: 'review' | 'draft') {
    if (!reviewVideo) return;
    setIsApproving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const isLocal = editScope === 'Local News (J&K)';
      const finalCategory = isLocal
        ? editCategory
        : (editScope === 'International' ? 'International' : 'National');

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
          category: finalCategory,
          topic: editCategory,
          scope: isLocal ? 'State (Jammu & Kashmir)' : editScope,
          district: isLocal ? (editDistrict || null) : null,
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
    <div className="space-y-3.5 sm:space-y-4">
      {/* Top Banner - Compact sm layout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">🌐</span>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Autonomous News Intelligence Radar
            </h1>
            <span className="rounded-full bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 text-[10px] sm:text-xs font-bold px-2 py-0.5 border border-purple-200 dark:border-purple-500/30">
              Multi-Source Intelligence
            </span>
            <span className="rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 text-[10px] sm:text-xs font-bold px-2 py-0.5 border border-cyan-200 dark:border-cyan-800">
              Zero Channels Needed
            </span>
            <button
              type="button"
              onClick={() => handleUpdateAutoPilotSettings(autoPilotIntervalMinutes, !autoPilot)}
              className={`rounded-full text-[10px] sm:text-xs font-bold px-2.5 py-0.5 border flex items-center gap-1.5 transition ${
                autoPilot
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 hover:bg-emerald-200'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 hover:bg-amber-200'
              }`}
              title="Click to toggle automatic background news discovery"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${autoPilot ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              {autoPilot ? `Autonomous Radar: Active (${formatCountdownTime(countdown)})` : 'Autonomous Radar: Paused'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Frequency Control Selector */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-1.5 text-xs shadow-xs">
            <label htmlFor="radar-schedule-select" className="text-slate-700 dark:text-slate-200 font-bold text-xs whitespace-nowrap flex items-center gap-1 cursor-pointer">
              <span>⏱️</span>
              <span>Schedule:</span>
            </label>
            <select
              id="radar-schedule-select"
              value={autoPilotIntervalMinutes}
              onChange={(e) => handleUpdateAutoPilotSettings(Number(e.target.value), autoPilot)}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs px-2.5 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-purple-500 [color-scheme:light] dark:[color-scheme:dark]"
              title="Select how often autonomous discovery runs"
            >
              <option value={1} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 1 Min (Rapid Realtime)</option>
              <option value={2} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 2 Min (Ultra Fast)</option>
              <option value={3} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 3 Min (Fast Track)</option>
              <option value={4} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 4 Min</option>
              <option value={5} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 5 Min (Quick)</option>
              <option value={7} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 7 Min</option>
              <option value={10} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 10 Min</option>
              <option value={15} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 15 Min</option>
              <option value={20} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 20 Min</option>
              <option value={30} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 30 Min</option>
              <option value={45} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 45 Min</option>
              <option value={60} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 1 Hour (Standard)</option>
              <option value={120} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 2 Hours</option>
              <option value={360} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white font-semibold">Every 6 Hours</option>
            </select>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            icon="🔍"
            disabled={isDiscovering}
            isLoading={isDiscovering}
            onClick={() => handleDiscoverNow(false)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs cursor-pointer"
            title="Trigger real-time multi-source news discovery across all beats right now"
          >
            {isDiscovering ? 'Discovering News...' : 'Discover News Now'}
          </Button>

          <Link
            href="/articles?status=review"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition shadow-2xs"
          >
            <span>⏳</span>
            <span>Pending Approval</span>
          </Link>

          <button
            type="button"
            onClick={handleTestEmail}
            disabled={isTestingEmail}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Send a test editorial verification alert to your email"
          >
            <span>{isTestingEmail ? '⏳' : '📧'}</span>
            <span>{isTestingEmail ? 'Sending...' : 'Test Email Alert'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium flex items-center justify-between ${
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

      {/* KJIN Autonomous News Discovery Radar */}
      <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white dark:from-purple-950/20 dark:via-slate-900 dark:to-slate-900 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 text-[11px] font-bold border border-purple-200 dark:border-purple-800">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse" />
                Autonomous News Intelligence Engine
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Gemini 2.5 + Google Search Grounding
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                ~65% Regional Ground Priority
              </span>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40">
                100% Pending Approval (0 Auto-Publish)
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingQuotas({ ...beatQuotas });
                  setIsQuotasModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition cursor-pointer ml-auto"
                title="Click to adjust min and max story targets for each region"
              >
                <span>🎯</span>
                <span>Adjust Beat Quotas (Min / Max)</span>
              </button>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-md font-semibold border border-emerald-200 dark:border-emerald-800/40">
                📰 Today Published News: <strong className="text-emerald-900 dark:text-emerald-200 ml-0.5">{discoveryStats?.publishedToday ?? 0}</strong> stories
              </span>
              <span>•</span>
              <span>🎯 Discovered / Target: <strong>{discoveryStats?.discoveredToday ?? 0} / {discoveryStats?.dailyTarget ?? 25}</strong> stories (Range: {discoveryStats?.minDailyTotal ?? 17}–{discoveryStats?.maxDailyTotal ?? 32})</span>
              <span>•</span>
              <span>⏱️ Cadence: <strong>Every {autoPilotIntervalMinutes >= 60 ? `${autoPilotIntervalMinutes / 60} hr${autoPilotIntervalMinutes > 60 ? 's' : ''}` : `${autoPilotIntervalMinutes} min${autoPilotIntervalMinutes > 1 ? 's' : ''}`}</strong></span>
              <span>•</span>
              <span>⛰️ Regional Coverage: <strong>{discoveryStats?.regionalCount ?? 0} stories ({discoveryStats?.regionalSharePercent ?? 65}% of minimum)</strong></span>
            </div>
          </div>
        </div>

        {/* 7 Regional Editorial Distribution Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1 border-t border-purple-100 dark:border-purple-900/30">
          {Object.entries(DEFAULT_BEAT_QUOTAS).map(([beatId, base]) => {
            const live = discoveryRegions.find((r) => r.id === beatId);
            const current = live?.current ?? 0;
            const published = live?.published ?? 0;
            const quota = beatQuotas[beatId] || { min: base.min, max: base.max };
            const minVal = quota?.min ?? live?.min ?? base.min;
            const maxVal = quota?.max ?? live?.max ?? base.max;
            const isMet = current >= minVal;
            const isMax = current >= maxVal;

            return (
              <div
                key={beatId}
                onClick={() => {
                  setEditingQuotas({ ...beatQuotas });
                  setIsQuotasModalOpen(true);
                }}
                className={`p-2 rounded-xl border text-xs transition flex flex-col justify-between cursor-pointer hover:shadow-sm ${
                  base.priority
                    ? 'border-cyan-300 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/20 hover:border-cyan-400'
                    : isMet
                    ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10 hover:border-emerald-300'
                    : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300'
                }`}
                title={`Click to adjust Min/Max targets for ${base.name} (Current: ${minVal}–${maxVal})`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-[11px] truncate text-slate-800 dark:text-slate-200" title={base.name}>
                    {base.name}
                  </span>
                  {base.priority ? (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-200 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-300 font-extrabold uppercase">
                      Top
                    </span>
                  ) : published > 0 ? (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold">
                      {published} Live
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {current}
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 ml-0.5 inline-flex items-center gap-0.5">
                      / {minVal}–{maxVal} <span className="opacity-60 text-[9px]">✏️</span>
                    </span>
                  </span>
                  <span className={`text-[10px] font-bold ${isMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {published > 0 ? `${published} published` : isMax ? 'Maxed' : isMet ? '✓ Met' : `${minVal - current} needed`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  <span className="truncate" title={base.subtitle}>{base.subtitle}</span>
                  {published > 0 && <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">({published} pub)</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Discovered Stories Queue from Autonomous Intelligence */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🛰️</span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Autonomous Discovered Stories Queue ({discoveredArticles.length})
            </h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              • Researched independently across Google News, local newspapers, PIB & disaster portals
            </span>
          </div>
          <Link
            href="/articles?status=review"
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
          >
            <span>Review Full Pending Queue ({discoveredArticles.length})</span>
            <span>→</span>
          </Link>
        </div>

        {discoveredArticles.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            <span className="text-2xl block mb-2">🔍</span>
            <p className="font-semibold text-slate-700 dark:text-slate-300">No autonomous stories in queue yet today.</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Click &quot;Discover News Now&quot; above to trigger an immediate multi-source research cycle across the internet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {discoveredArticles.map((art) => (
              <div
                key={art.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-800 transition bg-slate-50/50 dark:bg-slate-950/40"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] gap-2">
                    <span className="font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
                      {art.category}
                    </span>
                    {art.district && (
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        📍 {art.district}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/articles/${art.id}`}
                    className="font-bold text-xs text-slate-900 dark:text-slate-100 hover:text-purple-600 dark:hover:text-purple-300 line-clamp-2 leading-snug"
                  >
                    {art.title}
                  </Link>
                </div>

                <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                  <div className="truncate max-w-[160px] text-slate-500 dark:text-slate-400">
                    {art.source_url ? (
                      <a
                        href={art.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-indigo-600 dark:text-indigo-400 font-medium"
                        title={art.source_name || art.source_url}
                      >
                        🌐 {art.source_name || 'Source Link'} ↗
                      </a>
                    ) : (
                      <span>{art.source_name || 'Web Intelligence'}</span>
                    )}
                  </div>
                  <Link
                    href={`/articles/${art.id}/edit`}
                    className="px-2.5 py-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] transition shrink-0"
                  >
                    Review &amp; Publish →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4 Metric Cards - Collapsible / Mostly Hidden */}
      {!showStats ? (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs text-xs">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
              <strong className="text-slate-900 dark:text-white font-bold">{channels.length}</strong> Sources
              <span className="text-[11px] text-slate-400">({activeChannelsCount} active)</span>
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="flex items-center gap-1.5">
              <strong className="text-slate-900 dark:text-white font-bold">{videos.length}</strong> Ingested
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <strong>{pendingDraftsCount}</strong> Awaiting Approval
            </span>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">·</span>
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
              0 * * * * (Hourly Sync)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowStats(true)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 shrink-0 transition"
          >
            <span>Expand Stats</span>
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Monitored Sources
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {channels.length}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {activeChannelsCount} active surveillance channels
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                Discovered Videos
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {videos.length}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Ingested & deduplicated by ID
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Proposed Gemini Drafts
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {pendingDraftsCount}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Awaiting editorial approval
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Railway Schedule
              </p>
              <p className="mt-1 text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                0 * * * *
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Hourly background worker
              </p>
            </div>
          </div>
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => setShowStats(false)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <span>Hide Stats</span>
              <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Omni-Channel Quick Social Ingestion Bar (Facebook · Instagram · YouTube) - Compact sm */}
      <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/20 via-slate-900/40 to-purple-950/20 p-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-sm">
              📡
            </span>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Multi-Platform Social Surveillance</span>
                <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan-400">
                  FB · Insta · YT
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Paste any Facebook post, Instagram Reel, or YouTube link to formulate a verified 80/10/10 news draft in seconds.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowQuickIngestBox(!showQuickIngestBox)}
            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow transition shrink-0"
          >
            {showQuickIngestBox ? '✕ Close Quick Ingest' : '+ Ingest FB / Insta / YT News'}
          </button>
        </div>

        {showQuickIngestBox && (
          <form onSubmit={handleQuickSocialIngest} className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Social Post URL (Facebook Page / Instagram Reel / YouTube Video)
                </label>
                <input
                  type="url"
                  placeholder="e.g. https://www.facebook.com/... or https://www.instagram.com/reel/..."
                  value={quickSocialUrl}
                  onChange={(e) => setQuickSocialUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                />
              </div>
              <div className="sm:col-span-4 flex items-end">
                <button
                  type="submit"
                  disabled={isQuickIngesting}
                  className="w-full h-[38px] rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isQuickIngesting ? '⏳ Synthesizing with Gemini...' : '✨ Synthesize News Draft'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Optional: Raw Post Caption / Text (If post is text-only or behind login)
              </label>
              <textarea
                rows={2}
                placeholder="Paste the caption, press release, or bulletin text here..."
                value={quickSocialText}
                onChange={(e) => setQuickSocialText(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500"
              />
            </div>
          </form>
        )}
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
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-900 dark:text-white font-medium outline-none [color-scheme:light] dark:[color-scheme:dark]"
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
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-900 dark:text-white font-medium outline-none [color-scheme:light] dark:[color-scheme:dark]"
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

                      {/* KJIN Synthesized Original Story (From Scratch by Gemini) */}
                      {video.proposed_headline && (
                        <div className="mt-2 rounded-xl bg-purple-950/20 border border-purple-500/30 p-3 text-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5 font-bold text-purple-700 dark:text-purple-300">
                            <span className="flex items-center gap-1.5">
                              <span>🤖</span>
                              <span>Synthesized by Gemini 2.5 Flash (100% Original English)</span>
                            </span>
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-200 dark:border-purple-800 font-bold">
                              Zero Copyright
                            </span>
                          </div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            {video.proposed_headline}
                          </p>
                          {video.proposed_summary && (
                            <p className="text-slate-600 dark:text-slate-300 text-xs line-clamp-2">
                              {video.proposed_summary}
                            </p>
                          )}

                          {/* Multi-story news bulletin breakdown */}
                          {video.ai_analysis?.is_multi_story_bulletin && Array.isArray(video.ai_analysis.stories) && video.ai_analysis.stories.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-purple-500/20 space-y-1.5">
                              <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                                <span>📺</span>
                                <span>Multi-Story Bulletin ({video.ai_analysis.stories.length} Distinct Stories Extracted from Subtitles):</span>
                              </div>
                              <div className="space-y-1.5 pl-1">
                                {video.ai_analysis.stories.map((st, i) => (
                                  <div key={i} className="flex items-start gap-1.5 text-[11px] bg-slate-900/40 p-1.5 rounded-lg border border-purple-500/20">
                                    <span className="font-bold text-amber-500 shrink-0">{i + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-slate-200">{st.headline}</span>
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-200 border border-purple-700/50 uppercase font-bold">{st.scope}</span>
                                      </div>
                                      {st.summary && (
                                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{st.summary}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
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
                    Default News Category
                  </label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                  >
                    <option value="Local News">Local News</option>
                    <option value="Politics">Politics</option>
                    <option value="National">National</option>
                    <option value="International">International</option>
                    <option value="Economy">Economy</option>
                    <option value="Investigation">Investigation</option>
                    <option value="Problems">Problems</option>
                    <option value="Culture">Culture</option>
                    <option value="Sports">Sports</option>
                    <option value="Education">Education</option>
                    <option value="Opinion">Opinion</option>
                    <option value="General">General</option>
                  </select>
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
              {/* 2-Way Distribution: Scope (Tier 1) + Topic (Tier 2) + Optional J&K District (Tier 3) */}
              <div className={`grid grid-cols-1 ${editScope === 'Local News (J&K)' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                {/* 1st Dropdown: Coverage Scope */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Coverage Scope
                  </label>
                  <select
                    value={editScope}
                    onChange={(e: any) => {
                      const newScope = e.target.value as 'Local News (J&K)' | 'National' | 'International';
                      setEditScope(newScope);
                      if (newScope !== 'Local News (J&K)') {
                        setEditDistrict('');
                      }
                      const defaultCat = newScope === 'International' ? 'International' : newScope === 'National' ? 'National' : 'Local News';
                      setEditCategory(defaultCat);
                      const rec = getRecommendedEditorialImage(newScope, defaultCat);
                      setImageAlternatives(rec.alternatives);
                      if (!editImage || editImage === reviewVideo?.thumbnail_url) {
                        setEditImage(rec.featuredImage || '');
                      }
                      if (editSummary) {
                        const targetDateline = determineDatelineForScope(
                          newScope === 'Local News (J&K)' ? 'State (Jammu & Kashmir)' : newScope,
                          `${editHeadline} ${editSummary}`
                        );
                        setEditSummary(sanitizeDatelineForScope(
                          editSummary,
                          newScope === 'Local News (J&K)' ? 'State (Jammu & Kashmir)' : newScope,
                          targetDateline
                        ));
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-cyan-500 font-medium"
                  >
                    <option value="Local News (J&K)">🏔️ Local News (Jammu &amp; Kashmir)</option>
                    <option value="National">🇮🇳 National News (India)</option>
                    <option value="International">🌍 International News (World)</option>
                  </select>
                </div>

                {/* 2nd Dropdown: News Topic / Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    News Topic / Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => {
                      const nextTopic = e.target.value;
                      setEditCategory(nextTopic);
                      const rec = getRecommendedEditorialImage(editScope, nextTopic);
                      setImageAlternatives(rec.alternatives);
                      if (!editImage || editImage === reviewVideo.thumbnail_url) {
                        setEditImage(rec.featuredImage || '');
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-cyan-500 font-medium"
                  >
                    {NEWS_TOPICS.map((topic) => (
                      <option key={topic.value} value={topic.value}>
                        {topic.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3rd Dropdown: J&K District (ONLY visible if Local J&K) */}
                {editScope === 'Local News (J&K)' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      J&amp;K District
                    </label>
                    <select
                      value={editDistrict}
                      onChange={(e) => setEditDistrict(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-cyan-500 font-medium"
                    >
                      <option value="">All J&amp;K / State-wide (No specific district)</option>
                      {DISTRICT_GROUPS.map((group) => (
                        <optgroup key={group.region} label={group.region}>
                          {group.districts.map((d) => (
                            <option key={d.slug} value={d.slug}>
                              {d.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                )}
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

              {/* Full Article Body Script (Hidden by default) */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowEditBody(!showEditBody)}
                  className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
                >
                  <span className="flex items-center gap-2">
                    <span>📝 Full Article Body Script</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (Optional · Click to {showEditBody ? 'hide' : 'view / edit'})
                    </span>
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {showEditBody ? '▲ Hide' : '▼ Show'}
                  </span>
                </button>

                {showEditBody && (
                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1 bg-white dark:bg-slate-950">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        Markdown · Zero external links · No hashtags
                      </span>
                    </div>
                    <textarea
                      rows={7}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="mt-1 w-full font-mono text-xs rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-3 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                )}
              </div>

              {/* Featured Article Image Selection */}
              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Featured Article Image
                    </label>
                    {!editImage ? (
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                        📄 Text-Only Mode (No Image)
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                        ✓ Image Attached
                      </span>
                    )}
                  </div>
                  {editImage ? (
                    <button
                      type="button"
                      onClick={() => setEditImage('')}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-medium hover:underline flex items-center gap-1"
                      title="Clear image and publish article as text only"
                    >
                      <span>✕</span> Remove Image
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Optional &bull; No image required
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  {/* Current Image Preview & Drag/Drop Zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setIsImageDragging(true);
                    }}
                    onDragLeave={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setIsImageDragging(false);
                    }}
                    onDrop={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setIsImageDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleManualImageUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`relative w-40 h-28 rounded-xl overflow-hidden bg-slate-950 border shrink-0 shadow-md cursor-pointer group transition ${
                      isImageDragging
                        ? 'border-emerald-400 ring-2 ring-emerald-400 scale-[1.02]'
                        : !editImage
                          ? 'border-dashed border-slate-700 hover:border-slate-500'
                          : 'border-slate-700 hover:border-emerald-500'
                    }`}
                    title="Click or drop a file to upload an image from your computer"
                  >
                    {editImage ? (
                      <Image
                        src={editImage}
                        alt="Featured preview"
                        fill
                        className="object-cover group-hover:opacity-85 transition"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-xs text-slate-400 p-2 text-center bg-slate-900/90">
                        <span className="text-xl mb-0.5">📄</span>
                        <span className="font-bold text-[11px] text-slate-300">No Image</span>
                        <span className="text-[9.5px] text-cyan-400 mt-0.5 font-medium">Text-Only Dispatch</span>
                      </div>
                    )}

                    {/* Hover upload overlay */}
                    <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[11px] font-semibold gap-1 z-10 p-2 text-center">
                      <span>💻 Click to Upload</span>
                      <span className="text-[9.5px] text-slate-300 font-normal">or drop file from computer</span>
                    </div>

                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center gap-1.5 z-20">
                        <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] text-emerald-300 font-bold">Uploading from system...</span>
                      </div>
                    )}

                    {editImage && !isUploadingImage ? (
                      editImage.includes('/article-images/') || editImage.includes('supabase.co/storage') ? (
                        <span className="absolute bottom-1 right-1 rounded bg-emerald-600/95 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs z-10">
                          Uploaded Custom
                        </span>
                      ) : editImage === reviewVideo.thumbnail_url ? (
                        <span className="absolute bottom-1 right-1 rounded bg-amber-600/90 px-1 py-0.5 text-[9px] font-semibold text-white z-10">
                          YouTube Thumbnail
                        </span>
                      ) : (
                        <span className="absolute bottom-1 right-1 rounded bg-cyan-600/90 px-1 py-0.5 text-[9px] font-semibold text-white z-10">
                          Clean Editorial
                        </span>
                      )
                    ) : !editImage && !isUploadingImage ? (
                      <span className="absolute bottom-1 right-1 rounded bg-slate-800/90 border border-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 z-10">
                        No Image
                      </span>
                    ) : null}
                  </div>

                  {/* Image Options */}
                  <div className="flex-1 space-y-2 text-xs w-full">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleManualImageUpload(e.target.files[0]);
                        }
                      }}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Manual Upload Button */}
                      <button
                        type="button"
                        disabled={isUploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                          isUploadingImage
                            ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 animate-pulse cursor-wait'
                            : 'border-emerald-500/80 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-400 ring-1 ring-emerald-500/30'
                        }`}
                        title="Upload JPG, PNG, WebP or AVIF image from your system"
                      >
                        {isUploadingImage ? (
                          <>
                            <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span>Upload from Computer</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const recommended = getRecommendedEditorialImage(editScope, editCategory);
                          setEditImage(recommended.featuredImage || '');
                        }}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                          editImage && editImage !== reviewVideo.thumbnail_url && !editImage.includes('/article-images/') && !editImage.includes('supabase.co/storage')
                            ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 font-bold'
                            : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
                      >
                        📸 Clean Editorial Photo
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditImage(reviewVideo.thumbnail_url)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                          editImage === reviewVideo.thumbnail_url
                            ? 'border-amber-500 bg-amber-950/40 text-amber-300 font-bold'
                            : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
                      >
                        📺 YouTube Thumbnail
                      </button>

                      {/* No Image / Text Only Option */}
                      <button
                        type="button"
                        onClick={() => setEditImage('')}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1 ${
                          !editImage
                            ? 'border-rose-500 bg-rose-950/60 text-rose-300 font-bold ring-1 ring-rose-500/40 shadow-xs'
                            : 'border-slate-700 text-slate-400 hover:text-rose-300 hover:bg-slate-800/40'
                        }`}
                        title="Publish article without any photo as a text-only report"
                      >
                        <span>🚫</span>
                        <span>No Image (Text Only)</span>
                      </button>
                    </div>

                    {uploadImageError && (
                      <p className="text-[11px] text-rose-400 bg-rose-950/30 border border-rose-800/50 rounded-lg px-2.5 py-1 font-medium">
                        ⚠️ {uploadImageError}
                      </p>
                    )}

                    {/* Alternative Editorial Photos Gallery */}
                    {imageAlternatives.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto py-1">
                        <span className="text-[10px] text-slate-400 shrink-0 font-semibold">Presets:</span>
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
                      placeholder={!editImage ? "No image assigned (publishing as text only). Or paste image URL to attach..." : "Or paste custom image HTTPS URL directly..."}
                      value={editImage}
                      onChange={(e) => setEditImage(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 p-2 text-slate-900 dark:text-white text-xs outline-none focus:border-cyan-500 placeholder-slate-500"
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

      {/* Editorial Beat Quotas Configuration Modal */}
      {isQuotasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🎯</span>
                  <span>Adjust Editorial Beat Target Quotas</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Control the minimum needed and maximum daily ceiling of news discoveries for each region. Example: increase Chenab Valley max from 6 to 20 to prioritize more stories from Doda, Kishtwar, and Ramban.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuotasModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {Object.entries(DEFAULT_BEAT_QUOTAS).map(([beatId, base]) => {
                const currentMin = editingQuotas[beatId]?.min ?? base.min;
                const currentMax = editingQuotas[beatId]?.max ?? base.max;

                return (
                  <div
                    key={beatId}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{base.name}</span>
                        {base.priority && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-300 font-bold">
                            Top Priority
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{base.subtitle}</span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Min:</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={currentMin}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setEditingQuotas((prev) => ({
                              ...prev,
                              [beatId]: { min: val, max: Math.max(val, prev[beatId]?.max ?? base.max) },
                            }));
                          }}
                          className="w-16 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-center font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Max:</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={currentMax}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value));
                            setEditingQuotas((prev) => ({
                              ...prev,
                              [beatId]: { min: Math.min(val, prev[beatId]?.min ?? base.min), max: val },
                            }));
                          }}
                          className="w-16 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-center font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const defaults: Record<string, { min: number; max: number }> = {};
                  Object.entries(DEFAULT_BEAT_QUOTAS).forEach(([k, v]) => {
                    defaults[k] = { min: v.min, max: v.max };
                  });
                  setEditingQuotas(defaults);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Reset to Standard Defaults
              </button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsQuotasModalOpen(false)}
                  disabled={isSavingQuotas}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isSavingQuotas}
                  disabled={isSavingQuotas}
                  onClick={() => handleSaveBeatQuotas(editingQuotas)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                >
                  Save Beat Quotas
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
