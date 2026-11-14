'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileBottomBarProps {
  onOpenMenu: () => void;
  userRole?: string | null;
}

export function MobileBottomBar({ onOpenMenu }: MobileBottomBarProps) {
  const pathname = usePathname();

  const isDashboard = pathname === '/';
  const isStories = pathname.startsWith('/articles') && pathname !== '/articles/new';
  const isNew = pathname === '/articles/new';
  const isRadar = pathname.startsWith('/newsroom');

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-3 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-lg shadow-slate-900/10"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Dashboard / Desk */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            isDashboard
              ? 'text-cyan-700 dark:text-cyan-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span className="text-lg leading-none mb-0.5">📊</span>
          <span className="text-[10px] tracking-tight">Desk</span>
        </Link>

        {/* Stories / Publications */}
        <Link
          href="/articles"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            isStories
              ? 'text-cyan-700 dark:text-cyan-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span className="text-lg leading-none mb-0.5">📰</span>
          <span className="text-[10px] tracking-tight">Stories</span>
        </Link>

        {/* Floating Center + Create Story Button */}
        <Link
          href="/articles/new"
          aria-label="Create new story"
          className={`flex flex-col items-center justify-center -mt-5 h-12 w-12 rounded-full shadow-lg shadow-cyan-600/30 transition-all active:scale-95 ${
            isNew
              ? 'bg-cyan-500 text-white ring-4 ring-cyan-200 dark:ring-cyan-900'
              : 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white ring-3 ring-white dark:ring-slate-900 hover:brightness-110'
          }`}
        >
          <span className="text-2xl font-bold leading-none">+</span>
        </Link>

        {/* Autonomous AI Radar */}
        <Link
          href="/newsroom/youtube"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            isRadar
              ? 'text-purple-600 dark:text-purple-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span className="text-lg leading-none mb-0.5">🛰️</span>
          <span className="text-[10px] tracking-tight">Radar</span>
        </Link>

        {/* Menu / Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open full newsroom navigation"
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-lg leading-none mb-0.5">☰</span>
          <span className="text-[10px] tracking-tight">Menu</span>
        </button>
      </div>
    </nav>
  );
}
