/**
 * Application-wide configuration and canonical URL management
 */
function getCanonicalSiteUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://www.kjcpl.site';
    }
    return 'http://localhost:3000';
  }

  if (process.env.NODE_ENV === 'development') {
    const rawDev = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (rawDev && rawDev.includes('localhost')) {
      return rawDev.replace(/\/$/, '');
    }
    return 'http://localhost:3000';
  }

  return 'https://www.kjcpl.site';
}

export const SITE_URL = getCanonicalSiteUrl();

export const SITE_NAME = 'KJCPL News Network';
export const SITE_SHORT_NAME = 'KJCPL';
export const DEFAULT_LOCALE = 'en_IN';
