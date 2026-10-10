import '../globals.css';
import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | ${SITE_SHORT_NAME}`,
    template: `%s | ${SITE_SHORT_NAME}`,
  },
  description: 'Independent, verified, multilingual news and information for Jammu and Kashmir.',
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dir = lang === 'ur' ? 'rtl' : 'ltr';
  return (
    <html lang={lang} dir={dir}>
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
