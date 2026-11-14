'use client';

import { useState } from 'react';
import Image from 'next/image';

interface SafeEditorialImageProps {
  src?: string | null;
  alt?: string;
  badge?: string;
  className?: string;
  containerClassName?: string;
  sizes?: string;
  priority?: boolean;
}

export function SafeEditorialImage({
  src,
  alt = 'Editorial illustration',
  badge,
  className = 'object-cover',
  containerClassName = 'relative w-full h-32 rounded-xl overflow-hidden mb-3 border border-sky-100 shadow-xs bg-slate-900/5',
  sizes = '(max-width: 1024px) 100vw, 320px',
  priority = false,
}: SafeEditorialImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src || typeof src !== 'string' || !src.trim()) {
    return null;
  }

  const isExternal = src.startsWith('http://') || src.startsWith('https://');

  return (
    <div className={containerClassName}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={isExternal}
        className={className}
        onError={() => setHasError(true)}
      />
      {badge && (
        <div className="absolute top-2 left-2 bg-[#0F172A]/85 backdrop-blur-xs text-white px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded pointer-events-none z-10 shadow-xs">
          {badge}
        </div>
      )}
    </div>
  );
}

