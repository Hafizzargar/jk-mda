import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'KJIN Admin',
  description: 'Editorial and administrative dashboard for KJIN operations.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || undefined;

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body data-nonce={nonce ? 'present' : undefined}>{children}</body>
    </html>
  );
}

