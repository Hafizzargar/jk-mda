/**
 * Application-wide configuration and canonical URL management
 */
function getCanonicalSiteUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://www.kjcpl.site';
    }
  }

  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (process.env.NODE_ENV === 'production' && (!raw || raw.includes('localhost'))) {
    return 'https://www.kjcpl.site';
  }

  return (raw || 'https://www.kjcpl.site').replace(/\/$/, '');
}

export const SITE_URL = getCanonicalSiteUrl();

export const SITE_NAME = 'KJCPL News Network';
export const SITE_SHORT_NAME = 'KJCPL';
export const DEFAULT_LOCALE = 'en_IN';
