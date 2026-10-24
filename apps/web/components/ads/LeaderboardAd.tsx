import Image from 'next/image';
import { type CustomAdPlacement, getThemeStyles } from '@/lib/ads';

interface LeaderboardAdProps {
  ad: CustomAdPlacement;
}

export function LeaderboardAd({ ad }: LeaderboardAdProps) {
  if (!ad.enabled) return null;
  const styles = getThemeStyles(ad.theme_accent);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${styles.borderColor} ${styles.cardBg} ${styles.glow} p-4 sm:p-6 transition-all duration-300 group`}
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Media + Info */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left flex-1 min-w-0">
          {ad.image_url && (
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-inner">
              <Image
                src={ad.image_url}
                alt={ad.title}
                fill
                sizes="120px"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                unoptimized={true}
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${styles.badgeBg}`}>
                {ad.badge_label || 'Sponsored'}
              </span>
              <span className={`text-xs font-semibold ${styles.sponsorText}`}>
                {ad.sponsor_name}
              </span>
            </div>

            <h4 className={`text-base sm:text-lg font-bold text-white leading-snug line-clamp-1 sm:line-clamp-2 ${styles.titleHover} transition`}>
              {ad.title}
            </h4>

            {ad.description && (
              <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                {ad.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: CTA Button */}
        <div className="shrink-0 w-full sm:w-auto">
          <a
            href={ad.destination_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`block sm:inline-block text-center w-full px-6 py-3 rounded-xl text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 transform group-hover:scale-[1.02] ${styles.ctaButton}`}
          >
            {ad.cta_text || 'Learn More'} &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
