/**
 * Canonical Site URL configuration for Admin
 */
function getCanonicalSiteUrl(): string {
  // If running in browser on a production domain (Vercel or custom domain), always route to live site
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
