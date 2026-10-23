import Link from 'next/link';
import { SITE_SHORT_NAME } from '@/lib/config';
import { REGIONAL_DIVISIONS } from '@/lib/taxonomy';
import { DEFAULT_FOOTER_CONTACT, sanitizeContactSettings, type FooterContactSettings } from '@/lib/contact';
import { type TemplateTheme } from '@/lib/templates';

interface SiteFooterProps {
  lang?: string;
  theme?: TemplateTheme;
  contactSettings?: Partial<FooterContactSettings> | null;
}

export function SiteFooter({
  lang = 'en',
  theme,
  contactSettings,
}: SiteFooterProps) {
  const contact: FooterContactSettings = sanitizeContactSettings(contactSettings || DEFAULT_FOOTER_CONTACT);
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const isDark = theme?.isDark ?? false;

  const footerBg = isDark ? 'bg-[#05070a]' : 'bg-[#f4efe8]';
  const footerBorder = isDark ? 'border-t border-slate-800' : 'border-t-2 border-slate-300';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-300' : 'text-slate-700';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-500';
  const accentText = theme?.accentTextClass || (isDark ? 'text-cyan-400' : 'text-blue-800');
  const cardBg = isDark ? 'bg-slate-900/60' : 'bg-white/80';
  const cardBorder = isDark ? 'border-slate-800' : 'border-slate-200';

  return (
    <footer className={`mt-20 ${footerBg} ${footerBorder} font-sans transition-colors duration-200`}>
      {/* 1. Main 4-Column Layout */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          {/* Col 1: Identity & Editorial Mission (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Link
              href={`${langPrefix}/`}
              className={`text-3xl font-black tracking-tight uppercase ${textPrimary} hover:opacity-85 transition`}
              style={{ fontFamily: theme?.id === 'classic-editorial' ? 'Georgia, serif' : 'inherit' }}
            >
              {SITE_SHORT_NAME}
            </Link>

            <div className={`text-xs font-semibold ${accentText} tracking-wide`}>
              {contact.tagline}
            </div>

            <p className={`text-xs ${textSecondary} leading-relaxed`}>
              {contact.description}
            </p>

            <div className="pt-2">
              <div className={`p-3 rounded-xl border ${cardBorder} ${cardBg} text-[11px] space-y-1.5`}>
                <div className={`font-bold uppercase tracking-wider text-[10px] ${textMuted}`}>
                  Publisher & Statutory Accreditation
                </div>
                <div className={`${textSecondary} font-mono text-[10px] leading-tight`}>
                  {contact.registration_number}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                  <span>&#10003;</span>
                  <span>Independent Non-Partisan Journal of Record</span>
                </div>
              </div>
            </div>
          </div>

          {/* Col 2: Bureau Locations & Working Hours (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${textPrimary} border-b ${isDark ? 'border-slate-800' : 'border-slate-300'} pb-2`}>
              Bureau Headquarters
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className={`font-bold ${textPrimary} block text-[11px]`}>
                  {contact.primary_address_label}
                </span>
                <p className={`${textSecondary} mt-0.5 leading-relaxed`}>
                  {contact.primary_address}
                </p>
              </div>

              <div>
                <span className={`font-bold ${textPrimary} block text-[11px]`}>
                  {contact.bureau_address_label}
                </span>
                <p className={`${textSecondary} mt-0.5 leading-relaxed`}>
                  {contact.bureau_address}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                <span className={`font-bold ${textPrimary} block text-[10px] uppercase tracking-wider`}>
                  Operating Hours
                </span>
                <p className={`text-[11px] ${textMuted} mt-0.5`}>
                  {contact.operating_hours}
                </p>
              </div>
            </div>
          </div>

          {/* Col 3: Direct Desks & Grievances (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${textPrimary} border-b ${isDark ? 'border-slate-800' : 'border-slate-300'} pb-2`}>
              Direct Communications
            </h3>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                  {contact.phone_primary_label}
                </span>
                <a
                  href={`tel:${contact.phone_primary.replace(/[^0-9+]/g, '')}`}
                  className={`font-mono font-bold ${accentText} hover:underline`}
                >
                  {contact.phone_primary}
                </a>
              </div>

              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                  {contact.phone_secondary_label}
                </span>
                <a
                  href={`tel:${contact.phone_secondary.replace(/[^0-9+]/g, '')}`}
                  className={`font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'} hover:underline`}
                >
                  {contact.phone_secondary}
                </a>
              </div>

              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                  Editorial Newsdesk
                </span>
                <a
                  href={`mailto:${contact.email_editorial}`}
                  className={`font-mono ${textPrimary} hover:underline break-all`}
                >
                  {contact.email_editorial}
                </a>
              </div>

              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                  Press Releases & Dispatches
                </span>
                <a
                  href={`mailto:${contact.email_press}`}
                  className={`font-mono ${textSecondary} hover:underline break-all`}
                >
                  {contact.email_press}
                </a>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                  Public Grievance Redressal
                </span>
                <span className={`text-[11px] ${textSecondary} block font-medium`}>
                  {contact.grievance_officer_name}
                </span>
                <a
                  href={`mailto:${contact.email_grievance}`}
                  className={`font-mono text-[11px] ${isDark ? 'text-amber-400' : 'text-amber-700'} hover:underline break-all`}
                >
                  {contact.email_grievance}
                </a>
              </div>
            </div>
          </div>

          {/* Col 4: Regional Divisions & Broadcasts (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${textPrimary} border-b ${isDark ? 'border-slate-800' : 'border-slate-300'} pb-2`}>
              Regions of J&K
            </h3>

            <div className="space-y-1.5 text-xs">
              {Object.values(REGIONAL_DIVISIONS).map((reg) => (
                <Link
                  key={reg.id}
                  href={`${langPrefix}/region/${reg.id}`}
                  className={`block py-0.5 ${textSecondary} hover:${textPrimary} hover:translate-x-0.5 transition-transform`}
                >
                  {reg.name}
                </Link>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
              <h4 className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} mb-2`}>
                Follow KJIN
              </h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {contact.social_twitter && (
                  <a
                    href={contact.social_twitter}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition`}
                  >
                    X / Twitter
                  </a>
                )}
                {contact.social_facebook && (
                  <a
                    href={contact.social_facebook}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition`}
                  >
                    Facebook
                  </a>
                )}
                {contact.social_telegram && (
                  <a
                    href={contact.social_telegram}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition`}
                  >
                    Telegram
                  </a>
                )}
                {contact.social_whatsapp && (
                  <a
                    href={contact.social_whatsapp}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition`}
                  >
                    WhatsApp
                  </a>
                )}
                {contact.social_youtube && (
                  <a
                    href={contact.social_youtube}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition`}
                  >
                    YouTube
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sub-Footer Bar */}
      <div className={`border-t ${isDark ? 'border-slate-900 bg-black/60' : 'border-slate-300 bg-stone-200/40'} py-6 px-4 md:px-8`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className={textMuted}>
            &copy; {new Date().getFullYear()} {contact.organization_name}. All editorial rights reserved.
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link href={`${langPrefix}/category/investigation`} className={`${textMuted} hover:${textPrimary}`}>
              Investigations
            </Link>
            <span className={textMuted}>&bull;</span>
            <Link href={`${langPrefix}/latest`} className={`${textMuted} hover:${textPrimary}`}>
              Live Wire
            </Link>
            <span className={textMuted}>&bull;</span>
            <a href="http://localhost:3001" className={`${accentText} hover:underline`}>
              Staff Portal
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
