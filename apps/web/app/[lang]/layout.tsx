import '../globals.css';
import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME } from '@/lib/config';
import { createServerAnonClient } from '@/lib/supabase-server';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';

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

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dir = lang === 'ur' ? 'rtl' : 'ltr';

  const supabase = createServerAnonClient();
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const activeTemplateId: TemplateId = dbTemplateId || 'classic-editorial';
  const theme = getTemplateTheme(activeTemplateId);

  return (
    <html
      lang={lang}
      dir={dir}
      data-scroll-behavior="smooth"
      data-theme={theme.isDark ? 'dark' : 'light'}
      style={{ backgroundColor: theme.pageBgHex }}
    >
      <body
        className={`min-h-screen ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} antialiased transition-colors duration-200`}
      >
        {children}
      </body>
    </html>
  );
}
