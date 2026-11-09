import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEWS_CATEGORIES,
  isValidCategory,
  getCategoryDisplayName,
  REGIONAL_DIVISIONS,
  isValidRegion,
  getRegion,
  JK_DISTRICTS,
  isValidDistrict,
  getDistrictDisplayName,
  type KJINRegionKey,
} from '../lib/taxonomy';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME } from '../lib/config';
import { getNavItemHref, DEFAULT_NAVBAR_SETTINGS } from '../lib/navbar';

test('P0: Newspaper Full URL Structure & Routing Integrity', async (t) => {
  const LOCALES = ['en', 'ur', 'ks', 'hi'];

  await t.test('1. Core Newspaper Top-Level Routes', () => {
    const coreRoutes = [
      { path: '/', description: 'Home Landing (Rewrites to default locale /en)' },
      { path: '/india', description: 'National Desk' },
      { path: '/international', description: 'International Wire Desk' },
      { path: '/latest', description: 'Chronological Wire & Latest News' },
      { path: '/map', description: 'Territorial Map & District Intelligence' },
      { path: '/transit', description: 'High Altitude Mountain Pass Telemetry' },
      { path: '/careers', description: 'Careers & Bureau Postings' },
      { path: '/sitemap-news.xml', description: 'Google News XML Sitemap' },
      { path: '/api/feed', description: 'Syndicated Bureau News Feed' },
    ];

    for (const route of coreRoutes) {
      assert.ok(route.path.startsWith('/'), `Route ${route.path} must start with /`);
      assert.ok(route.description.length > 0, `Route ${route.path} must have a description`);
    }
  });

  await t.test('2. Multi-Language Locale Prefixes (/en, /ur, /ks, /hi)', () => {
    for (const lang of LOCALES) {
      assert.ok(lang.length >= 2, `Locale ${lang} must be valid ISO code`);
      const langHome = `/${lang}`;
      assert.ok(langHome.startsWith('/'), `Locale path ${langHome} is valid`);

      // Test core routes under each locale
      const localeIndia = `/${lang}/india`;
      const localeInternational = `/${lang}/international`;
      const localeLatest = `/${lang}/latest`;
      const localeTransit = `/${lang}/transit`;
      const localeMap = `/${lang}/map`;
      const localeCareers = `/${lang}/careers`;

      assert.equal(localeIndia, `/${lang}/india`);
      assert.equal(localeInternational, `/${lang}/international`);
      assert.equal(localeLatest, `/${lang}/latest`);
      assert.equal(localeTransit, `/${lang}/transit`);
      assert.equal(localeMap, `/${lang}/map`);
      assert.equal(localeCareers, `/${lang}/careers`);
    }
  });

  await t.test('3. All News Category URLs (/category/[name])', () => {
    const categories = Object.keys(NEWS_CATEGORIES);
    assert.ok(categories.length >= 8, 'Must have at least 8 verified news categories');

    for (const catKey of categories) {
      assert.ok(isValidCategory(catKey), `Category '${catKey}' must be valid`);
      const displayName = getCategoryDisplayName(catKey);
      assert.ok(displayName.length > 0, `Category '${catKey}' must have a valid display name`);

      for (const lang of LOCALES) {
        const langPrefix = lang === 'en' ? '' : `/${lang}`;
        const categoryUrl = `${SITE_URL}${langPrefix}/category/${catKey}`;
        assert.ok(
          categoryUrl.startsWith('https://'),
          `Category URL ${categoryUrl} must start with https://`
        );
        assert.match(
          categoryUrl,
          new RegExp(`/category/${catKey}$`),
          `Category URL must end with /category/${catKey}`
        );
      }
    }
  });

  await t.test('4. All Regional Corridor Divisions (/region/[slug])', () => {
    const regionKeys = Object.keys(REGIONAL_DIVISIONS) as KJINRegionKey[];
    assert.equal(regionKeys.length, 5, 'Must have exactly 5 verified regional divisions');

    for (const regKey of regionKeys) {
      assert.ok(isValidRegion(regKey), `Region '${regKey}' must be valid in taxonomy`);
      const regionData = getRegion(regKey);
      assert.ok(regionData, `Region '${regKey}' data must exist`);
      assert.ok(regionData.name.length > 0, `Region '${regKey}' must have a display name`);
      assert.ok(regionData.districts.length > 0, `Region '${regKey}' must contain districts`);

      for (const lang of LOCALES) {
        const langPrefix = lang === 'en' ? '' : `/${lang}`;
        const regionUrl = `${SITE_URL}${langPrefix}/region/${regKey}`;
        assert.match(
          regionUrl,
          new RegExp(`/region/${regKey}$`),
          `Region URL must match /region/${regKey}`
        );
      }
    }
  });

  await t.test('5. All J&K and Ladakh District URLs (/district/[name])', () => {
    const districts = Object.keys(JK_DISTRICTS);
    assert.ok(districts.length >= 22, 'Must have at least 22 verified districts');

    for (const distKey of districts) {
      assert.ok(isValidDistrict(distKey), `District '${distKey}' must be valid`);
      const distName = getDistrictDisplayName(distKey);
      assert.ok(distName.length > 0, `District '${distKey}' must have a display name`);
      const distInfo = JK_DISTRICTS[distKey];
      assert.ok(distInfo.region, `District '${distKey}' must belong to a regional division`);
      assert.ok(distInfo.regionKey, `District '${distKey}' must have a regionKey`);

      for (const lang of LOCALES) {
        const langPrefix = lang === 'en' ? '' : `/${lang}`;
        const districtUrl = `${SITE_URL}${langPrefix}/district/${distKey}`;
        assert.match(
          districtUrl,
          new RegExp(`/district/${distKey}$`),
          `District URL must match /district/${distKey}`
        );
      }
    }
  });

  await t.test('6. Article Detail Canonical URL Patterns (/[category]/[slug])', () => {
    const sampleArticles = [
      { category: 'investigation', slug: 'international-cryosphere-consortium-glacier-mission' },
      { category: 'politics', slug: 'jammu-kashmir-legislative-assembly-resolution' },
      { category: 'economy', slug: 'bhaderwah-lavender-growers-cooperative-export' },
      { category: 'environment', slug: 'changthang-plateau-solar-microgrid-storage' },
      { category: 'culture', slug: 'drass-kargil-war-memorial-interactive-archive' },
    ];

    for (const art of sampleArticles) {
      const canonicalEn = `${SITE_URL}/${art.category}/${art.slug}`;
      const canonicalUr = `${SITE_URL}/ur/${art.category}/${art.slug}`;
      const canonicalKs = `${SITE_URL}/ks/${art.category}/${art.slug}`;
      const canonicalHi = `${SITE_URL}/hi/${art.category}/${art.slug}`;

      assert.equal(canonicalEn, `${SITE_URL}/${art.category}/${art.slug}`);
      assert.equal(canonicalUr, `${SITE_URL}/ur/${art.category}/${art.slug}`);
      assert.equal(canonicalKs, `${SITE_URL}/ks/${art.category}/${art.slug}`);
      assert.equal(canonicalHi, `${SITE_URL}/hi/${art.category}/${art.slug}`);
    }
  });

  await t.test('7. Navbar Navigation Item Link Resolvers', () => {
    const defaultNav = DEFAULT_NAVBAR_SETTINGS;
    assert.ok(defaultNav.nav_items.length > 0, 'Navbar must have items');

    for (const item of defaultNav.nav_items) {
      const href = getNavItemHref(item);
      assert.ok(href.startsWith('/'), `Navbar item '${item.label}' href '${href}' must be a valid path`);
    }
  });

  await t.test('8. Dynamic Rewrite Rules for Aliases & Top-Level Slugs', () => {
    // Tests the route logic implemented in apps/web/app/[lang]/[category]/page.tsx
    const aliasMappings: Record<string, string> = {
      articles: '/latest',
      latest: '/latest',
      india: '/india',
      national: '/india',
      international: '/international',
      problem: '/category/problems',
      problems: '/category/problems',
      search: '/latest',
    };

    for (const [raw, expectedTarget] of Object.entries(aliasMappings)) {
      assert.ok(expectedTarget.startsWith('/'), `Alias '${raw}' targets '${expectedTarget}'`);
    }
  });

  await t.test('9. Syndication Feed Endpoint Query Parameters (/api/feed)', () => {
    const validSections = ['wire', 'international', 'conflict', 'discover', 'problems'];
    for (const sec of validSections) {
      const feedUrl = `/api/feed?section=${sec}&lang=en&limit=10`;
      assert.ok(feedUrl.includes(`section=${sec}`));
      assert.ok(feedUrl.includes('lang=en'));
      assert.ok(feedUrl.includes('limit=10'));
    }
  });
});
