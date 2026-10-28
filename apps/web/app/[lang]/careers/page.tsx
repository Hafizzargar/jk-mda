import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME } from '@/lib/config';
import { getBrandSettings } from '@/lib/brand';
import { getNavbarSettings } from '@/lib/navbar';
import { getFooterContactSettings } from '@/lib/contact';
import { getCareersSettings } from '@/lib/careers';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { CareersPortal } from '@/components/careers/CareersPortal';

export const revalidate = 60;

interface CareersPageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createServerAnonClient();
  const brand = await getBrandSettings(supabase);
  const careersSettings = await getCareersSettings(supabase);

  const brandName = brand.name || SITE_SHORT_NAME;
  const brandFullName = brand.full_name || SITE_NAME;
  const pageTitle = careersSettings.page_title || `Work With Us • Careers at ${brandName}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${pageTitle} | ${brandFullName}`,
    description: careersSettings.page_subtitle || `Join the editorial, investigative, and reporting newsroom at ${brandFullName}.`,
    alternates: {
      canonical: `${SITE_URL}/careers`,
    },
    openGraph: {
      title: `${pageTitle} | ${brandName}`,
      description: careersSettings.page_subtitle,
      url: `${SITE_URL}/careers`,
      siteName: `${brandFullName} (${brandName})`,
      type: 'website',
    },
  };
}

export default async function CareersPage({ params }: CareersPageProps) {
  const { lang } = await params;
  const langPrefix = lang === 'en' ? '' : `/${lang}`;

  const supabase = createServerAnonClient();
  const [brand, navbarSettings, footerContact, careersSettings, activeTemplateRow] = await Promise.all([
    getBrandSettings(supabase),
    getNavbarSettings(supabase),
    getFooterContactSettings(supabase),
    getCareersSettings(supabase),
    supabase.from('site_settings').select('value').eq('key', 'active_template').maybeSingle(),
  ]);

  const dbTemplateId = (activeTemplateRow.data?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const activeTemplateId: TemplateId = dbTemplateId || 'classic-editorial';
  const theme = getTemplateTheme(activeTemplateId);

  return (
    <div className={`min-h-screen ${theme.pageBgClass} flex flex-col`}>
      <SiteNavbar
        lang={lang}
        theme={theme}
        navbarSettings={navbarSettings}
      />

      <main className="flex-1">
        <CareersPortal
          careersSettings={careersSettings}
          brandName={brand.name || SITE_SHORT_NAME}
          brandFullName={brand.full_name || SITE_NAME}
          langPrefix={langPrefix}
        />
      </main>

      <SiteFooter
        lang={lang}
        theme={theme}
        contactSettings={footerContact}
        brandSettings={brand}
      />
    </div>
  );
}
