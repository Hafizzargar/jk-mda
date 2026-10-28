import Link from 'next/link';
import { SITE_SHORT_NAME } from '@/lib/config';
import { REGIONAL_DIVISIONS } from '@/lib/taxonomy';
import { DEFAULT_FOOTER_CONTACT, sanitizeContactSettings, type FooterContactSettings } from '@/lib/contact';
import { type TemplateTheme } from '@/lib/templates';
import type { NavbarBrandConfig } from '@/lib/navbar';

interface SiteFooterProps {
  lang?: string;
  theme?: TemplateTheme;
  contactSettings?: Partial<FooterContactSettings> | null;
  brandSettings?: Partial<NavbarBrandConfig> | null;
  variant?: 'full' | 'compact';
}

export function SiteFooter({
  lang = 'en',
  theme,
  contactSettings,
  brandSettings,
  variant = 'compact',
}: SiteFooterProps) {
  const contact: FooterContactSettings = sanitizeContactSettings(contactSettings || DEFAULT_FOOTER_CONTACT);
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const isDark = theme?.isDark ?? false;

  // Unified brand resolution: Brand name (e.g. KCPL), full form (e.g. Kashmir Central Press...)
  const brandName = brandSettings?.name?.trim() ||
    (contact.organization_name?.includes('(') ? contact.organization_name.split('(')[0].trim() : contact.organization_name?.trim()) ||
    SITE_SHORT_NAME;

  const brandFullName = brandSettings?.full_name?.trim() ||
    (contact.organization_name?.includes('(')
      ? contact.organization_name.match(/\((.*?)\)/)?.[1]?.trim()
      : '');

  // Tagline logic: respect "if empty then empty"
  const activeTagline = brandSettings?.tagline !== undefined
    ? brandSettings.tagline?.trim()
    : contact.tagline?.trim();

  const footerBg = isDark ? 'bg-[#05070a]' : 'bg-[#f4efe8]';
  const footerBorder = isDark ? 'border-t border-slate-800' : 'border-t-2 border-slate-300';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-300' : 'text-slate-700';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-500';
  const accentText = theme?.accentTextClass || (isDark ? 'text-cyan-400' : 'text-blue-800');
  const cardBg = isDark ? 'bg-slate-900/60' : 'bg-white/80';
  const cardBorder = isDark ? 'border-slate-800' : 'border-slate-200';

  if (variant === 'compact') {
    return (
      <footer className={`mt-10 sm:mt-14 ${footerBg} ${footerBorder} font-sans transition-colors duration-200`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-8 sm:py-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
            {/* Col 1: Brand & Colophon Accreditation */}
            <div className="md:col-span-5 space-y-2.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <Link
                  href={`${langPrefix}/`}
                  className={`text-2xl sm:text-3xl font-black tracking-tight uppercase ${textPrimary} hover:opacity-85 transition inline-block`}
                  style={{ fontFamily: theme?.id === 'classic-editorial' ? 'Georgia, serif' : 'inherit' }}
                >
                  {brandName}
                </Link>
                {brandFullName && (
                  <span className={`text-[11px] font-semibold ${textMuted} tracking-wide`}>
                    ({brandFullName})
                  </span>
                )}
              </div>

              {activeTagline ? (
                <div className={`text-xs font-semibold ${accentText} tracking-wide`}>
                  {activeTagline}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] sm:text-[11px]">
                <span className={`font-mono ${textMuted}`}>
                  {contact.registration_number}
                </span>
                <span className={textMuted}>•</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span>✓</span> Independent Journal of Record
                </span>
              </div>
            </div>

            {/* Col 2: Broadsheet Desks & Fast Links */}
            <div className="md:col-span-4 space-y-2">
              <div className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
                Regional Bureaus &amp; Wires
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {Object.values(REGIONAL_DIVISIONS).map((reg) => (
                  <Link
                    key={reg.id}
                    href={`${langPrefix}/region/${reg.id}`}
                    className={`px-2 py-0.5 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} hover:border-slate-400 text-[11px] font-medium transition`}
                  >
                    {reg.name}
                  </Link>
                ))}
                <Link
                  href={`${langPrefix}/india`}
                  className={`px-2 py-0.5 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} text-[11px] font-medium transition`}
                >
                  National
                </Link>
                <Link
                  href={`${langPrefix}/international`}
                  className={`px-2 py-0.5 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} text-[11px] font-medium transition`}
                >
                  World
                </Link>
              </div>
            </div>

            {/* Col 3: Direct Newsdesk Dispatches */}
            <div className="md:col-span-3 space-y-2 text-xs">
              <div className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
                Newsdesk Dispatch
              </div>
              <div className="space-y-1">
                <div>
                  <span className={`text-[10px] ${textMuted} block`}>Editorial:</span>
                  <a
                    href={`mailto:${contact.email_editorial}`}
                    className={`font-mono text-[11px] ${textPrimary} hover:underline break-all`}
                  >
                    {contact.email_editorial}
                  </a>
                </div>
                <div>
                  <span className={`text-[10px] ${textMuted} block`}>Grievances:</span>
                  <a
                    href={`mailto:${contact.email_grievance}`}
                    className={`font-mono text-[11px] ${isDark ? 'text-amber-400' : 'text-amber-700'} hover:underline break-all`}
                  >
                    {contact.email_grievance}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Footer Bar */}
        <div className={`border-t ${isDark ? 'border-slate-900 bg-black/60' : 'border-slate-300 bg-stone-200/40'} py-4 px-3 sm:px-6 md:px-8`}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-center sm:text-left">
            <div className={textMuted}>
              &copy; {new Date().getFullYear()} {brandName}{brandFullName ? ` (${brandFullName})` : ''}. All editorial rights reserved.
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
              <Link href={`${langPrefix}/category/investigation`} className={`${textMuted} hover:${textPrimary}`}>
                Investigations
              </Link>
              <span className={textMuted}>&bull;</span>
              <Link href={`${langPrefix}/latest`} className={`${textMuted} hover:${textPrimary}`}>
                Live Wire
              </Link>
              <span className={textMuted}>&bull;</span>
              <Link href={`${langPrefix}/careers`} className={`${textMuted} hover:${textPrimary}`}>
                Work With Us / Careers
              </Link>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // Full 4-Column Layout (used on Main Page for desktop, mobile & tablet)
  return (
    <footer className={`mt-14 sm:mt-20 ${footerBg} ${footerBorder} font-sans transition-colors duration-200 w-full`}>
      {/* 1. Main 4-Column Layout */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Col 1: Identity & Editorial Mission (4 cols) */}
          <div className="sm:col-span-2 lg:col-span-4 space-y-3 sm:space-y-4">
            <div>
              <Link
                href={`${langPrefix}/`}
                className={`text-2xl sm:text-3xl font-black tracking-tight uppercase ${textPrimary} hover:opacity-85 transition inline-block`}
                style={{ fontFamily: theme?.id === 'classic-editorial' ? 'Georgia, serif' : 'inherit' }}
              >
                {brandName}
              </Link>
              {brandFullName && (
                <div className={`text-xs font-semibold ${textMuted} tracking-wide mt-1`}>
                  {brandFullName}
                </div>
              )}
            </div>

            {activeTagline ? (
              <div className={`text-xs font-semibold ${accentText} tracking-wide`}>
                {activeTagline}
              </div>
            ) : null}

            <p className={`text-xs ${textSecondary} leading-relaxed`}>
              {contact.description}
            </p>

            <div className="pt-2">
              <div className={`p-3 rounded-xl border ${cardBorder} ${cardBg} text-[11px] space-y-1.5`}>
                <div className={`font-bold uppercase tracking-wider text-[10px] ${textMuted}`}>
                  Publisher &amp; Statutory Accreditation
                </div>
                <div className={`${textSecondary} font-mono text-[10px] leading-tight break-all`}>
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
          <div className="lg:col-span-3 space-y-3 sm:space-y-4">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${textPrimary} border-b ${isDark ? 'border-slate-800' : 'border-slate-300'} pb-2`}>
              Bureau Headquarters
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className={`font-bold ${textPrimary} block text-[11px]`}>
                  {contact.primary_address_label}
                </span>
                <p className={`${textSecondary} mt-0.5 leading-relaxed break-words`}>
                  {contact.primary_address}
                </p>
              </div>

              <div>
                <span className={`font-bold ${textPrimary} block text-[11px]`}>
                  {contact.bureau_address_label}
                </span>
                <p className={`${textSecondary} mt-0.5 leading-relaxed break-words`}>
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
          <div className="lg:col-span-3 space-y-3 sm:space-y-4">
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
                  Press Releases &amp; Dispatches
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
          <div className="sm:col-span-2 lg:col-span-2 space-y-3 sm:space-y-4">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${textPrimary} border-b ${isDark ? 'border-slate-800' : 'border-slate-300'} pb-2`}>
              Regions of J&amp;K
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5 text-xs">
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
                Follow {brandName}
              </h4>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs">
                {contact.social_twitter && (
                  <a
                    href={contact.social_twitter}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition text-[11px] sm:text-xs`}
                  >
                    X / Twitter
                  </a>
                )}
                {contact.social_facebook && (
                  <a
                    href={contact.social_facebook}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition text-[11px] sm:text-xs`}
                  >
                    Facebook
                  </a>
                )}
                {contact.social_telegram && (
                  <a
                    href={contact.social_telegram}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition text-[11px] sm:text-xs`}
                  >
                    Telegram
                  </a>
                )}
                {contact.social_whatsapp && (
                  <a
                    href={contact.social_whatsapp}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition text-[11px] sm:text-xs`}
                  >
                    WhatsApp
                  </a>
                )}
                {contact.social_youtube && (
                  <a
                    href={contact.social_youtube}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`px-2 py-1 rounded border ${cardBorder} ${cardBg} ${textSecondary} hover:${textPrimary} transition text-[11px] sm:text-xs`}
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
      <div className={`border-t ${isDark ? 'border-slate-900 bg-black/60' : 'border-slate-300 bg-stone-200/40'} py-6 px-3 sm:px-6 md:px-8`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-center sm:text-left">
          <div className={textMuted}>
            &copy; {new Date().getFullYear()} {brandName}{brandFullName ? ` (${brandFullName})` : ''}. All editorial rights reserved.
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            <Link href={`${langPrefix}/category/investigation`} className={`${textMuted} hover:${textPrimary}`}>
              Investigations
            </Link>
            <span className={textMuted}>&bull;</span>
            <Link href={`${langPrefix}/latest`} className={`${textMuted} hover:${textPrimary}`}>
              Live Wire
            </Link>
            <span className={textMuted}>&bull;</span>
            <Link href={`${langPrefix}/careers`} className={`${textMuted} hover:${textPrimary}`}>
              Work With Us / Careers
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
