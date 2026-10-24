'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
}

interface NavItem {
  name: string;
  description: string;
  href: string;
  icon: string;
  badge?: string;
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
}: SidebarProps) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const navSections: NavSection[] = [
    {
      title: 'Editorial Operations',
      items: [
        {
          name: 'Dashboard',
          description: 'Live metrics, drafts & review queue',
          href: '/',
          icon: '📊',
          exact: true,
        },
        {
          name: 'Articles & Stories',
          description: 'Browse, edit & filter published news',
          href: '/articles',
          icon: '📰',
          exact: false,
        },
        {
          name: 'New Story',
          description: 'Compose news report or civic dispatch',
          href: '/articles/new',
          icon: '✍️',
          badge: 'Draft',
          badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40',
        },
        {
          name: 'Area Problems',
          description: 'Civic grievances & valley ground issues',
          href: '/articles?category=Local',
          icon: '🏛️',
          badge: 'Civic',
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
        },
      ],
    },
    {
      title: 'Team & Workspace',
      items: [
        {
          name: 'Employees & Access',
          description: 'Staff directory, RBAC roles & permissions',
          href: '/employees',
          icon: '👥',
        },
        {
          name: 'My Profile & Author',
          description: 'Author bio, credentials & security MFA',
          href: '/profile',
          icon: '👤',
        },
      ],
    },
    {
      title: 'Site Design & Navigation',
      items: [
        {
          name: 'Header & Navigation',
          description: 'Brand logo, navbar menus, topics & tools',
          href: '/settings/navbar',
          icon: '🧭',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          badge: 'Live',
          badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold',
        },
        {
          name: 'Footer & Bureaus',
          description: 'Footer columns, bureau contacts & links',
          href: '/settings/footer',
          icon: '📑',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
        },
        {
          name: 'Website Templates',
          description: 'Reader themes, typography & layout presets',
          href: '/templates',
          icon: '🎨',
          roles: ['owner', 'superadmin', 'admin'],
        },
      ],
    },
    {
      title: 'Revenue & Monetization',
      items: [
        {
          name: 'Custom Ads & Monetization',
          description: 'Sponsors, native ad slots & earnings',
          href: '/settings/ads',
          icon: '💰',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          badge: '✨ Earn',
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/25 dark:text-amber-200 dark:border-amber-400/50 font-bold',
        },
      ],
    },
  ];

  const handleSignOutClick = async () => {
    setLoggingOut(true);
    await onSignOut();
  };

  const isLinkActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    // Specific match for category=Local
    if (item.href === '/articles?category=Local') {
      return pathname === '/articles' && typeof window !== 'undefined' && window.location.search.includes('category=Local');
    }
    return pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href) && !item.href.includes('?'));
  };

  const userInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : userRole
      ? userRole.slice(0, 2).toUpperCase()
      : 'KJ';

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 text-slate-800 overflow-hidden shadow-xs dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200">
      {/* Top Branding Section (Fixed) */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 p-1 shadow-xs dark:bg-slate-900 dark:border-slate-700">
              <Image
                src="/kcpjln-symbol.webp"
                alt="KJIN Symbol"
                width={26}
                height={26}
                className="object-contain"
                priority
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-wider text-slate-900 dark:text-white">KJIN</span>
                  <span className="rounded bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-200 dark:border-cyan-700 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-widest">
                    OS
                  </span>
                </div>
                <p className="text-[10px] font-bold tracking-widest text-slate-600 uppercase dark:text-slate-400">
                  Newsroom Admin
                </p>
              </div>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            <span className="text-[10px] font-bold">{isCollapsed ? '▶' : '◀'}</span>
          </button>
        </div>

        {/* Live Engine Status Mini Banner */}
        {!isCollapsed && (
          <div className="mx-3 mt-3 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs dark:border-emerald-600/40 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              <span className="font-extrabold text-emerald-950 dark:text-emerald-200 text-xs">Newsdesk Active</span>
            </div>
            <span className="text-[10px] font-mono font-black text-emerald-800 dark:text-emerald-300 uppercase">v2.4</span>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav
        data-sidebar-nav
        className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar px-3 py-2 space-y-2"
      >
        {navSections.map((section) => {
          const filteredItems = section.items.filter((item) => {
            if (!item.roles || !userRole) return true;
            return item.roles.includes(userRole);
          });

          if (filteredItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-0.5">
              {!isCollapsed && (
                <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {filteredItems.map((item) => {
                  const active = isLinkActive(item);

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onCloseMobile}
                      title={item.name}
                      className={`group flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                        active
                          ? 'bg-cyan-50 text-cyan-950 font-bold border-l-4 border-cyan-600 shadow-2xs dark:bg-cyan-950/50 dark:text-cyan-200 dark:border-cyan-400'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-l-4 border-transparent dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="text-base shrink-0 transition-transform group-hover:scale-110">
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <>
                          <span className="truncate flex-1">
                            {item.name}
                          </span>
                          {item.badge && (
                            <span
                              className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${item.badgeColor}`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Quick Reader Portal Link */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          {!isCollapsed && (
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
              Live Reader Site
            </p>
          )}
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            title="Open Live Public Site"
            className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-cyan-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-cyan-300 transition-all border-l-4 border-transparent"
          >
            <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">🌐</span>
            {!isCollapsed && (
              <>
                <span className="truncate flex-1">Public Site</span>
                <span className="text-xs text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 font-bold">↗</span>
              </>
            )}
          </a>
        </div>
      </nav>

      {/* Bottom User Profile Section */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/80 dark:bg-slate-900/60">
        <div
          className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all ${
            isCollapsed ? 'justify-center p-2' : ''
          }`}
        >
          {/* Avatar - Clickable Link to Profile */}
          <Link
            href="/profile"
            onClick={onCloseMobile}
            title="My Profile & Author Settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 text-xs font-black text-white shadow-xs hover:scale-105 transition-transform"
          >
            {userInitials}
          </Link>

          {!isCollapsed && (
            <Link
              href="/profile"
              onClick={onCloseMobile}
              title="My Profile & Author Settings"
              className="flex-1 min-w-0 group"
            >
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors">
                {userEmail || 'Editor Session'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900" />
                <span className="truncate text-[11px] font-mono font-bold text-cyan-800 dark:text-cyan-300 capitalize group-hover:underline">
                  {userRole || 'Editor'} • Edit
                </span>
              </div>
            </Link>
          )}

          {/* Profile / Settings Button */}
          {!isCollapsed && (
            <Link
              href="/profile"
              onClick={onCloseMobile}
              title="Edit Profile & Author Name"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300 transition-colors"
            >
              <span className="text-xs">⚙️</span>
            </Link>
          )}

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={handleSignOutClick}
            disabled={loggingOut}
            title="Sign out of newsroom"
            aria-label="Sign out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-slate-700 hover:border-red-400 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-500/50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
          >
            <span className="text-sm">{loggingOut ? '⏳' : '🚪'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-68'
        }`}
      >
        <div className={`fixed top-0 bottom-0 z-40 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-68'}`}>
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Sliding Drawer & Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Sliding drawer */}
          <div className="fixed inset-y-0 left-0 w-76 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
