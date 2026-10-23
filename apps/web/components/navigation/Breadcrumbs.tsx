import Link from 'next/link';
import { type TemplateTheme } from '@/lib/templates';
import { safeJsonLd } from '@/lib/sanitize';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  lang?: string;
  theme?: TemplateTheme;
  className?: string;
}

export function Breadcrumbs({
  items,
  lang = 'en',
  theme,
  className = '',
}: BreadcrumbsProps) {
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const allItems: BreadcrumbItem[] = [
    { label: 'Home', href: `${langPrefix}/` },
    ...items,
  ];

  // Schema.org BreadcrumbList JSON-LD
  const schemaBreadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: allItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: item.href ? (item.href.startsWith('http') ? item.href : `https://kjin.org${item.href}`) : undefined,
    })),
  };

  const isDark = theme?.isDark;
  const textColor = isDark ? 'text-slate-400' : 'text-slate-500';
  const hoverColor = isDark ? 'hover:text-cyan-300' : 'hover:text-blue-700';
  const currentColor = isDark ? 'text-slate-200' : 'text-slate-900';
  const dividerColor = isDark ? 'text-slate-600' : 'text-slate-400';
  const bgBadge = isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200/80';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(schemaBreadcrumbs) }}
      />
      <nav
        aria-label="Breadcrumb"
        className={`w-full py-2.5 px-4 rounded-xl border ${bgBadge} text-xs ${className}`}
      >
        <ol className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          {allItems.map((item, idx) => {
            const isLast = idx === allItems.length - 1;
            return (
              <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5 sm:gap-2">
                {idx === 0 && (
                  <span className="text-sm opacity-70" aria-hidden="true">
                    🏠
                  </span>
                )}
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className={`font-medium transition-colors ${textColor} ${hoverColor}`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={`font-semibold truncate max-w-[200px] sm:max-w-md ${currentColor}`}
                    aria-current={isLast ? 'page' : undefined}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                )}

                {!isLast && (
                  <span className={`select-none ${dividerColor}`} aria-hidden="true">
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
