/**
 * Application-wide configuration and canonical URL management
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  'https://kjin.in'
).replace(/\/$/, '');

export const SITE_NAME = 'KJCPL News Network';
export const SITE_SHORT_NAME = 'KJCPL';
export const DEFAULT_LOCALE = 'en_IN';
