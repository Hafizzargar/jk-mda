import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AdminShell } from '@/components/AdminShell';
import { ScrollToTop } from '@/components/ScrollToTop';

export const metadata: Metadata = {
  title: 'KJIN Admin',
  description: 'Editorial and administrative dashboard for KJIN operations.',
  icons: {
    icon: [
      { url: '/kjin-emblem.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/kjin-emblem.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/kjin-emblem.png',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || undefined;

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body data-nonce={nonce ? 'present' : undefined}>
        <ScrollToTop />
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}

