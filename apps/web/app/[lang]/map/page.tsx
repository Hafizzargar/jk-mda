import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { getBrandSettings } from '@/lib/brand';
import { getNavbarSettings } from '@/lib/navbar';
import { getFooterContactSettings } from '@/lib/contact';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { JKMapOverview } from '@/components/map/JKMapOverview';

interface MapPageProps {
  params: Promise<{
    lang: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: MapPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const supabase = createServerAnonClient();
  const brand = await getBrandSettings(supabase);

  return {
    title: `Map Overview JK — Interactive District News & Civic Intelligence | ${brand.name}`,
    description:
      'Interactive geographic map of Jammu, Kashmir and Ladakh. Explore verified ground problems, road and pass alerts, development projects, and district news across all 22 districts.',
    openGraph: {
      title: `Map Overview JK • ${brand.full_name || 'Kashmir & Jammu Information Network'}`,
      description:
        'Geographic intelligence for J&K: Live district telemetry, verified civic issues, road conditions, and local news.',
    },
  };
}

export default async function MapPage({ params, searchParams }: MapPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const initialDistrict = typeof resolvedSearchParams.district === 'string'
    ? resolvedSearchParams.district.toLowerCase()
    : 'doda';

  const supabase = createServerAnonClient();
  const [brandSettings, navbarSettings] = await Promise.all([
    getBrandSettings(supabase),
    getNavbarSettings(supabase),
  ]);

  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-stone-100">
      <main className="flex-1 w-full min-h-0 flex flex-col overflow-hidden">
        <JKMapOverview
          lang={resolvedParams.lang}
          initialDistrictId={initialDistrict}
          brand={brandSettings}
        />
      </main>
    </div>
  );
}
