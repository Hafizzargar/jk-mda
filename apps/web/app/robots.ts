import { MetadataRoute } from 'next';

const BASE_URL = 'https://kjin.news';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
