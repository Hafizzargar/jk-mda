'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_FESTIVE_SETTINGS,
  FESTIVE_PRESETS,
  isFestiveCelebrationActive,
  type FestiveCelebrationSettings,
  type FestiveEffectType,
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

export default function FestiveCelebrationPage() {
  const router = useRouter();

  const [form, setForm] = useState<FestiveCelebrationSettings>(DEFAULT_FESTIVE_SETTINGS);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'synced' | 'error'>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Simulator canvas ref
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

  // Auto-sync timeout ref
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

        const token = sessionData.session.access_token;
        const res = await fetch('/api/settings/celebrations', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.ok) {
          const json = await res.json();
          if (json.celebrations) {
            setForm(json.celebrations);
          }
          if (typeof json.can_manage === 'boolean') {
            setCanManage(json.can_manage);
          }
          setSyncStatus('synced');
          setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (err) {
        console.error('Failed to load celebration settings:', err);
        setErrorMsg('Failed to load festive celebration settings.');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [router]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Trigger auto-sync helper
  const triggerAutoSync = (updatedSettings: FestiveCelebrationSettings, customSuccess?: string) => {
    if (!canManage) return;
    setSyncStatus('saving');
    if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);

    autoSyncTimeoutRef.current = setTimeout(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const res = await fetch('/api/settings/celebrations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(updatedSettings),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Auto-sync failed');
        }

        setSyncStatus('synced');
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        if (customSuccess) {
          setSuccessMsg(customSuccess);
          setTimeout(() => setSuccessMsg(null), 4000);
        }
      } catch (err: unknown) {
        console.error('Auto-sync error:', err);
        setSyncStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Failed to auto-sync changes.');
      }
    }, 700);
  };

  const updateField = <K extends keyof FestiveCelebrationSettings>(
    field: K,
    value: FestiveCelebrationSettings[K],
    msg?: string
  ) => {
    const next = { ...form, [field]: value };
    setForm(next);
    triggerAutoSync(next, msg);
  };

  // Date Quick Setters
  const setToToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const start = `${yyyy}-${mm}-${dd}T00:00`;
    const end = `${yyyy}-${mm}-${dd}T23:59`;

    const next: FestiveCelebrationSettings = {
      ...form,
      start_date: start,
      end_date: end,
      enabled: true,
      mode: 'scheduled',
    };
    setForm(next);
    triggerAutoSync(next, '⚡ Celebration date set to TODAY! Active on live website.');
    triggerBurst();
  };

  const setTo28Nov = () => {
    const yyyy = new Date().getFullYear();
    const start = `${yyyy}-11-28T00:00`;
    const end = `${yyyy}-11-28T23:59`;

    const next: FestiveCelebrationSettings = {
      ...form,
      start_date: start,
      end_date: end,
      enabled: true,
      mode: 'scheduled',
      occasion_name: 'Special Broadsheet Occasion — 28 Nov',
      greeting_title: 'Commemorating 28 November',
      greeting_message: 'Marking this important day with dedicated coverage and community reflections.',
      effect_type: 'fireworks',
    };
    setForm(next);
    triggerAutoSync(next, '📅 Scheduled for 28 November! Will automatically activate on 28 Nov.');
    triggerBurst();
  };

  const applyPreset = (key: keyof typeof FESTIVE_PRESETS) => {
    const preset = FESTIVE_PRESETS[key];
    if (!preset) return;

    let start = form.start_date;
    let end = form.end_date;

    if (preset.suggested_date) {
      start = `${preset.suggested_date}T00:00`;
      end = `${preset.suggested_date}T23:59`;
    }

    const next: FestiveCelebrationSettings = {
      ...form,
      occasion_name: preset.occasion_name,
      greeting_title: preset.greeting_title,
      greeting_message: preset.greeting_message,
      effect_type: preset.effect_type,
      colors: [...preset.colors],
      start_date: start,
      end_date: end,
      enabled: true,
    };

    setForm(next);
    triggerAutoSync(next, `✨ Applied preset: ${preset.label}`);
    triggerBurst();
  };

  // Canvas Simulator Animation
  const triggerBurst = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const colors = form.colors.length > 0 ? form.colors : ['#F59E0B', '#EF4444', '#10B981'];

    // Generate 60-80 celebration particles
    const newParticles = [];
    const count = 70;
    const originX = width / 2;
    const originY = form.effect_type === 'firelight_sparkles' ? height - 20 : height / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = form.effect_type === 'firelight_sparkles' ? Math.random() * 2 + 1 : Math.random() * 5 + 1.5;
      const vy = form.effect_type === 'firelight_sparkles' ? -(Math.random() * 3 + 1.5) : Math.sin(angle) * speed;

      newParticles.push({
        x: form.effect_type === 'firelight_sparkles' ? Math.random() * width : originX + (Math.random() - 0.5) * 60,
        y: originY,
        vx: form.effect_type === 'firelight_sparkles' ? (Math.random() - 0.5) * 1.5 : Math.cos(angle) * speed,
        vy,
        size: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 60 + 40,
      });
    }

    particlesRef.current = newParticles;

    if (!animationFrameRef.current) {
      animate();
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      // Gravity or buoyancy
      if (form.effect_type === 'firelight_sparkles') {
        p.vy -= 0.02; // floating upward
        p.vx += (Math.random() - 0.5) * 0.1;
      } else {
        p.vy += 0.08; // gravity falling
      }

      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (p.life >= p.maxLife || p.y < 0 || p.y > canvas.height) {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      animationFrameRef.current = null;
    }
  };

  // Run initial simulator burst
  useEffect(() => {
    if (!loading) {
      setTimeout(() => triggerBurst(), 300);
    }
  }, [loading]);

  const isActiveOnSite = isFestiveCelebrationActive(form);

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-24 px-4 sm:px-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>🎆</span>
              <span>Festive &amp; Occasion Celebration Desk</span>
            </h1>

            {/* Live Status Badge */}
            {isActiveOnSite ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>🟢 Active on Live Website</span>
              </span>
            ) : form.enabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>⏳ Scheduled (Waiting for Date)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>⚪ Inactive (Disabled)</span>
              </span>
            )}

            {/* Live Sync Badge */}
            {syncStatus === 'saving' ? (
              <span className="text-xs text-amber-500 font-medium">Syncing...</span>
            ) : syncStatus === 'synced' ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Synced {lastSyncedAt ? `(${lastSyncedAt})` : ''}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Control festive firelight, fireworks, and cultural greeting banners for Diwali, Eid, Holi, or custom dates (e.g. 28 Nov).
          </p>
        </div>

        {/* Master Switches on Header Right */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 pl-1.5">
              Celebration Overlay:
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => updateField('enabled', e.target.checked, e.target.checked ? 'Celebration overlay enabled!' : 'Celebration overlay disabled.')}
                disabled={!canManage}
                className="sr-only peer"
              />
              <div className="w-11 h-5 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <button
            type="button"
            onClick={triggerBurst}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <span>▶️</span>
            <span>Test Burst Now</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 2. One-Click Festive Presets */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <span>✨</span>
            <span>One-Click Occasion Presets (Pre-configured colors &amp; greetings)</span>
          </h2>
          <span className="text-[11px] text-slate-500">Click any card to auto-fill</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {Object.entries(FESTIVE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-cyan-500 hover:bg-cyan-500/5 transition cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <span className="text-2xl block mb-1">{preset.icon}</span>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
                  {preset.label}
                </h3>
              </div>
              <div className="flex items-center gap-1 mt-2.5">
                {preset.colors.slice(0, 4).map((c, i) => (
                  <span
                    key={i}
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Grid: Settings Form (Left 7) + Live Simulator & Preview (Right 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Date & Configuration */}
        <div className="lg:col-span-7 space-y-5">
          {/* Date & Scheduling Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>📅</span>
                <span>Date Schedule &amp; Activation Mode</span>
              </h2>

              {/* Quick Date Setter Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={setToToday}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer"
                  title="Instantly sets start and end date to today"
                >
                  ⚡ Set to Today
                </button>
                <button
                  type="button"
                  onClick={setTo28Nov}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition cursor-pointer"
                  title="Instantly sets date to 28 November"
                >
                  🌟 Set to 28 Nov
                </button>
              </div>
            </div>

            {/* Force Active Now Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Force Active Now (Ignore Schedule Date)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enable to immediately display on the live public website right now for live testing.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={form.force_active_now}
                  onChange={(e) => updateField('force_active_now', e.target.checked, e.target.checked ? 'Forced live test active!' : 'Forced live test disabled.')}
                  className="sr-only peer"
                />
                <div className="w-11 h-5 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Scheduled Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Start Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={form.start_date.substring(0, 16)}
                  onChange={(e) => updateField('start_date', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  End Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={form.end_date.substring(0, 16)}
                  onChange={(e) => updateField('end_date', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none transition font-mono"
                />
              </div>
            </div>
          </div>

          {/* Effect Type & Colors */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <span>🎆</span>
              <span>Visual Effect &amp; Color Palette</span>
            </h2>

            {/* Effect Type Radio Cards */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Celebration Particle Style
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EFFECT_OPTIONS.map((opt) => {
                  const isSelected = form.effect_type === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        updateField('effect_type', opt.id);
                        setTimeout(() => triggerBurst(), 50);
                      }}
                      className={`text-left p-3 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xl shrink-0">{opt.icon}</span>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {opt.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Palette Chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Custom Colors (Choose up to 5 colors)
                </label>
                <span className="text-[11px] text-slate-500">Click any chip to pick color</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {form.colors.map((color, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shadow-xs"
                  >
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        const newColors = [...form.colors];
                        newColors[idx] = e.target.value;
                        updateField('colors', newColors);
                        triggerBurst();
                      }}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => {
                        const newColors = [...form.colors];
                        newColors[idx] = e.target.value;
                        updateField('colors', newColors);
                      }}
                      className="w-18 text-xs font-mono uppercase bg-transparent text-slate-900 dark:text-white focus:outline-none"
                    />
                    {form.colors.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newColors = form.colors.filter((_, i) => i !== idx);
                          updateField('colors', newColors);
                        }}
                        className="text-slate-400 hover:text-red-500 text-xs px-1 cursor-pointer"
                        title="Remove color"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {form.colors.length < 6 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newColors = [...form.colors, '#F59E0B'];
                      updateField('colors', newColors);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:border-cyan-500 hover:text-cyan-500 transition cursor-pointer"
                  >
                    + Add Color
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Greeting Copy & Timing */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <span>✍️</span>
              <span>Greeting Banner Text &amp; Reader Display Rules</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Occasion Name / Category Tag
                </label>
                <input
                  type="text"
                  value={form.occasion_name}
                  onChange={(e) => updateField('occasion_name', e.target.value)}
                  placeholder="e.g. Diwali — Festival of Lights"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Greeting Headline Title
                </label>
                <input
                  type="text"
                  value={form.greeting_title}
                  onChange={(e) => updateField('greeting_title', e.target.value)}
                  placeholder="e.g. Happy Deepavali!"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Peace &amp; Celebration Message (Subtext)
              </label>
              <textarea
                rows={2}
                value={form.greeting_message}
                onChange={(e) => updateField('greeting_message', e.target.value)}
                placeholder="e.g. Wishing peace, warmth, and light across Jammu &amp; Kashmir and Ladakh."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Particle Burst Duration: {form.duration_seconds} Seconds
                </label>
                <input
                  type="range"
                  min={4}
                  max={15}
                  value={form.duration_seconds}
                  onChange={(e) => updateField('duration_seconds', parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <span className="text-[11px] text-slate-500">Auto-dissolves so reading is never blocked</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Play Frequency
                </label>
                <select
                  value={form.play_frequency}
                  onChange={(e) => updateField('play_frequency', e.target.value as 'once_per_session' | 'always')}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none transition"
                >
                  <option value="once_per_session">Once Per Session (Gentle, Recommended)</option>
                  <option value="always">Every Page Refresh (For Testing)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Canvas Simulator & Banner Preview */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-5 shadow-xl space-y-4 text-white overflow-hidden relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>👁️</span>
                <span>Live Interactive Canvas Simulator</span>
              </span>
              <button
                type="button"
                onClick={triggerBurst}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow cursor-pointer"
              >
                ▶️ Fire Burst
              </button>
            </div>

            {/* Canvas for Particle Simulation */}
            <div className="relative w-full h-64 rounded-xl overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-black border border-white/10 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={400}
                height={256}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {/* Mock Broadsheet Floating Pill Preview */}
              <div className="relative z-10 max-w-xs mx-auto text-center p-3 rounded-xl bg-slate-900/90 border border-white/20 backdrop-blur-md shadow-2xl">
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1.5"
                  style={{
                    backgroundColor: `${form.colors[0] || '#F59E0B'}25`,
                    color: form.colors[0] || '#F59E0B',
                    borderColor: `${form.colors[0] || '#F59E0B'}40`,
                  }}
                >
                  {form.occasion_name || 'Occasion'}
                </span>
                <h4 className="text-sm font-bold text-white leading-tight">
                  {form.greeting_title || 'Greeting Title'}
                </h4>
                <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                  {form.greeting_message || 'Greeting message text...'}
                </p>
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                  <span>✨ Auto-fades in {form.duration_seconds}s</span>
                  <span className="text-cyan-400 font-semibold cursor-pointer">✕ Dismiss</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-slate-400">Active Effect:</span>
                <span className="text-cyan-300 uppercase font-bold">{form.effect_type}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-slate-400">Public Mode:</span>
                <span className="text-amber-300 font-bold">{form.force_active_now ? 'Forced Active' : form.mode}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
                💡 On the live public website, particles render across the full screen with <code className="text-white">pointer-events: none</code> so readers can click articles and read without interference.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
