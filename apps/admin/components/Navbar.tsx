'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface NavbarProps {
  onOpenMobile: () => void;
  onOpenSearch: () => void;
  userRole?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
}

export function Navbar({
  onOpenMobile,
  onOpenSearch,
  userRole,
}: NavbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getBreadcrumb = () => {
    if (pathname === '/') return { title: 'Newsroom Dashboard', section: 'Overview' };
    if (pathname === '/articles/new') return { title: 'New Article Draft', section: 'Articles' };
    if (pathname.startsWith('/articles/') && pathname.endsWith('/edit'))
      return { title: 'Edit Story Content', section: 'Articles' };
    if (pathname.startsWith('/articles/') && pathname.endsWith('/review'))
      return { title: 'Review Article', section: 'Articles' };
    if (pathname.startsWith('/articles/') && pathname !== '/articles')
      return { title: 'Article Details', section: 'Articles' };
    if (pathname === '/articles') {
      const cat = searchParams?.get('category');
      if (cat === 'Local') return { title: 'Area Problems & Civic Grievances', section: 'Local Issues' };
      return { title: 'Articles Directory', section: 'Editorial Desk' };
    }
    if (pathname === '/employees') return { title: 'Employees & Staff', section: 'Team Directory' };
    if (pathname === '/templates') return { title: 'Website Templates', section: 'Themes & Layouts' };
    if (pathname === '/settings/footer') return { title: 'Footer & Bureaus', section: 'Site Settings' };
    if (pathname === '/settings/ads') return { title: 'Custom Ads & Monetization', section: 'Revenue & Sponsors' };
    return { title: 'KJIN Admin', section: 'Editorial' };
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-4 md:px-8 backdrop-blur-xl">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Mobile menu hamburger */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open sidebar menu"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:border-slate-700 lg:hidden"
        >
          <span className="text-lg">☰</span>
        </button>

        {/* Breadcrumb Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300">
              {breadcrumb.section}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[200px] sm:max-w-none">
              {breadcrumb.title}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <button
          type="button"
          onClick={onOpenSearch}
          className="group flex w-full items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/60 px-3.5 py-1.5 text-xs text-slate-400 hover:border-cyan-500/40 hover:bg-slate-900 transition-all shadow-inner"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500 group-hover:text-cyan-400 transition-colors">🔍</span>
            <span className="text-slate-400 group-hover:text-slate-300">Quick jump or search...</span>
          </div>
          <kbd className="flex items-center gap-1 rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700/80">
            <span>⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Right: Quick CTAs, Reader Link, & Profile */}
      <div className="flex items-center gap-2.5 md:gap-3">
        {/* Mobile Search Icon */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open command palette"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white md:hidden"
        >
          <span>🔍</span>
        </button>

        {/* Reader Website Link */}
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          title="Open live public reader website"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:bg-slate-900 hover:text-white transition-colors"
        >
          <span>Live Site</span>
          <span className="text-[11px] text-slate-500">↗</span>
        </a>

        {/* Primary CTA: + New Article */}
        <Link
          href="/articles/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-sky-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-cyan-950/40 hover:from-cyan-300 hover:to-sky-300 transition-all active:scale-95"
        >
          <span className="text-sm leading-none">+</span>
          <span className="hidden xs:inline">New Article</span>
        </Link>

        {/* Role & Profile Link */}
        <Link
          href="/profile"
          title="My Profile & Author Settings"
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1 text-xs font-mono font-medium text-cyan-300 capitalize transition-all"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span>{userRole || 'Profile'}</span>
          <span className="text-[10px] opacity-70">⚙️</span>
        </Link>
      </div>
    </header>
  );
}
