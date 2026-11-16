import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME } from '@/lib/config';
import { safeJsonLd } from '@/lib/sanitize';

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
  let logo = '/kcpjln-symbol.webp';
  let tagline = 'Independent, verified news, ground dispatches, and mountain transit telemetry for Jammu, Kashmir, and Ladakh.';

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

  const keywords = [
    'KJCPL',
    'KJCPL News',
    'KJCPL Truth',
    'Jammu and Kashmir News',
    'Kashmir News Today',
    'Srinagar News',
    'Chenab Valley News',
    'Doda News',
    'Kishtwar News',
    'Pir Panjal News',
    'Poonch Rajouri News',
    'Ladakh News',
    'Mughal Road Status',
    'Zojila Pass Status',
    'Breaking News Jammu and Kashmir',
  ];

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${brandFullName} | ${brandName}`,
      template: `%s | ${brandName}`,
    },
    description: tagline,
    keywords,
    authors: [{ name: 'KJCPL Editorial Bureau', url: `${SITE_URL}/en` }],
    creator: 'KJCPL News Network',
    publisher: brandFullName,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: `${brandFullName} | ${brandName}`,
      description: tagline,
      url: `${SITE_URL}/en`,
      siteName: brandFullName,
      locale: 'en_IN',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/kcpjln-wide-banner.webp`,
          width: 1200,
          height: 630,
          alt: brandFullName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${brandFullName} | ${brandName}`,
      description: tagline,
      images: [`${SITE_URL}/kcpjln-wide-banner.webp`],
      site: '@kjcpl_news',
      creator: '@kjcpl_news',
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
  const lang = 'en';
  const dir = 'ltr';

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

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: 'KJCPL News Network',
    alternateName: ['KJCPL', 'KJCPL Truth'],
    url: `${SITE_URL}/en`,
    logo: `${SITE_URL}/kcpjln-symbol.webp`,
    publishingPrinciples: `${SITE_URL}/en`,
    masthead: `${SITE_URL}/en`,
    diversityPolicy: `${SITE_URL}/en`,
    ethicsPolicy: `${SITE_URL}/en`,
    correctionsPolicy: `${SITE_URL}/en`,
    verificationFactCheckingPolicy: `${SITE_URL}/en`,
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'KJCPL News Network',
    alternateName: ['KJCPL', 'kjcpl.site'],
    url: `${SITE_URL}/en`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/en?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

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
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600&family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`min-h-screen w-full max-w-full overflow-x-hidden ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} antialiased transition-colors duration-200`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd) }}
        />
        <ScrollToTop />
        <FestiveCelebrationOverlay initialSettings={festiveSettings} />
        {children}
      </body>
    </html>
  );
}
