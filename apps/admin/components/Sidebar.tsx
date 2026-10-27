'use client';

import { useState, useEffect } from 'react';
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
  brandName?: string;
  brandLogo?: string;
}

interface SubNavItem {
  name: string;
  href: string;
  icon?: string;
  badge?: string;
  badgeColor?: string;
  exact?: boolean;
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
  children?: SubNavItem[];
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
  brandName = 'KCPJLN',
  brandLogo = '/kcpjln-symbol.webp',
}: SidebarProps) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentSearch, setCurrentSearch] = useState('');
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    'Articles & Stories': true,
    'Event & Gov Monitor': true,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentSearch(window.location.search);
      const handleLocation = () => setCurrentSearch(window.location.search);
      window.addEventListener('popstate', handleLocation);
      return () => window.removeEventListener('popstate', handleLocation);
    }
  }, [pathname]);

  const toggleMenu = (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenus((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

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
          description: 'News reports, new story drafts & civic problems',
          href: '/articles',
          icon: '📰',
          exact: false,
          children: [
            {
              name: 'All Stories',
              href: '/articles',
              icon: '📄',
            },
            {
              name: 'New Story',
              href: '/articles/new',
              icon: '✍️',
              badge: 'Draft',
              badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40',
            },
            {
              name: 'Area Problems',
              href: '/articles?category=Local',
              icon: '🏛️',
              badge: 'Civic',
              badgeColor: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
            },
          ],
        },
      ],
    },
    {
      title: 'AI Newsroom',
      items: [
        {
          name: 'Event & Gov Monitor',
          description: 'District events & official government response monitor',
          href: '/newsroom',
          icon: '📡',
          badge: 'Radar',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          children: [
            {
              name: 'Live Monitor',
              href: '/newsroom',
              icon: '📡',
              exact: true,
            },
            {
              name: 'Source Registry',
              href: '/newsroom/sources',
              icon: '🔗',
            },
            {
              name: 'Drafts & Fact-Check',
              href: '/newsroom/drafts',
              icon: '📋',
            },
            {
              name: 'AI Quota & Usage',
              href: '/newsroom/usage',
              icon: '⚡',
            },
          ],
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
          roles: ['owner', 'superadmin', 'admin'],
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
          name: 'Brand & Identity',
          description: 'Name, acronym, logo emblem & legal masthead',
          href: '/settings/brand',
          icon: '🎨',
          roles: ['owner', 'superadmin', 'admin'],
          badge: 'Core',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-bold',
        },
        {
          name: 'Header & Navigation',
          description: 'Brand logo, navbar menus, topics & tools',
          href: '/settings/navbar',
          icon: '🧭',
          roles: ['owner', 'superadmin', 'admin'],
          badge: 'Live',
          badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold',
        },
        {
          name: 'Footer & Bureaus',
          description: 'Footer columns, bureau contacts & links',
          href: '/settings/footer',
          icon: '📑',
          roles: ['owner', 'superadmin', 'admin'],
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
          roles: ['owner', 'superadmin', 'admin'],
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

  const isSubItemActive = (sub: SubNavItem) => {
    if (sub.href === '/articles?category=Local') {
      return pathname === '/articles' && currentSearch.includes('category=Local');
    }
    if (sub.href === '/articles') {
      return pathname === '/articles' && !currentSearch.includes('category=Local');
    }
    return pathname === sub.href;
  };

  const isLinkActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    if (item.children) {
      return pathname.startsWith(item.href);
    }
    // Specific match for category=Local
    if (item.href === '/articles?category=Local') {
      return pathname === '/articles' && currentSearch.includes('category=Local');
    }
    return pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href) && !item.href.includes('?'));
  };

  const userInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : userRole
      ? userRole.slice(0, 2).toUpperCase()
      : brandName
        ? brandName.slice(0, 2).toUpperCase()
        : 'KJ';

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 text-slate-800 overflow-hidden shadow-xs dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200">
      {/* Top Branding Section (Fixed) */}
      <div className="shrink-0">
        <div
          className={`border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60 transition-all ${
            isCollapsed
              ? 'py-3.5 px-2 flex items-center justify-center'
              : 'px-4 py-3.5 flex items-center justify-between'
          }`}
        >
          <Link
            href="/"
            onClick={onCloseMobile}
            title={`${brandName} Newsroom Admin`}
            suppressHydrationWarning
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'} transition-opacity hover:opacity-90`}
          >
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 p-1 shadow-xs dark:bg-slate-900 dark:border-slate-700">
              <Image
                src={brandLogo || '/kcpjln-symbol.webp'}
                alt={`${brandName} Symbol`}
                width={26}
                height={26}
                className="object-contain"
                priority
                suppressHydrationWarning
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    suppressHydrationWarning
                    className="font-extrabold text-base tracking-wider text-slate-900 dark:text-white uppercase"
                  >
                    {brandName}
                  </span>
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

          {/* Desktop collapse toggle (when expanded) */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-slate-300 bg-white text-slate-700 shadow-2xs hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300 transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Mobile drawer close button (only visible on mobile drawer) */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            className="lg:hidden flex h-7 w-7 items-center justify-center rounded-[8px] border border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>

        {/* Collapsed state: Dedicated expand button centered right below header */}
        {isCollapsed && (
          <div className="px-2 pt-2.5 pb-0.5 flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-[8px] border border-slate-300 bg-white text-slate-700 shadow-2xs hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300 transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
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
                  const hasChildren = item.children && item.children.length > 0;
                  const isOpen = openMenus[item.name] ?? true;

                  if (hasChildren) {
                    return (
                      <div key={item.name} className="space-y-0.5">
                        <div
                          className={`group flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                            active
                              ? 'bg-cyan-50/80 text-cyan-950 font-bold border-l-4 border-cyan-600 shadow-2xs dark:bg-cyan-950/50 dark:text-cyan-200 dark:border-cyan-400'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-l-4 border-transparent dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Link
                            href={item.href}
                            onClick={onCloseMobile}
                            title={item.name}
                            className="flex items-center gap-2.5 flex-1 min-w-0"
                          >
                            <span className="text-base shrink-0 transition-transform group-hover:scale-110">
                              {item.icon}
                            </span>
                            {!isCollapsed && (
                              <span className="truncate flex-1">
                                {item.name}
                              </span>
                            )}
                          </Link>

                          {!isCollapsed && (
                            <button
                              type="button"
                              onClick={(e) => toggleMenu(item.name, e)}
                              aria-label={isOpen ? 'Collapse submenu' : 'Expand submenu'}
                              className="ml-1 flex h-5 w-5 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                            >
                              <span
                                className={`inline-block text-[9px] transition-transform duration-200 ${
                                  isOpen ? 'rotate-180' : ''
                                }`}
                              >
                                ▼
                              </span>
                            </button>
                          )}
                        </div>

                        {!isCollapsed && isOpen && (
                          <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-slate-200 dark:border-slate-800 pl-2.5 py-0.5">
                            {item.children!.map((sub) => {
                              const subActive = isSubItemActive(sub);

                              return (
                                <Link
                                  key={sub.name}
                                  href={sub.href}
                                  onClick={onCloseMobile}
                                  title={sub.name}
                                  className={`group flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                                    subActive
                                      ? 'bg-cyan-100/90 text-cyan-950 font-bold dark:bg-cyan-900/50 dark:text-cyan-200 shadow-2xs'
                                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'
                                  }`}
                                >
                                  {sub.icon && (
                                    <span className="text-xs shrink-0 transition-transform group-hover:scale-110">
                                      {sub.icon}
                                    </span>
                                  )}
                                  <span className="truncate flex-1">
                                    {sub.name}
                                  </span>
                                  {sub.badge && (
                                    <span
                                      className={`ml-auto shrink-0 rounded-full border px-1.5 py-0.2 text-[9px] font-bold tracking-wide ${sub.badgeColor}`}
                                    >
                                      {sub.badge}
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-slate-300 bg-slate-50 text-slate-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300 transition-colors"
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-slate-300 bg-slate-50 text-slate-700 hover:border-red-400 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-500/50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
          >
            <span className="text-sm">{loggingOut ? '⏳' : '🚪'}</span>
          </button>
        </div>
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
