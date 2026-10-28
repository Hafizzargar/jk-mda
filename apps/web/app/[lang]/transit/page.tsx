import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { getBrandSettings } from '@/lib/brand';
import { getNavbarSettings } from '@/lib/navbar';
import { getFooterContactSettings } from '@/lib/contact';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { getTelemetrySettings } from '@/lib/telemetry';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { PassTransitTopography } from '@/components/transit/PassTransitTopography';

interface TransitPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export async function generateMetadata({ params }: TransitPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const supabase = createServerAnonClient();
  const brand = await getBrandSettings(supabase);

  return {
    title: `High Altitude Mountain Passes & Transit Diagnostic | ${brand.name}`,
    description: 'Real-time snow blockades, road surface telemetry, convoy dispatch slots, and sector commander advisories across 5 regional Himalayan corridors.',
    openGraph: {
      title: `Mountain Pass Transit Telemetry • ${brand.full_name}`,
      description: 'Real-time road pass status for NH-44, Mughal Road (Peer Ki Gali), Zojila Pass, Sinthan Top, Razdan Pass, and Khardung La.',
    },
  };
}

export default async function TransitPage({ params }: TransitPageProps) {
  const resolvedParams = await params;
  const supabase = createServerAnonClient();
  const [brandSettings, navbarSettings, contactSettings, telemetry] = await Promise.all([
    getBrandSettings(supabase),
    getNavbarSettings(supabase),
    getFooterContactSettings(supabase),
    getTelemetrySettings(supabase),
  ]);

  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);

  return (
    <div className={`min-h-screen ${theme.pageBgClass} flex flex-col justify-between`}>
      <SiteNavbar
        lang={resolvedParams.lang}
        theme={theme}
        activeCategory="transit"
        navbarSettings={navbarSettings}
      />

      <main className="flex-1 w-full">
        <PassTransitTopography
          telemetry={telemetry}
          brandName={brandSettings.name || 'KCPJLN'}
          brandFullName={brandSettings.full_name || 'Kashmir Chenab Panjal Jammu Ladakh Network'}
        />
      </main>

      <SiteFooter
        lang={resolvedParams.lang}
        theme={theme}
        contactSettings={contactSettings}
        brandSettings={brandSettings}
      />
    </div>
  );
}
