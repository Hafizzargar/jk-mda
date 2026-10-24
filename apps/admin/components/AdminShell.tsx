'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { CommandPalette } from './CommandPalette';

export interface AdminContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isBlockerActive: boolean;
  toggleBlocker: () => void;
}

export const AdminContext = createContext<AdminContextType>({
  theme: 'light',
  toggleTheme: () => {},
  isBlockerActive: false,
  toggleBlocker: () => {},
});

export const useAdmin = () => useContext(AdminContext);

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isBlockerActive, setIsBlockerActive] = useState(false);
  const [blockerToast, setBlockerToast] = useState<string | null>(null);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Initialize theme & blocker states from localStorage on client mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('kjin_admin_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);

    const savedBlocker = localStorage.getItem('kjin_admin_blocker_active');
    if (savedBlocker === 'true') {
      setIsBlockerActive(true);
      document.documentElement.setAttribute('data-blocker', 'active');
    }

    const savedCollapsed = localStorage.getItem('kjin_admin_sidebar_collapsed');
    if (savedCollapsed === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('kjin_admin_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  };

  const handleToggleBlocker = () => {
    setIsBlockerActive((prev) => {
      const next = !prev;
      localStorage.setItem('kjin_admin_blocker_active', String(next));
      document.documentElement.setAttribute('data-blocker', next ? 'active' : 'inactive');
      
      const msg = next
        ? '🛡️ Blocker Activated: Native Ads, Trackers & Simulation Overlays are now blocked.'
        : '🛡️ Blocker Disabled: Real-time ads and live services restored.';
      setBlockerToast(msg);
      setTimeout(() => setBlockerToast(null), 4500);

      window.dispatchEvent(new CustomEvent('kjin-blocker-changed', { detail: { active: next } }));
      return next;
    });
  };

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('kjin_admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Fetch session & profile info
  useEffect(() => {
    async function loadSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          setUserEmail(data.session.user.email ?? null);
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.session.user.id)
            .maybeSingle();

          if (profile?.role) {
            setUserRole(profile.role);
          }
        }
      } catch {
        // Silently handle if unauthenticated
      }
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
      } else {
        setUserEmail(null);
        setUserRole(null);
      }
    });

    // Listen for custom open-command-palette event
    const handleOpenCommandPalette = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleOpenCommandPalette);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('open-command-palette', handleOpenCommandPalette);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push('/login');
    }
  };

  // If on login or MFA auth routes, don't show the dashboard sidebar/navbar shell
  const isAuthRoute = pathname === '/login' || pathname.startsWith('/mfa/');
  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <AdminContext.Provider
      value={{
        theme,
        toggleTheme: handleToggleTheme,
        isBlockerActive,
        toggleBlocker: handleToggleBlocker,
      }}
    >
      <div
        className={`min-h-screen flex antialiased selection:bg-cyan-500 selection:text-white transition-colors duration-200 ${
          theme === 'dark' ? 'bg-[#020817] text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        {/* Blocker Alert Toast Notification */}
        {blockerToast && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-cyan-500/40 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md dark:bg-slate-900/95 dark:border-cyan-500/50 animate-in fade-in slide-in-from-top-3 duration-300">
            <span className="text-xl">🛡️</span>
            <div className="text-xs">
              <p className="font-bold text-slate-900 dark:text-white">Admin Blocker Shield</p>
              <p className="text-slate-600 dark:text-slate-300">{blockerToast}</p>
            </div>
            <button
              type="button"
              onClick={() => setBlockerToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Sidebar (Desktop sticky + Mobile sliding drawer) */}
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          userRole={userRole}
          userEmail={userEmail}
          onSignOut={handleSignOut}
          theme={theme}
        />

        {/* Main Body */}
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          <Navbar
            onOpenMobile={() => setMobileOpen(true)}
            onOpenSearch={() => setIsCommandPaletteOpen(true)}
            userRole={userRole}
            userEmail={userEmail}
            onSignOut={handleSignOut}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            isBlockerActive={isBlockerActive}
            onToggleBlocker={handleToggleBlocker}
          />

          <main className="flex-1 min-w-0">{children}</main>
        </div>

        {/* Command Palette Modal */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
      </div>
    </AdminContext.Provider>
  );
}
