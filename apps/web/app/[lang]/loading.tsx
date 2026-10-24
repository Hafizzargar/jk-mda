'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { DEFAULT_NAVBAR_SETTINGS, type NavbarBrandConfig, sanitizeNavbarSettings } from '@/lib/navbar';

export default function Loading() {
  const [brand, setBrand] = useState<NavbarBrandConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('kjin_brand_config');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object' && parsed.name) {
            return {
              ...DEFAULT_NAVBAR_SETTINGS.brand,
              ...parsed,
            };
          }
        }
      } catch {
        // ignore JSON parse error
      }
    }
    return DEFAULT_NAVBAR_SETTINGS.brand;
  });

  useEffect(() => {
    let isMounted = true;
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

    fetchBrandSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const logoSrc = brand.logo_url || '/kjin-emblem.png';
  const brandName = brand.name || 'KJIN';
  const subtitle = brand.loader_text || brand.tagline || 'Jammu & Kashmir Journal of Record';

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center bg-white select-none px-4 transition-colors duration-200">

      {/* Logo Stack with Company Emblem */}
      <div className="relative flex items-center justify-center w-32 h-32 mb-8">

        {/* Outermost slow-drift ring */}
        <div
          className="absolute inset-0 rounded-full border border-red-200/60"
          style={{ animation: 'spin 18s linear infinite' }}
        />

        {/* Dashed orbital */}
        <div
          className="absolute inset-2 rounded-full border-2 border-dashed border-amber-300/50"
          style={{ animation: 'spin 10s linear infinite reverse' }}
        />

        {/* Smooth conic-gradient arc spinner */}
        <div
          className="absolute inset-3.5 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #dc2626 0%, #f59e0b 45%, transparent 65%)',
            animation: 'spin 1.4s linear infinite',
            borderRadius: '9999px',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), white calc(100% - 2px))',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), white calc(100% - 2px))',
          }}
        />

        {/* Soft aura glow behind logo */}
        <div className="absolute inset-6 rounded-full bg-red-100/50 blur-md pointer-events-none" />

        {/* Company Emblem Center Badge */}
        {brand.show_logo_image !== false && (
          <div className="relative w-20 h-20 rounded-full overflow-hidden bg-white shadow-xl shadow-slate-300/60 ring-4 ring-white flex items-center justify-center shrink-0">
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
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-600 border border-red-200 bg-red-50 px-1.5 py-0.5 rounded">
          Live
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
            className="block w-1.5 h-1.5 rounded-full bg-red-500"
            style={{
              animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Shimmer Progress Track */}
      <div className="relative w-52 h-0.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 w-1/2 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, #dc2626, #f59e0b, transparent)',
            animation: 'shimmer 1.6s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
