'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { CommandPalette } from './CommandPalette';
import { Toaster } from './Toast';

export interface AdminContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  brandName: string;
  brandLogo: string;
}

export const AdminContext = createContext<AdminContextType>({
  theme: 'light',
  toggleTheme: () => {},
  brandName: 'KCPJLN',
  brandLogo: '/kcpjln-symbol.webp',
});

export const useAdmin = () => useContext(AdminContext);

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [brandName, setBrandName] = useState('KCPJLN');
  const [brandLogo, setBrandLogo] = useState('/kcpjln-symbol.webp');

  // Initialize theme state from localStorage on client mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('kjin_admin_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
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
            .select('role_key')
            .eq('id', data.session.user.id)
            .maybeSingle();

          if (profile?.role_key) {
            setUserRole(profile.role_key);
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

  // Fetch dynamic brand configuration from site_settings
  useEffect(() => {
    // Fast sync from local cache on client mount (safe after hydration)
    try {
      const cached = localStorage.getItem('kjin_brand_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.name && typeof parsed.name === 'string' && parsed.name.trim()) {
          setBrandName(parsed.name.trim());
        }
        if (parsed?.logo_url && typeof parsed.logo_url === 'string' && parsed.logo_url.trim()) {
          setBrandLogo(parsed.logo_url.trim());
        }
      }
    } catch {
      // ignore
    }

    async function loadBrandSettings() {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'navbar_settings')
          .maybeSingle();

        const rawVal = data?.value as Record<string, unknown> | undefined;
        const brand = rawVal?.brand as Record<string, unknown> | undefined;
        if (brand?.name && typeof brand.name === 'string' && brand.name.trim()) {
          setBrandName(brand.name.trim());
        }
        if (brand?.logo_url && typeof brand.logo_url === 'string' && brand.logo_url.trim()) {
          setBrandLogo(brand.logo_url.trim());
        }
        if (brand) {
          try {
            localStorage.setItem('kjin_brand_config', JSON.stringify(brand));
          } catch {
            // ignore
          }
        }
      } catch {
        // Fallback to default
      }
    }

    loadBrandSettings();

    const handleBrandUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ name?: string; logo_url?: string }>;
      if (customEvent.detail?.name) {
        setBrandName(customEvent.detail.name);
      }
      if (customEvent.detail?.logo_url) {
        setBrandLogo(customEvent.detail.logo_url);
      }
    };

    window.addEventListener('kjin-brand-updated', handleBrandUpdate);
    return () => window.removeEventListener('kjin-brand-updated', handleBrandUpdate);
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
    return (
      <>
        {children}
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <AdminContext.Provider
      value={{
        theme,
        toggleTheme: handleToggleTheme,
        brandName,
        brandLogo,
      }}
    >
      <div
        className={`min-h-screen antialiased selection:bg-cyan-500 selection:text-white transition-colors duration-200 ${
          theme === 'dark' ? 'bg-[#020817] text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        {/* Sidebar (Desktop fixed + Mobile sliding drawer) */}
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          userRole={userRole}
          userEmail={userEmail}
          onSignOut={handleSignOut}
          theme={theme}
          brandName={brandName}
          brandLogo={brandLogo}
        />

        {/* Main Body - Offset by desktop sidebar width */}
        <div
          className={`flex flex-col min-h-screen min-w-0 transition-all duration-300 ${
            isCollapsed ? 'lg:pl-20' : 'lg:pl-[272px]'
          }`}
        >
          <Navbar
            onOpenMobile={() => setMobileOpen(true)}
            onOpenSearch={() => setIsCommandPaletteOpen(true)}
            userRole={userRole}
            userEmail={userEmail}
            onSignOut={handleSignOut}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            brandName={brandName}
          />

          <main className="flex-1 min-w-0 w-full overflow-x-hidden">{children}</main>
        </div>

        {/* Command Palette Modal */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />

        {/* Global Toaster Notification Container (Top-Right) */}
        <Toaster position="top-right" />
      </div>
    </AdminContext.Provider>
  );
}
