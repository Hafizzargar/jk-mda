'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  userRole?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
  theme?: 'light' | 'dark';
  brandName?: string;
  brandLogo?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeDot?: boolean;
  badgeColor?: string;
  roles?: string[];
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  userRole,
  userEmail,
  onSignOut,
  brandName = 'KJCPL',
}: SidebarProps) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOutClick = async () => {
    setLoggingOut(true);
    await onSignOut();
  };

  const isLinkActive = (item: NavItem) => {
    if (!pathname) return false;
    if (item.exact) {
      return pathname === item.href;
    }
    if (item.href === '/articles') {
      return pathname.startsWith('/articles');
    }
    return pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href) && !item.href.includes('?'));
  };

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        {
          name: 'Dashboard',
          href: '/',
          exact: true,
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          name: 'Audience & Views',
          href: '/analytics',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Newsroom',
      items: [
        {
          name: 'Articles & Stories',
          href: '/articles',
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          ),
        },
        {
          name: 'Pending AI Drafts',
          href: '/newsroom/ai-drafts',
          badge: '$0 Free',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          name: 'Autonomous News',
          href: '/newsroom/youtube',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        },
        {
          name: 'Voices & Editorial Desk',
          href: '/settings/editorial-records',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          ),
        },
        {
          name: 'Correspondents & Bylines',
          href: '/settings/authors',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          ),
        },
        {
          name: 'Careers & Applications',
          href: '/careers',
          badge: 'Hiring',
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
          roles: ['owner', 'superadmin', 'admin'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Live data',
      items: [
        {
          name: 'Regional telemetry',
          href: '/settings/telemetry',
          badge: 'Live',
          badgeDot: true,
          badgeColor: 'text-emerald-400 font-semibold',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Site',
      items: [
        {
          name: 'Footer and legal',
          href: '/settings/footer',
          roles: ['owner', 'superadmin', 'admin'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
        {
          name: 'Design & Curation',
          href: '/settings/curation',
          roles: ['owner', 'superadmin', 'admin'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          ),
        },
        {
          name: 'Team & Workspace',
          href: '/employees',
          roles: ['owner', 'superadmin'],
          icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        },
      ],
    },
  ];

  const userInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : userRole
      ? userRole.slice(0, 2).toUpperCase()
      : 'KJ';

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#080e1a] text-slate-300 border-r border-slate-800/80 shadow-xl overflow-hidden select-none">
      {/* Top Header */}
      <div className="shrink-0 border-b border-slate-800/80">
        {isCollapsed ? (
          <div className="py-3 px-2 flex flex-col items-center gap-2">
            <Link
              href="/"
              onClick={onCloseMobile}
              title={`${brandName} Newsroom Admin`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 font-black text-lg shadow-sm hover:scale-105 transition-transform"
            >
              K
            </Link>
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="px-4 py-3.5 flex items-center justify-between">
            <Link
              href="/"
              onClick={onCloseMobile}
              title={`${brandName} Newsroom Admin`}
              className="flex items-center gap-3 group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 font-black text-base shadow-sm group-hover:scale-105 transition-transform">
                K
              </div>
              <div className="min-w-0">
                <div className="font-serif font-black text-sm tracking-wide text-white leading-tight">
                  {brandName}
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Newsroom admin
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            {/* Mobile drawer close button */}
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="lg:hidden flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <span className="text-xs">✕</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav
        data-sidebar-nav
        className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-4"
      >
        {navSections.map((section) => {
          const filteredItems = section.items.filter((item) => {
            if (!item.roles) return true;
            if (!userRole) return false;
            return item.roles.includes(userRole);
          });

          if (filteredItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  {section.title}
                </p>
              )}

              <div className="space-y-0.5">
                {filteredItems.map((item) => {
                  const active = isLinkActive(item);

                  if (isCollapsed) {
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={onCloseMobile}
                        title={item.name}
                        className={`group relative flex h-10 w-10 items-center justify-center rounded-xl mx-auto transition-all ${
                          active
                            ? 'bg-slate-800/90 text-cyan-400 shadow-2xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cyan-400 rounded-r" />
                        )}
                        <span className="transition-transform group-hover:scale-110">
                          {item.icon}
                        </span>
                        {/* Hover Tooltip */}
                        <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-xl whitespace-nowrap group-hover:block border border-slate-800">
                          {item.name}
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                        active
                          ? 'bg-slate-800/80 text-white font-semibold shadow-2xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cyan-400 rounded-r" />
                      )}

                      <span
                        className={`shrink-0 transition-colors ${
                          active ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      >
                        {item.icon}
                      </span>

                      <span className="truncate flex-1">{item.name}</span>

                      {item.badge && (
                        <span className={`shrink-0 flex items-center gap-1 text-[10px] ${item.badgeColor || 'text-slate-400'}`}>
                          {item.badgeDot && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          <span>{item.badge}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Footer Section */}
      <div className={`shrink-0 border-t border-slate-800/80 bg-slate-950/60 ${isCollapsed ? 'p-2' : 'p-3'}`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/profile"
              onClick={onCloseMobile}
              title={`Signed in as ${userEmail || 'Editor'}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white shadow-2xs hover:scale-105 transition-transform"
            >
              {userInitials}
            </Link>
            <button
              type="button"
              onClick={handleSignOutClick}
              disabled={loggingOut}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 p-2">
            <Link
              href="/profile"
              onClick={onCloseMobile}
              title="My Profile"
              className="flex items-center gap-2.5 min-w-0 flex-1 group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white shadow-2xs">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                  {userEmail ? userEmail.split('@')[0] : 'Editor'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="truncate text-[10px] font-mono font-medium text-cyan-400 capitalize">
                    {userRole || 'Editor'}
                  </span>
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleSignOutClick}
              disabled={loggingOut}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-[272px]'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sliding Drawer & Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
