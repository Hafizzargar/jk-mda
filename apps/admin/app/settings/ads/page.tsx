'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { Button } from '@/components/Button';
import {
  DEFAULT_ADS_SETTINGS,
  type CustomAdsSettings,
  type CustomAdPlacement,
  type AdThemeAccent,
  type AdSlotType,
  getThemeStyles,
} from '@/lib/ads';

const ACCENT_OPTIONS: { id: AdThemeAccent; label: string; icon: string; bgClass: string }[] = [
  { id: 'gold', label: 'Imperial Gold', icon: '🌟', bgClass: 'bg-amber-500' },
  { id: 'emerald', label: 'Valley Emerald', icon: '🌲', bgClass: 'bg-emerald-500' },
  { id: 'cyan', label: 'Glacier Cyan', icon: '🔷', bgClass: 'bg-cyan-500' },
  { id: 'ruby', label: 'Saffron Ruby', icon: '🌹', bgClass: 'bg-rose-500' },
  { id: 'indigo', label: 'Highland Indigo', icon: '🔮', bgClass: 'bg-indigo-500' },
];

const SLOT_OPTIONS: {
  id: AdSlotType;
  label: string;
  shortLabel: string;
  locationDesc: string;
  icon: string;
  colSpan: string;
}[] = [
  {
    id: 'leaderboard_top',
    label: 'Homepage Top Leaderboard Banner',
    shortLabel: 'Top Banner',
    locationDesc: 'Spans across the very top of the homepage, right beneath the mountain transit pass telemetry bar.',
    icon: '🌟',
    colSpan: 'Full Width (12 cols)',
  },
  {
    id: 'left_rail_sponsor',
    label: 'Left Column Broadsheet Sponsor',
    shortLabel: 'Left Rail',
    locationDesc: 'Fills the space in the left 3-column rail, directly below the Bureau Wire and Territorial Map.',
    icon: '📌',
    colSpan: 'Left Rail (3 cols)',
  },
  {
    id: 'leaderboard_feed',
    label: 'Mid-Feed Broadsheet Sponsor Banner',
    shortLabel: 'Mid Feed',
    locationDesc: 'Spans across the center desk right below lead story pagination and above the agricultural telemetry stream.',
    icon: '📰',
    colSpan: 'Center Desk (6 cols)',
  },
  {
    id: 'sidebar_banner',
    label: 'Right Rail Sidebar Sponsor',
    shortLabel: 'Right Rail',
    locationDesc: 'Displays in the right-hand column beneath the Editorial of Record and Mountain Transit telemetry.',
    icon: '📑',
    colSpan: 'Right Rail (3 cols)',
  },
  {
    id: 'in_article_native',
    label: 'In-Article Story Sponsor',
    shortLabel: 'In-Article',
    locationDesc: 'Injected midway through full-length investigative dispatches and regional article views.',
    icon: '📖',
    colSpan: 'Reader View',
  },
];

export default function AdsSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState<CustomAdsSettings>(DEFAULT_ADS_SETTINGS);
  const [activePlacementId, setActivePlacementId] = useState<string>('left_rail_sponsor');
  const [filterSlot, setFilterSlot] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Auto-Sync and Drag-and-Drop state
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'synced' | 'error'>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'studio' | 'wireframe'>('studio');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [draggedAdId, setDraggedAdId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<AdSlotType | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

        const role = (profile as { role_key?: string }).role_key || 'staff';
        setUserRole(role);

        const allowedRoles = ['owner', 'superadmin', 'admin', 'editor'];
        if (!allowedRoles.includes(role)) {
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

        const hasAccess = allowedRoles.includes(role);
        setCanManage(hasAccess);

        // Fetch current custom_ads from API route
        const token = sessionData.session.access_token;
        const res = await fetch('/api/settings/ads', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          if (json.settings) {
            setForm(json.settings);
            if (json.settings.placements && json.settings.placements.length > 0) {
              setActivePlacementId(json.settings.placements[0].id);
            }
          }
          if (typeof json.can_manage === 'boolean') {
            setCanManage(json.can_manage);
          }
          setSyncStatus('synced');
          setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (err: unknown) {
        console.error('Failed to load ads settings:', err);
        setErrorMsg('Failed to load current ads configuration.');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [router]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
    };
  }, []);

  // Universal Auto-Sync Handler
  const triggerAutoSync = async (updatedSettings: CustomAdsSettings, notificationMsg?: string) => {
    try {
      setSyncStatus('saving');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updatedSettings),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to auto-sync ads configuration');
      }

      setSyncStatus('synced');
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setHasUnsavedChanges(false);

      if (notificationMsg) {
        setSuccessMsg(notificationMsg);
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err: unknown) {
      console.error('[Ads Auto-Sync Error]', err);
      setSyncStatus('error');
    }
  };

  // Debounced auto-sync for text input edits
  const debouncedAutoSync = (updatedSettings: CustomAdsSettings) => {
    setHasUnsavedChanges(true);
    setSyncStatus('saving');
    if (autoSyncTimeoutRef.current) {
      clearTimeout(autoSyncTimeoutRef.current);
    }
    autoSyncTimeoutRef.current = setTimeout(() => {
      triggerAutoSync(updatedSettings);
    }, 700);
  };

  // Update a specific field of an ad
  const updatePlacement = (index: number, field: keyof CustomAdPlacement, value: unknown) => {
    setForm((prev) => {
      const nextPlacements = [...prev.placements];
      nextPlacements[index] = {
        ...nextPlacements[index],
        [field]: value,
        updated_at: new Date().toISOString(),
      };
      const updatedSettings = { ...prev, placements: nextPlacements };
      debouncedAutoSync(updatedSettings);
      return updatedSettings;
    });
  };

  // Assign Ad to Slot with automatic swapping and immediate auto-sync
  const assignAdToSlot = (adId: string, targetSlot: AdSlotType) => {
    setForm((prev) => {
      const targetAd = prev.placements.find((p) => p.id === adId);
      if (!targetAd) return prev;

      const previousSlot = targetAd.slot || (targetAd.id as AdSlotType);
      const existingOccupant = prev.placements.find(
        (p) => p.id !== adId && (p.slot || p.id) === targetSlot && p.enabled
      );

      const nextPlacements = prev.placements.map((p) => {
        if (p.id === adId) {
          const slotMeta = SLOT_OPTIONS.find((s) => s.id === targetSlot);
          return {
            ...p,
            slot: targetSlot,
            name: `${slotMeta?.label || 'Ad'} (${p.sponsor_name || 'Custom'})`,
            enabled: true,
            updated_at: new Date().toISOString(),
          };
        }
        // If another ad already occupied targetSlot, swap it with previousSlot!
        if (existingOccupant && p.id === existingOccupant.id) {
          const slotMeta = SLOT_OPTIONS.find((s) => s.id === previousSlot);
          return {
            ...p,
            slot: previousSlot,
            name: `${slotMeta?.label || 'Ad'} (${p.sponsor_name || 'Custom'})`,
            updated_at: new Date().toISOString(),
          };
        }
        return p;
      });

      const updatedSettings = { ...prev, placements: nextPlacements };
      const slotMeta = SLOT_OPTIONS.find((s) => s.id === targetSlot);
      const swapNotice = existingOccupant
        ? ` (Swapped with "${existingOccupant.sponsor_name || 'other ad'}")`
        : '';

      triggerAutoSync(
        updatedSettings,
        `⚡ Auto-Synced: "${targetAd.sponsor_name || targetAd.title}" placed in ${slotMeta?.label || targetSlot}${swapNotice}`
      );
      return updatedSettings;
    });

    setActivePlacementId(adId);
  };

  // Change slot via dropdown (immediate auto-sync)
  const handleSlotChange = (index: number, slotId: AdSlotType) => {
    const ad = form.placements[index];
    if (ad) {
      assignAdToSlot(ad.id, slotId);
    }
  };

  // Clear / Unassign Ad from Slot
  const clearAdFromSlot = (slotId: AdSlotType) => {
    setForm((prev) => {
      const occupant = prev.placements.find((p) => (p.slot || p.id) === slotId && p.enabled);
      if (!occupant) return prev;

      const nextPlacements = prev.placements.map((p) =>
        p.id === occupant.id ? { ...p, enabled: false, updated_at: new Date().toISOString() } : p
      );
      const updatedSettings = { ...prev, placements: nextPlacements };
      triggerAutoSync(
        updatedSettings,
        `Ad "${occupant.sponsor_name}" unslotted and paused. (Slot is now clear)`
      );
      return updatedSettings;
    });
  };

  // Create a brand new ad with immediate auto-sync
  const handleCreateNewAd = (preferredSlot: AdSlotType = 'left_rail_sponsor') => {
    const newId = `ad_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const slotInfo = SLOT_OPTIONS.find((s) => s.id === preferredSlot);
    const newAd: CustomAdPlacement = {
      id: newId,
      slot: preferredSlot,
      name: `${slotInfo?.label || 'Custom Ad'}`,
      enabled: true,
      sponsor_name: 'New Commercial Sponsor',
      badge_label: 'Sponsored',
      title: 'Commercial Sponsor Headline',
      description: 'Enter the advertisement description, highlights, and promotion offer here.',
      cta_text: 'Learn More',
      destination_url: 'https://',
      image_url: null,
      theme_accent: 'gold',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedSettings: CustomAdsSettings = {
      ...form,
      placements: [newAd, ...form.placements],
    };

    setForm(updatedSettings);
    setActivePlacementId(newId);
    setViewMode('studio');
    triggerAutoSync(
      updatedSettings,
      '✨ New ad created & auto-synced! Drag it into any slot below or edit details.'
    );
  };

  // Delete an ad with immediate auto-sync
  const handleDeleteAd = (idToDelete: string) => {
    const target = form.placements.find((p) => p.id === idToDelete);
    const filtered = form.placements.filter((p) => p.id !== idToDelete);
    const updatedSettings = { ...form, placements: filtered };

    setForm(updatedSettings);
    setDeleteConfirmId(null);

    const remaining = filtered;
    if (remaining.length > 0) {
      setActivePlacementId(remaining[0].id);
    }

    triggerAutoSync(
      updatedSettings,
      `🗑️ Deleted "${target?.sponsor_name || 'ad'}" & auto-synced to site.`
    );
  };

  // Restore Default Regional Ads
  const handleRestoreDefaults = () => {
    if (
      !window.confirm(
        'Are you sure you want to restore the verified default J&K ads? This will reload the 5 curated broadsheet placements.'
      )
    ) {
      return;
    }

    const updatedSettings: CustomAdsSettings = {
      ...form,
      placements: DEFAULT_ADS_SETTINGS.placements.map((p) => ({ ...p, id: `ad_${p.id}` })),
    };

    setForm(updatedSettings);
    setActivePlacementId('ad_left_rail_sponsor');
    triggerAutoSync(updatedSettings, '↺ Restored verified default ads & auto-synced.');
  };

  // Upload an image from computer
  const handleUploadImage = async (placementIndex: number, file: File) => {
    try {
      setUploadingIndex(placementIndex);
      setErrorMsg(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to upload image');
      }

      updatePlacement(placementIndex, 'image_url', json.url);
      setSuccessMsg('Image uploaded and attached to ad successfully!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      console.error('Image upload failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingIndex(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Manual explicit save button
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save ads configuration');
      }

      if (json.settings) {
        setForm(json.settings);
      }

      setHasUnsavedChanges(false);
      setSyncStatus('synced');
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSuccessMsg('All ads saved, published, and synced to live website!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      console.error('Error saving ads:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // HTML5 Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, adId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ adId }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedAdId(adId);
  };

  const handleDragOver = (e: React.DragEvent, slotId: AdSlotType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlot !== slotId) {
      setDragOverSlot(slotId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, slotId: AdSlotType) => {
    e.preventDefault();
    if (dragOverSlot === slotId) {
      setDragOverSlot(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSlotId: AdSlotType) => {
    e.preventDefault();
    setDragOverSlot(null);

    let adId = draggedAdId;
    if (!adId) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) {
          const parsed = JSON.parse(raw);
          adId = parsed.adId;
        }
      } catch {
        // ignore
      }
    }

    if (adId) {
      assignAdToSlot(adId, targetSlotId);
    }
    setDraggedAdId(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-xs text-slate-400 font-mono">Loading revenue &amp; ad placements...</p>
        </div>
      </div>
    );
  }

  const activeIndex = form.placements.findIndex((p) => p.id === activePlacementId);
  const activePlacement = activeIndex >= 0 ? form.placements[activeIndex] : form.placements[0];
  const activeStyles = activePlacement ? getThemeStyles(activePlacement.theme_accent) : null;
  const activeSlot = activePlacement ? (activePlacement.slot || (activePlacement.id as AdSlotType)) : 'left_rail_sponsor';
  const activeSlotInfo = SLOT_OPTIONS.find((s) => s.id === activeSlot) || SLOT_OPTIONS[0];

  // Helper to find which ad occupies a slot
  const getAdInSlot = (slotId: AdSlotType): CustomAdPlacement | null => {
    const direct = form.placements.find(
      (p) => (p.slot === slotId || p.id === slotId) && p.enabled
    );
    if (direct) return direct;
    return null;
  };

  // Filtered placements list for the inventory tray
  const filteredPlacements = form.placements.filter((p) => {
    if (filterSlot === 'all') return true;
    const slot = p.slot || p.id;
    return slot === filterSlot;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-24 px-4 sm:px-6">
      {/* 1. Sleek Modern Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Commercial Ads &amp; Sponsors
            </h1>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {form.placements.length} {form.placements.length === 1 ? 'Ad' : 'Ads'}
            </span>

            {/* Live Auto-Sync Status Badge */}
            {syncStatus === 'saving' ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Syncing...</span>
              </span>
            ) : syncStatus === 'synced' ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Live Synced {lastSyncedAt ? `(${lastSyncedAt})` : ''}</span>
              </span>
            ) : syncStatus === 'error' ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                <span>⚠️ Sync Error</span>
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure homepage broadsheet banners, right rail sponsors, and in-article announcements.
          </p>
        </div>

        {/* Header Right Actions: Compact Monetization Switch + Create Ad */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Compact Master Monetization Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              Site Monetization:
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.monetization_enabled}
                onChange={(e) => {
                  const nextVal = e.target.checked;
                  const nextSettings = { ...form, monetization_enabled: nextVal };
                  setForm(nextSettings);
                  triggerAutoSync(
                    nextSettings,
                    nextVal ? 'Monetization enabled: Ads are now visible on site.' : 'Monetization paused: All ads hidden.'
                  );
                }}
                disabled={!canManage}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
            <span className={`text-[11px] font-bold ${form.monetization_enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {form.monetization_enabled ? 'Active' : 'Paused'}
            </span>
          </div>

          <Button
            type="button"
            onClick={() => handleCreateNewAd()}
            variant="primary"
            size="sm"
            icon={<span>+</span>}
            className="font-bold shadow-xs"
          >
            New Ad
          </Button>

          {canManage && (
            <Button
              type="button"
              onClick={handleSubmit}
              variant="secondary"
              size="sm"
              disabled={saving}
              isLoading={saving}
            >
              {saving ? 'Publishing...' : 'Publish'}
            </Button>
          )}

          <Button
            href="http://localhost:3000"
            external
            variant="secondary"
            size="sm"
          >
            Live Site ↗
          </Button>
        </div>
      </div>

      {/* 2. Unified Navigation & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        {/* Navigation Breadcrumbs / Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
          <Link
            href="/settings/layout"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition whitespace-nowrap"
          >
            1. Layout Canvas
          </Link>
          <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs shadow-2xs whitespace-nowrap">
            2. Ads &amp; Sponsors
          </span>
          <Link
            href="/settings/curation"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition whitespace-nowrap"
          >
            3. Story Slotting
          </Link>
        </div>

        {/* View Switcher: Studio & Editor vs Visual Wireframe */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'studio'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>📋</span>
            <span>Ad Studio &amp; Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('wireframe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'wireframe'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>🗺️</span>
            <span>Broadsheet Wireframe</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-200 shadow-md">
          <div className="flex items-center gap-2 font-bold text-red-400 mb-1">
            <span>⚠️</span> Error
          </div>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-200 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
            <span>✓</span> Success
          </div>
          {successMsg}
        </div>
      )}

      {/* Delete Confirmation Modal / Banner */}
      {deleteConfirmId && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/60 p-4 text-xs text-red-200 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <span className="font-bold">Are you sure you want to delete this ad?</span>
              <p className="text-[11px] text-red-300">This action will remove the advertisement from the database immediately.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmId(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDeleteAd(deleteConfirmId)}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VISUAL HOMEPAGE AD PLACEMENT PREVIEW & DRAG-AND-DROP CANVAS           */}
      {/* ========================================================================= */}
      {viewMode === 'wireframe' && (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Homepage Ad Wireframe &amp; Drag-and-Drop Placement Canvas
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Drag any ad card and drop it directly onto a slot. Or drag an ad between slots to swap them.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                  previewMode === 'desktop'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>🖥️</span>
                <span>Desktop Broadsheet (3-Col)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                  previewMode === 'mobile'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>📱</span>
                <span>Mobile Feed Stream</span>
              </button>
            </div>
          </div>
        </div>

        {/* The Wireframe Board */}
        <div
          className={`mx-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 space-y-4 transition-all ${
            previewMode === 'mobile' ? 'max-w-md' : 'w-full'
          }`}
        >
          {/* Mock Top Telemetry Bar */}
          <div className="rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-3 py-1.5 text-[11px] font-mono flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span>🏔️</span>
              <span className="font-semibold">CORRIDOR MOUNTAIN TRANSIT &amp; PASS TELEMETRY</span>
            </span>
            <span className="text-[10px] opacity-70">Peer Ki Gali &bull; Zojila &bull; Banihal</span>
          </div>

          {/* ========================================================================= */}
          {/* SLOT 1: TOP LEADERBOARD BANNER (Full Width)                               */}
          {/* ========================================================================= */}
          {(() => {
            const slotAd = getAdInSlot('leaderboard_top');
            const isTarget = dragOverSlot === 'leaderboard_top';
            return (
              <div
                onDragOver={(e) => handleDragOver(e, 'leaderboard_top')}
                onDragLeave={(e) => handleDragLeave(e, 'leaderboard_top')}
                onDrop={(e) => handleDrop(e, 'leaderboard_top')}
                className={`relative rounded-xl border-2 transition-all p-3 text-xs ${
                  isTarget
                    ? 'border-cyan-400 bg-cyan-500/15 ring-4 ring-cyan-500/30 scale-[1.01]'
                    : slotAd
                    ? 'border-slate-700 bg-slate-900/90 text-white shadow-md'
                    : 'border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <span>🌟</span>
                    <span>Slot 1: Homepage Top Leaderboard Banner (100% Width)</span>
                  </span>
                  {slotAd && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePlacementId(slotAd.id);
                          setViewMode('studio');
                        }}
                        className="text-[11px] px-2.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer"
                      >
                        ✏️ Edit Ad
                      </button>
                      <button
                        type="button"
                        onClick={() => clearAdFromSlot('leaderboard_top')}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 hover:bg-red-900 font-semibold transition cursor-pointer"
                        title="Remove ad from this slot"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {slotAd ? (
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, slotAd.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-black/40 border border-white/10 cursor-grab active:cursor-grabbing hover:border-amber-400/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      {slotAd.image_url ? (
                        <div className="relative w-16 h-12 rounded overflow-hidden border border-white/20 shrink-0">
                          <Image
                            src={slotAd.image_url}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-12 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                          BANNER
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300">
                            {slotAd.badge_label || 'PARTNER'}
                          </span>
                          <span className="font-bold text-white text-xs truncate max-w-xs">
                            {slotAd.sponsor_name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-semibold line-clamp-1 mt-0.5">
                          {slotAd.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 italic">⠿ Drag to swap</span>
                      {slotAd.destination_url && slotAd.destination_url.trim() && slotAd.destination_url.trim() !== 'https://' && (
                        <span className="px-3 py-1 rounded bg-amber-500 text-slate-950 font-bold text-xs">
                          {slotAd.cta_text || 'Learn More'} &rarr;
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      📥 Drop any ad here to assign to the Top Leaderboard Banner
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Or select an ad from inventory below and click &quot;Top Banner&quot;
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* BROADSHEET 3-COLUMN LAYOUT: LEFT (3 cols) | CENTER (6 cols) | RIGHT (3)   */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* ------------------------------------------------------------- */}
            {/* LEFT COLUMN RAIL (3 cols)                                     */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-3 space-y-3">
              {/* Mock Bureau Wire Header */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="font-bold text-red-600">● BUREAU WIRE</span>
                <p className="text-[10px] text-slate-400 mt-1">Field dispatches from 20 J&amp;K districts...</p>
              </div>

              {/* Mock Map Overview */}
              <div className="p-2 rounded-lg bg-slate-900 text-slate-300 text-[10px] border border-slate-700">
                🗺️ Territorial Station Telemetry (Srinagar &amp; Jammu)
              </div>

              {/* SLOT 2: LEFT COLUMN BROADSHEET SPONSOR */}
              {(() => {
                const slotAd = getAdInSlot('left_rail_sponsor');
                const isTarget = dragOverSlot === 'left_rail_sponsor';
                const styles = slotAd ? getThemeStyles(slotAd.theme_accent) : null;
                return (
                  <div
                    onDragOver={(e) => handleDragOver(e, 'left_rail_sponsor')}
                    onDragLeave={(e) => handleDragLeave(e, 'left_rail_sponsor')}
                    onDrop={(e) => handleDrop(e, 'left_rail_sponsor')}
                    className={`relative rounded-xl border-2 transition-all p-3 text-xs ${
                      isTarget
                        ? 'border-cyan-400 bg-cyan-500/15 ring-4 ring-cyan-500/30 scale-[1.02]'
                        : slotAd
                        ? 'border-slate-700 bg-slate-900 text-white shadow-md'
                        : 'border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <span>📌</span>
                        <span>Slot 2: Left Column Sponsor</span>
                      </span>
                      {slotAd && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePlacementId(slotAd.id);
                              setViewMode('studio');
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => clearAdFromSlot('left_rail_sponsor')}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 hover:bg-red-900 cursor-pointer"
                            title="Clear slot"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {slotAd ? (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, slotAd.id)}
                        onClick={() => {
                          setActivePlacementId(slotAd.id);
                          setViewMode('studio');
                        }}
                        className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-2 cursor-grab active:cursor-grabbing hover:border-cyan-400 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {slotAd.badge_label || 'SPONSOR'}
                          </span>
                          <span className="text-[10px] text-slate-400">⠿ Drag to move</span>
                        </div>
                        {slotAd.image_url && (
                          <div className="relative w-full h-24 rounded overflow-hidden border border-white/10">
                            <Image src={slotAd.image_url} alt="" fill className="object-cover" unoptimized />
                          </div>
                        )}
                        <h4 className="font-bold text-white text-xs line-clamp-2">{slotAd.title}</h4>
                        <p className="text-[11px] text-slate-300 line-clamp-2">{slotAd.description}</p>
                        {slotAd.destination_url && slotAd.destination_url.trim() && slotAd.destination_url.trim() !== 'https://' && (
                          <button
                            type="button"
                            className="w-full py-1 rounded bg-slate-800 border border-slate-700 text-white font-bold text-[11px]"
                          >
                            {slotAd.cta_text || 'Learn More'} &rarr;
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <span className="text-xl block mb-1">📥</span>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Drop Ad Here for Left Column
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* CENTER LEAD DESK (6 cols)                                     */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-6 space-y-3">
              {/* Mock Lead Story */}
              <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">ENVIRONMENT &bull; SPECIAL INVESTIGATION</span>
                <h3 className="font-serif font-bold text-sm text-slate-900 dark:text-white leading-snug">
                  International Cryosphere Consortium &amp; University of Kashmir Launch Glacier Mission
                </h3>
                <div className="w-full h-28 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-500">
                  🏔️ Lead Broadsheet Investigative Photo
                </div>
              </div>

              {/* SLOT 3: MID-FEED BROADSHEET SPONSOR BANNER */}
              {(() => {
                const slotAd = getAdInSlot('leaderboard_feed');
                const isTarget = dragOverSlot === 'leaderboard_feed';
                const styles = slotAd ? getThemeStyles(slotAd.theme_accent) : null;
                return (
                  <div
                    onDragOver={(e) => handleDragOver(e, 'leaderboard_feed')}
                    onDragLeave={(e) => handleDragLeave(e, 'leaderboard_feed')}
                    onDrop={(e) => handleDrop(e, 'leaderboard_feed')}
                    className={`relative rounded-xl border-2 transition-all p-3 text-xs ${
                      isTarget
                        ? 'border-cyan-400 bg-cyan-500/15 ring-4 ring-cyan-500/30 scale-[1.01]'
                        : slotAd
                        ? 'border-slate-700 bg-slate-900 text-white shadow-md'
                        : 'border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <span>📰</span>
                        <span>Slot 3: Mid-Feed Center Banner (Below Stories &amp; Pagination)</span>
                      </span>
                      {slotAd && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePlacementId(slotAd.id);
                              setViewMode('studio');
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => clearAdFromSlot('leaderboard_feed')}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 hover:bg-red-900 cursor-pointer"
                            title="Clear slot"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {slotAd ? (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, slotAd.id)}
                        onClick={() => {
                          setActivePlacementId(slotAd.id);
                          setViewMode('studio');
                        }}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-black/40 border border-white/10 cursor-grab active:cursor-grabbing hover:border-cyan-400 transition"
                      >
                        <div className="flex items-center gap-3">
                          {slotAd.image_url ? (
                            <div className="relative w-16 h-12 rounded overflow-hidden border border-white/20 shrink-0">
                              <Image src={slotAd.image_url} alt="" fill className="object-cover" unoptimized />
                            </div>
                          ) : (
                            <div className="w-16 h-12 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              MID-FEED
                            </div>
                          )}
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                              {slotAd.badge_label || 'PARTNER'}
                            </span>
                            <h4 className="font-bold text-white text-xs truncate max-w-xs mt-0.5">
                              {slotAd.title}
                            </h4>
                            <p className="text-[11px] text-slate-300 truncate max-w-sm">
                              {slotAd.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400 italic">⠿ Drag to move</span>
                          {slotAd.destination_url && slotAd.destination_url.trim() && slotAd.destination_url.trim() !== 'https://' && (
                            <span className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-white font-bold text-xs">
                              {slotAd.cta_text || 'Explore'} &rarr;
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <span className="text-xl block mb-1">📥</span>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Drop Ad Here for Mid-Feed Center Banner
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT COLUMN RAIL (3 cols)                                    */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-3 space-y-3">
              {/* Mock Right Column Elements */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="font-bold text-blue-600">🌐 INTERNATIONAL WIRE &amp; CONFLICT</span>
                <p className="text-[10px] text-slate-400 mt-0.5">UN, Global Diplomacy &amp; Defense...</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="font-semibold text-slate-900 dark:text-white">EDITORIAL OF RECORD</span>
                <p className="text-[10px] text-slate-500 italic mt-0.5">&quot;The Pluralistic Pulse of the Corridors...&quot;</p>
              </div>

              {/* SLOT 4: RIGHT RAIL SIDEBAR SPONSOR */}
              {(() => {
                const slotAd = getAdInSlot('sidebar_banner');
                const isTarget = dragOverSlot === 'sidebar_banner';
                return (
                  <div
                    onDragOver={(e) => handleDragOver(e, 'sidebar_banner')}
                    onDragLeave={(e) => handleDragLeave(e, 'sidebar_banner')}
                    onDrop={(e) => handleDrop(e, 'sidebar_banner')}
                    className={`relative rounded-xl border-2 transition-all p-3 text-xs ${
                      isTarget
                        ? 'border-cyan-400 bg-cyan-500/15 ring-4 ring-cyan-500/30 scale-[1.02]'
                        : slotAd
                        ? 'border-slate-700 bg-slate-900 text-white shadow-md'
                        : 'border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <span>📑</span>
                        <span>Slot 4: Right Rail Sidebar Sponsor</span>
                      </span>
                      {slotAd && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePlacementId(slotAd.id);
                              setViewMode('studio');
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => clearAdFromSlot('sidebar_banner')}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 hover:bg-red-900 cursor-pointer"
                            title="Clear slot"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {slotAd ? (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, slotAd.id)}
                        onClick={() => {
                          setActivePlacementId(slotAd.id);
                          setViewMode('studio');
                        }}
                        className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-2 cursor-grab active:cursor-grabbing hover:border-cyan-400 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {slotAd.badge_label || 'SPONSOR'}
                          </span>
                          <span className="text-[10px] text-slate-400">⠿ Drag to move</span>
                        </div>
                        {slotAd.image_url && (
                          <div className="relative w-full h-24 rounded overflow-hidden border border-white/10">
                            <Image src={slotAd.image_url} alt="" fill className="object-cover" unoptimized />
                          </div>
                        )}
                        <h4 className="font-bold text-white text-xs line-clamp-2">{slotAd.title}</h4>
                        <p className="text-[11px] text-slate-300 line-clamp-2">{slotAd.description}</p>
                        {slotAd.destination_url && slotAd.destination_url.trim() && slotAd.destination_url.trim() !== 'https://' && (
                          <button
                            type="button"
                            className="w-full py-1 rounded bg-slate-800 border border-slate-700 text-white font-bold text-[11px]"
                          >
                            {slotAd.cta_text || 'Learn More'} &rarr;
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <span className="text-xl block mb-1">📥</span>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Drop Ad Here for Right Rail
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SLOT 5: IN-ARTICLE STORY SPONSOR (Reader View)                            */}
          {/* ========================================================================= */}
          {(() => {
            const slotAd = getAdInSlot('in_article_native');
            const isTarget = dragOverSlot === 'in_article_native';
            return (
              <div
                onDragOver={(e) => handleDragOver(e, 'in_article_native')}
                onDragLeave={(e) => handleDragLeave(e, 'in_article_native')}
                onDrop={(e) => handleDrop(e, 'in_article_native')}
                className={`relative rounded-xl border-2 transition-all p-3 text-xs ${
                  isTarget
                    ? 'border-cyan-400 bg-cyan-500/15 ring-4 ring-cyan-500/30 scale-[1.01]'
                    : slotAd
                    ? 'border-slate-700 bg-slate-900 text-white shadow-md'
                    : 'border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <span>📖</span>
                    <span>Slot 5: In-Article Native Story Sponsor (Inside Dispatches &amp; Article Pages)</span>
                  </span>
                  {slotAd && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePlacementId(slotAd.id);
                          setViewMode('studio');
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition cursor-pointer"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => clearAdFromSlot('in_article_native')}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 hover:bg-red-900 cursor-pointer"
                        title="Clear slot"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {slotAd ? (
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, slotAd.id)}
                    onClick={() => {
                      setActivePlacementId(slotAd.id);
                      setViewMode('studio');
                    }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-black/40 border border-white/10 cursor-grab active:cursor-grabbing hover:border-cyan-400 transition"
                  >
                    <div className="flex items-center gap-3">
                      {slotAd.image_url ? (
                        <div className="relative w-16 h-12 rounded overflow-hidden border border-white/20 shrink-0">
                          <Image src={slotAd.image_url} alt="" fill className="object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="w-16 h-12 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                          ARTICLE
                        </div>
                      )}
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {slotAd.badge_label || 'STORY SPONSOR'}
                        </span>
                        <h4 className="font-bold text-white text-xs truncate max-w-xs mt-0.5">
                          {slotAd.title}
                        </h4>
                        <p className="text-[11px] text-slate-300 truncate max-w-sm">
                          {slotAd.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 italic">⠿ Drag to move</span>
                      {slotAd.destination_url && slotAd.destination_url.trim() && slotAd.destination_url.trim() !== 'https://' && (
                        <span className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-white font-bold text-xs">
                          {slotAd.cta_text || 'View Story'} &rarr;
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <span className="text-xl block mb-1">📥</span>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Drop Ad Here for In-Article Native Story Sponsor
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* 5. AD INVENTORY TRAY & QUICK PLACEMENT PILLS                              */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📢</span>
              <span>Ad Inventory &amp; Quick Assignment ({form.placements.length})</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Drag any card onto the wireframe above, or click one of the slot pills on the card to assign instantly.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="text-xs text-slate-500 hover:text-cyan-500 dark:text-slate-400 transition underline mr-2"
            >
              ↺ Restore Defaults
            </button>
            <button
              type="button"
              onClick={() => handleCreateNewAd()}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-sm transition"
            >
              <span>➕</span>
              <span>Create Ad</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterSlot('all')}
            className={`px-3 py-1 rounded-lg border font-medium transition ${
              filterSlot === 'all'
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-bold'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}
          >
            All Slots ({form.placements.length})
          </button>
          {SLOT_OPTIONS.map((slot) => {
            const count = form.placements.filter((p) => (p.slot || p.id) === slot.id).length;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setFilterSlot(slot.id)}
                className={`px-3 py-1 rounded-lg border font-medium transition flex items-center gap-1 whitespace-nowrap ${
                  filterSlot === slot.id
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-bold'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>{slot.icon}</span>
                <span>{slot.shortLabel}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Ad Cards Grid */}
        {filteredPlacements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white dark:bg-slate-900/40">
            <span className="text-2xl mb-2 block">📭</span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No ads found in this filter.</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">Click below to create an ad for this placement slot.</p>
            <button
              type="button"
              onClick={() => handleCreateNewAd(filterSlot !== 'all' ? (filterSlot as AdSlotType) : 'left_rail_sponsor')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-500 transition shadow"
            >
              ➕ Create Ad For This Slot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {filteredPlacements.map((placement) => {
              const isActive = placement.id === activePlacementId;
              const slot = placement.slot || (placement.id as AdSlotType);
              const slotInfo = SLOT_OPTIONS.find((s) => s.id === slot);
              return (
                <div
                  key={placement.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, placement.id)}
                  onClick={() => setActivePlacementId(placement.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing relative flex flex-col justify-between select-none ${
                    isActive
                      ? 'border-cyan-500 bg-cyan-500/10 shadow-md ring-2 ring-cyan-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <span>{slotInfo?.icon || '📌'}</span>
                        <span className="truncate">{slotInfo?.shortLabel || 'Slot'}</span>
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          placement.enabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-500'
                        }`}
                        title={placement.enabled ? 'Active on site' : 'Paused'}
                      />
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {placement.sponsor_name || 'Unnamed Sponsor'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {placement.title}
                    </div>

                    {/* Quick Move Pills */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-[9px] uppercase font-mono text-slate-400 block mb-1">
                        Quick Move:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {SLOT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              assignAdToSlot(placement.id, opt.id);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition ${
                              (placement.slot || placement.id) === opt.id
                                ? 'bg-cyan-600 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                            title={`Move to ${opt.label}`}
                          >
                            {opt.icon} {opt.shortLabel.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 uppercase font-mono">{placement.theme_accent}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">⠿ Drag</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(placement.id);
                        }}
                        className="text-red-500 hover:text-red-700 font-bold transition px-1 ml-1"
                        title="Delete this ad"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
