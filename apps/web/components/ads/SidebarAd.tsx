import Image from 'next/image';
import { type CustomAdPlacement, getThemeStyles } from '@/lib/ads';

interface SidebarAdProps {
  ad: CustomAdPlacement;
}

export function SidebarAd({ ad }: SidebarAdProps) {
  if (!ad.enabled) return null;
  const styles = getThemeStyles(ad.theme_accent);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-slate-950 ${styles.borderColor} ${styles.cardBg} ${styles.glow} p-5 transition-all duration-300 group shadow-xl`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles.badgeBg}`}>
          {ad.badge_label || 'Sponsored'}
        </span>
        <span className={`text-[11px] font-semibold truncate ${styles.sponsorText}`}>
          {ad.sponsor_name}
        </span>
      </div>

      {ad.image_url && (
        <div className="relative w-full h-40 rounded-xl overflow-hidden mb-3.5 border border-white/10 shadow-inner">
          <Image
            src={ad.image_url}
            alt={ad.title}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized={true}
          />
        </div>
      )}

      <h4 className={`text-base font-bold text-white leading-tight mb-2 ${styles.titleHover} transition`}>
        {ad.title}
      </h4>

      {ad.description && (
        <p className="text-xs text-slate-300 mb-4 line-clamp-3 leading-relaxed">
          {ad.description}
        </p>
      )}

      <a
        href={ad.destination_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`block text-center w-full px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 transform group-hover:scale-[1.02] ${styles.ctaButton}`}
      >
        {ad.cta_text || 'Visit Sponsor'} &rarr;
      </a>
    </div>
  );
}
