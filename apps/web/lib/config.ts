/**
 * Application-wide configuration and canonical URL management
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  'https://kjin.in'
).replace(/\/$/, '');

export const SITE_NAME = 'Kashmir Jammu Information Network';
export const SITE_SHORT_NAME = 'KJIN';
export const DEFAULT_LOCALE = 'en_IN';
