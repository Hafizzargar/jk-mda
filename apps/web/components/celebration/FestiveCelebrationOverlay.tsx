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
  const [bannerState, setBannerState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
  const [dismissed, setDismissed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const burstTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide timer tracking for celebration banner
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bannerStartTimeRef = useRef<number>(0);
  const remainingTimeRef = useRef<number>(0);

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

  // Smooth dismiss: triggers graceful slide-up & fade-out before unmounting
  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }
    setBannerState('exiting');
    exitTimerRef.current = setTimeout(() => {
      setBannerState('hidden');
    }, 450);
  }, []);

  const startBannerCountdown = useCallback((durationMs: number) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    remainingTimeRef.current = durationMs;
    bannerStartTimeRef.current = Date.now();

    bannerTimerRef.current = setTimeout(() => {
      dismissBanner();
    }, durationMs);
  }, [dismissBanner]);

  const handlePause = () => {
    setIsHovered(true);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    const elapsed = Date.now() - bannerStartTimeRef.current;
    remainingTimeRef.current = Math.max(1500, remainingTimeRef.current - elapsed);
  };

  const handleResume = () => {
    setIsHovered(false);
    if (bannerState === 'visible' && remainingTimeRef.current > 0) {
      bannerStartTimeRef.current = Date.now();
      bannerTimerRef.current = setTimeout(() => {
        dismissBanner();
      }, remainingTimeRef.current);
    }
  };

  const handleManualDismiss = () => {
    setDismissed(true);
    dismissBanner();
  };

  // Only fetch if initialSettings was not already provided by server layout
  useEffect(() => {
    if (initialSettings !== undefined) return;

    fetch('/api/celebrations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const active = data?.celebration || data?.celebrations;
        if (active) {
          setSettings(active);
        }
      })
      .catch(() => {});
  }, [initialSettings]);

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

    const isMobile = width < 768;
    const isFirelight = settings.effect_type === 'firelight_sparkles';
    // Optimized particle count: lightweight on mobile to preserve 60fps & battery
    const count = isFirelight ? (isMobile ? 35 : 65) : (isMobile ? 40 : 75);
    const newParticles = [];

    if (isFirelight) {
      // Warm rising firelight embers & diya sparkles from bottom
      for (let i = 0; i < count; i++) {
        newParticles.push({
          x: Math.random() * width,
          y: height + Math.random() * 30,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -(Math.random() * 2.2 + 0.8),
          size: Math.random() * 3.5 + 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          life: 0,
          maxLife: Math.random() * 90 + 50,
        });
      }
    } else {
      // Sky Fireworks & Color Bursts adapted to screen size
      const origins = isMobile
        ? [{ x: width * 0.5, y: height * 0.28 }]
        : [
            { x: width * 0.25, y: height * 0.3 },
            { x: width * 0.5, y: height * 0.24 },
            { x: width * 0.75, y: height * 0.3 },
          ];

      origins.forEach((origin) => {
        const burstCount = Math.floor(count / origins.length);
        for (let i = 0; i < burstCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 + 1.2;
          newParticles.push({
            x: origin.x + (Math.random() - 0.5) * 20,
            y: origin.y + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 1.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            life: 0,
            maxLife: Math.random() * 65 + 35,
          });
        }
      });
    }

    particlesRef.current = newParticles;
    isRunningRef.current = true;
    setIsAnimating(true);

    if (settings.show_greeting_banner) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      setDismissed(false);
      setBannerState('entering');

      // Trigger smooth spring entrance into 'visible'
      requestAnimationFrame(() => {
        setTimeout(() => {
          setBannerState('visible');
          const autoDismissMs = Math.max(6, settings.duration_seconds || 8) * 1000;
          startBannerCountdown(autoDismissMs);
        }, 30);
      });
    }

    if (!animationFrameRef.current) {
      animate();
    }

    // Auto-dissolve canvas after configured duration
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, (settings.duration_seconds || 7) * 1000);
  }, [settings, startBannerCountdown]);

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
      setBannerState('hidden');
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
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
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

      {/* 2. Sleek Broadsheet Celebration Notification Banner with Auto-Hide & Spring Animation */}
      {bannerState !== 'hidden' && !dismissed && settings && settings.show_greeting_banner && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-2.5 sm:top-4 left-1/2 -translate-x-1/2 z-[101] w-[calc(100%-1.25rem)] max-w-lg pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            bannerState === 'visible'
              ? 'opacity-100 translate-y-0 scale-100 filter-none'
              : bannerState === 'exiting'
              ? 'opacity-0 -translate-y-6 scale-95 blur-[2px] pointer-events-none'
              : 'opacity-0 -translate-y-7 scale-95 blur-[1px]'
          }`}
          onMouseEnter={handlePause}
          onMouseLeave={handleResume}
          onTouchStart={handlePause}
          onTouchEnd={handleResume}
        >
          <div
            className="relative overflow-hidden rounded-2xl bg-[#070d18]/94 text-white p-3.5 sm:p-4 shadow-2xl border backdrop-blur-xl flex items-start justify-between gap-3 transition-all duration-500"
            style={{
              borderColor: `${primaryColor}60`,
              boxShadow:
                bannerState === 'visible'
                  ? `0 20px 50px -12px ${primaryColor}40, 0 0 25px -4px ${primaryColor}25, inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)`
                  : 'none',
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="text-2xl mt-0.5 shrink-0 select-none inline-block"
                style={{
                  animation: 'festive-sparkle 3.5s ease-in-out infinite',
                }}
              >
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
                    className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm transition-all"
                    style={{
                      backgroundColor: `${primaryColor}20`,
                      color: primaryColor,
                      borderColor: `${primaryColor}40`,
                      boxShadow: `0 0 10px ${primaryColor}20`,
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
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1 border border-white/10 shadow-sm"
                title="Replay celebration"
              >
                <span>✨</span>
                <span>Replay</span>
              </button>
              <button
                type="button"
                onClick={handleManualDismiss}
                className="w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-white/15 active:scale-90 flex items-center justify-center text-xs transition-all cursor-pointer border border-transparent hover:border-white/10"
                title="Dismiss"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>

            {/* Auto-Hide Smooth Timer Progress Line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/10 overflow-hidden">
              <div
                className="h-full w-full"
                style={{
                  backgroundColor: primaryColor,
                  transformOrigin: 'left',
                  animation:
                    bannerState === 'visible'
                      ? `festive-progress ${Math.max(6, settings.duration_seconds || 8)}s linear forwards`
                      : 'none',
                  animationPlayState: isHovered ? 'paused' : 'running',
                  boxShadow: `0 0 10px ${primaryColor}`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
