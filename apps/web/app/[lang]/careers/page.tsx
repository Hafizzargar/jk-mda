import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createServerAnonClient } from '@/lib/supabase-server';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME } from '@/lib/config';
import { getBrandSettings } from '@/lib/brand';
import { getFooterContactSettings } from '@/lib/contact';
import { getCareersSettings } from '@/lib/careers';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
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
      canonical: `${SITE_URL}/en/careers`,
    },
    openGraph: {
      title: `${pageTitle} | ${brandName}`,
      description: careersSettings.page_subtitle,
      url: `${SITE_URL}/en/careers`,
      siteName: `${brandFullName} (${brandName})`,
      type: 'website',
    },
  };
}

export default async function CareersPage({ params }: CareersPageProps) {
  const { lang } = await params;
  const langPrefix = lang === 'en' ? '' : `/${lang}`;

  const supabase = createServerAnonClient();
  const [brand, footerContact, careersSettings, activeTemplateRow] = await Promise.all([
    getBrandSettings(supabase),
    getFooterContactSettings(supabase),
    getCareersSettings(supabase),
    supabase.from('site_settings').select('value').eq('key', 'active_template').maybeSingle(),
  ]);

  const dbTemplateId = (activeTemplateRow.data?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const activeTemplateId: TemplateId = dbTemplateId || 'classic-editorial';
  const theme = getTemplateTheme(activeTemplateId);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans">
      {/* 1. MINIMAL DEDICATED CAREERS HEADER: ONLY LOGO & NAME */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo & Name */}
          <Link href={langPrefix || '/'} className="flex items-center gap-3 group">
            {brand.logo_url ? (
              <Image
                src={brand.logo_url}
                alt={brand.name || 'KJCPL'}
                width={44}
                height={44}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-contain shadow-xs transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500 text-slate-950 font-serif font-black flex items-center justify-center text-lg shadow-xs group-hover:scale-105 transition-transform">
                {brand.name?.[0] || 'K'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-xl sm:text-2xl tracking-tight text-white group-hover:text-amber-400 transition-colors">
                  {brand.name || 'KJCPL'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Careers Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                {brand.full_name || 'Jammu & Kashmir Journal of Record'}
              </p>
            </div>
          </Link>

          {/* Clean Return Link */}
          <Link
            href={langPrefix || '/'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition shadow-xs group"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform text-amber-400">←</span>
            <span>Return to Publication</span>
          </Link>
        </div>
      </header>

      {/* 2. CAREERS HERO & INTERACTIVE PORTAL */}
      <main className="flex-1">
        <CareersPortal
          careersSettings={careersSettings}
          brandName={brand.name || SITE_SHORT_NAME}
          brandFullName={brand.full_name || SITE_NAME}
          langPrefix={langPrefix}
        />
      </main>

      {/* 3. FOOTER */}
      <SiteFooter
        lang={lang}
        theme={theme}
        contactSettings={footerContact}
        brandSettings={brand}
      />
    </div>
  );
}
