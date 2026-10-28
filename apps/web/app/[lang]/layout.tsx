import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME } from '@/lib/config';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};
import { createServerAnonClient } from '@/lib/supabase-server';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { ScrollToTop } from '@/components/navigation/ScrollToTop';
import { getBrandSettings } from '@/lib/brand';

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createServerAnonClient();
  const brand = await getBrandSettings(supabase);
  const brandName = brand.name || SITE_SHORT_NAME;
  const brandFullName = brand.full_name || SITE_NAME;
  const logo = brand.logo_url || '/kcpjln-symbol.webp';

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${brandFullName} | ${brandName}`,
      template: `%s | ${brandName}`,
    },
    description: brand.tagline || 'Independent, verified, multilingual news and information for Jammu and Kashmir.',
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: [
        { url: logo },
        { url: '/favicon.ico', sizes: 'any' },
      ],
      apple: [
        { url: logo, sizes: '180x180' },
      ],
      shortcut: logo,
    },
  };
}

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body
        className={`min-h-screen w-full max-w-full overflow-x-hidden ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} antialiased transition-colors duration-200`}
      >
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
