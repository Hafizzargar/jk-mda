import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AdminShell } from '@/components/AdminShell';

export const metadata: Metadata = {
  title: 'KJIN Admin',
  description: 'Editorial and administrative dashboard for KJIN operations.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || undefined;

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body data-nonce={nonce ? 'present' : undefined}>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}

