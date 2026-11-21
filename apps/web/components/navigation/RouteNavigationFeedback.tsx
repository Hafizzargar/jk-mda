'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const NAVIGATION_TIMEOUT_MS = 30_000;

export function RouteNavigationFeedback() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const sourceUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      const destinationPath = `${destination.pathname}${destination.search}`;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (destinationPath === currentPath) return;

      sourceUrlRef.current = currentPath;
      setIsNavigating(true);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!isNavigating || !sourceUrlRef.current) return;

    const sourceUrl = sourceUrlRef.current;
    const finishNavigation = () => {
      sourceUrlRef.current = null;
      setIsNavigating(false);
    };

    if (pathname !== sourceUrl.split('?')[0]) {
      finishNavigation();
      return;
    }

    const stopWhenUrlChanges = () => {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (currentPath !== sourceUrl) finishNavigation();
    };

    const intervalId = window.setInterval(stopWhenUrlChanges, 100);
    const timeoutId = window.setTimeout(finishNavigation, NAVIGATION_TIMEOUT_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [isNavigating, pathname]);

  if (!isNavigating) return null;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[10001] h-1 overflow-hidden bg-cyan-100" aria-hidden="true">
        <div className="route-progress-indicator h-full w-1/3 bg-cyan-600" />
      </div>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/25 px-4">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 shadow-xl ring-1 ring-slate-200"
        >
          <span
            aria-hidden="true"
            className="h-6 w-6 shrink-0 rounded-full border-[3px] border-cyan-600 border-t-transparent motion-safe:animate-spin"
          />
          <span className="text-left">
            <span className="block font-semibold text-slate-900">Opening story</span>
            <span className="block text-sm text-slate-600">Please wait while the page loads.</span>
          </span>
        </div>
      </div>
    </>
  );
}
