'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { DEFAULT_NAVBAR_SETTINGS, type NavbarBrandConfig, sanitizeNavbarSettings } from '@/lib/navbar';
import { isFestiveCelebrationActive, type FestiveCelebrationSettings } from '@/lib/festive';

export default function Loading() {
  const [brand, setBrand] = useState<NavbarBrandConfig>(DEFAULT_NAVBAR_SETTINGS.brand);
  const [festive, setFestive] = useState<FestiveCelebrationSettings | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Fast sync from local cache on client mount
    try {
      const cached = localStorage.getItem('kjin_brand_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && parsed.name) {
          setBrand({
            ...DEFAULT_NAVBAR_SETTINGS.brand,
            ...parsed,
          });
        }
      }
    } catch {
      // ignore
    }

    async function fetchBrandSettings() {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'navbar_settings')
          .maybeSingle();

        if (isMounted && data?.value) {
          const sanitized = sanitizeNavbarSettings(data.value);
          if (sanitized.brand) {
            setBrand(sanitized.brand);
            try {
              localStorage.setItem('kjin_brand_config', JSON.stringify(sanitized.brand));
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error('[Loading] Error loading brand:', err);
      }
    }

    // Fetch active celebration for festive splash loading
    fetch('/api/celebrations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const active = data?.celebration || data?.celebrations;
        if (isMounted && active) {
          setFestive(active);
        }
      })
      .catch(() => {});

    fetchBrandSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const isFestiveActive = isFestiveCelebrationActive(festive);
  const primaryColor = festive?.colors?.[0] || '#F59E0B';
  const secondaryColor = festive?.colors?.[1] || festive?.colors?.[0] || '#EF4444';

  const logoSrc = brand.logo_url || '/kjin-emblem.png';
  const brandName = brand.name || 'KJIN';
  const subtitle = brand.loader_text || brand.tagline || 'ONE REGION, MANY VOICES, TRUSTED NEWS';

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center bg-white select-none px-4 transition-colors duration-200 relative overflow-hidden">
      {/* Occasion Greeting Pill (Displayed during festive celebrations) */}
      {isFestiveActive && festive && (
        <div
          className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border shadow-md animate-bounce"
          style={{
            backgroundColor: `${primaryColor}15`,
            borderColor: `${primaryColor}50`,
            color: primaryColor,
            boxShadow: `0 4px 20px -2px ${primaryColor}30`,
          }}
        >
          <span className="text-base">
            {festive.effect_type === 'crescent_stars'
              ? '🌙'
              : festive.effect_type === 'firelight_sparkles'
              ? '🪔'
              : festive.effect_type === 'color_burst'
              ? '🎨'
              : festive.effect_type === 'tricolor_burst'
              ? '🇮🇳'
              : '✨'}
          </span>
          <span>{festive.occasion_name}</span>
          <span className="text-[10px] opacity-75 font-mono">• Special Edition</span>
        </div>
      )}

      {/* Logo Stack with Company Emblem */}
      <div className="relative flex items-center justify-center w-32 h-32 mb-8">
        {/* Outermost slow-drift ring */}
        <div
          className="absolute inset-0 rounded-full border"
          style={{
            borderColor: isFestiveActive ? `${primaryColor}50` : 'rgba(254, 202, 202, 0.6)',
            animation: 'kjinSpin 18s linear infinite',
            willChange: 'transform',
          }}
        />

        {/* Dashed orbital */}
        <div
          className="absolute inset-2 rounded-full border-2 border-dashed"
          style={{
            borderColor: isFestiveActive ? `${secondaryColor}60` : 'rgba(252, 211, 77, 0.5)',
            animation: 'kjinSpinReverse 10s linear infinite',
            willChange: 'transform',
          }}
        />

        {/* Smooth conic-gradient arc spinner (Celebration themed arc) */}
        <div
          className="absolute inset-3.5 rounded-full"
          style={{
            background: isFestiveActive
              ? `conic-gradient(from 0deg, ${primaryColor} 0%, ${secondaryColor} 45%, transparent 65%)`
              : 'conic-gradient(from 0deg, #dc2626 0%, #f59e0b 45%, transparent 65%)',
            animation: 'kjinSpin 1.2s linear infinite',
            borderRadius: '9999px',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), white calc(100% - 2px))',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), white calc(100% - 2px))',
            willChange: 'transform',
          }}
        />

        {/* Soft aura glow behind logo */}
        <div
          className="absolute inset-5 rounded-full blur-xl pointer-events-none transition-all duration-700"
          style={{
            backgroundColor: isFestiveActive ? `${primaryColor}40` : 'rgba(254, 226, 226, 0.5)',
            boxShadow: isFestiveActive ? `0 0 40px ${primaryColor}50` : undefined,
          }}
        />

        {/* Company Emblem Center Badge */}
        {brand.show_logo_image !== false && (
          <div
            className="relative w-20 h-20 rounded-full overflow-hidden bg-white shadow-xl ring-4 ring-white flex items-center justify-center shrink-0 transition-all duration-300"
            style={{
              boxShadow: isFestiveActive ? `0 10px 30px -5px ${primaryColor}50` : '0 10px 25px -5px rgba(148, 163, 184, 0.6)',
            }}
          >
            <Image
              src={logoSrc}
              alt={`${brandName} Emblem`}
              width={80}
              height={80}
              priority
              className="w-full h-full object-contain p-0.5"
            />
          </div>
        )}
      </div>

      {/* Brand Name */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl font-black tracking-[0.18em] text-slate-800 uppercase font-serif">
          {brandName}
        </span>
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors"
          style={{
            backgroundColor: isFestiveActive ? `${primaryColor}15` : '#FEF2F2',
            color: isFestiveActive ? primaryColor : '#DC2626',
            borderColor: isFestiveActive ? `${primaryColor}40` : '#FECACA',
          }}
        >
          {isFestiveActive ? 'Festive Live' : 'Live'}
        </span>
      </div>

      {/* Subtitle */}
      <p className="text-xs font-mono text-slate-400 tracking-widest uppercase mb-7 text-center max-w-sm px-2">
        {subtitle}
      </p>

      {/* Staggered Dot Wave */}
      <div className="flex items-center gap-1.5 mb-7">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: isFestiveActive ? primaryColor : '#EF4444',
              animation: `kjinDotBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Shimmer Progress Track */}
      <div className="relative w-52 h-0.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 w-1/2 rounded-full"
          style={{
            background: isFestiveActive
              ? `linear-gradient(90deg, transparent, ${primaryColor}, ${secondaryColor}, transparent)`
              : 'linear-gradient(90deg, transparent, #dc2626, #f59e0b, transparent)',
            animation: 'shimmer 1.6s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes kjinSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes kjinSpinReverse {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
        @keyframes kjinDotBounce {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-5px);
            opacity: 1;
          }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
