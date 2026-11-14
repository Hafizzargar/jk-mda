'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_CELEBRATION_ITEMS,
  FESTIVE_PRESETS,
  getCelebrationStatus,
  getActiveCelebration,
  type FestiveCelebrationItem,
  type FestiveEffectType,
  type CelebrationStatus,
} from '@/lib/festive';

const EFFECT_OPTIONS: { id: FestiveEffectType; label: string; icon: string; description: string }[] = [
  {
    id: 'firelight_sparkles',
    label: 'Firelight Embers & Sparkles',
    icon: '✨',
    description: 'Warm glowing embers floating upward with gentle ambient diya illumination (Diwali / New Year)',
  },
  {
    id: 'fireworks',
    label: 'Cascading Fireworks',
    icon: '🎆',
    description: 'Sky burst fireworks with high-velocity radiating particles & sparkle trails (28 Nov / Milestones)',
  },
  {
    id: 'crescent_stars',
    label: 'Crescent Glow & Starlight',
    icon: '🌙',
    description: 'Royal emerald & golden starlight particles floating like lanterns (Eid / Ramadan)',
  },
  {
    id: 'color_burst',
    label: 'Vibrant Gulal Color Splash',
    icon: '🎨',
    description: 'Joyous multi-color festive powder bursts that diffuse softly across the broadsheet (Holi)',
  },
  {
    id: 'tricolor_burst',
    label: 'National Tricolor',
    icon: '🇮🇳',
    description: 'Saffron, white, and emerald green celebration particles (Republic & Independence Days)',
  },
];

const PALETTE_PRESETS: { label: string; colors: string[] }[] = [
  { label: 'Diwali Gold & Crimson', colors: ['#F59E0B', '#EF4444', '#FBBF24', '#D97706', '#FEF08A'] },
  { label: 'Eid Emerald & Amber', colors: ['#10B981', '#F59E0B', '#059669', '#FBBF24', '#34D399'] },
  { label: 'Holi Multi-Color Splash', colors: ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#06B6D4', '#F43F5E'] },
  { label: 'National Tricolor', colors: ['#FF9933', '#FFFFFF', '#138808', '#000080'] },
  { label: '28 Nov Sapphire & Gold', colors: ['#F59E0B', '#06B6D4', '#8B5CF6', '#10B981', '#3B82F6'] },
];

export default function FestiveCelebrationsDesk() {
  const router = useRouter();

  const [items, setItems] = useState<FestiveCelebrationItem[]>(DEFAULT_CELEBRATION_ITEMS);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'synced' | 'error'>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CelebrationStatus>('all');

  // Active item in simulator
  const [simulatedItem, setSimulatedItem] = useState<FestiveCelebrationItem | null>(null);

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FestiveCelebrationItem | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Canvas simulator refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    alpha: number;
    life: number;
    maxLife: number;
  }>>([]);

  // Fetch all celebrations from API
  const loadCelebrations = async () => {
    try {
      setLoading(true);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        router.push('/login');
        return;
      }

      const token = sessionData.session.access_token;
      const res = await fetch('/api/settings/celebrations', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.items)) {
          setItems(json.items);
          const active = getActiveCelebration(json.items);
          setSimulatedItem(active || json.items[0] || null);
        }
        if (typeof json.can_manage === 'boolean') {
          setCanManage(json.can_manage);
        }
        setSyncStatus('synced');
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.error('Failed to load celebrations:', err);
      setErrorMsg('Failed to load festive celebrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCelebrations();
  }, []);

  // Cleanup canvas on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Trigger Burst in Simulator
  const triggerSimulatorBurst = (targetItem?: FestiveCelebrationItem | null) => {
    const item = targetItem || simulatedItem;
    const canvas = canvasRef.current;
    if (!canvas || !item) return;

    const width = canvas.width;
    const height = canvas.height;
    const colors = item.colors && item.colors.length > 0 ? item.colors : ['#F59E0B', '#EF4444', '#10B981'];
    const isFirelight = item.effect_type === 'firelight_sparkles';
    const count = isFirelight ? 60 : 80;

    const newParticles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      life: number;
      maxLife: number;
    }> = [];

    if (isFirelight) {
      for (let i = 0; i < count; i++) {
        newParticles.push({
          x: Math.random() * width,
          y: height + Math.random() * 20,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -(Math.random() * 2.5 + 1),
          size: Math.random() * 4 + 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          life: 0,
          maxLife: Math.random() * 100 + 60,
        });
      }
    } else {
      const origins = [
        { x: width * 0.25, y: height * 0.4 },
        { x: width * 0.5, y: height * 0.3 },
        { x: width * 0.75, y: height * 0.4 },
      ];
      origins.forEach((origin) => {
        const burstCount = Math.floor(count / origins.length);
        for (let i = 0; i < burstCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 4.5 + 1.2;
          newParticles.push({
            x: origin.x,
            y: origin.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 1.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            life: 0,
            maxLife: Math.random() * 70 + 40,
          });
        }
      });
    }

    particlesRef.current = newParticles;

    if (!animationFrameRef.current) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const animate = () => {
        ctx.clearRect(0, 0, width, height);

        const current = particlesRef.current;
        for (let i = current.length - 1; i >= 0; i--) {
          const p = current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life++;

          if (!isFirelight) {
            p.vy += 0.04; // gravity
            p.vx *= 0.98;
          }

          p.alpha = Math.max(0, 1 - p.life / p.maxLife);

          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          if (p.life >= p.maxLife || p.alpha <= 0) {
            current.splice(i, 1);
          }
        }

        if (current.length > 0) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          animationFrameRef.current = null;
          ctx.clearRect(0, 0, width, height);
        }
      };

      animate();
    }
  };

  // Re-trigger simulator burst when simulatedItem changes
  useEffect(() => {
    if (simulatedItem) {
      triggerSimulatorBurst(simulatedItem);
    }
  }, [simulatedItem]);

  // Execute API CRUD Action
  const executeApiAction = async (payload: Record<string, unknown>, successText: string) => {
    if (!canManage) return;
    setSyncStatus('saving');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch('/api/settings/celebrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Request failed');
      }

      const json = await res.json();
      if (Array.isArray(json.items)) {
        setItems(json.items);
        const active = getActiveCelebration(json.items);
        if (active) setSimulatedItem(active);
      }

      setSyncStatus('synced');
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSuccessMsg(successText);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      console.error('API action error:', err);
      setErrorMsg(msg);
      setSyncStatus('error');
    }
  };

  // Quick Action: Toggle Enabled
  const handleToggle = (id: string, currentEnabled: boolean) => {
    executeApiAction(
      { action: 'toggle', id },
      currentEnabled ? 'Celebration paused.' : 'Celebration enabled and scheduled.'
    );
  };

  // Quick Action: Test Fire Now (force_active_now)
  const handleTestNow = (targetItem: FestiveCelebrationItem) => {
    setSimulatedItem(targetItem);
    triggerSimulatorBurst(targetItem);
    executeApiAction(
      { action: 'test', id: targetItem.id },
      targetItem.force_active_now
        ? 'Test mode deactivated. Reverted to standard schedule.'
        : `⚡ Test Fire Active! "${targetItem.occasion_name}" is now broadcasting live on website & splash screen.`
    );
  };

  // Delete Action
  const handleDelete = (id: string) => {
    executeApiAction({ action: 'delete', id }, 'Celebration removed from calendar.');
    setDeletingId(null);
  };

  // Open Create Modal
  const openCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingItem({
      id: `celebration-${Date.now()}`,
      occasion_name: 'New Festive Celebration',
      greeting_title: 'Warm Festive Greetings!',
      greeting_message: 'May this special occasion bring happiness, peace, and progress to our entire community.',
      effect_type: 'firelight_sparkles',
      colors: ['#F59E0B', '#EF4444', '#FBBF24', '#D97706'],
      start_date: `${today}T00:00`,
      end_date: `${today}T23:59`,
      enabled: true,
      force_active_now: false,
      duration_seconds: 8,
      play_frequency: 'always',
      show_greeting_banner: true,
      sound_enabled: false,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: FestiveCelebrationItem) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  // Apply Preset to Editing Item
  const applyPresetToForm = (presetKey: string) => {
    const preset = FESTIVE_PRESETS[presetKey];
    if (!preset || !editingItem) return;

    const baseDate = preset.suggested_date || new Date().toISOString().split('T')[0];
    setEditingItem({
      ...editingItem,
      occasion_name: preset.occasion_name,
      greeting_title: preset.greeting_title,
      greeting_message: preset.greeting_message,
      effect_type: preset.effect_type,
      colors: [...preset.colors],
      start_date: `${baseDate}T00:00`,
      end_date: `${baseDate}T23:59`,
    });
  };

  // Save from Modal
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSavingItem(true);
    const isNew = !items.some((i) => i.id === editingItem.id);
    const action = isNew ? 'create' : 'update';

    await executeApiAction(
      { action, item: editingItem },
      isNew
        ? `Celebration "${editingItem.occasion_name}" scheduled successfully!`
        : `Celebration "${editingItem.occasion_name}" updated successfully!`
    );

    setIsSavingItem(false);
    setIsModalOpen(false);
    setSimulatedItem(editingItem);
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.occasion_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.greeting_title.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      const status = getCelebrationStatus(item);
      return status === statusFilter;
    });
  }, [items, searchQuery, statusFilter]);

  // Counts for KPI Cards
  const kpis = useMemo(() => {
    const active = items.find((i) => getCelebrationStatus(i) === 'active');
    const scheduledCount = items.filter((i) => getCelebrationStatus(i) === 'scheduled').length;
    const disabledCount = items.filter((i) => getCelebrationStatus(i) === 'disabled').length;

    return {
      total: items.length,
      activeNow: active ? active.occasion_name : null,
      activeItem: active || null,
      scheduled: scheduledCount,
      disabled: disabledCount,
    };
  }, [items]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header & Master Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🎆</span>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  Festive & Occasion Celebrations Desk
                </h1>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Full CRUD Calendar
                </span>
              </div>
              <p className="text-sm text-slate-400 max-w-2xl">
                Create, schedule, and manage firelight sparkles, fireworks, and cultural greeting banners for holidays, regional milestones (e.g., 28 Nov), and festival days. Automatically synced to the live newspaper and splash loader.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Auto Sync Indicator */}
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
                {syncStatus === 'saving' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-amber-300">Syncing to live site...</span>
                  </>
                ) : syncStatus === 'error' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-red-300">Sync Error</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400">
                      Live Synced {lastSyncedAt ? `(${lastSyncedAt})` : ''}
                    </span>
                  </>
                )}
              </div>

              {/* Create Button */}
              {canManage && (
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span className="text-base font-black">+</span>
                  <span>Schedule Celebration</span>
                </button>
              )}

              {/* Public Website Preview Link */}
              <a
                href="http://localhost:3000/en"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 hover:border-slate-600 flex items-center gap-1.5 transition-all"
              >
                <span>Live Site</span>
                <span className="text-xs">↗</span>
              </a>
            </div>
          </div>
        </div>

        {/* Feedback Messages */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3 animate-fade-in">
            <span className="text-emerald-400 text-lg">✓</span>
            <span className="font-medium">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-3 animate-fade-in">
            <span className="text-red-400 text-lg">⚠</span>
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Celebrations</div>
            <div className="text-3xl font-black text-white mt-2">{kpis.total}</div>
            <div className="text-xs text-slate-500 mt-1">Holidays & occasion events configured</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Live Now</span>
              {kpis.activeNow && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-2 truncate">
              {kpis.activeNow ? kpis.activeNow : 'None Active Today'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {kpis.activeNow ? 'Broadcasting on newspaper & loader' : 'Scheduled dates will trigger automatically'}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Upcoming / Scheduled</div>
            <div className="text-3xl font-black text-amber-400 mt-2">{kpis.scheduled}</div>
            <div className="text-xs text-slate-500 mt-1">Future holidays on the calendar</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Paused / Drafts</div>
            <div className="text-3xl font-black text-slate-400 mt-2">{kpis.disabled}</div>
            <div className="text-xs text-slate-500 mt-1">Disabled events</div>
          </div>
        </div>

        {/* Real-time Particle Physics Simulator Box */}
        {simulatedItem && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">👁️</span>
                  <h2 className="text-base font-bold text-white">Live Particle Physics Simulator</h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">
                    {simulatedItem.occasion_name}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Instant real-time particle physics rendering exactly as readers see it on broadsheet and splash screen.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => triggerSimulatorBurst(simulatedItem)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✨ Trigger Particle Burst</span>
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleTestNow(simulatedItem)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      simulatedItem.force_active_now
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <span>{simulatedItem.force_active_now ? '⚡ Active on Website' : '⚡ Test on Live Site'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Canvas Viewport */}
            <div className="relative w-full h-44 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                width={800}
                height={176}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {/* Simulated Occasion Banner */}
              {simulatedItem.show_greeting_banner && (
                <div
                  className="relative z-10 max-w-lg mx-auto p-4 rounded-xl border backdrop-blur-md text-center shadow-2xl transition-all"
                  style={{
                    backgroundColor: `${simulatedItem.colors[0] || '#F59E0B'}18`,
                    borderColor: `${simulatedItem.colors[0] || '#F59E0B'}50`,
                  }}
                >
                  <div
                    className="text-sm font-black tracking-wide uppercase mb-1"
                    style={{ color: simulatedItem.colors[0] || '#F59E0B' }}
                  >
                    {simulatedItem.greeting_title}
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    {simulatedItem.greeting_message}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <span className="absolute left-3 top-2.5 text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search celebrations..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {(['all', 'active', 'scheduled', 'ended', 'disabled'] as const).map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer shrink-0 ${
                    active
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {status === 'all' ? `All (${items.length})` : status}
                </button>
              );
            })}
          </div>
        </div>

        {/* Celebrations Grid (CRUD: Read & Manage) */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Loading festive celebrations calendar...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="text-4xl mb-3">🗓️</div>
            <h3 className="text-base font-bold text-white">No Celebrations Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Get started by scheduling your first celebration or holiday.'}
            </p>
            {canManage && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow hover:bg-amber-400 cursor-pointer"
              >
                + Schedule Celebration
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const status = getCelebrationStatus(item);
              const effectMeta = EFFECT_OPTIONS.find((e) => e.id === item.effect_type) || EFFECT_OPTIONS[0];
              const isSimulated = simulatedItem?.id === item.id;

              return (
                <div
                  key={item.id}
                  className={`bg-slate-900 rounded-2xl border p-5 flex flex-col justify-between transition-all relative overflow-hidden group ${
                    status === 'active'
                      ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Accent Top Border Bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 transition-all"
                    style={{
                      background: `linear-gradient(90deg, ${item.colors[0] || '#F59E0B'}, ${
                        item.colors[1] || item.colors[0] || '#EF4444'
                      })`,
                    }}
                  />

                  <div>
                    {/* Top Status & Effect Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3 pt-1">
                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : status === 'scheduled'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : status === 'ended'
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-slate-800/60 text-slate-500 border-slate-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            status === 'active'
                              ? 'bg-emerald-400 animate-ping'
                              : status === 'scheduled'
                              ? 'bg-amber-400'
                              : 'bg-slate-500'
                          }`}
                        />
                        <span className="capitalize">
                          {item.force_active_now ? '⚡ Active (Test Mode)' : status}
                        </span>
                      </span>

                      {/* Effect Type Pill */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 border border-slate-800 text-[11px] font-mono">
                        <span>{effectMeta.icon}</span>
                        <span className="truncate max-w-[120px]">{effectMeta.label}</span>
                      </span>
                    </div>

                    {/* Occasion Title & Greeting */}
                    <h3 className="text-base font-bold text-white leading-snug group-hover:text-amber-300 transition-colors">
                      {item.occasion_name}
                    </h3>
                    <div className="text-xs font-semibold text-amber-400/90 mt-1">
                      {item.greeting_title}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {item.greeting_message}
                    </p>

                    {/* Color Swatches Palette */}
                    <div className="mt-4 flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-mono uppercase mr-1">Palette:</span>
                      {item.colors.slice(0, 5).map((color, idx) => (
                        <span
                          key={idx}
                          className="w-4 h-4 rounded-full border border-slate-800 shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>

                    {/* Schedule Date Window */}
                    <div className="mt-4 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Start:</span>
                        <span className="text-slate-200">
                          {item.start_date.replace('T', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>End:</span>
                        <span className="text-slate-200">
                          {item.end_date.replace('T', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Test Fire / Website Trigger */}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleTestNow(item)}
                          title="Instant test on live site"
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            item.force_active_now
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'
                          }`}
                        >
                          ⚡ {item.force_active_now ? 'Active' : 'Test'}
                        </button>
                      )}

                      {/* Preview in Simulator */}
                      <button
                        type="button"
                        onClick={() => {
                          setSimulatedItem(item);
                          triggerSimulatorBurst(item);
                        }}
                        title="Simulate particle physics"
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSimulated
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                        }`}
                      >
                        👁️ Preview
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Toggle Enable */}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleToggle(item.id, item.enabled)}
                          title={item.enabled ? 'Pause celebration' : 'Enable celebration'}
                          className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                            item.enabled
                              ? 'bg-slate-800 text-emerald-400 border-emerald-500/30 hover:bg-slate-700'
                              : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {item.enabled ? '⏸️' : '▶️'}
                        </button>
                      )}

                      {/* Edit */}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Edit celebration settings"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-all cursor-pointer"
                        >
                          ✏️
                        </button>
                      )}

                      {/* Delete */}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setDeletingId(item.id)}
                          title="Delete celebration"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs transition-all cursor-pointer"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* CREATE & EDIT MODAL (CRUD: Create & Update) */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">✨</span>
                <h2 className="text-lg font-bold text-white">
                  {items.some((i) => i.id === editingItem.id) ? 'Edit Celebration' : 'Schedule New Celebration'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Presets Bar */}
            <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                ⚡ Quick Fill Preset Templates
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(FESTIVE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPresetToForm(key)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-amber-500 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-6">
              
              {/* Occasion Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Occasion / Holiday Name
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.occasion_name}
                  onChange={(e) => setEditingItem({ ...editingItem, occasion_name: e.target.value })}
                  placeholder="e.g. Special Broadsheet Occasion — 28 Nov"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Schedule Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={editingItem.start_date.substring(0, 16)}
                    onChange={(e) => setEditingItem({ ...editingItem, start_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={editingItem.end_date.substring(0, 16)}
                    onChange={(e) => setEditingItem({ ...editingItem, end_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Quick Date Shortcut Buttons */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setEditingItem({
                      ...editingItem,
                      start_date: `${today}T00:00`,
                      end_date: `${today}T23:59`,
                    });
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 text-amber-300 hover:bg-slate-700 cursor-pointer"
                >
                  ⚡ Set to Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tom = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                    setEditingItem({
                      ...editingItem,
                      start_date: `${tom}T00:00`,
                      end_date: `${tom}T23:59`,
                    });
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  📅 Set to Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem({
                      ...editingItem,
                      start_date: '2026-11-28T00:00',
                      end_date: '2026-11-28T23:59',
                    });
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 text-cyan-300 hover:bg-slate-700 cursor-pointer"
                >
                  🌟 Set to 28 Nov
                </button>
              </div>

              {/* Particle Effect Type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Particle Physics Effect
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EFFECT_OPTIONS.map((eff) => {
                    const selected = editingItem.effect_type === eff.id;
                    return (
                      <button
                        key={eff.id}
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, effect_type: eff.id })}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selected
                            ? 'bg-amber-500/15 border-amber-500 text-white shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-sm text-slate-200">
                          <span>{eff.icon}</span>
                          <span>{eff.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {eff.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Palette */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Festive Color Palette (HEX Colors)
                </label>
                
                {/* Palette presets */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {PALETTE_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, colors: [...p.colors] })}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-600 text-[11px] text-slate-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <div className="flex -space-x-1">
                        {p.colors.slice(0, 3).map((c, i) => (
                          <span
                            key={i}
                            className="w-2.5 h-2.5 rounded-full border border-slate-900"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>

                {/* Color Chips Inputs */}
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  {editingItem.colors.map((color, index) => (
                    <div key={index} className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const next = [...editingItem.colors];
                          next[index] = e.target.value.toUpperCase();
                          setEditingItem({ ...editingItem, colors: next });
                        }}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => {
                          const next = [...editingItem.colors];
                          next[index] = e.target.value;
                          setEditingItem({ ...editingItem, colors: next });
                        }}
                        className="w-16 bg-transparent text-xs font-mono text-slate-200 uppercase focus:outline-none"
                      />
                      {editingItem.colors.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = editingItem.colors.filter((_, i) => i !== index);
                            setEditingItem({ ...editingItem, colors: next });
                          }}
                          className="text-slate-500 hover:text-red-400 text-xs px-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  {editingItem.colors.length < 8 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem({
                          ...editingItem,
                          colors: [...editingItem.colors, '#F59E0B'],
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-amber-400 border border-dashed border-slate-700 cursor-pointer"
                    >
                      + Add Color
                    </button>
                  )}
                </div>
              </div>

              {/* Greeting Banner */}
              <div className="space-y-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Celebration Greeting Banner
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={editingItem.show_greeting_banner}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, show_greeting_banner: e.target.checked })
                      }
                      className="rounded bg-slate-900 border-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Show Greeting Banner</span>
                  </label>
                </div>

                {editingItem.show_greeting_banner && (
                  <>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Banner Headline
                      </label>
                      <input
                        type="text"
                        value={editingItem.greeting_title}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, greeting_title: e.target.value })
                        }
                        placeholder="Happy Deepavali to All!"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Message / Blessing Note
                      </label>
                      <textarea
                        rows={2}
                        value={editingItem.greeting_message}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, greeting_message: e.target.value })
                        }
                        placeholder="May the festival of lights bring peace, brightness, and warmth..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Duration Slider & Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-300">Burst Duration</span>
                    <span className="font-mono text-amber-400">{editingItem.duration_seconds}s</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="25"
                    step="1"
                    value={editingItem.duration_seconds}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, duration_seconds: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-300 mb-1">Play Frequency</span>
                  <select
                    value={editingItem.play_frequency}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        play_frequency: e.target.value as 'always' | 'once_per_session',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="always">Always (Every Page Load / Refresh)</option>
                    <option value="once_per_session">Once Per Visitor Session</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingItem ? (
                    <>
                      <span className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Celebration</span>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG (CRUD: Delete) */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="text-3xl mb-2">🗑️</div>
            <h3 className="text-base font-bold text-white">Delete Celebration?</h3>
            <p className="text-xs text-slate-400 mt-1 mb-6 leading-relaxed">
              Are you sure you want to remove this celebration from the calendar? This will delete the scheduled particle effects and greeting banner permanently.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
