'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  isFestiveCelebrationActive,
  type FestiveCelebrationSettings,
} from '@/lib/festive';

interface FestiveCelebrationOverlayProps {
  initialSettings?: FestiveCelebrationSettings | null;
}

export function FestiveCelebrationOverlay({ initialSettings }: FestiveCelebrationOverlayProps) {
  const [settings, setSettings] = useState<FestiveCelebrationSettings | null>(initialSettings || null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const burstTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const isRunningRef = useRef(false);

  // Always fetch freshest settings on mount from API to ensure instant real-time sync with admin changes
  useEffect(() => {
    fetch('/api/celebrations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.celebrations) {
          setSettings(data.celebrations);
        }
      })
      .catch(() => {});
  }, []);

  const triggerBurst = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !settings) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const colors = settings.colors && settings.colors.length > 0
      ? settings.colors
      : ['#F59E0B', '#EF4444', '#10B981', '#06B6D4', '#EC4899'];

    const isFirelight = settings.effect_type === 'firelight_sparkles';
    const count = isFirelight ? 100 : 130;
    const newParticles = [];

    if (isFirelight) {
      // Warm rising firelight embers & diya sparkles from bottom
      for (let i = 0; i < count; i++) {
        newParticles.push({
          x: Math.random() * width,
          y: height + Math.random() * 50,
          vx: (Math.random() - 0.5) * 1.6,
          vy: -(Math.random() * 2.8 + 1.2),
          size: Math.random() * 4.5 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          life: 0,
          maxLife: Math.random() * 140 + 80,
        });
      }
    } else {
      // Sky Fireworks & Color Bursts from multiple broadsheet focal points
      const origins = [
        { x: width * 0.22, y: height * 0.32 },
        { x: width * 0.5, y: height * 0.24 },
        { x: width * 0.78, y: height * 0.32 },
      ];

      origins.forEach((origin) => {
        const burstCount = Math.floor(count / origins.length);
        for (let i = 0; i < burstCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 6.5 + 1.8;
          newParticles.push({
            x: origin.x + (Math.random() - 0.5) * 40,
            y: origin.y + (Math.random() - 0.5) * 40,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3.8 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            life: 0,
            maxLife: Math.random() * 80 + 45,
          });
        }
      });
    }

    particlesRef.current = newParticles;
    isRunningRef.current = true;
    setIsAnimating(true);
    setShowBanner(true);

    if (!animationFrameRef.current) {
      animate();
    }

    // Auto-dissolve canvas after configured duration
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, (settings.duration_seconds || 7) * 1000);
  }, [settings]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isRunningRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    const isFirelight = settings?.effect_type === 'firelight_sparkles';

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      if (isFirelight) {
        p.vy -= 0.012; // warm air rising
        p.vx += (Math.random() - 0.5) * 0.12;
      } else {
        p.vy += 0.075; // gravity fall
      }

      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (p.life >= p.maxLife || p.y < -60 || p.y > canvas.height + 60) {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      isRunningRef.current = false;
      animationFrameRef.current = null;
      setIsAnimating(false);
    }
  }, [settings]);

  // Activate on mount if current settings qualify
  useEffect(() => {
    if (!settings) return;

    const active = isFestiveCelebrationActive(settings);
    if (!active) {
      setShowBanner(false);
      setIsAnimating(false);
      return;
    }

    // Check session frequency
    const sessionKey = `kjin_festive_${settings.occasion_name}_${settings.start_date}`;
    let alreadyPlayed = false;
    try {
      alreadyPlayed = !!sessionStorage.getItem(sessionKey);
    } catch {}

    if (alreadyPlayed && settings.play_frequency === 'once_per_session' && !settings.force_active_now) {
      // Don't auto-burst, but keep banner available
      return;
    }

    try {
      sessionStorage.setItem(sessionKey, 'true');
    } catch {}

    // Trigger celebration burst
    burstTimerRef.current = setTimeout(() => {
      triggerBurst();
    }, 400);

    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [settings, triggerBurst]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const primaryColor = settings?.colors?.[0] || '#F59E0B';

  return (
    <>
      {/* 1. Fullscreen Non-Blocking Canvas (Always Mounted in DOM) */}
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 pointer-events-none z-[100] w-full h-full transition-opacity duration-1000 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ pointerEvents: 'none' }}
      />

      {/* 2. Sleek Broadsheet Celebration Notification Banner */}
      {showBanner && !dismissed && settings && settings.show_greeting_banner && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[101] w-full max-w-lg px-4 transition-all duration-500 animate-in fade-in slide-in-from-top-4">
          <div
            className="rounded-2xl bg-slate-950/95 text-white p-3.5 sm:p-4 shadow-2xl border backdrop-blur-md flex items-start justify-between gap-3"
            style={{
              borderColor: `${primaryColor}60`,
              boxShadow: `0 10px 40px -10px ${primaryColor}40`,
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5 shrink-0">
                {settings.effect_type === 'crescent_stars'
                  ? '🌙'
                  : settings.effect_type === 'firelight_sparkles'
                  ? '🪔'
                  : settings.effect_type === 'color_burst'
                  ? '🎨'
                  : settings.effect_type === 'tricolor_burst'
                  ? '🇮🇳'
                  : '🎆'}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: `${primaryColor}20`,
                      color: primaryColor,
                      borderColor: `${primaryColor}40`,
                    }}
                  >
                    {settings.occasion_name}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mt-1 leading-snug">
                  {settings.greeting_title}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {settings.greeting_message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              <button
                type="button"
                onClick={() => triggerBurst()}
                className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition cursor-pointer"
                title="Replay celebration"
              >
                ✨ Replay
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissed(true);
                  setShowBanner(false);
                }}
                className="w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center text-xs transition cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
