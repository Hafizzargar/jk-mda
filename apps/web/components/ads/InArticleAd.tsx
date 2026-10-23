import Image from 'next/image';
import { type CustomAdPlacement, getThemeStyles } from '@/lib/ads';

interface InArticleAdProps {
  ad: CustomAdPlacement;
}

export function InArticleAd({ ad }: InArticleAdProps) {
  if (!ad.enabled) return null;
  const styles = getThemeStyles(ad.theme_accent);

  return (
    <aside
      aria-label="Sponsored Content"
      className={`my-8 p-5 rounded-2xl border ${styles.borderColor} ${styles.cardBg} ${styles.glow} ${styles.borderAccent} group transition-all duration-300`}
    >
      <div className="flex flex-col sm:flex-row items-center gap-5">
        {ad.image_url && (
          <div className="relative w-full sm:w-36 h-28 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-inner">
            <Image
              src={ad.image_url}
              alt={ad.title}
              fill
              sizes="(max-width: 640px) 100vw, 150px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles.badgeBg}`}>
              {ad.badge_label || 'Sponsored Dispatch'}
            </span>
            <span className={`text-xs font-semibold ${styles.sponsorText}`}>
              Presented by {ad.sponsor_name}
            </span>
          </div>

          <h4 className={`text-base font-bold text-white leading-snug mb-1.5 ${styles.titleHover} transition`}>
            {ad.title}
          </h4>

          {ad.description && (
            <p className="text-xs text-slate-300 mb-3 line-clamp-2 leading-relaxed">
              {ad.description}
            </p>
          )}

          <a
            href={ad.destination_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`inline-block px-5 py-2 rounded-lg text-xs uppercase tracking-wider ${styles.ctaButton}`}
          >
            {ad.cta_text || 'Learn More'} &rarr;
          </a>
        </div>
      </div>
    </aside>
  );
}
