'use client';

import React, { useEffect, useRef, useState } from 'react';

interface LazyViewportSectionProps<T = any> {
  id?: string;
  className?: string;
  minHeight?: string | number;
  apiSection?: string;
  lang?: string;
  initialData?: T | null;
  skeletonVariant?: 'card' | 'wire' | 'list' | 'quote';
  children?: ((data: T | null, isLoading: boolean) => React.ReactNode) | React.ReactNode;
}

export function LazyViewportSection<T = any>({
  id,
  className = '',
  minHeight = '140px',
  apiSection,
  lang = 'en',
  initialData = null,
  skeletonVariant = 'card',
  children,
}: LazyViewportSectionProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isIntersected, setIsIntersected] = useState<boolean>(Boolean(initialData));
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData && Boolean(apiSection));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we already have initial data or already loaded, no need to observe
    if (initialData) {
      setData(initialData);
      setIsLoading(false);
      return;
    }

    if (typeof window === 'undefined') return;

    if (!('IntersectionObserver' in window)) {
      setIsIntersected(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          setIsIntersected(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        // Pre-fetch 200px before the element enters the viewport
        rootMargin: '200px 0px',
        threshold: 0.01,
      }
    );

    const currentElem = containerRef.current;
    if (currentElem) {
      observer.observe(currentElem);
    }

    return () => {
      observer.disconnect();
    };
  }, [initialData]);

  // Fetch micro-API once intersected if apiSection is configured and no initialData
  useEffect(() => {
    if (!isIntersected || !apiSection || initialData) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchFeed = async () => {
      try {
        const res = await fetch(`/api/feed?section=${encodeURIComponent(apiSection)}&lang=${encodeURIComponent(lang)}`);
        if (!res.ok) {
          throw new Error(`Feed request failed: HTTP ${res.status}`);
        }
        const json = await res.json();
        if (isMounted) {
          setData(json.items ?? json.item ?? json);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn(`[LazyViewportSection] Failed to load ${apiSection}:`, err);
          setError(err.message || 'Failed to load');
          setIsLoading(false);
        }
      }
    };

    fetchFeed();

    return () => {
      isMounted = false;
    };
  }, [isIntersected, apiSection, lang, initialData]);

  // If not yet near viewport, render lightweight skeleton placeholder
  if (!isIntersected || (isLoading && !data)) {
    return (
      <div
        ref={containerRef}
        id={id}
        className={`w-full transition-opacity duration-300 ${className}`}
        style={{ minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }}
      >
        <NewsSkeleton variant={skeletonVariant} />
      </div>
    );
  }

  return (
    <div ref={containerRef} id={id} className={`w-full animate-fade-in ${className}`}>
      {typeof children === 'function' ? children(data, isLoading) : children}
    </div>
  );
}

/**
 * Editorial Newspaper Shimmer Skeleton matching KCPJLN styling
 */
function NewsSkeleton({ variant }: { variant: 'card' | 'wire' | 'list' | 'quote' }) {
  if (variant === 'wire') {
    return (
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-3 font-sans animate-pulse">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <div className="h-3 w-28 bg-stone-200 rounded"></div>
          <div className="h-2.5 w-12 bg-stone-100 rounded"></div>
        </div>
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-2.5 bg-stone-50 rounded-xl space-y-1.5">
              <div className="flex justify-between">
                <div className="h-2 w-16 bg-stone-200 rounded"></div>
                <div className="h-2 w-10 bg-stone-100 rounded"></div>
              </div>
              <div className="h-3 w-5/6 bg-stone-200 rounded"></div>
              <div className="h-2 w-24 bg-stone-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'quote') {
    return (
      <div className="bg-[#efeeeb] p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3 font-sans animate-pulse">
        <div className="h-3 w-36 bg-stone-300 rounded"></div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="p-3 bg-white rounded-xl space-y-1.5">
              <div className="h-3 w-full bg-stone-200 rounded"></div>
              <div className="h-3 w-3/4 bg-stone-200 rounded"></div>
              <div className="flex justify-between pt-1">
                <div className="h-2 w-20 bg-stone-200 rounded"></div>
                <div className="h-2 w-12 bg-stone-100 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default 'card' skeleton
  return (
    <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-2.5 font-sans animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-2.5 w-24 bg-stone-200 rounded"></div>
        <div className="h-2 w-12 bg-stone-100 rounded"></div>
      </div>
      <div className="h-4 w-4/5 bg-stone-200 rounded"></div>
      <div className="h-3 w-full bg-stone-100 rounded"></div>
      <div className="h-3 w-2/3 bg-stone-100 rounded"></div>
      <div className="pt-2 border-t border-stone-100 flex justify-between">
        <div className="h-2 w-16 bg-stone-200 rounded"></div>
        <div className="h-2 w-14 bg-stone-200 rounded"></div>
      </div>
    </div>
  );
}

