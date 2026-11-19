import Link from 'next/link';
import { SITE_SHORT_NAME } from '@/lib/config';
import { REGIONAL_DIVISIONS } from '@/lib/taxonomy';
import { DEFAULT_FOOTER_CONTACT, sanitizeContactSettings, type FooterContactSettings } from '@/lib/contact';
import {
  DEFAULT_DEVELOPER_SUPPORT,
  sanitizeDeveloperSupportSettings,
  type DeveloperSupportSettings,
} from '@/lib/developer-support';
import { type TemplateTheme } from '@/lib/templates';
import type { NavbarBrandConfig } from '@/lib/navbar';

interface SiteFooterProps {
  lang?: string;
  theme?: TemplateTheme;
  contactSettings?: Partial<FooterContactSettings> | null;
  brandSettings?: Partial<NavbarBrandConfig> | null;
  developerSettings?: Partial<DeveloperSupportSettings> | null;
  variant?: 'full' | 'compact';
}

export function SiteFooter({
  lang = 'en',
  theme,
  contactSettings,
  brandSettings,
  developerSettings,
  variant = 'compact',
}: SiteFooterProps) {
  const contact: FooterContactSettings = sanitizeContactSettings(contactSettings || DEFAULT_FOOTER_CONTACT);
  const dev: DeveloperSupportSettings = sanitizeDeveloperSupportSettings(
    developerSettings || contact.developer_support || DEFAULT_DEVELOPER_SUPPORT
  );
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const isDark = theme?.isDark ?? false;

  // Unified brand resolution: Brand name (e.g. KJIN), full form (e.g. Kashmir & Jammu Information Network)
  const rawBrandName = brandSettings?.name?.trim() ||
    (contact.organization_name?.includes('(') ? contact.organization_name.split('(')[0].trim() : contact.organization_name?.trim()) ||
    SITE_SHORT_NAME;
  const brandName = rawBrandName.replace(/\b(KCPJLN|KJIN)\b/g, 'KJCPL') || 'KJCPL';

  const rawBrandFullName = brandSettings?.full_name?.trim() ||
    (contact.organization_name?.includes('(')
      ? contact.organization_name.match(/\((.*?)\)/)?.[1]?.trim()
      : '');
  const brandFullName = (rawBrandFullName || 'Kashmir Jammu Chenab Pir Panjal Leh Network')
    .replace(/Kashmir Chenab Panjal Jammu Ladakh Network|Kashmir & Jammu Information Network|Kashmir Jammu Independent News/gi, 'Kashmir Jammu Chenab Pir Panjal Leh Network');

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

  // Dedicated contact email resolution (enforces h26412301@gmail.com over outdated domain presets)
  const resolveContactEmail = (email?: string | null) => {
    const val = (email || '').trim().toLowerCase();
    if (
      !val ||
      val === 'grievance@kjcpl.site' ||
      val === 'news@kjcpl.site' ||
      val === 'careers@kjcpl.site' ||
      val === 'grievance@kjin.org' ||
      val === 'news@kjin.org' ||
      val === 'careers@kjin.org' ||
      val.includes('@kjcpl.site')
    ) {
      return 'h26412301@gmail.com';
    }
    return email!.trim();
  };

  const editorialEmail = resolveContactEmail(contact.email_editorial);
  const careersEmail = resolveContactEmail(contact.email_careers);
  const pressEmail = resolveContactEmail(contact.email_press);
  const grievanceEmail = resolveContactEmail(contact.email_grievance);
  const grievanceOfficer = contact.grievance_officer_name && !contact.grievance_officer_name.toLowerCase().includes('hafiz')
    ? contact.grievance_officer_name
    : 'Adv. Bashir Ahmad (Public Grievance Redressal Officer)';
  const srinagarBureau = contact.bureau_address?.trim() || 'Press Enclave, Residency Road, Srinagar (J&K) 190001';
  const rawPhone = contact.phone_primary?.trim() || '';
  const primaryPhone = rawPhone && !rawPhone.includes('6005950197') ? rawPhone : '';

  if (variant === 'compact') {
    return (
      <footer className={`mt-10 sm:mt-14 ${footerBg} ${footerBorder} font-sans transition-colors duration-200`}>
        <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-3 sm:px-6 md:px-8 py-8 sm:py-10">
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
                {contact.show_editor_in_chief !== false && contact.editor_in_chief ? (
                  <>
                    <span className={textMuted}>•</span>
                    <span className={`font-semibold ${textSecondary}`}>
                      Editor-in-Chief: {contact.editor_in_chief}
                    </span>
                  </>
                ) : null}
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
                {contact.show_phone_numbers && primaryPhone ? (
                  <div>
                    <span className={`text-[10px] ${textMuted} block`}>
                      {contact.phone_primary_label || 'Editorial Newsdesk Hotlines'}:
                    </span>
                    <a
                      href={`tel:${primaryPhone.replace(/[^0-9+]/g, '')}`}
                      className={`font-mono text-[11px] font-bold ${accentText} hover:underline`}
                    >
                      {primaryPhone}
                    </a>
                  </div>
                ) : null}
                <div>
                  <span className={`text-[10px] ${textMuted} block`}>Editorial Newsdesk:</span>
                  <a
                    href={`mailto:${editorialEmail}`}
                    className={`font-mono text-[11px] ${textPrimary} hover:underline break-all`}
                  >
                    {editorialEmail}
                  </a>
                </div>
                <div>
                  <span className={`text-[10px] ${textMuted} block`}>Careers &amp; Resumes:</span>
                  <a
                    href={`mailto:${careersEmail}`}
                    className={`font-mono text-[11px] ${textPrimary} hover:underline break-all`}
                  >
                    {careersEmail}
                  </a>
                </div>
                <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] ${textMuted} block font-bold uppercase`}>Public Grievance Redressal:</span>
                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">IT Rules 2021</span>
                  </div>
                  <span className={`text-[10px] ${textSecondary} block font-medium`}>
                    {contact.grievance_officer_name || 'Adv. Bashir Ahmad (Public Grievance Redressal Officer)'}
                  </span>
                  <a
                    href={`mailto:${grievanceEmail}`}
                    className={`font-mono text-[11px] ${isDark ? 'text-amber-400' : 'text-amber-700'} hover:underline break-all block`}
                  >
                    {grievanceEmail}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated Website Development & Support Section */}
          {dev.footer_position !== 'subfooter' && (
            <DeveloperSupportSection
              dev={dev}
              isDark={isDark}
              cardBg={cardBg}
              cardBorder={cardBorder}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              textMuted={textMuted}
              accentText={accentText}
            />
          )}
        </div>

        {/* Sub-Footer Bar */}
        <div className={`border-t ${isDark ? 'border-slate-900 bg-black/60' : 'border-slate-300 bg-stone-200/40'} py-4 px-3 sm:px-6 md:px-8`}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-center sm:text-left">
            <div className={textMuted}>
              &copy; {new Date().getFullYear()} {brandName}{brandFullName ? ` (${brandFullName})` : ''}. All editorial rights reserved.
            </div>

            <SubfooterDeveloperSnippet
              dev={dev}
              isDark={isDark}
              textMuted={textMuted}
              textSecondary={textSecondary}
            />

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
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-3 sm:px-6 md:px-8 py-10 sm:py-14">
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
                {contact.show_editor_in_chief !== false && contact.editor_in_chief ? (
                  <div className={`text-[10px] ${textSecondary} font-semibold pt-1 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between`}>
                    <span>Editor-in-Chief:</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">{contact.editor_in_chief}</span>
                  </div>
                ) : null}
                <div className={`text-[10px] ${textSecondary} pt-1 border-t border-slate-200/50 dark:border-slate-800/50 space-y-0.5`}>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Grievance Officer:</span>
                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">IT Rules 2021</span>
                  </div>
                  <div className="font-medium text-stone-800 dark:text-stone-200">{grievanceOfficer}</div>
                  <a
                    href={`mailto:${grievanceEmail}`}
                    className={`font-mono text-[9.5px] ${isDark ? 'text-amber-400' : 'text-amber-700'} hover:underline block break-all`}
                  >
                    {grievanceEmail}
                  </a>
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
                  Jammu Administrative Bureau
                </span>
                <p className={`${textSecondary} mt-0.5 leading-relaxed break-words`}>
                  {contact.primary_address || 'Sidhra, Jammu Tawi (J&K) 180019'}
                </p>
              </div>

              <div>
                <span className={`font-bold ${textPrimary} block text-[11px]`}>
                  Srinagar Press Bureau
                </span>
                <p className={`${textSecondary} mt-0.5 leading-relaxed break-words`}>
                  {srinagarBureau}
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
              {primaryPhone ? (
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                    Editorial Newsdesk Hotlines
                  </span>
                  <a
                    href={`tel:${primaryPhone.replace(/[^0-9+]/g, '')}`}
                    className={`font-mono font-bold ${accentText} hover:underline`}
                  >
                    {primaryPhone}
                  </a>
                </div>
              ) : null}

              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                  Careers &amp; Resume Submissions
                </span>
                <a
                  href={`mailto:${careersEmail}`}
                  className={`font-mono font-bold ${accentText} hover:underline break-all`}
                >
                  {careersEmail}
                </a>
              </div>

              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                  Editorial Newsdesk
                </span>
                <a
                  href={`mailto:${editorialEmail}`}
                  className={`font-mono ${textPrimary} hover:underline break-all`}
                >
                  {editorialEmail}
                </a>
              </div>

              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                  Press Releases &amp; Dispatches
                </span>
                <a
                  href={`mailto:${pressEmail}`}
                  className={`font-mono ${textSecondary} hover:underline break-all`}
                >
                  {pressEmail}
                </a>
              </div>

              <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted} block`}>
                    Public Grievance Redressal
                  </span>
                  <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    IT Rules 2021
                  </span>
                </div>
                <span className={`text-[11px] ${textSecondary} block font-medium`}>
                  {grievanceOfficer}
                </span>
                <a
                  href={`mailto:${grievanceEmail}`}
                  className={`font-mono text-[11px] ${isDark ? 'text-amber-400' : 'text-amber-700'} hover:underline break-all block`}
                >
                  {grievanceEmail}
                </a>
                <span className={`text-[10px] ${textMuted} block pt-0.5`}>
                  Physical Office: {contact.primary_address || 'Sidhra, Jammu Tawi (J&K) 180019'}
                </span>
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

        {/* Dedicated Website Development & Support Section */}
        {dev.footer_position !== 'subfooter' && (
          <DeveloperSupportSection
            dev={dev}
            isDark={isDark}
            cardBg={cardBg}
            cardBorder={cardBorder}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            textMuted={textMuted}
            accentText={accentText}
          />
        )}
      </div>

      {/* 2. Sub-Footer Bar */}
      <div className={`border-t ${isDark ? 'border-slate-900 bg-black/60' : 'border-slate-300 bg-stone-200/40'} py-6 px-3 sm:px-6 md:px-8`}>
        <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-center sm:text-left">
          <div className={textMuted}>
            &copy; {new Date().getFullYear()} {brandName}{brandFullName ? ` (${brandFullName})` : ''}. All editorial rights reserved.
          </div>

          <SubfooterDeveloperSnippet
            dev={dev}
            isDark={isDark}
            textMuted={textMuted}
            textSecondary={textSecondary}
          />

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

function DeveloperSupportSection({
  dev,
  isDark,
  cardBg,
  cardBorder,
  textPrimary,
  textSecondary,
  textMuted,
  accentText,
}: {
  dev: DeveloperSupportSettings;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentText: string;
}) {
  if (!dev.show_developer_section) return null;

  const mobileVisibilityClass = dev.show_on_mobile ? 'block' : 'hidden md:block';
  const hasMail = dev.show_mail_us && Boolean(dev.support_email?.trim());
  const hasPhone = dev.show_call_us && Boolean(dev.support_phone?.trim()) && !dev.support_phone.includes('6005950197');
  const hasSupportContacts = hasMail || hasPhone;

  return (
    <div
      className={`${mobileVisibilityClass} mt-8 pt-6 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200/80'}`}
      data-purpose="developer-technical-support"
    >
      <div className={`p-4 sm:p-5 rounded-2xl border ${cardBorder} ${cardBg} shadow-xs`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          {/* Left Column: Website Development & Support Attribution */}
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${accentText} flex items-center gap-1.5`}>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                Website Development &amp; Support
              </span>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${isDark ? 'bg-slate-800/60 text-slate-400 border-slate-700' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                Platform Infrastructure
              </span>
            </div>

            <div className="text-xs">
              <span className={`text-[10px] uppercase tracking-wider ${textMuted} font-semibold block`}>
                Developed &amp; Maintained By
              </span>
              {dev.developer_website ? (
                <a
                  href={dev.developer_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm font-bold ${textPrimary} hover:${accentText} hover:underline inline-flex items-center gap-1 transition`}
                >
                  <span>{dev.developer_name}</span>
                  <span className="text-xs text-slate-400">↗</span>
                </a>
              ) : (
                <span className={`text-sm font-bold ${textPrimary}`}>
                  {dev.developer_name}
                </span>
              )}
            </div>

            {dev.developer_description ? (
              <p className={`text-[11px] ${textSecondary} leading-relaxed`}>
                {dev.developer_description}
              </p>
            ) : null}
          </div>

          {/* Right Column: Technical Support Actions */}
          {hasSupportContacts ? (
            <div className={`flex flex-col sm:flex-row sm:items-center gap-4 pt-3 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="space-y-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${accentText} block`}>
                  Technical Support
                </span>
                <span className={`text-[11px] ${textSecondary} block`}>
                  Platform Infrastructure &amp; Technical Queries
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {hasMail ? (
                  <div className="space-y-1">
                    <span className={`text-[9.5px] font-semibold uppercase tracking-wider ${textMuted} block`}>
                      Email Support
                    </span>
                    <a
                      href={`mailto:${dev.support_email}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                        isDark
                          ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20'
                          : 'bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100'
                      }`}
                      title={`Email Technical Support at ${dev.support_email}`}
                    >
                      <span>✉</span>
                      <span>Mail Us</span>
                    </a>
                  </div>
                ) : null}

                {hasPhone ? (
                  <div className="space-y-1">
                    <span className={`text-[9.5px] font-semibold uppercase tracking-wider ${textMuted} block`}>
                      Telephone Support
                    </span>
                    <a
                      href={`tel:${dev.support_phone.replace(/[^0-9+]/g, '')}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                        isDark
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                      title={`Call Technical Support at ${dev.support_phone}`}
                    >
                      <span>📞</span>
                      <span>Call Us</span>
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SubfooterDeveloperSnippet({
  dev,
  isDark,
  textMuted,
  textSecondary,
}: {
  dev: DeveloperSupportSettings;
  isDark: boolean;
  textMuted: string;
  textSecondary: string;
}) {
  if (!dev.show_developer_section || dev.footer_position !== 'subfooter') return null;
  const mobileVisibilityClass = dev.show_on_mobile ? 'block' : 'hidden md:block';
  const hasMail = dev.show_mail_us && Boolean(dev.support_email?.trim());
  const hasPhone = dev.show_call_us && Boolean(dev.support_phone?.trim()) && !dev.support_phone.includes('6005950197');

  return (
    <div className={`${mobileVisibilityClass} text-[11px] ${textMuted} flex items-center gap-2 mt-2 sm:mt-0`}>
      <span>Developed by {dev.developer_name}</span>
      {(hasMail || hasPhone) && <span>•</span>}
      {hasMail && (
        <a href={`mailto:${dev.support_email}`} className={`${textSecondary} hover:underline font-semibold`}>
          Mail Support
        </a>
      )}
      {hasMail && hasPhone && <span>•</span>}
      {hasPhone && (
        <a href={`tel:${dev.support_phone.replace(/[^0-9+]/g, '')}`} className={`${textSecondary} hover:underline font-semibold`}>
          Call Support
        </a>
      )}
    </div>
  );
}
