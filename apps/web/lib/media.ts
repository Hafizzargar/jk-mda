/**
 * Optimizes remote CDN image URLs for fast web delivery and optimal LCP.
 * For Unsplash images: forces WebP, sets responsive width, and adjusts quality to 72%.
 * For Google User Content: adds dynamic width resize parameters.
 */
export function getOptimizedMediaUrl(url?: string | null, targetWidth = 720): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    // 1. Unsplash: optimize width, WebP format, and compression
    if (trimmed.includes('images.unsplash.com')) {
      const u = new URL(trimmed);
      u.searchParams.set('w', String(targetWidth));
      u.searchParams.set('q', '72');
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fm', 'webp');
      u.searchParams.set('fit', 'crop');
      return u.toString();
    }

    // 2. Google User Content: add dynamic width if not specified
    if (trimmed.includes('googleusercontent.com') && !trimmed.includes('=w')) {
      return `${trimmed}=w${targetWidth}-rw`;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}
