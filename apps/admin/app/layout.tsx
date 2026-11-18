import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AdminShell } from '@/components/AdminShell';
import { ScrollToTop } from '@/components/ScrollToTop';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'KJCPL Admin',
  description: 'Editorial and administrative dashboard for KJCPL operations.',
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
  let nonce: string | undefined = undefined;
  try {
    const headersList = await headers();
    nonce = headersList.get('x-nonce') || undefined;
  } catch (err) {
    console.warn('[RootLayout] headers() resolution warning:', err);
  }

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body data-nonce={nonce ? 'present' : undefined} suppressHydrationWarning>
        <ScrollToTop />
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}

