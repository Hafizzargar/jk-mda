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
  const [isVisible, setIsVisible] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

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

  const isRunningRef = useRef(false);

  // If no initialSettings passed from SSR, fetch from API on mount
  useEffect(() => {
    if (!initialSettings) {
      fetch('/api/settings/celebrations')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.celebrations) {
            setSettings(data.celebrations);
          }
        })
        .catch(() => {});
    }
  }, [initialSettings]);

  const triggerBurst = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !settings) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const colors = settings.colors.length > 0 ? settings.colors : ['#F59E0B', '#EF4444', '#10B981', '#3B82F6'];

    const newParticles = [];
    const count = settings.effect_type === 'firelight_sparkles' ? 90 : 120;

    // Fire from multiple launch points for broadsheet coverage
    const origins = [
      { x: width * 0.2, y: height * 0.35 },
      { x: width * 0.5, y: height * 0.25 },
      { x: width * 0.8, y: height * 0.35 },
    ];

    if (settings.effect_type === 'firelight_sparkles') {
      // Ambient rising firelight embers from bottom
      for (let i = 0; i < count; i++) {
        newParticles.push({
          x: Math.random() * width,
          y: height + Math.random() * 40,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -(Math.random() * 2.5 + 1.2),
          size: Math.random() * 4.5 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          life: 0,
          maxLife: Math.random() * 120 + 80,
        });
      }
    } else {
      // Fireworks / Bursts from sky origins
      origins.forEach((origin) => {
        const burstCount = Math.floor(count / origins.length);
        for (let i = 0; i < burstCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 6 + 1.5;
          newParticles.push({
            x: origin.x + (Math.random() - 0.5) * 30,
            y: origin.y + (Math.random() - 0.5) * 30,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3.5 + 1.8,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            life: 0,
            maxLife: Math.random() * 70 + 40,
          });
        }
      });
    }

    particlesRef.current = newParticles;
    isRunningRef.current = true;
    setIsVisible(true);
    setShowBanner(true);

    if (!animationFrameRef.current) {
      animate();
    }
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
        p.vy -= 0.015; // rising buoyancy
        p.vx += (Math.random() - 0.5) * 0.15;
      } else {
        p.vy += 0.07; // gravitational pull
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

      if (p.life >= p.maxLife || p.y < -50 || p.y > canvas.height + 60) {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      isRunningRef.current = false;
      animationFrameRef.current = null;
      setIsVisible(false);
    }
  }, [settings]);

  useEffect(() => {
    if (!settings) return;

    const active = isFestiveCelebrationActive(settings);
    if (!active) return;

    // Check session storage if once_per_session
    const sessionKey = `kjin_festive_${settings.occasion_name}_${settings.start_date}`;
    const alreadyPlayed = typeof window !== 'undefined' ? sessionStorage.getItem(sessionKey) : null;

    if (alreadyPlayed && settings.play_frequency === 'once_per_session' && !settings.force_active_now) {
      return;
    }

    // Mark as played
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(sessionKey, 'true');
      } catch {}
    }

    // Launch burst after small mount delay
    const timer = setTimeout(() => {
      triggerBurst();
    }, 600);

    return () => clearTimeout(timer);
  }, [settings, triggerBurst]);

  // Window resize handler
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

  if (!settings || (!isVisible && !showBanner)) {
    return null;
  }

  const primaryColor = settings.colors[0] || '#F59E0B';

  return (
    <>
      {/* 1. Fullscreen Non-Blocking Canvas */}
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 pointer-events-none z-50 w-full h-full transition-opacity duration-1000 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ pointerEvents: 'none' }}
      />

      {/* 2. Sleek Broadsheet Celebration Notification Banner */}
      {showBanner && !bannerDismissed && settings.show_greeting_banner && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 transition-all duration-500 animate-in fade-in slide-in-from-top-4">
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
                  setBannerDismissed(true);
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
