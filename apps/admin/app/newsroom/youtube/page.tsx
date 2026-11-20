'use client';

export const dynamic = 'force-dynamic';

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

export interface AutonomousScanLog {
  id: string;
  timestamp: string;
  status: 'generated' | 'skipped' | 'cooldown' | 'error';
  beat?: string;
  district?: string;
  headline?: string;
  reason: string;
  ageHours?: number | null;
  articleId?: string;
  sourceUrl?: string;
}

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

export interface DistrictQuotaConfig {
  min: number;
  max: number;
  priority?: 'high' | 'normal' | 'low';
}

export interface BeatQuotaConfig {
  min: number;
  max: number;
  districts?: Record<string, DistrictQuotaConfig>;
}

export interface BeatDefinition {
  min: number;
  max: number;
  name: string;
  subtitle: string;
  priority?: boolean;
  districts?: Record<string, { min: number; max: number; name: string; priority: 'high' | 'normal' | 'low' }>;
}

const DEFAULT_BEAT_QUOTAS: Record<string, BeatDefinition> = {
  chenab_valley: {
    min: 3,
    max: 6,
    name: 'Chenab Valley',
    subtitle: 'Doda, Kishtwar, Ramban',
    priority: true,
    districts: {
      doda: { min: 1, max: 2, name: 'Doda', priority: 'high' },
      kishtwar: { min: 1, max: 2, name: 'Kishtwar', priority: 'high' },
      ramban: { min: 1, max: 2, name: 'Ramban', priority: 'normal' },
    },
  },
  jammu: {
    min: 2,
    max: 5,
    name: 'Jammu Plains',
    subtitle: 'Jammu, Samba, Kathua',
    districts: {
      jammu: { min: 1, max: 2, name: 'Jammu', priority: 'high' },
      samba: { min: 0, max: 1, name: 'Samba', priority: 'normal' },
      kathua: { min: 0, max: 1, name: 'Kathua', priority: 'normal' },
      udhampur: { min: 0, max: 1, name: 'Udhampur', priority: 'normal' },
      reasi: { min: 0, max: 1, name: 'Reasi', priority: 'normal' },
    },
  },
  kashmir: {
    min: 2,
    max: 5,
    name: 'Kashmir Valley',
    subtitle: 'Srinagar & Valley',
    districts: {
      srinagar: { min: 1, max: 2, name: 'Srinagar', priority: 'high' },
      anantnag: { min: 0, max: 1, name: 'Anantnag', priority: 'normal' },
      baramulla: { min: 0, max: 1, name: 'Baramulla', priority: 'normal' },
      pulwama: { min: 0, max: 1, name: 'Pulwama', priority: 'normal' },
      kupwara: { min: 0, max: 1, name: 'Kupwara', priority: 'normal' },
      budgam: { min: 0, max: 1, name: 'Budgam', priority: 'normal' },
      ganderbal: { min: 0, max: 1, name: 'Ganderbal', priority: 'normal' },
      kulgam: { min: 0, max: 1, name: 'Kulgam', priority: 'normal' },
      bandipora: { min: 0, max: 1, name: 'Bandipora', priority: 'normal' },
      shopian: { min: 0, max: 1, name: 'Shopian', priority: 'normal' },
    },
  },
  leh_ladakh: {
    min: 2,
    max: 3,
    name: 'Leh & Ladakh',
    subtitle: 'Leh, Kargil (UT)',
    districts: {
      leh: { min: 1, max: 2, name: 'Leh', priority: 'normal' },
      kargil: { min: 1, max: 2, name: 'Kargil', priority: 'normal' },
    },
  },
  pir_panjal: {
    min: 2,
    max: 3,
    name: 'Pir Panjal',
    subtitle: 'Poonch, Rajouri',
    districts: {
      poonch: { min: 1, max: 2, name: 'Poonch', priority: 'normal' },
      rajouri: { min: 1, max: 2, name: 'Rajouri', priority: 'normal' },
    },
  },
  national: { min: 2, max: 5, name: 'National (India)', subtitle: 'Pan-India Policy' },
  international: { min: 4, max: 5, name: 'International', subtitle: 'Global Diplomacy' },
};

export default function YouTubeMonitorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'radar' | 'drafts' | 'channels' | 'approved'>('radar');
  const [draftSubFilter, setDraftSubFilter] = useState<'pending' | 'fresh' | 'approved' | 'all'>('pending');
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
    districts?: Array<{
      id: string;
      name: string;
      current: number;
      published?: number;
      min: number;
      max: number;
      priority: 'high' | 'normal' | 'low';
      deficit: number;
      isMet: boolean;
      isMaxReached: boolean;
    }>;
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
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(false);
  const [autoPublishDelayMinutes, setAutoPublishDelayMinutes] = useState(5);
  const [isApprovalGuideOpen, setIsApprovalGuideOpen] = useState(false);
  const [publishingArticleId, setPublishingArticleId] = useState<string | null>(null);
  const [scheduledQueue, setScheduledQueue] = useState<Array<{
    articleId: string;
    headline: string;
    category: string;
    district?: string | null;
    scope?: string;
    scheduledFor: string;
    createdAt: string;
    status: 'pending' | 'published' | 'cancelled';
    publishedAt?: string;
  }>>([]);
  const [isTogglingAutoPublish, setIsTogglingAutoPublish] = useState(false);
  const [civicProblems, setCivicProblems] = useState<{
    currentToday: number;
    maxDaily: number;
    lastProblemAt: string | null;
    canDiscoverNow: boolean;
    hoursSinceLastProblem: number | null;
    hoursUntilNextAllowed: number;
  } | null>(null);
  const [isDiscoveringCivic, setIsDiscoveringCivic] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
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
    return 3;
  });
  const [countdown, setCountdown] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedNext = localStorage.getItem('kjin_autopilot_next_scan_timestamp');
      if (savedNext && !isNaN(Number(savedNext))) {
        const diff = Math.ceil((Number(savedNext) - Date.now()) / 1000);
        if (diff > 0) return diff;
      }
      const saved = localStorage.getItem('kjin_autopilot_interval');
      if (saved && !isNaN(Number(saved))) return Number(saved) * 60;
    }
    return 180;
  });
  const isSyncingRef = useRef(false);
  const isDiscoveringRef = useRef(false);
  const nextScanTimestampRef = useRef<number>(
    typeof window !== 'undefined' && localStorage.getItem('kjin_autopilot_next_scan_timestamp')
      ? Number(localStorage.getItem('kjin_autopilot_next_scan_timestamp')) || 0
      : 0
  );

  // Dynamic Beat & District Target Quotas State (Min / Max per region and per district)
  const [beatQuotas, setBeatQuotas] = useState<Record<string, BeatQuotaConfig>>({
    chenab_valley: {
      min: 3,
      max: 6,
      districts: {
        doda: { min: 1, max: 2, priority: 'high' },
        kishtwar: { min: 1, max: 2, priority: 'high' },
        ramban: { min: 1, max: 2, priority: 'normal' },
      },
    },
    jammu: {
      min: 2,
      max: 5,
      districts: {
        jammu: { min: 1, max: 2, priority: 'high' },
        samba: { min: 0, max: 1, priority: 'normal' },
        kathua: { min: 0, max: 1, priority: 'normal' },
        udhampur: { min: 0, max: 1, priority: 'normal' },
        reasi: { min: 0, max: 1, priority: 'normal' },
      },
    },
    kashmir: {
      min: 2,
      max: 5,
      districts: {
        srinagar: { min: 1, max: 2, priority: 'high' },
        anantnag: { min: 0, max: 1, priority: 'normal' },
        baramulla: { min: 0, max: 1, priority: 'normal' },
        pulwama: { min: 0, max: 1, priority: 'normal' },
        kupwara: { min: 0, max: 1, priority: 'normal' },
        budgam: { min: 0, max: 1, priority: 'normal' },
        ganderbal: { min: 0, max: 1, priority: 'normal' },
        kulgam: { min: 0, max: 1, priority: 'normal' },
        bandipora: { min: 0, max: 1, priority: 'normal' },
        shopian: { min: 0, max: 1, priority: 'normal' },
      },
    },
    leh_ladakh: {
      min: 2,
      max: 3,
      districts: {
        leh: { min: 1, max: 2, priority: 'normal' },
        kargil: { min: 1, max: 2, priority: 'normal' },
      },
    },
    pir_panjal: {
      min: 2,
      max: 3,
      districts: {
        poonch: { min: 1, max: 2, priority: 'normal' },
        rajouri: { min: 1, max: 2, priority: 'normal' },
      },
    },
    national: { min: 2, max: 5 },
    international: { min: 4, max: 5 },
  });
  const [isQuotasModalOpen, setIsQuotasModalOpen] = useState(false);
  const [isSavingQuotas, setIsSavingQuotas] = useState(false);
  const [editingQuotas, setEditingQuotas] = useState<Record<string, BeatQuotaConfig>>({});
  const [civicMaxDaily, setCivicMaxDaily] = useState<number>(2);
  const [civicIntervalHours, setCivicIntervalHours] = useState<number>(6);
  const [isCivicModalOpen, setIsCivicModalOpen] = useState(false);
  const [isSavingCivicSettings, setIsSavingCivicSettings] = useState(false);
  const [expandedBeatDistricts, setExpandedBeatDistricts] = useState<Record<string, boolean>>({
    chenab_valley: true,
  });
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [scanLogs, setScanLogs] = useState<AutonomousScanLog[]>([]);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  function formatScanTimestamp(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  }

  function formatScanRelativeTime(iso: string): string {
    try {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 45) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      return `${diffHours}h ago`;
    } catch {
      return '';
    }
  }

  async function handleRefreshScanLogs() {
    setIsRefreshingLogs(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const res = await fetch('/api/newsroom/discovery/run', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.scanLogs)) {
          setScanLogs(data.scanLogs.slice(0, 10));
        }
      }
    } catch (err) {
      console.error('Error refreshing scan logs:', err);
    } finally {
      setIsRefreshingLogs(false);
    }
  }

  async function handleClearScanLogs() {
    setIsClearingLogs(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const res = await fetch('/api/newsroom/discovery/run', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      if (res.ok) {
        setScanLogs([]);
        setFeedback({ text: 'Scan diagnostic log cleared.', type: 'success' });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Failed to clear scan logs.', type: 'error' });
    } finally {
      setIsClearingLogs(false);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'drafts' || tabParam === 'channels' || tabParam === 'radar' || tabParam === 'approved') {
        setActiveTab(tabParam);
      } else {
        const savedTab = localStorage.getItem('kjin_newsroom_active_tab');
        if (savedTab === 'drafts' || savedTab === 'channels' || savedTab === 'radar' || savedTab === 'approved') {
          setActiveTab(savedTab as any);
        }
      }
    }
  }, []);

  const handleTabChange = (tab: 'radar' | 'drafts' | 'channels' | 'approved') => {
    setActiveTab(tab);
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kjin_newsroom_active_tab', tab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    loadData();
    // Do not trigger immediate discovery on mount; let the server-driven schedule and timer tick down smoothly without resetting on page refresh
  }, []);

  useEffect(() => {
    // If nextScanTimestamp is not initialized or expired, check localStorage then fallback
    const now = Date.now();
    if (!nextScanTimestampRef.current || nextScanTimestampRef.current <= now) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('kjin_autopilot_next_scan_timestamp') : null;
      if (saved && !isNaN(Number(saved)) && Number(saved) > now) {
        nextScanTimestampRef.current = Number(saved);
      } else {
        nextScanTimestampRef.current = now + autoPilotIntervalMinutes * 60 * 1000;
        if (typeof window !== 'undefined') {
          localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(nextScanTimestampRef.current));
        }
      }
    }

    const ticker = setInterval(() => {
      const current = Date.now();
      setNowTimestamp(current);

      if (autoPilot) {
        if (!nextScanTimestampRef.current || nextScanTimestampRef.current <= current) {
          // Time to trigger autonomous scan
          if (!isDiscoveringRef.current) {
            handleDiscoverNow(true);
          }
          if (!isSyncingRef.current) {
            handleSyncNow(true);
          }
          const nextTarget = current + autoPilotIntervalMinutes * 60 * 1000;
          nextScanTimestampRef.current = nextTarget;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(nextTarget));
          }
        }

        const remainingSecs = Math.max(0, Math.ceil((nextScanTimestampRef.current - current) / 1000));
        setCountdown(remainingSecs);
      }
    }, 1000);

    return () => clearInterval(ticker);
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
    const newNextMs = Date.now() + newInterval * 60 * 1000;
    nextScanTimestampRef.current = newNextMs;
    setCountdown(newInterval * 60);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kjin_autopilot_interval', String(newInterval));
      localStorage.setItem('kjin_autopilot_enabled', String(newEnabled));
      localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(newNextMs));
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
          next_scan_at: new Date(newNextMs).toISOString(),
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

  async function handleSaveBeatQuotas(newQuotas: Record<string, BeatQuotaConfig>) {
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
        text: '✅ Editorial Beat and District Target Quotas updated! Radar will discover news according to your exact regional & district limits.',
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

  async function handleSaveCivicSettings(maxDaily: number, intervalHours: number) {
    setIsSavingCivicSettings(true);
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
          civic_max_daily: maxDaily,
          civic_interval_hours: intervalHours,
        }),
      });
      if (!res.ok) throw new Error('Failed to save civic settings.');
      setCivicMaxDaily(maxDaily);
      setCivicIntervalHours(intervalHours);
      setIsCivicModalOpen(false);
      setFeedback({
        text: `✅ Ground problems policy updated: ${maxDaily} problems/day with ${intervalHours}h auto-pacing. Manual publishing remains instant!`,
        type: 'success',
      });
      await loadData();
    } catch (err: any) {
      console.error('Failed to save civic settings:', err);
      setFeedback({ text: err.message || 'Failed to save civic settings.', type: 'error' });
    } finally {
      setIsSavingCivicSettings(false);
    }
  }

  async function handleDiscoverDistrict(beatId: string, districtId: string) {
    if (isDiscoveringRef.current || isDiscovering) return;
    isDiscoveringRef.current = true;
    setIsDiscovering(true);
    setFeedback({
      text: `🛰️ Radar searching web for verified news specifically in ${districtId.toUpperCase()} (${beatId})...`,
      type: 'success',
    });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const res = await fetch('/api/newsroom/discovery/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ beat_id: beatId, district_id: districtId, force: true }),
      });
      const data = await res.json();

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
      if (res.ok && data.success && data.discovered) {
        setFeedback({
          text: `✨ Discovered breaking story for ${districtId.toUpperCase()}: "${data.headline}"! Sent to Pending Approval queue.`,
          type: 'success',
        });
        await loadData();
      } else {
        if (data.skipped) {
          setFeedback({ text: `ℹ️ ${data.reason}`, type: 'success' });
        } else {
          setFeedback({ text: data.reason || data.error || `Discovery complete for ${districtId}. No new breaking events found.`, type: 'error' });
        }
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Discovery network error.', type: 'error' });
    } finally {
      setIsDiscovering(false);
      isDiscoveringRef.current = false;
    }
  }

  async function handleDiscoverCivicProblem(districtId?: string) {
    if (isDiscoveringRef.current || isDiscovering || isDiscoveringCivic) return;
    setIsDiscoveringCivic(true);
    setFeedback({
      text: `🚨 Investigating grassroots civic issues & public grievances${districtId ? ` in ${districtId.toUpperCase()}` : ' across J&K / Ladakh'} (water, electricity, internet blackouts in remote pockets like Sarthal/Bani)...`,
      type: 'success',
    });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const res = await fetch('/api/newsroom/discovery/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ topic: 'civic_problems', district_id: districtId, force: true }),
      });
      const data = await res.json();

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
      if (data?.civicProblemsStatus) {
        setCivicProblems(data.civicProblemsStatus);
      }
      if (res.ok && data.success && data.discovered) {
        setFeedback({
          text: `🚨 Discovered ground grievance report: "${data.headline}" (${data.district || 'J&K'})! Deposited into editorial desk.`,
          type: 'success',
        });
        await loadData();
      } else {
        if (data.skipped) {
          setFeedback({ text: `ℹ️ ${data.reason}`, type: 'success' });
        } else {
          setFeedback({ text: data.reason || data.error || 'Civic issue surveillance complete. No new unaddressed breakdowns reported.', type: 'error' });
        }
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'Civic discovery network error.', type: 'error' });
    } finally {
      setIsDiscoveringCivic(false);
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

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
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


  const handleToggleAutoPublish = async (override?: boolean, customDelay?: number) => {
    const nextState = override !== undefined ? override : !autoPublishEnabled;
    const delayToUse = customDelay !== undefined ? customDelay : autoPublishDelayMinutes;
    setIsTogglingAutoPublish(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated.');

      const res = await fetch('/api/newsroom/auto-publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'toggle',
          enabled: nextState,
          delay_minutes: delayToUse,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update auto-publish state.');
      }

      const data = await res.json();

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
      setAutoPublishEnabled(Boolean(data.enabled));
      if (data.delay_minutes) {
        setAutoPublishDelayMinutes(Number(data.delay_minutes));
      }
      setFeedback({
        type: 'success',
        text: data.enabled
          ? `⚡ Autonomous Auto-Approval ENABLED: Stories will auto-publish after a ${data.delay_minutes || delayToUse}-minute safety buffer with immediate email alert.`
          : '✋ Manual Review Mode ENABLED: Stories wait in queue for your manual review and approval before going live.',
      });
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Could not update approval mode setting.',
      });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setIsTogglingAutoPublish(false);
    }
  };

  const handleUpdateAutoPublishDelay = async (newDelay: number) => {
    setAutoPublishDelayMinutes(newDelay);
    if (autoPublishEnabled) {
      await handleToggleAutoPublish(true, newDelay);
    }
  };

  const handlePublishNow = async (articleId: string) => {
    setPublishingArticleId(articleId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated.');

      const res = await fetch('/api/newsroom/auto-publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'publish_now',
          article_id: articleId,
        }),
      });

      const data = await res.json();

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to publish story.');
      }

      setScheduledQueue((prev) =>
        prev.map((item) => (item.articleId === articleId ? { ...item, status: 'published' } : item))
      );
      setDiscoveredArticles((prev) =>
        prev.map((item) => (item.id === articleId ? { ...item, status: 'published' } : item))
      );
      setFeedback({
        type: 'success',
        text: '🚀 Story approved & published live to the public website immediately!',
      });
      setTimeout(() => setFeedback(null), 4000);
      loadData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Publish now failed.',
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setPublishingArticleId(null);
    }
  };

  const handleCancelAutoPublish = async (articleId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated.');

      const res = await fetch('/api/newsroom/auto-publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'cancel',
          article_id: articleId,
        }),
      });

      const data = await res.json();

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel auto-publish.');
      }

      setScheduledQueue((prev) =>
        prev.map((item) => (item.articleId === articleId ? { ...item, status: 'cancelled' } : item))
      );
      setFeedback({
        type: 'success',
        text: '🛑 Auto-publish cancelled. Story kept safely in Review queue.',
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Cancel auto-publish failed.',
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  async function loadData() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role_key')
        .eq('id', sessionData.session.user.id)
        .single();

      if (!profile || ['editor', 'author'].includes(profile.role_key)) {
        router.push('/');
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
        if (dData.autoPublish) {
          setAutoPublishEnabled(Boolean(dData.autoPublish.enabled));
          setAutoPublishDelayMinutes(Number(dData.autoPublish.delayMinutes) || 5);
          if (Array.isArray(dData.autoPublish.scheduledQueue)) {
            setScheduledQueue(dData.autoPublish.scheduledQueue);
          }
        }
        if (dData.civicProblems) {
          setCivicProblems(dData.civicProblems);
        }
        if (Array.isArray(dData.scanLogs)) {
          setScanLogs(dData.scanLogs.slice(0, 10));
        }
      }

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        if (Array.isArray(sData.scan_logs) && sData.scan_logs.length > 0) {
          setScanLogs((prev) => (prev.length === 0 ? sData.scan_logs.slice(0, 10) : prev));
        }
        const mins = sData.interval_minutes !== undefined && !isNaN(Number(sData.interval_minutes))
          ? Number(sData.interval_minutes)
          : 3;
        const enabled = sData.auto_pilot_enabled !== false;
        setAutoPilotIntervalMinutes(mins);
        setAutoPilot(enabled);

        // Synchronize with backend-persisted scan timestamp
        let targetNextMs = 0;
        if (sData.next_scan_at) {
          const parsed = new Date(sData.next_scan_at).getTime();
          if (!isNaN(parsed) && parsed > Date.now()) {
            targetNextMs = parsed;
          }
        }

        if (!targetNextMs) {
          const localSaved = typeof window !== 'undefined' ? localStorage.getItem('kjin_autopilot_next_scan_timestamp') : null;
          if (localSaved && !isNaN(Number(localSaved)) && Number(localSaved) > Date.now()) {
            targetNextMs = Number(localSaved);
          }
        }

        if (!targetNextMs) {
          const remainingSecs = sData.remaining_seconds && Number(sData.remaining_seconds) > 0
            ? Number(sData.remaining_seconds)
            : mins * 60;
          targetNextMs = Date.now() + remainingSecs * 1000;
        }

        nextScanTimestampRef.current = targetNextMs;
        const remainingSecs = Math.max(0, Math.ceil((targetNextMs - Date.now()) / 1000));
        setCountdown(remainingSecs);

        if (typeof window !== 'undefined') {
          localStorage.setItem('kjin_autopilot_interval', String(mins));
          localStorage.setItem('kjin_autopilot_enabled', String(enabled));
          localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(targetNextMs));
        }
        if (sData.beat_quotas) {
          setBeatQuotas((prev) => ({ ...prev, ...sData.beat_quotas }));
        }
        if (sData.civic_max_daily !== undefined) {
          setCivicMaxDaily(Number(sData.civic_max_daily));
        }
        if (sData.civic_interval_hours !== undefined) {
          setCivicIntervalHours(Number(sData.civic_interval_hours));
        }
        if (sData.auto_publish_enabled !== undefined) {
          setAutoPublishEnabled(Boolean(sData.auto_publish_enabled));
        }
        if (sData.auto_publish_delay_minutes !== undefined) {
          setAutoPublishDelayMinutes(Number(sData.auto_publish_delay_minutes) || 5);
        }
        if (Array.isArray(sData.scheduled_queue)) {
          setScheduledQueue(sData.scheduled_queue);
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

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
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

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
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
      } else {
        // Silently refresh discovery pulse counters and logs
        await loadData();
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

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
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

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
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

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
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

    // Text-only news mandate: default to no image
    setImageAlternatives([]);
    const initialImage = video.ai_analysis?.featured_image_url || '';
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

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
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

      if (Array.isArray(data.scanLogs)) {
        setScanLogs(data.scanLogs.slice(0, 10));
      }

      if (data.next_scan_at) {
        const parsed = new Date(data.next_scan_at).getTime();
        if (!isNaN(parsed) && parsed > Date.now()) {
          nextScanTimestampRef.current = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem('kjin_autopilot_next_scan_timestamp', String(parsed));
          }
        }
      }
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

  const approvedVideos = videos.filter((v) => v.processing_status === 'approved');
  const pendingVideos = videos.filter((v) => v.processing_status === 'draft_proposed');
  const freshVideos = videos.filter((v) => (Date.now() - new Date(v.published_at).getTime()) <= 6 * 60 * 60 * 1000);
  const approvedVideosCount = approvedVideos.length;
  const pendingDraftsCount = pendingVideos.length;
  const freshVideosCount = freshVideos.length;

  const filteredVideos = videos.filter((v) => {
    if (draftSubFilter === 'pending' && v.processing_status !== 'draft_proposed') return false;
    if (draftSubFilter === 'approved' && v.processing_status !== 'approved') return false;
    if (draftSubFilter === 'fresh') {
      const ageMs = Date.now() - new Date(v.published_at).getTime();
      if (ageMs > 6 * 60 * 60 * 1000) return false;
    }
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

  return (
    <div className="space-y-4">
      {/* Top Banner - Clean, Wide & Professional */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-xl shadow-md text-white font-bold shrink-0">
            🛰️
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Newsroom Command Center
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Autonomous regional intelligence, grassroots civic alerts, and multi-source broadcast surveillance.
            </p>
          </div>
        </div>

        {/* Global Live Status Badge */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 shadow-2xs ${
              autoPilot
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${autoPilot ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
            <span>
              {autoPilot
                ? `Autonomous Radar Active (Next scan: ${formatCountdownTime(countdown)})`
                : 'Autonomous Radar Paused'}
            </span>
          </div>
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

      {/* Primary Newsroom Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => handleTabChange('radar')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'radar'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>🛰️ Autonomous Ground Radar</span>
          <span className="rounded-full bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300 font-bold">
            {discoveredArticles.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('drafts')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'drafts'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📰 Video &amp; Social Broadcasts</span>
          <span className="rounded-full bg-cyan-100 dark:bg-cyan-950 px-2 py-0.5 text-xs text-cyan-800 dark:text-cyan-300 font-bold">
            {pendingDraftsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('channels')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'channels'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>⚙️ Monitored Sources Registry</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300 font-semibold">
            {channels.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('approved')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'approved'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>✓ Approved Articles &amp; Live Dispatches</span>
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
            {approvedVideosCount + discoveredArticles.filter((a) => a.status === 'published').length}
          </span>
        </button>
      </div>

      {/* Tab 1: Autonomous News Discovery Radar & Queue */}
      {activeTab === 'radar' && (
      <>
        {/* 1. Radar Control Deck: 3 Clear Strategy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Radar Automation & Schedule */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 shadow-2xs flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>⏱️</span>
                  <span>Autonomous News Scanner</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleUpdateAutoPilotSettings(autoPilotIntervalMinutes, !autoPilot)}
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                    autoPilot
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                      : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                  }`}
                  title="Click to toggle automatic background discovery"
                >
                  {autoPilot ? '● Scanner Active' : '○ Scanner Paused'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {autoPilot
                  ? `Scanning online news sources every ${autoPilotIntervalMinutes >= 60 ? `${autoPilotIntervalMinutes / 60} hour(s)` : `${autoPilotIntervalMinutes} min(s)`}. Next run in ${formatCountdownTime(countdown)}.`
                  : 'Automatic background scanning is paused. Click Resume to activate automatic news hunting.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <label htmlFor="radar-schedule-select" className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Scan Cadence:
              </label>
              <select
                id="radar-schedule-select"
                value={autoPilotIntervalMinutes}
                onChange={(e) => handleUpdateAutoPilotSettings(Number(e.target.value), autoPilot)}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs px-2.5 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-purple-500"
              >
                <option value={1}>Every 1 Min (Rapid Realtime)</option>
                <option value={2}>Every 2 Min (Ultra Fast)</option>
                <option value={3}>Every 3 Min (Fast Track)</option>
                <option value={5}>Every 5 Min (Recommended)</option>
                <option value={10}>Every 10 Min</option>
                <option value={15}>Every 15 Min</option>
                <option value={30}>Every 30 Min</option>
                <option value={60}>Every 1 Hour (Standard)</option>
                <option value={120}>Every 2 Hours</option>
                <option value={360}>Every 6 Hours</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1.5 rounded-lg border border-purple-200/80 dark:border-purple-900/50">
              <span>⏰</span>
              <span>Freshness Window: Strict &lt; 6h (Stale News Blocked)</span>
            </div>

            {scanLogs.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                  Latest Scan:
                </span>
                <span
                  className="truncate font-semibold text-slate-800 dark:text-slate-200"
                  title={scanLogs[0].reason}
                >
                  {scanLogs[0].status === 'generated'
                    ? '✅ Draft Created'
                    : scanLogs[0].status === 'cooldown'
                    ? '⏳ 429 Cooldown'
                    : scanLogs[0].status === 'error'
                    ? '❌ Scan Error'
                    : 'ℹ️ ' + (scanLogs[0].headline ? 'Stale/Duplicate' : 'No Fresh Story')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                  {formatScanRelativeTime(scanLogs[0].timestamp)}
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Publishing & Approval Strategy */}
          <div
            className={`rounded-2xl border p-4 shadow-2xs flex flex-col justify-between space-y-3 transition-all ${
              autoPublishEnabled
                ? 'border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/50 via-white to-white dark:from-emerald-950/20 dark:via-slate-900/90 dark:to-slate-900/90'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90'
            }`}
          >
            <div className="space-y-2.5">
              {/* Header with Title, Guide Trigger, and Status Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span>{autoPublishEnabled ? '⚡' : '🛡️'}</span>
                    <span>Approval &amp; Publishing</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsApprovalGuideOpen(true)}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-bold inline-flex items-center gap-0.5 ml-1 transition cursor-pointer"
                    title="Click to view full comparison of Auto vs Manual Approval"
                  >
                    <span>ℹ️</span>
                    <span className="underline">Guide</span>
                  </button>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                    autoPublishEnabled
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      autoPublishEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
                    }`}
                  />
                  {autoPublishEnabled ? 'Auto-Approval' : 'Manual Review'}
                </span>
              </div>

              {/* Segmented Mode Selector: Manual Review vs Auto-Publish */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 gap-1">
                <button
                  type="button"
                  onClick={() => autoPublishEnabled && handleToggleAutoPublish(false)}
                  disabled={isTogglingAutoPublish}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    !autoPublishEnabled
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>✋</span>
                  <span>Manual Review</span>
                </button>

                <button
                  type="button"
                  onClick={() => !autoPublishEnabled && handleToggleAutoPublish(true)}
                  disabled={isTogglingAutoPublish}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    autoPublishEnabled
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>⚡</span>
                  <span>Auto-Publish</span>
                </button>
              </div>

              {/* Dynamic Description & Micro-Pipeline Flow */}
              <div className="space-y-1.5 text-xs">
                <p className="text-slate-600 dark:text-slate-300 leading-snug">
                  {autoPublishEnabled ? (
                    <>
                      <strong className="text-emerald-700 dark:text-emerald-300 font-semibold">Autonomous publishing:</strong> Stories auto-publish after a <strong>{autoPublishDelayMinutes}-min buffer</strong>. Advance email alert sent with 1-click cancel link.
                    </>
                  ) : (
                    <>
                      <strong className="text-blue-700 dark:text-blue-300 font-semibold">Human safety check:</strong> Stories wait in your pending queue. <strong>Zero stories go live</strong> until an editor reviews and approves.
                    </>
                  )}
                </p>

                {/* Visual Pipeline Flow Stepper */}
                <div className="py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[10px] font-medium text-slate-600 dark:text-slate-300 flex items-center justify-between gap-1 overflow-x-auto">
                  {autoPublishEnabled ? (
                    <>
                      <span className="flex items-center gap-0.5 whitespace-nowrap">🤖 AI Draft</span>
                      <span className="text-slate-400">→</span>
                      <span className="flex items-center gap-0.5 whitespace-nowrap text-amber-600 dark:text-amber-400 font-semibold">📧 Alert Sent</span>
                      <span className="text-slate-400">→</span>
                      <span className="flex items-center gap-0.5 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-semibold">⏳ {autoPublishDelayMinutes}m Buffer</span>
                      <span className="text-slate-400">→</span>
                      <span className="flex items-center gap-0.5 whitespace-nowrap text-emerald-700 dark:text-emerald-300 font-bold">🚀 Live</span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-0.5 whitespace-nowrap">🤖 AI Draft</span>
                      <span className="text-slate-400">→</span>
                      <span className="flex items-center gap-0.5 whitespace-nowrap text-blue-600 dark:text-blue-400 font-semibold">📋 Review Queue</span>
                      <span className="text-slate-400">→</span>
                      <span className="flex items-center gap-0.5 whitespace-nowrap text-purple-600 dark:text-purple-400 font-semibold">👤 Editor Approves</span>
                      <span className="text-slate-400">→</span>
                      <span className="flex items-center gap-0.5 whitespace-nowrap text-emerald-700 dark:text-emerald-300 font-bold">🚀 Live</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              {autoPublishEnabled ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5">
                    <label
                      htmlFor="auto-publish-buffer-select"
                      className="text-[11px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap"
                    >
                      Grace Buffer:
                    </label>
                    <select
                      id="auto-publish-buffer-select"
                      value={autoPublishDelayMinutes}
                      onChange={(e) => handleUpdateAutoPublishDelay(Number(e.target.value))}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs px-2 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value={2}>2 Min (Rapid Live)</option>
                      <option value={3}>3 Min (Fast)</option>
                      <option value={5}>5 Min (Recommended)</option>
                      <option value={10}>10 Min (Standard)</option>
                      <option value={15}>15 Min (Extended Safety)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={isTestingEmail}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Send a sample email alert with cancellation link to test your setup"
                  >
                    {isTestingEmail ? '...' : '📧 Test Alert'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href="/articles?status=review"
                    className="flex-1 py-1 px-2.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition flex items-center justify-center gap-1.5"
                  >
                    <span>📋</span>
                    <span>Review Pending ({discoveredArticles.filter((a) => a.status !== 'published').length})</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={isTestingEmail}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Send a sample email alert"
                  >
                    {isTestingEmail ? '...' : '📧 Test Alert'}
                  </button>
                </div>
              )}

              {/* Strict text-only badge */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                  <span>📝</span>
                  <span>100% Text-Only News</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Clean Broadsheet</span>
              </div>
            </div>
          </div>

          {/* Card 3: Instant On-Demand Triggers */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 shadow-2xs flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>🚀</span>
                  <span>Instant Discovery</span>
                </span>
                <Link
                  href="/articles?status=review"
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Review Pending ({discoveredArticles.length}) →
                </Link>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Trigger an immediate multi-source search across Google News, local J&K publications, and official portals right now.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon="🔍"
                disabled={isDiscovering}
                isLoading={isDiscovering}
                onClick={() => handleDiscoverNow(false)}
                className="w-full justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer"
              >
                {isDiscovering ? 'Searching...' : 'Discover Now'}
              </Button>

              <button
                type="button"
                disabled={isDiscoveringCivic}
                onClick={() => handleDiscoverCivicProblem()}
                className="w-full justify-center inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 transition cursor-pointer disabled:opacity-50"
                title="Search grassroots water, power, and road problems across districts"
              >
                <span>🚨</span>
                <span>Civic Issue</span>
                <span className="text-[10px] font-mono px-1 rounded bg-amber-500/20 font-bold">
                  {civicProblems ? `${civicProblems.currentToday}/${civicProblems.maxDaily}` : '2/d'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Today's Editorial Pulse: 4 Clear KPI Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-slate-900 p-4 shadow-2xs">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-1">
              📰 Published Today
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {discoveryStats?.publishedToday ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Live on broadsheet website
            </p>
          </div>

          <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-slate-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                🎯 Discovered Today
              </span>
              <span className="text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300">
                Goal: {discoveryStats?.dailyTarget ?? 25}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {discoveryStats?.discoveredToday ?? 0} <span className="text-sm font-semibold text-slate-400">/ {discoveryStats?.dailyTarget ?? 25}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Daily Target Range: {discoveryStats?.minDailyTotal ?? 17}–{discoveryStats?.maxDailyTotal ?? 32}
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-200 dark:border-cyan-900/50 bg-gradient-to-br from-cyan-50/60 to-white dark:from-cyan-950/20 dark:to-slate-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                ⛰️ Regional J&amp;K Share
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Priority Met
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {discoveryStats?.regionalSharePercent ?? 65}%
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {discoveryStats?.regionalCount ?? 0} stories from J&amp;K &amp; Ladakh beats (65% min)
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-slate-900 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                🚨 Ground Grievances
              </span>
              <button
                type="button"
                onClick={() => setIsCivicModalOpen(true)}
                className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                title="Configure daily quota and automated interval sliders"
              >
                <span>⚙️ Sliders</span>
                <span>{civicProblems ? (civicProblems.canDiscoverNow ? 'Ready' : `Next in ${civicProblems.hoursUntilNextAllowed}h`) : `${civicIntervalHours}h Shift`}</span>
              </button>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {civicProblems?.currentToday ?? 0} <span className="text-sm font-semibold text-slate-400">/ {civicMaxDaily}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCivicModalOpen(true)}
                className="text-[10px] font-bold text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 transition cursor-pointer"
              >
                Pacing Sliders →
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Grassroots water, power &amp; road issues
            </p>
          </div>
        </div>

        {/* 3. Regional Coverage & Story Quotas */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🎯 Regional Coverage &amp; Story Quotas</span>
                <span className="text-[11px] font-normal text-slate-500">
                  Target distribution to prevent news desert in remote districts
                </span>
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingQuotas(JSON.parse(JSON.stringify(beatQuotas)));
                setIsQuotasModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition cursor-pointer self-start sm:self-auto"
            >
              <span>⚙️ Adjust Quotas (Min / Max)</span>
            </button>
          </div>

          {/* 7 Regional Beat Cards with Progress Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {Object.entries(DEFAULT_BEAT_QUOTAS).map(([beatId, base]) => {
              const live = discoveryRegions.find((r) => r.id === beatId);
              const current = live?.current ?? 0;
              const published = live?.published ?? 0;
              const quota = beatQuotas[beatId] || { min: base.min, max: base.max };
              const minVal = quota?.min ?? live?.min ?? base.min;
              const maxVal = quota?.max ?? live?.max ?? base.max;
              const isMet = current >= minVal;
              const isMax = current >= maxVal;
              const percent = Math.min(100, Math.round((current / (maxVal || 1)) * 100));

              return (
                <div
                  key={beatId}
                  className={`p-3 rounded-xl border text-xs transition flex flex-col justify-between hover:shadow-sm ${
                    base.priority
                      ? 'border-cyan-300 dark:border-cyan-800/80 bg-cyan-50/50 dark:bg-cyan-950/20'
                      : isMet
                      ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate" title={base.name}>
                        {base.name}
                      </span>
                      {base.priority ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-200 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-300 font-extrabold uppercase">
                          Top
                        </span>
                      ) : published > 0 ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold">
                          {published} Live
                        </span>
                      ) : null}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-2" title={base.subtitle}>
                      {base.subtitle}
                    </div>

                    <div className="flex items-baseline justify-between mb-1.5">
                      <div className="text-lg font-black text-slate-900 dark:text-white">
                        {current} <span className="text-[10px] font-normal text-slate-400">/ {minVal}–{maxVal}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${isMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {published > 0 ? `${published} live` : isMax ? 'Maxed' : isMet ? '✓ Met' : `${minVal - current} needed`}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          base.priority ? 'bg-cyan-500' : isMet ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* District Quick Search Chips */}
                  {live?.districts && live.districts.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      {live.districts.map((dist) => (
                        <button
                          key={dist.id}
                          type="button"
                          onClick={() => handleDiscoverDistrict(beatId, dist.id)}
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-1 transition cursor-pointer ${
                            dist.isMet
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-purple-100 dark:hover:bg-purple-900/60'
                          }`}
                          title={`Click to search news specifically for ${dist.name}`}
                        >
                          <span className={`w-1 h-1 rounded-full ${dist.isMet ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span>{dist.name}</span>
                          <span className="opacity-70 font-mono">({dist.current})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Autonomous Scan Diagnostics & Issue Logs (Top 10 Cycles) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-base">📡</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Autonomous Scan Diagnostics &amp; Issues</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                    Last {scanLogs.length} of 10
                  </span>
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Live surveillance trail of every {autoPilotIntervalMinutes}-minute scan cycle. If news was not generated or was blocked by quota/freshness, the exact issue is reported below (max 10 items).
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleRefreshScanLogs}
                disabled={isRefreshingLogs}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
                title="Refresh scan logs from server"
              >
                <span>{isRefreshingLogs ? '...' : '🔄 Refresh'}</span>
              </button>
              {scanLogs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearScanLogs}
                  disabled={isClearingLogs}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer disabled:opacity-50"
                  title="Clear scan history"
                >
                  <span>🗑️ Clear</span>
                </button>
              )}
            </div>
          </div>

          {scanLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              <span className="text-xl block mb-1">⏱️</span>
              <p className="font-semibold text-slate-700 dark:text-slate-300">No scan activity recorded yet.</p>
              <p className="mt-1 text-[11px] text-slate-400">
                The scanner runs every {autoPilotIntervalMinutes >= 60 ? `${autoPilotIntervalMinutes / 60} hour(s)` : `${autoPilotIntervalMinutes} minute(s)`} (Next scan in {formatCountdownTime(countdown)}). Click &quot;Discover Now&quot; above to trigger an immediate test scan.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {scanLogs.slice(0, 10).map((log, idx) => {
                const isGenerated = log.status === 'generated';
                const isCooldown = log.status === 'cooldown';
                const isError = log.status === 'error';
                const reasonLower = (log.reason || '').toLowerCase();
                const isStale = reasonLower.includes('stale') || reasonLower.includes('6-hour') || reasonLower.includes('freshness');
                const isDuplicate = reasonLower.includes('duplicate') || reasonLower.includes('already covered');

                return (
                  <div key={log.id || idx} className="py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isGenerated ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                            <span>✅</span>
                            <span>Draft Generated</span>
                          </span>
                        ) : isCooldown ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                            <span>⏳</span>
                            <span>Quota 429 Cooldown</span>
                          </span>
                        ) : isStale ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                            <span>⚠️</span>
                            <span>Stale (&gt;6h) Rejected</span>
                          </span>
                        ) : isDuplicate ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                            <span>🔁</span>
                            <span>Duplicate Skipped</span>
                          </span>
                        ) : isError ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center gap-1">
                            <span>❌</span>
                            <span>Scan Error</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                            <span>ℹ️</span>
                            <span>No Fresh Story</span>
                          </span>
                        )}

                        {log.beat && (
                          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                            {log.beat}
                          </span>
                        )}

                        {log.district && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            📍 {log.district}
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-slate-400">
                          {formatScanTimestamp(log.timestamp)} ({formatScanRelativeTime(log.timestamp)})
                        </span>
                      </div>

                      {log.headline && (
                        <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 text-[11px]">
                          &quot;{log.headline}&quot;
                        </div>
                      )}

                      <p className={`text-[11px] leading-relaxed ${
                        isGenerated
                          ? 'text-emerald-700 dark:text-emerald-300 font-medium'
                          : isCooldown
                          ? 'text-amber-700 dark:text-amber-300'
                          : isError
                          ? 'text-rose-600 dark:text-rose-400 font-medium'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {log.reason}
                      </p>
                    </div>

                    {log.articleId && (
                      <Link
                        href={`/articles/${log.articleId}`}
                        className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline whitespace-nowrap self-start sm:self-center"
                      >
                        View Draft →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
            {discoveredArticles.map((art) => {
              const scheduledItem = scheduledQueue.find((item) => item.articleId === art.id);
              const isScheduledPending = scheduledItem && scheduledItem.status === 'pending';
              const remainingSec = isScheduledPending
                ? Math.max(0, Math.floor((new Date(scheduledItem.scheduledFor).getTime() - nowTimestamp) / 1000))
                : 0;
              const isAutoPublished = art.status === 'published' || scheduledItem?.status === 'published';
              const isCancelled = scheduledItem?.status === 'cancelled';

              return (
                <div
                  key={art.id}
                  className={`rounded-xl border p-3.5 flex flex-col justify-between transition ${
                    isScheduledPending && remainingSec > 0
                      ? 'border-emerald-500/50 dark:border-emerald-600/50 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-purple-300 dark:hover:border-purple-800'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
                          {art.category}
                        </span>
                        {art.district && (
                          <span className="font-semibold text-slate-600 dark:text-slate-400">
                            📍 {art.district}
                          </span>
                        )}
                        <span className="font-bold text-[9.5px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                          ⚡ &lt; 6h Fresh
                        </span>
                        <span className="font-bold text-[9.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          📝 Text-Only
                        </span>
                      </div>
                      {art.status === 'published' ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          ● LIVE
                        </span>
                      ) : isScheduledPending && remainingSec > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                          ⏳ Auto-Queued
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          ✋ Pending Approval
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/articles/${art.id}`}
                      className="font-bold text-xs text-slate-900 dark:text-slate-100 hover:text-purple-600 dark:hover:text-purple-300 line-clamp-2 leading-snug"
                    >
                      {art.title}
                    </Link>

                    {/* Auto-Publish Grace Period Active Countdown Banner */}
                    {isScheduledPending && remainingSec > 0 && (
                      <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 my-2 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                          <span className="animate-spin">⏳</span>
                          <span>Auto-Publishing in {Math.floor(remainingSec / 60)}m {remainingSec % 60}s</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePublishNow(art.id)}
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                            title="Publish immediately without waiting for remaining timer"
                          >
                            Publish Now
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelAutoPublish(art.id)}
                            className="px-2 py-0.5 rounded bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 text-[10px] font-bold cursor-pointer"
                            title="Cancel automatic publishing and keep in review queue"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {isAutoPublished && (
                      <div className="px-2 py-1 rounded-lg bg-emerald-900/20 border border-emerald-800/30 my-1.5 flex items-center gap-1.5 text-[11px] text-emerald-500 font-semibold">
                        <span>✓</span>
                        <span>Auto-Approved &amp; Published Live</span>
                      </div>
                    )}

                    {isCancelled && (
                      <div className="px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 my-1.5 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                        <span>🛑</span>
                        <span>Auto-Publish Cancelled (Manual Review)</span>
                      </div>
                    )}
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
                    {art.status === 'published' ? (
                      <Link
                        href={`/articles/${art.id}`}
                        className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shrink-0 inline-flex items-center gap-1"
                      >
                        <span>View Live</span>
                        <span>↗</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handlePublishNow(art.id)}
                          disabled={publishingArticleId === art.id}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shrink-0 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 shadow-2xs"
                          title="Instantly approve and publish live on the website"
                        >
                          {publishingArticleId === art.id ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="animate-spin text-xs">⏳</span>
                              <span>Publishing...</span>
                            </span>
                          ) : (
                            <>
                              <span>✓</span>
                              <span>Approve</span>
                            </>
                          )}
                        </button>
                        <Link
                          href={`/articles/${art.id}/edit`}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition shrink-0"
                          title="Open editor to review or edit text before publishing"
                        >
                          ✏️ Edit
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
      </>
      )}

      {/* Tab 2: Video & Social Broadcasts (FB, Insta, YT) */}
      {activeTab === 'drafts' && (
      <div className="space-y-4">
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

      {/* Sub-Filter Controls for Broadcasts: Awaiting Approval vs Approved vs All */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setDraftSubFilter('pending');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            draftSubFilter === 'pending'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>⏳ Awaiting Approval</span>
          <span className="rounded-full bg-black/20 dark:bg-white/20 px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {pendingDraftsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDraftSubFilter('fresh');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            draftSubFilter === 'fresh'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>⚡ Fresh (&lt; 6 Hours)</span>
          <span className="rounded-full bg-black/20 dark:bg-white/20 px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {freshVideosCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDraftSubFilter('approved');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            draftSubFilter === 'approved'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>✓ Approved &amp; Stored Articles</span>
          <span className="rounded-full bg-black/20 dark:bg-white/20 px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {approvedVideosCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDraftSubFilter('all');
            setCurrentPage(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            draftSubFilter === 'all'
              ? 'bg-cyan-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>All Ingested Broadcasts</span>
          <span className="rounded-full bg-black/20 dark:bg-white/20 px-1.5 py-0.2 text-[10px] font-mono font-bold">
            {videos.length}
          </span>
        </button>
      </div>

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
                          {(Date.now() - new Date(video.published_at).getTime()) <= 6 * 60 * 60 * 1000 ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-0.5">
                              <span>⚡</span>
                              <span>&lt; 6h</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-0.5" title="Published more than 6 hours ago">
                              <span>⚠️</span>
                              <span>&gt; 6h Stale</span>
                            </span>
                          )}
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

                      {/* KJCPL Synthesized Original Story (From Scratch by Gemini) */}
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

      {/* Tab 4: Approved & Published Articles Archive */}
      {activeTab === 'approved' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>✓ Approved &amp; Published News Archive</span>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-xs text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                  {approvedVideosCount + discoveredArticles.filter((a) => a.status === 'published').length} Stories Stored
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                All approved news formulations and autonomous field discoveries converted into permanent broadsheet articles.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/articles"
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Open Full CMS Desk →
              </Link>
            </div>
          </div>

          {/* Section A: Approved Video & Social Broadcasts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>📰 Approved Video &amp; Social Broadcasts</span>
                <span className="rounded-full bg-cyan-100 dark:bg-cyan-950 px-2 py-0.5 text-[10px] text-cyan-800 dark:text-cyan-300 font-bold">
                  {approvedVideos.length}
                </span>
              </h4>
            </div>

            {approvedVideos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                No broadcast videos have been approved yet. Click &quot;Review &amp; Approve&quot; in the Video &amp; Social Broadcasts tab.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {approvedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 p-4 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Article Created</span>
                        <span>{video.published_at ? new Date(video.published_at).toLocaleDateString() : 'Stored'}</span>
                      </div>
                      <h5 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                        {video.proposed_headline || video.ai_analysis?.headline || video.title}
                      </h5>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {video.proposed_summary || video.ai_analysis?.summary || video.description || 'Synthesized broadsheet formulation.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-mono text-slate-400">
                        {video.youtube_sources?.channel_name || 'Social Stream'}
                      </span>
                      {video.article_id && (
                        <Link
                          href={`/articles/${video.article_id}`}
                          className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 transition"
                        >
                          Edit Article →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Published Autonomous Ground Radar Stories */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>🛰️ Autonomous Radar Published Dispatches</span>
                <span className="rounded-full bg-purple-100 dark:bg-purple-950 px-2 py-0.5 text-[10px] text-purple-800 dark:text-purple-300 font-bold">
                  {discoveredArticles.filter((a) => a.status === 'published').length}
                </span>
              </h4>
            </div>

            {discoveredArticles.filter((a) => a.status === 'published').length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                No autonomous stories published yet. Stories approved manually or via Auto-Approval mode appear here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {discoveredArticles
                  .filter((a) => a.status === 'published')
                  .map((art) => (
                    <div
                      key={art.id}
                      className="rounded-xl border border-purple-500/30 bg-purple-50/10 dark:bg-purple-950/10 p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            📍 {art.district ? art.district.toUpperCase() : art.category}
                          </span>
                          <span>{new Date(art.created_at).toLocaleDateString()}</span>
                        </div>
                        <h5 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                          {art.title}
                        </h5>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          Source: {art.source_name || 'Ground Research'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-[11px] font-mono text-slate-400">
                          {art.category} • {art.status}
                        </span>
                        <Link
                          href={`/articles/${art.id}`}
                          className="font-bold text-purple-600 hover:text-purple-500 dark:text-purple-400 transition"
                        >
                          Edit Article →
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>
            )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[88vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 sm:p-6 shadow-2xl space-y-4">
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
                    Original KJCPL Headline
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

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setReviewVideo(null)}
                className="w-full sm:w-auto justify-center"
              >
                Cancel
              </Button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={isApproving}
                  onClick={() => handleApproveDraft('draft')}
                  className="w-full sm:w-auto justify-center"
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
                  className="w-full sm:w-auto justify-center font-bold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 duration-150">
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
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col gap-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                              setEditingQuotas((prev) => {
                                const pBeat = prev[beatId] || { min: base.min, max: base.max };
                                return {
                                  ...prev,
                                  [beatId]: { ...pBeat, min: val, max: Math.max(val, pBeat.max ?? base.max) },
                                };
                              });
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
                              setEditingQuotas((prev) => {
                                const pBeat = prev[beatId] || { min: base.min, max: base.max };
                                return {
                                  ...prev,
                                  [beatId]: { ...pBeat, min: Math.min(val, pBeat.min ?? base.min), max: val },
                                };
                              });
                            }}
                            className="w-16 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-center font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sub-District Level Priority & Quotas (e.g. Chenab Valley -> Doda, Kishtwar, Ramban) */}
                    {base.districts && Object.keys(base.districts).length > 0 && (
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60">
                        <div className="flex items-center justify-between mb-2">
                          <button
                            type="button"
                            onClick={() => setExpandedBeatDistricts((prev) => ({ ...prev, [beatId]: !prev[beatId] }))}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer"
                          >
                            <span>{expandedBeatDistricts[beatId] ? '▼' : '▶'}</span>
                            <span>District Priority &amp; Quotas ({Object.keys(base.districts).length} Districts)</span>
                          </button>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            Set story targets &amp; priorities per district
                          </span>
                        </div>

                        {expandedBeatDistricts[beatId] && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-white/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            {Object.entries(base.districts).map(([distId, distBase]) => {
                              const beatObj = editingQuotas[beatId];
                              const currentDistQuota = beatObj?.districts?.[distId] || {
                                min: distBase.min,
                                max: distBase.max,
                                priority: distBase.priority,
                              };
                              const liveDist = discoveryRegions.find((r) => r.id === beatId)?.districts?.find((d) => d.id === distId);

                              return (
                                <div
                                  key={distId}
                                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-800/80 text-xs space-y-2 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                      <span>📍</span>
                                      <span>{distBase.name}</span>
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                                      Today: {liveDist?.current ?? 0} stories
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 flex-1">
                                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Min:</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={20}
                                        value={currentDistQuota.min}
                                        onChange={(e) => {
                                          const val = Math.max(0, Number(e.target.value));
                                          setEditingQuotas((prev) => {
                                            const pBeat = prev[beatId] || { min: base.min, max: base.max };
                                            const pDistObj = pBeat.districts?.[distId] || { min: distBase.min, max: distBase.max, priority: distBase.priority };
                                            return {
                                              ...prev,
                                              [beatId]: {
                                                ...pBeat,
                                                districts: {
                                                  ...(pBeat.districts || {}),
                                                  [distId]: {
                                                    ...pDistObj,
                                                    min: val,
                                                    max: Math.max(val, pDistObj.max),
                                                  },
                                                },
                                              },
                                            };
                                          });
                                        }}
                                        className="w-12 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 py-0.5 text-center text-xs font-bold text-slate-900 dark:text-white"
                                      />
                                    </div>

                                    <div className="flex items-center gap-1 flex-1">
                                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Max:</label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={currentDistQuota.max}
                                        onChange={(e) => {
                                          const val = Math.max(1, Number(e.target.value));
                                          setEditingQuotas((prev) => {
                                            const pBeat = prev[beatId] || { min: base.min, max: base.max };
                                            const pDistObj = pBeat.districts?.[distId] || { min: distBase.min, max: distBase.max, priority: distBase.priority };
                                            return {
                                              ...prev,
                                              [beatId]: {
                                                ...pBeat,
                                                districts: {
                                                  ...(pBeat.districts || {}),
                                                  [distId]: {
                                                    ...pDistObj,
                                                    min: Math.min(val, pDistObj.min),
                                                    max: val,
                                                  },
                                                },
                                              },
                                            };
                                          });
                                        }}
                                        className="w-12 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 py-0.5 text-center text-xs font-bold text-slate-900 dark:text-white"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-700">
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Priority:</span>
                                    <select
                                      value={currentDistQuota.priority || 'normal'}
                                      onChange={(e) => {
                                        const prio = e.target.value as 'high' | 'normal' | 'low';
                                        setEditingQuotas((prev) => {
                                          const pBeat = prev[beatId] || { min: base.min, max: base.max };
                                          const pDistObj = pBeat.districts?.[distId] || { min: distBase.min, max: distBase.max, priority: distBase.priority };
                                          return {
                                            ...prev,
                                            [beatId]: {
                                              ...pBeat,
                                              districts: {
                                                ...(pBeat.districts || {}),
                                                [distId]: {
                                                  ...pDistObj,
                                                  priority: prio,
                                                },
                                              },
                                            },
                                          };
                                        });
                                      }}
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold border outline-none ${
                                        currentDistQuota.priority === 'high'
                                          ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800'
                                          : currentDistQuota.priority === 'low'
                                          ? 'border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'
                                          : 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800'
                                      }`}
                                    >
                                      <option value="high">🔥 High</option>
                                      <option value="normal">⚖️ Normal</option>
                                      <option value="low">💤 Low</option>
                                    </select>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const defaults: Record<string, BeatQuotaConfig> = {};
                  Object.entries(DEFAULT_BEAT_QUOTAS).forEach(([k, v]) => {
                    const defaultDistricts: Record<string, DistrictQuotaConfig> = {};
                    if (v.districts) {
                      Object.entries(v.districts).forEach(([dId, dVal]) => {
                        defaultDistricts[dId] = { min: dVal.min, max: dVal.max, priority: dVal.priority };
                      });
                    }
                    defaults[k] = { min: v.min, max: v.max, districts: defaultDistricts };
                  });
                  setEditingQuotas(defaults);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer text-left sm:text-center"
              >
                Reset to Standard Defaults
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsQuotasModalOpen(false)}
                  disabled={isSavingQuotas}
                  className="flex-1 sm:flex-initial justify-center"
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
                  className="flex-1 sm:flex-initial justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold"
                >
                  Save Beat Quotas
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Civic Problems Daily Quota & Pacing Sliders Modal */}
      {isCivicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚨</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Civic Problems &amp; Ground Grievances Policy
                  </h3>
                  <p className="text-xs text-slate-500">
                    Control automated AI discovery pacing and daily limits with sliders
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCivicModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Instant Manual Publishing Notice */}
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>⚡</span>
                <span>Manual Creation is ALWAYS Instant (0 Min Wait)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                When you or your editors manually write and publish a civic problem, it publishes immediately in minutes. You never have to wait for the automatic interval.
              </p>
            </div>

            {/* Sliders Container */}
            <div className="space-y-5 pt-1">
              {/* Slider 1: Daily Target Problems */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>1. Daily Problems Target (Per Day):</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 font-mono text-amber-800 dark:text-amber-300 font-bold">
                    {civicMaxDaily} {civicMaxDaily === 1 ? 'Report' : 'Reports'} / Day
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={civicMaxDaily}
                  onChange={(e) => setCivicMaxDaily(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>1 / Day</span>
                  <span>2 (Standard)</span>
                  <span>3 / Day</span>
                  <span>4 / Day</span>
                  <span>5 / Day</span>
                </div>
              </div>

              {/* Slider 2: Shift Pacing Interval */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>2. Automated Radar Shift Interval:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 font-mono text-blue-800 dark:text-blue-300 font-bold">
                    {civicIntervalHours} Hours Between Reports
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={24}
                  step={1}
                  value={civicIntervalHours}
                  onChange={(e) => setCivicIntervalHours(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>1h (Frequent)</span>
                  <span>6h (Standard)</span>
                  <span>12h (Relaxed)</span>
                  <span>24h (Once daily)</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  handleDiscoverCivicProblem();
                  setIsCivicModalOpen(false);
                }}
                className="w-full sm:w-auto text-xs font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 py-2 px-3 rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🚨</span>
                <span>Scan Ground Radar Now</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCivicModalOpen(false)}
                  disabled={isSavingCivicSettings}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isSavingCivicSettings}
                  disabled={isSavingCivicSettings}
                  onClick={() => handleSaveCivicSettings(civicMaxDaily, civicIntervalHours)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                >
                  Save Sliders
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editorial Publishing & Approval Modes Comparison Guide Modal */}
      {isApprovalGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📖</span>
                  <span>Understanding Publishing &amp; Approval Modes</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  How autonomous story discovery and live publishing work in your newsroom.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsApprovalGuideOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Side-by-Side Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Manual Approval */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <span>✋</span>
                    <span>Manual Approval</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                    Human in the Loop
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  AI scans sources, writes comprehensive fact-checked stories, and places them in your pending review queue.
                </p>
                <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Zero Surprise Posts:</strong> Nothing goes live until an editor clicks &quot;Approve&quot;.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Full Quality Control:</strong> Edit headlines, ledes, and quotes before publication.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>1-Click Quick Publish:</strong> Approve directly from the radar or edit first.</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/40 text-[10px] text-blue-800 dark:text-blue-300 font-semibold">
                  💡 Best for: Regular daytime shifts, sensitive breaking beats, and high editorial vetting.
                </div>
              </div>

              {/* Option 2: Auto-Approval */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Autonomous Auto-Approval</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                    Hands-Free Speed
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  AI discovers and drafts stories, then automatically publishes them after a safety grace buffer (e.g. 5 minutes).
                </p>
                <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Advance Email Alert:</strong> Sent to you the second a story is discovered.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>Safety Countdown Buffer:</strong> 5 minutes to click &quot;Cancel&quot; if you want to hold it.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>24/7 Rapid Coverage:</strong> Keeps the news site updated around the clock without manual clicks.</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold">
                  💡 Best for: Night shifts, wire monitoring, and routine regional developments.
                </div>
              </div>
            </div>

            {/* Quick Summary Comparison Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                  <tr>
                    <th className="p-2.5">Feature</th>
                    <th className="p-2.5">✋ Manual Approval</th>
                    <th className="p-2.5">⚡ Auto-Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300 text-[11px]">
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900 dark:text-white">Who Publishes?</td>
                    <td className="p-2.5">Editor clicks &quot;Approve&quot;</td>
                    <td className="p-2.5">AI publishes automatically</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900 dark:text-white">Safety Buffer</td>
                    <td className="p-2.5">Indefinite (waits in queue)</td>
                    <td className="p-2.5">2–15 minute countdown window</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900 dark:text-white">Email Notification</td>
                    <td className="p-2.5">Digest &amp; alerts</td>
                    <td className="p-2.5">Immediate alert with 1-click cancel</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900 dark:text-white">Can Cancel / Intercept?</td>
                    <td className="p-2.5">Always (delete or edit draft)</td>
                    <td className="p-2.5">Yes, during countdown timer</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsApprovalGuideOpen(false)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 cursor-pointer"
              >
                Got It, Close Guide
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
