import Link from 'next/link';
import { createServerAnonClient } from '@/lib/supabase-server';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { getBrandSettings } from '@/lib/brand';

export default async function NotFound() {
  const supabase = createServerAnonClient();
  const brandSettings = await getBrandSettings(supabase);
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);

  return (
    <main className={`min-h-screen ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} flex items-center justify-center px-4`}>
      <div className={`max-w-md w-full text-center ${theme.cardBgClass} border ${theme.cardBorderClass} rounded-2xl p-8 shadow-sm`}>
        <div className={`text-6xl font-black ${theme.accentTextClass} mb-4 tracking-tighter`}>404</div>
        <h1 className={`text-2xl font-bold ${theme.textPrimaryClass} mb-3`}>Page Not Found</h1>
        <p className={`${theme.textSecondaryClass} mb-8 text-sm`}>
          The dispatch, article, or category you requested does not exist or has been archived.
        </p>
        <Link
          href="/"
          className={`inline-block ${theme.accentBgClass} font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition text-sm`}
        >
          Return to {brandSettings.name} Homepage
        </Link>
      </div>
    </main>
  );
}
