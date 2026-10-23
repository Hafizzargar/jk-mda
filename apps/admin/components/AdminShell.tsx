'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { CommandPalette } from './CommandPalette';

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Read collapsed state from localStorage on client mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('kjin_admin_sidebar_collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

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
    <div className="min-h-screen bg-[#020817] text-slate-100 flex antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Sidebar (Desktop sticky + Mobile sliding drawer) */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        userRole={userRole}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Navbar
          onOpenMobile={() => setMobileOpen(true)}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
          userRole={userRole}
          userEmail={userEmail}
          onSignOut={handleSignOut}
        />

        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
