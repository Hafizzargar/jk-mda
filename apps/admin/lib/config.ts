/**
 * Canonical Site URL configuration for Admin
 * All "View on Website", "Live Article URL", and "Live Site" links
 * must point to the public news publication website.
 */
function getCanonicalSiteUrl(): string {
  // If running in browser on a production domain (Vercel or custom domain), always route to live site
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://www.kjcpl.site';
    }
    return 'http://localhost:3000';
  }

  // During SSR or Node runtime:
  if (process.env.NODE_ENV === 'development') {
    const rawDev = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (rawDev && rawDev.includes('localhost')) {
      return rawDev.replace(/\/$/, '');
    }
    return 'http://localhost:3000';
  }

  // Under all production/staging/Vercel deployments, ALWAYS link to the canonical public website
  return 'https://www.kjcpl.site';
}

export const SITE_URL = getCanonicalSiteUrl();
