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
import { FestiveCelebrationOverlay } from '@/components/celebration/FestiveCelebrationOverlay';
import { getBrandSettings } from '@/lib/brand';
import { getFestiveSettings, type FestiveCelebrationSettings } from '@/lib/festive';
import { getCachedSiteSetting } from '@/lib/site-settings-cache';

export async function generateMetadata(): Promise<Metadata> {
  let brandName = SITE_SHORT_NAME;
  let brandFullName = SITE_NAME;
  let logo = '/kjin-emblem.png';
  let tagline = 'Independent, verified, multilingual news and information for Jammu and Kashmir.';

  try {
    const supabase = createServerAnonClient();
    const brand = await getBrandSettings(supabase);
    if (brand.name) brandName = brand.name;
    if (brand.full_name) brandFullName = brand.full_name;
    if (brand.logo_url) logo = brand.logo_url;
    if (brand.tagline) tagline = brand.tagline;
  } catch (err) {
    console.warn('[RootLayout:generateMetadata] Fallback metadata:', err);
  }

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${brandFullName} | ${brandName}`,
      template: `%s | ${brandName}`,
    },
    description: tagline,
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
  const resolvedParams = (await params) || {};
  const lang = resolvedParams.lang || 'en';
  const dir = lang === 'ur' ? 'rtl' : 'ltr';

  let activeTemplateId: TemplateId = 'classic-editorial';
  try {
    const supabase = createServerAnonClient();
    const settingValue = await getCachedSiteSetting<{ template_id?: string }>(supabase, 'active_template');
    const dbTemplateId = settingValue?.template_id as TemplateId | undefined;
    if (dbTemplateId) activeTemplateId = dbTemplateId;
  } catch (err) {
    console.warn('[RootLayout] Using fallback template:', err);
  }

  let festiveSettings: FestiveCelebrationSettings | null = null;
  try {
    const supabase = createServerAnonClient();
    festiveSettings = await getFestiveSettings(supabase);
  } catch (err) {
    console.warn('[RootLayout] Using fallback festive settings:', err);
  }

  const theme = getTemplateTheme(activeTemplateId);

  return (
    <html
      lang={lang}
      dir={dir}
      data-scroll-behavior="smooth"
      data-theme={theme.isDark ? 'dark' : 'light'}
      style={{ backgroundColor: theme.pageBgHex }}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body
        suppressHydrationWarning
        className={`min-h-screen w-full max-w-full overflow-x-hidden ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} antialiased transition-colors duration-200`}
      >
        <ScrollToTop />
        <FestiveCelebrationOverlay initialSettings={festiveSettings} />
        {children}
      </body>
    </html>
  );
}
