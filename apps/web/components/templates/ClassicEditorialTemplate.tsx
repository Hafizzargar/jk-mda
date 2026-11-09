import Link from 'next/link';
import Image from 'next/image';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { PaginationControls } from '@/components/navigation/PaginationControls';
import { LeaderboardAd } from '@/components/ads/LeaderboardAd';
import { SidebarAd } from '@/components/ads/SidebarAd';
import { DEFAULT_ADS_SETTINGS, type CustomAdPlacement, type AdSlotType } from '@/lib/ads';
import { DEFAULT_HOMEPAGE_LAYOUT, type HomepageSectionId } from '@/lib/homepage-layout';
import { TemplateProps } from './types';
import { getDistrictDisplayName } from '@/lib/taxonomy';
import { DEFAULT_TELEMETRY_SETTINGS } from '@/lib/telemetry';
import { formatArticleDate } from '@/lib/date';
import { getOptimizedMediaUrl } from '@/lib/media';
import { FALLBACK_BROADSHEET_ARTICLES } from '@/lib/seed-articles';

export function ClassicEditorialTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
  allArticles,
  theme,
  contactSettings,
  paginationMeta,
  adsSettings,
  navbarSettings,
  telemetry,
  curation,
  weather,
  dossierArticles: propDossierArticles,
  editorialArticle: propEditorialArticle,
  subArticles: propSubArticles,
  wireArticles: propWireArticles,
  streamArticles: propStreamArticles,
  conflictNews: propConflictNews,
  discoverNews: propDiscoverNews,
  problemArticle,
  internationalArticle,
  internationalArticles,
  editorialDeskSettings,
  layoutConfig,
  scope,
}: TemplateProps) {
  const activeTelemetry = telemetry || DEFAULT_TELEMETRY_SETTINGS;
  const lang = langPrefix ? langPrefix.replace('/', '') : 'en';
  const brandName = navbarSettings?.brand?.name || 'KCPJLN';

  const isNational = scope?.type === 'national';
  const isInternational = scope?.type === 'international';
  const isRegion = scope?.type === 'region';
  const hasScopeBanner = Boolean(scope && scope.type !== 'home');

  const getCatSlug = (cat?: string | null) => (cat || 'news').toLowerCase().replace(/\s+/g, '-');
  const getArtHref = (art?: { category?: string | null; slug?: string | null } | null) => {
    if (!art?.slug) return langPrefix || '/';
    return `${langPrefix}/${getCatSlug(art.category)}/${art.slug}`;
  };

  const isMonetizationActive = adsSettings?.monetization_enabled === true;
  const adPool = Array.isArray(adsSettings?.placements) ? adsSettings.placements : [];

  const findAdForSlot = (targetSlot: AdSlotType, fallbackSlot?: AdSlotType): CustomAdPlacement | null => {
    // If monetization is disabled/paused by admin, NEVER display any ads
    if (!isMonetizationActive) return null;

    // 1. Priority: custom active ad matching targetSlot
    const directMatch = adPool.find(
      (p) => (p.slot === targetSlot || p.id === targetSlot || p.id.includes(targetSlot)) && p.enabled
    );
    if (directMatch) return directMatch;

    // 2. Fallback slot match from active ad pool
    if (fallbackSlot) {
      const fallbackMatch = adPool.find(
        (p) => (p.slot === fallbackSlot || p.id === fallbackSlot || p.id.includes(fallbackSlot)) && p.enabled
      );
      if (fallbackMatch) return fallbackMatch;
    }

    // Do NOT resurrect deleted ads — if a slot was deleted, return null so no ad is rendered
    return null;
  };

  const leaderboardAd = findAdForSlot('leaderboard_top');
  const leaderboardFeedAd = findAdForSlot('leaderboard_feed');
  const leftRailAd = findAdForSlot('left_rail_sponsor');
  const sidebarAd = findAdForSlot('sidebar_banner');

  // Curated vs Fallback story splitting for broadsheet columns
  const subArticles = propSubArticles && propSubArticles.length > 0 ? propSubArticles : recentArticles.slice(0, 2);
  const wireArticles = propWireArticles && propWireArticles.length > 0 ? propWireArticles : recentArticles.slice(2, 7);
  const streamArticles = propStreamArticles && propStreamArticles.length > 0 ? propStreamArticles : recentArticles.slice(2);
  const dossierArticles = propDossierArticles && propDossierArticles.length > 0 ? propDossierArticles : recentArticles.slice(7, 13);
  const conflictNews = propConflictNews || [];
  const discoverNews = propDiscoverNews || [];
  const editorialArticle = propEditorialArticle || null;

  // Scoped Developing Alert Text
  const isCurationActive = Boolean(curation?.developing_is_active && curation?.developing_headline?.trim());
  const curationHeadline = isCurationActive ? curation?.developing_headline?.trim() : null;

  const isWireAuto = activeTelemetry.live_wire?.mode === 'auto';
  const autoHeadline = heroArticle?.title || recentArticles[0]?.title;

  const developingHeadline = isNational
    ? (heroArticle?.title || 'Union Parliament advances legislative agenda on inter-state fiscal relations; Supreme Court constitution bench reviews landmark petitions.')
    : isInternational
    ? (heroArticle?.title || 'United Nations General Assembly adopts multilateral resolution on regional conflict resolution and humanitarian security.')
    : isRegion
    ? (heroArticle?.title || activeTelemetry.live_wire?.headline || `Grassroots field dispatches and regional coverage from ${scope?.title}.`)
    : (curationHeadline || (isWireAuto && autoHeadline ? autoHeadline : (activeTelemetry.live_wire?.headline?.trim() || autoHeadline || 'Chenab Valley railway link completes final sub-zero winter trials; commercial timetable issued for Sangaldan-Reasi sector.')));

  const developingBadge = isNational
    ? 'NATIONAL WIRE'
    : isInternational
    ? 'GLOBAL WIRE'
    : isRegion
    ? `${(scope?.title || 'CORRIDOR').toUpperCase()} WIRE`
    : (activeTelemetry.live_wire?.badge?.trim() || 'DEVELOPING');

  const showDevelopingRibbon = isNational || isInternational || isRegion || (curation?.developing_is_active ?? (activeTelemetry.live_wire?.is_active !== false));

  const wireColumnTitle = isNational
    ? 'All-India National Wire'
    : isInternational
    ? 'Global Diplomatic Wire'
    : isRegion
    ? `${scope?.title} Regional Wire`
    : 'Bureau Wire';

  const wireColumnDesc = isNational
    ? 'Chronological dispatches filed from New Delhi and Union state desks.'
    : isInternational
    ? 'Vetted foreign reports and international diplomatic dispatches.'
    : isRegion
    ? `Chronological grassroots dispatches filed from resident correspondents across ${scope?.title}.`
    : 'Chronological field dispatches vetted by resident correspondents.';

  const takeawaysTitle = isNational
    ? 'KEY ANALYTICAL TAKEAWAYS — NATIONAL POLICY & UNION DESK'
    : isInternational
    ? 'KEY ANALYTICAL TAKEAWAYS — INTERNATIONAL & DIPLOMATIC DESK'
    : isRegion
    ? `KEY ANALYTICAL TAKEAWAYS — ${(scope?.title || 'REGIONAL').toUpperCase()} BUREAU`
    : 'KEY ANALYTICAL TAKEAWAYS — BUREAU ECONOMIC DESK';

  const defaultTakeaways = isNational
    ? [
        'Union fiscal policy emphasizes inter-state infrastructure corridors and digital public goods.',
        'Supreme Court jurisprudence upholds constitutional safeguards on federal administrative autonomy.',
        'Macroeconomic indicators project resilient manufacturing and domestic agricultural demand.',
      ]
    : isInternational
    ? [
        'Multilateral accords focus on global supply chain diversification and climate transition finance.',
        'Diplomatic delegations prioritize bilateral security dialogues and multilateral trade frameworks.',
        'International tribunals reinforce maritime navigation rights and treaty compliance protocols.',
      ]
    : isRegion
    ? [
        `Resident correspondents report sustained civic, infrastructure, and agricultural progress across ${scope?.title}.`,
        'District administrative councils coordinate on regional connectivity, weather contingencies, and public services.',
        'Grassroots field reporting highlights ongoing community developments and cultural initiatives.',
      ]
    : [
        '€4.2M allocated towards high-resolution hyperspectral scanning of Sharda, Dogra, and Persian scripts.',
        'Establishment of twin digital archive locales in Graz and Srinagar to safeguard provenance records.',
        'Direct scholarship endowments created for doctoral linguistics research at Jammu and Kashmir universities.',
      ];

  const takeaways = (curation?.takeaways && curation.takeaways.length > 0 && !isNational && !isInternational && !isRegion)
    ? curation.takeaways
    : defaultTakeaways;

  const dossiersTitle = isNational
    ? 'National Feature Dossiers & Union In-Depth'
    : isInternational
    ? 'Global Feature Dossiers & Geopolitical Analyses'
    : isRegion
    ? `${scope?.title} Feature Dossiers`
    : 'Corridor Feature Dossiers';

  const bureauStation = isNational
    ? {
        node: '00-NDX ACTIVE',
        name: 'NEW DELHI CENTRAL DESK',
        coords: '28.6139° N, 77.2090° E • Raisina Hill / Parliament St',
        uplink: 'Union Feed: 28 States & UTs Synchronized',
        desc: 'National capital editorial bureau coordinating state correspondents, union ministries, and supreme court press galleries.',
      }
    : isInternational
    ? {
        node: 'GL-INT ACTIVE',
        name: 'FOREIGN AFFAIRS DESK',
        coords: 'Global Wire Uplink • Geneva / NY / London Wires',
        uplink: 'Global Agency Feeds: Synchronized',
        desc: 'International newsdesk tracking multilateral diplomacy, global summits, bilateral accords, and foreign ministry dispatches.',
      }
    : scope?.regionSlug === 'chenab-valley'
    ? {
        node: '03-DOD ACTIVE',
        name: 'DODA & KISHTWAR STATION',
        coords: '33.1415° N, 75.7681° E • Chenab Gorge • Elev 1,638m',
        uplink: 'Hydro Corridor Uplink: OK',
        desc: 'Chenab basin telemetry tracking river discharge, hydro generation, and mountain pass clearances across Doda, Kishtwar & Ramban.',
      }
    : scope?.regionSlug === 'pir-panjal'
    ? {
        node: '04-PIR ACTIVE',
        name: 'POONCH & RAJOURI STATION',
        coords: '33.7711° N, 74.0934° E • Mughal Corridor • Elev 1,021m',
        uplink: 'Pass Highway Radar: OK',
        desc: 'Highland border basin telemetry monitoring Peer Ki Gali transit, trade routes, and community field dispatches.',
      }
    : scope?.regionSlug === 'jammu'
    ? {
        node: '02-JMU ACTIVE',
        name: 'JAMMU TAWI OBSERVATORY',
        coords: '32.7266° N, 74.8570° E • Shivalik Foothills • Elev 327m',
        uplink: 'Rail & Highway Link: OK',
        desc: 'Commercial trade hub and transportation crossroads connecting the Shivalik belt with mainland commercial corridors.',
      }
    : scope?.regionSlug === 'leh'
    ? {
        node: '05-LEH ACTIVE',
        name: 'LEH PLATEAU STATION',
        coords: '34.1526° N, 77.5771° E • Trans-Himalaya • Elev 3,524m',
        uplink: 'High-Altitude Sensor: OK',
        desc: 'High-altitude ecological, meteorological, and trans-Himalayan trade telemetry covering Leh and Kargil high passes.',
      }
    : {
        node: '01-SRX ACTIVE',
        name: 'SRINAGAR CENTRAL STATION',
        coords: '34.0837° N, 74.7973° E • Elev 1,585m',
        uplink: 'Uplink: Synchronized',
        desc: 'Real-time bureau telemetry across 5 regional operational hubs linking valley, chenab gorges, and ladakh plateau.',
      };

  const isHomePage = !scope || scope.type === 'home';
  const footerVariant: 'full' | 'compact' = isHomePage ? 'full' : 'compact';

  return (
    <div className="bg-newsprint min-h-screen text-[#0F172A] selection:bg-amber-100 selection:text-amber-900 font-serif flex flex-col justify-between w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full overflow-x-hidden">
        {/* Global Navigation Bar */}
        <SiteNavbar
          lang={lang}
          theme={theme}
          navbarSettings={navbarSettings}
          activeRegion={scope?.regionSlug}
          activeCategory={scope?.activeCategory}
        />

        {/* Heraldic Masthead Scope Banner */}
        {hasScopeBanner && (
          <section className="w-full bg-[#FAF8F5] border-b border-stone-300/80 py-4 px-3 sm:px-6 md:px-8 font-sans">
            <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isNational
                        ? 'bg-red-700 text-white'
                        : isInternational
                        ? 'bg-blue-800 text-white'
                        : 'bg-stone-900 text-amber-400'
                    }`}
                  >
                    {scope?.eyebrow || (isNational ? 'COUNTRY WIRE • INDIA' : isInternational ? 'GLOBAL WIRE • WORLD' : `${brandName} REGIONAL BUREAU`)}
                  </span>
                  <span className="text-[11px] font-mono text-stone-500">
                    {isNational
                      ? '• UNION & CONSTITUTIONAL DESK'
                      : isInternational
                      ? '• FOREIGN & MULTILATERAL DESK'
                      : '• TERRITORIAL CORRIDOR'}
                  </span>
                  {scope?.totalCount !== undefined && (
                    <span className="text-[11px] font-mono text-stone-400">
                      ({scope.totalCount} {scope.totalCount === 1 ? 'Dispatch' : 'Dispatches'})
                    </span>
                  )}
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] leading-tight">
                  {scope?.title}
                </h1>
                {scope?.tagline && (
                  <p className="text-xs sm:text-sm text-stone-600 font-serif mt-1 max-w-2xl leading-relaxed">
                    {scope.tagline}
                  </p>
                )}
              </div>

              {/* Constituent districts for region, or domain indicators for national/international */}
              {isRegion && scope?.districts && scope.districts.length > 0 && (
                <div className="flex flex-col md:items-end">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    Constituent Districts ({scope.districts.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-w-md md:justify-end">
                    {scope.districts.map((d) => (
                      <Link
                        key={d}
                        href={`${langPrefix}/district/${d}`}
                        className="px-2 py-0.5 text-[11px] bg-white border border-stone-300 rounded hover:border-stone-900 hover:bg-stone-50 transition font-medium text-stone-700 shadow-2xs"
                      >
                        {getDistrictDisplayName(d)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {isNational && (
                <div className="flex flex-col md:items-end">
                  <div className="flex items-center gap-2 text-xs font-mono text-stone-700 bg-white border border-stone-300 px-3 py-2 rounded-xl shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>PARLIAMENT &bull; SUPREME COURT &bull; UNION MINISTRIES &bull; RBI</span>
                  </div>
                </div>
              )}

              {isInternational && (
                <div className="flex flex-col md:items-end">
                  <div className="flex items-center gap-2 text-xs font-mono text-stone-700 bg-white border border-stone-300 px-3 py-2 rounded-xl shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                    <span>UNITED NATIONS &bull; G20 &bull; DIPLOMATIC CORPS &bull; THE HAGUE</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* 1. MOBILE-ONLY VIEW (md:hidden): Pixel-Matched Stream from User HTML Mockup */}
        {/* ========================================================================= */}
        <div className="block md:hidden pb-6 w-full max-w-full overflow-x-hidden">
          <main className="px-2.5 sm:px-3.5 py-2.5 sm:py-3 space-y-3 sm:space-y-4 w-full max-w-md mx-auto" data-purpose="newspaper-stream">
            {/* Breaking Wire Capsule */}
            {showDevelopingRibbon && (
              <section
                className="bg-stone-900 text-stone-100 rounded-lg p-2 sm:p-2.5 shadow-md flex items-center space-x-2 border-l-4 border-red-500 font-sans min-w-0"
                data-purpose="breaking-wire-ticker"
              >
                <span className="flex-shrink-0 bg-red-600 text-white text-[8.5px] sm:text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider animate-pulse flex items-center space-x-1">
                  <span className="w-1 h-1 rounded-full bg-white"></span>
                  <span>{developingBadge}</span>
                </span>
                <div className="flex-1 overflow-hidden min-w-0">
                  <p className="text-[10.5px] sm:text-[11.5px] text-stone-200 truncate font-medium">
                    {developingHeadline}
                  </p>
                </div>
                <span className="text-[8px] sm:text-[9px] text-stone-400 font-mono flex-shrink-0">
                  {activeTelemetry.live_wire?.synced_time || 'LIVE'}
                </span>
              </section>
            )}

            {/* Contextual Telemetry Strip (National / International / Mountain Transit) */}
            {isNational ? (
              <section
                className="bg-white rounded-lg border border-stone-200 p-2 sm:p-2.5 shadow-xs font-sans"
                data-purpose="national-governance-strip"
              >
                <div className="flex items-center justify-between mb-1.5 gap-1">
                  <div className="flex items-center space-x-1 text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-wider text-stone-700 min-w-0">
                    <span className="text-red-600 font-bold">🏛️</span>
                    <span className="truncate">Union Governance &amp; Constitutional Wire</span>
                  </div>
                  <span className="text-[8.5px] sm:text-[9px] font-mono text-stone-500 shrink-0">
                    Gazette Sync →
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 sm:gap-1.5 text-center text-[9px] sm:text-[10px]">
                  <div className="bg-amber-50 border border-amber-200 rounded p-1 sm:p-1.5 min-w-0">
                    <div className="font-bold text-amber-950 text-[9px] sm:text-[10px] truncate">Parliament</div>
                    <div className="text-amber-800 font-semibold flex items-center justify-center space-x-0.5 mt-0.5 text-[7.5px] sm:text-[9px] truncate">
                      <span className="w-1 h-1 rounded-full bg-amber-600 shrink-0"></span>
                      <span className="truncate">LOK &amp; RAJYA</span>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-1 sm:p-1.5 min-w-0">
                    <div className="font-bold text-blue-950 text-[9px] sm:text-[10px] truncate">Supreme Court</div>
                    <div className="text-blue-800 font-semibold flex items-center justify-center space-x-0.5 mt-0.5 text-[7.5px] sm:text-[9px] truncate">
                      <span className="w-1 h-1 rounded-full bg-blue-600 shrink-0"></span>
                      <span className="truncate">BENCH ACTIVE</span>
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-1 sm:p-1.5 min-w-0">
                    <div className="font-bold text-emerald-950 text-[9px] sm:text-[10px] truncate">Union Economy</div>
                    <div className="text-emerald-800 font-semibold flex items-center justify-center space-x-0.5 mt-0.5 text-[7.5px] sm:text-[9px] truncate">
                      <span className="w-1 h-1 rounded-full bg-emerald-600 shrink-0"></span>
                      <span className="truncate">RBI REPO 6.50%</span>
                    </div>
                  </div>
                </div>
              </section>
            ) : isInternational ? (
              <section
                className="bg-white rounded-lg border border-stone-200 p-2 sm:p-2.5 shadow-xs font-sans"
                data-purpose="international-diplomatic-strip"
              >
                <div className="flex items-center justify-between mb-1.5 gap-1">
                  <div className="flex items-center space-x-1 text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-wider text-stone-700 min-w-0">
                    <span className="text-blue-600 font-bold">🌐</span>
                    <span className="truncate">Global Diplomatic &amp; Treaty Wire</span>
                  </div>
                  <span className="text-[8.5px] sm:text-[9px] font-mono text-stone-500 shrink-0">
                    UN Wire →
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 sm:gap-1.5 text-center text-[9px] sm:text-[10px]">
                  <div className="bg-blue-50 border border-blue-200 rounded p-1 sm:p-1.5 min-w-0">
                    <div className="font-bold text-blue-950 text-[9px] sm:text-[10px] truncate">United Nations</div>
                    <div className="text-blue-800 font-semibold flex items-center justify-center space-x-0.5 mt-0.5 text-[7.5px] sm:text-[9px] truncate">
                      <span className="w-1 h-1 rounded-full bg-blue-600 shrink-0"></span>
                      <span className="truncate">UNGA / UNSC</span>
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded p-1 sm:p-1.5 min-w-0">
                    <div className="font-bold text-purple-950 text-[9px] sm:text-[10px] truncate">The Hague / ICJ</div>
                    <div className="text-purple-800 font-semibold flex items-center justify-center space-x-0.5 mt-0.5 text-[7.5px] sm:text-[9px] truncate">
                      <span className="w-1 h-1 rounded-full bg-purple-600 shrink-0"></span>
                      <span className="truncate">TREATY DOCKET</span>
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-1 sm:p-1.5 min-w-0">
                    <div className="font-bold text-emerald-950 text-[9px] sm:text-[10px] truncate">Global Markets</div>
                    <div className="text-emerald-800 font-semibold flex items-center justify-center space-x-0.5 mt-0.5 text-[7.5px] sm:text-[9px] truncate">
                      <span className="w-1 h-1 rounded-full bg-emerald-600 shrink-0"></span>
                      <span className="truncate">BRENT $74.2</span>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section
                className="bg-white rounded-lg border border-stone-200 p-2 sm:p-2.5 shadow-xs font-sans"
                data-purpose="mountain-transit-strip"
              >
                <div className="flex items-center justify-between mb-1.5 gap-1">
                  <div className="flex items-center space-x-1 text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-wider text-stone-700 min-w-0">
                    <svg
                      className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-stone-500 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                    <span className="truncate">Transit &amp; Pass Telemetry</span>
                  </div>
                  <Link
                    href={`${langPrefix}/transit`}
                    className="text-[8.5px] sm:text-[9px] font-mono text-stone-500 hover:text-stone-800 transition shrink-0"
                  >
                    Traffic HQ →
                  </Link>
                </div>
                {/* Real-time Pass Pills */}
                <div className="grid grid-cols-3 gap-1 sm:gap-1.5 text-center text-[9px] sm:text-[10px]">
                  <Link
                    href={`${langPrefix}/transit#nh44`}
                    className="bg-emerald-50 border border-emerald-200 rounded p-1 sm:p-1.5 block hover:bg-emerald-100/70 transition min-w-0"
                  >
                    <div className="font-bold text-emerald-950 text-[9px] sm:text-[10px] truncate">NH-44 Tunnel</div>
                    <div className="text-emerald-700 font-semibold flex items-center justify-center space-x-0.5 mt-0.5 text-[7.5px] sm:text-[9px] truncate">
                      <span className="w-1 h-1 rounded-full bg-emerald-600 shrink-0"></span>
                      <span className="truncate">CLEAR / DUAL</span>
                    </div>
                  </Link>
                  <Link
                    href={`${langPrefix}/transit#zojila`}
                    className="bg-amber-50 border border-amber-200 rounded p-1 sm:p-1.5 block hover:bg-amber-100/70 transition min-w-0"
                  >
                    <div className="font-bold text-amber-950 text-[9px] sm:text-[10px] truncate">Zojila Pass</div>
                    <div className="text-amber-800 font-semibold flex items-center justify-center space-x-0.5 mt-0.5 text-[7.5px] sm:text-[9px] truncate">
                      <span className="w-1 h-1 rounded-full bg-amber-600 shrink-0"></span>
                      <span className="truncate">CHAINS REQ.</span>
                    </div>
                  </Link>
                  <Link
                    href={`${langPrefix}/transit#peer`}
                    className="bg-rose-50 border border-rose-200 rounded p-1 sm:p-1.5 block hover:bg-rose-100/70 transition min-w-0"
                  >
                    <div className="font-bold text-rose-950 text-[9px] sm:text-[10px] truncate">Peer Ki Gali</div>
                    <div className="text-rose-700 font-semibold flex items-center justify-center space-x-0.5 mt-0.5 text-[7.5px] sm:text-[9px] truncate">
                      <span className="w-1 h-1 rounded-full bg-rose-600 shrink-0"></span>
                      <span className="truncate">SNOW BLOCK</span>
                    </div>
                  </Link>
                </div>
              </section>
            )}

            {/* Hero Editorial of Record */}
            <article
              className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden"
              data-purpose="hero-investigation"
            >
              <div className="p-2.5 sm:p-3.5 pb-2">
                <div className="flex items-center justify-between mb-1.5 font-sans gap-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] sm:text-[10px] font-bold tracking-wider uppercase bg-cyan-100/70 text-cyan-900 border border-cyan-200 truncate max-w-[190px]">
                    {heroArticle?.category
                      ? `${heroArticle.category.toUpperCase()} • INVESTIGATION`
                      : 'CULTURE • INVESTIGATION'}
                  </span>
                  <span className="text-[8.5px] sm:text-[10px] text-stone-500 font-medium shrink-0">7 Min Read</span>
                </div>
                <h2 className="font-headline text-[17px] sm:text-[22px] text-stone-950 font-bold leading-snug sm:leading-tight">
                  <Link
                    href={
                      heroArticle
                        ? getArtHref(heroArticle)
                        : `${langPrefix}/latest`
                    }
                    className="hover:text-stone-700 transition"
                  >
                    {heroArticle?.title ||
                      'J&K Diaspora Cultural Alliance Concludes European Conclave in Vienna with Pledges for Heritage Digitization'}
                  </Link>
                </h2>
                <p className="text-stone-600 font-serif text-[12px] sm:text-[13.5px] leading-relaxed mt-1.5 sm:mt-2.5 line-clamp-3 sm:line-clamp-none">
                  {heroArticle?.excerpt ||
                    'Over 400 scholars, artists, and overseas diaspora representatives establish a multi-million euro foundation to preserve Kashmiri and Dogri archival manuscripts.'}
                </p>
                <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-stone-100 text-[10px] sm:text-[11px] font-sans gap-1">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-stone-900 text-white font-bold text-[8.5px] sm:text-[9px] flex items-center justify-center border border-amber-400 shrink-0">
                      {heroArticle?.author_display_name
                        ? heroArticle.author_display_name[0]?.toUpperCase()
                        : 'K'}
                    </div>
                    <div className="min-w-0 truncate">
                      <span className="font-bold text-stone-800 truncate">
                        {heroArticle?.author_display_name || 'KCPJLN Bureau'}
                      </span>
                      <span className="text-stone-400 font-normal">
                        {' '}• {heroArticle?.district ? getDistrictDisplayName(heroArticle.district) : 'Srinagar'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-stone-500 font-mono text-[9px] sm:text-[10px] shrink-0" suppressHydrationWarning>
                    <div>
                      {heroArticle
                        ? formatArticleDate(heroArticle.published_at)
                        : 'Oct 24, 2026'}
                    </div>
                    <div className="text-stone-400 text-[8px] sm:text-[9px]">06:00 IST Dispatch</div>
                  </div>
                </div>
              </div>
              {heroArticle?.featured_image_url && (
                <div className="relative w-full aspect-[16/10] bg-stone-800 overflow-hidden">
                  <Image
                    alt={
                      heroArticle.title ||
                      'Regional photographic record verified by KJIN documentary desk'
                    }
                    className="w-full h-full object-cover"
                    src={getOptimizedMediaUrl(heroArticle.featured_image_url, 450)}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 100vw, 450px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-1.5 left-2.5 right-2.5 flex items-center justify-between text-[8.5px] sm:text-[9.5px] text-stone-200 font-sans z-10 gap-1">
                    <span className="font-medium tracking-wide truncate">Regional documentary record verified</span>
                    <span className="font-mono text-stone-300 shrink-0">Photo: KJIN</span>
                  </div>
                </div>
              )}
              <div
                className="p-2.5 sm:p-3.5 bg-amber-50/60 border-t border-amber-200/70 font-sans"
                data-purpose="analytical-takeaways"
              >
                <div className="flex items-center space-x-1.5 text-stone-800 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-1.5 min-w-0">
                  <svg className="w-3.5 h-3.5 text-amber-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14H8a4 4 0 01-.82-7.915A5 5 0 0116.82 8.5 4.002 4.002 0 0112 14z"></path>
                  </svg>
                  <span className="text-amber-950 font-bold truncate">Key Analytical Takeaways • Bureau Economic Desk</span>
                </div>
                <ul className="text-[11px] sm:text-[12px] text-stone-700 space-y-1 sm:space-y-1.5 list-disc list-inside leading-snug">
                  {(curation?.takeaways && curation.takeaways.length > 0
                    ? curation.takeaways
                    : [
                        '€4.2M allocated toward high-resolution hyperspectral scanning of Sharda, Dogra, and Persian scripts.',
                        'Establishment of twin digital archival nodes in Graz and Srinagar to safeguard provenance records.',
                        'Direct scholarship endowments created for doctoral linguistics research at Jammu and Kashmir universities.',
                      ]
                  ).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            </article>

            {/* Top Sub-Lead Stories (Mobile 2-Card Deck) */}
            {subArticles && subArticles.length > 0 && (
              <section className="space-y-2.5 font-sans" data-purpose="sub-leads-mobile">
                <div className="flex items-center justify-between pb-1.5 border-b border-stone-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-amber-600 inline-block" />
                    <span>Sub-Lead Dispatches</span>
                  </h3>
                  <span className="text-[10px] font-mono text-stone-400">Featured</span>
                </div>
                <div className="space-y-2.5">
                  {subArticles.map((art) => (
                    <article key={art.id} className="p-3 bg-white rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 text-[9.5px]">
                          <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-amber-100 text-amber-800">
                            {art.category}
                          </span>
                          {art.district && (
                            <span className="font-semibold text-[#0891B2]">
                              {getDistrictDisplayName(art.district)}
                            </span>
                          )}
                        </div>
                        <h4 className="font-serif text-sm font-bold text-[#0F172A] leading-snug hover:text-[#0891B2] transition mb-1">
                          <Link href={getArtHref(art)}>
                            {art.title}
                          </Link>
                        </h4>
                        {art.excerpt && (
                          <p className="text-[11.5px] text-stone-600 line-clamp-2 leading-relaxed">
                            {art.excerpt}
                          </p>
                        )}
                      </div>
                      <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
                        <span>By {art.author_display_name || 'Correspondent'}</span>
                        <span suppressHydrationWarning>{formatArticleDate(art.published_at)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Five Territorial Corridors At A Glance */}
            <section
              className="bg-white rounded-xl border border-stone-200 p-2.5 sm:p-3.5 shadow-sm space-y-2 sm:space-y-3 font-sans"
              data-purpose="territorial-corridors-section"
            >
              <div className="flex items-center justify-between border-b border-stone-200 pb-1.5 gap-1">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <span className="text-amber-700">🧭</span>
                  <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-900 truncate">
                    Five Territorial Corridors
                  </h3>
                </div>
                <span className="text-[8.5px] sm:text-[9.5px] font-mono font-medium text-stone-500 shrink-0">Live Wire Dispatch</span>
              </div>
              <div className="space-y-2.5">
                {activeTelemetry.corridors_at_a_glance.map((corridor) => {
                  const articleUrl = `${langPrefix}${
                    corridor.link_path.startsWith('/') ? corridor.link_path : `/${corridor.link_path}`
                  }`;
                  const regionSlug =
                    corridor.region_slug ||
                    (corridor.id === 'chenab'
                      ? 'chenab-valley'
                      : corridor.id === 'panjal'
                      ? 'pir-panjal'
                      : corridor.id === 'ladakh'
                      ? 'leh'
                      : corridor.id);
                  const regionUrl = `${langPrefix}/region/${regionSlug}`;

                  const badgeStyles: Record<string, { badge: string; hover: string }> = {
                    kashmir: {
                      badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
                      hover: 'hover:border-emerald-500',
                    },
                    jammu: {
                      badge: 'bg-amber-100 text-amber-900 border-amber-200',
                      hover: 'hover:border-amber-500',
                    },
                    chenab: {
                      badge: 'bg-cyan-100 text-cyan-900 border-cyan-200',
                      hover: 'hover:border-cyan-500',
                    },
                    panjal: {
                      badge: 'bg-purple-100 text-purple-900 border-purple-200',
                      hover: 'hover:border-purple-500',
                    },
                    ladakh: {
                      badge: 'bg-blue-100 text-blue-900 border-blue-200',
                      hover: 'hover:border-blue-500',
                    },
                  };

                  const style = badgeStyles[corridor.id] || badgeStyles.kashmir;

                  return (
                    <div
                      key={corridor.id}
                      className={`border border-stone-200 rounded-lg p-2 sm:p-3 ${style.hover} transition-all bg-stone-50/40 relative`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Link
                          href={regionUrl}
                          className={`text-[9px] sm:text-[10px] font-bold tracking-wider uppercase px-1.5 sm:px-2 py-0.5 rounded border ${style.badge}`}
                        >
                          {corridor.name}
                        </Link>
                        <Link href={articleUrl} className="text-stone-400 text-xs hover:text-stone-700">
                          →
                        </Link>
                      </div>
                      <h4 className="text-[12px] sm:text-[13px] font-semibold text-stone-900 leading-snug line-clamp-2">
                        <Link href={articleUrl} className="hover:text-stone-600 transition">
                          {corridor.headline}
                        </Link>
                      </h4>
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-stone-200/60 text-[9px] sm:text-[10px] text-stone-500">
                        <span className="truncate">{corridor.stats}</span>
                        <span className="text-emerald-700 font-bold flex items-center space-x-1 shrink-0">
                          <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
                          <span>LIVE</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Territorial Bureau GIS Telemetry Box */}
            <section
              className="bg-white rounded-xl border border-stone-200 p-2.5 sm:p-3.5 shadow-sm space-y-2 sm:space-y-2.5 font-sans"
              data-purpose="territorial-bureau-map"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <span className="text-sm sm:text-base">🗺️</span>
                  <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-900 truncate">
                    Territorial Bureau Map
                  </h3>
                </div>
                <span className="text-[8.5px] sm:text-[9.5px] font-mono text-cyan-800 bg-cyan-50 border border-cyan-200 px-1.5 sm:px-2 py-0.5 rounded-full font-semibold shrink-0">
                  GPS Telemetry
                </span>
              </div>
              <div className="bg-slate-950 text-white rounded-lg p-3 sm:p-4 relative overflow-hidden border border-slate-800 shadow-inner">
                <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full border border-slate-800/80 pointer-events-none"></div>
                <div className="absolute -right-2 -bottom-2 w-28 h-28 rounded-full border border-cyan-900/40 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="flex items-center space-x-2 mb-2 sm:mb-3">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span className="text-[9px] sm:text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-semibold">
                      NODE: 01-SRX ACTIVE
                    </span>
                  </div>
                  <h4 className="font-mono text-sm sm:text-base font-bold text-white tracking-wide truncate">
                    SRINAGAR CENTRAL STATION
                  </h4>
                  <p className="font-mono text-[9.5px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                    34.0837° N, 74.7973° E • <span className="text-amber-400 font-semibold">Elev 1,585m</span>
                  </p>
                  <div className="mt-2.5 sm:mt-3.5 pt-2 sm:pt-3 border-t border-slate-800/80 flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-slate-400">
                    <span>Uplink: OK</span>
                    <span className="text-emerald-400">Synchronized</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-stone-600 leading-snug px-0.5">
                Real-time bureau telemetry across 5 regional operational hubs linking valley, chenab gorges, and ladakh plateau.
              </p>
            </section>

            {/* Agricultural & Commodity Mandi Telemetry */}
            <section
              className="bg-white rounded-xl border border-stone-200 p-2.5 sm:p-3.5 shadow-sm space-y-2.5 sm:space-y-3 font-sans"
              data-purpose="mandi-telemetry-section"
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-headline text-base sm:text-lg font-bold text-stone-950 leading-tight truncate">
                    Agricultural &amp; Commodity Mandi
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                </div>
                <p className="text-[11px] sm:text-[11.5px] text-stone-600 mt-0.5 leading-snug font-serif">
                  Direct spot pricing from terminal markets across Jammu, Srinagar, Sopore &amp; Kishtwar.
                </p>
                <div className="flex items-center space-x-1.5 text-[9px] sm:text-[10px] text-emerald-800 font-semibold mt-1">
                  <span>●</span>
                  <span className="truncate">Updated: Today 11:30 AM IST • APMC Official Wire</span>
                </div>
              </div>
              <div className="space-y-1.5 sm:space-y-2 pt-1">
                {activeTelemetry.mandi_commodities.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="bg-stone-50 border border-stone-200 rounded-lg p-2 sm:p-3 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-bold text-stone-700 bg-stone-200/80 px-1.5 sm:px-2 py-0.5 rounded tracking-wide uppercase">
                        {item.market_name}
                      </span>
                      <span
                        className={`text-[10.5px] sm:text-[11px] font-bold flex items-center ${
                          item.trend === 'up'
                            ? 'text-emerald-600'
                            : item.trend === 'down'
                            ? 'text-rose-600'
                            : 'text-stone-500'
                        }`}
                      >
                        {item.change_pct} {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : ''}
                      </span>
                    </div>
                    <div className="my-1.5 sm:my-2">
                      <div className="text-[12px] sm:text-[13px] font-bold text-stone-900 truncate">{item.commodity_name}</div>
                      <div className="flex items-baseline space-x-1 mt-0.5">
                        <span className="font-serif text-base sm:text-lg font-bold text-stone-950">{item.price}</span>
                        <span className="text-[10px] sm:text-[11px] text-stone-500">{item.unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-stone-500 border-t border-stone-200/60 pt-1">
                      <span className="truncate">{item.stat_left}</span>
                      <span
                        className={`font-medium shrink-0 ${
                          item.stat_right.includes('GI')
                            ? 'text-amber-700 font-bold'
                            : item.stat_right.includes('Export')
                            ? 'text-blue-700 font-bold'
                            : 'text-stone-700'
                        }`}
                      >
                        {item.stat_right}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* International News Spotlight (Mobile) */}
            {(!scope || scope.type === 'home') && (
              <div className="bg-white p-3 sm:p-4 rounded-xl border border-sky-200/90 shadow-xs bg-gradient-to-br from-white via-sky-50/20 to-blue-50/25 font-sans">
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-sky-100">
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-sky-600/10 text-sky-700 border border-sky-600/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                      <span>🌐 International Wire</span>
                    </span>
                    <Link
                      href={`${langPrefix}/international`}
                      className="text-[9px] font-mono font-bold text-sky-700 hover:text-sky-900 transition flex items-center gap-0.5"
                    >
                      <span>World Desk</span>
                      <span>→</span>
                    </Link>
                  </div>

                  {internationalArticle ? (
                    <>
                      {internationalArticle.featured_image_url && (
                        <div className="relative w-full h-28 rounded-lg overflow-hidden mb-2 border border-sky-100 shadow-2xs">
                          <Image
                            src={getOptimizedMediaUrl(internationalArticle.featured_image_url, 400)}
                            alt={internationalArticle.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, 360px"
                          />
                        </div>
                      )}
                      <h4 className="font-serif text-sm font-bold text-[#0F172A] leading-snug mb-1 hover:text-[#0891B2] transition">
                        <Link href={getArtHref(internationalArticle)}>
                          {internationalArticle.title}
                        </Link>
                      </h4>
                      {internationalArticle.excerpt && (
                        <p className="text-xs text-slate-600 font-serif line-clamp-2 leading-relaxed mb-2">
                          {internationalArticle.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[9px]">
                        <span className="text-slate-400" suppressHydrationWarning>
                          {formatArticleDate(internationalArticle.published_at)}
                        </span>
                        <Link
                          href={getArtHref(internationalArticle)}
                          className="font-bold text-sky-700 hover:text-sky-900 transition flex items-center gap-0.5"
                        >
                          <span>Read Wire</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="py-1.5 text-center text-xs text-slate-500">
                      <p className="italic text-[11px]">Monitoring global defense &amp; diplomatic intelligence.</p>
                      <Link
                        href={`${langPrefix}/international`}
                        className="mt-1 inline-block text-[10px] font-bold text-sky-700 hover:underline"
                      >
                        Open International Desk →
                      </Link>
                    </div>
                  )}
                </div>
            )}

            {/* Archival Wire & Special Dispatches */}
            <section
              className="bg-white rounded-xl border border-stone-200 p-2.5 sm:p-3.5 shadow-sm space-y-2.5 sm:space-y-3 font-sans"
              data-purpose="editorial-dispatches"
            >
              <div className="flex items-center justify-between border-b border-stone-200 pb-1.5 gap-1">
                <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-900 truncate">
                  Archival Wire &amp; Special Dispatches
                </h3>
                <span className="text-[9px] sm:text-[10px] font-serif italic text-stone-500 shrink-0">Bureau Records</span>
              </div>
              <div className="space-y-1">
                {(wireArticles && wireArticles.length >= 3
                  ? wireArticles.slice(0, 3).map((art, idx) => ({
                      id: art.id,
                      code: idx === 0 ? 'KJ' : idx === 1 ? 'LP' : 'PP',
                      category: art.district
                        ? getDistrictDisplayName(art.district).toUpperCase()
                        : art.category.toUpperCase(),
                      time: `${(idx + 1) * 3}h ago`,
                      title: art.title,
                      href: getArtHref(art),
                    }))
                  : [
                      {
                        id: 'disp-1',
                        code: 'KJ',
                        category: 'HYDRO-ENERGY',
                        time: '4h ago',
                        title: 'Kishtwar Ratle Hydro Project Installs First Rotor Shaft in Subterranean Powerhouse',
                        href: `${langPrefix}/latest`,
                      },
                      {
                        id: 'disp-2',
                        code: 'LP',
                        category: 'HIGH-ALTITUDE ECOLOGY',
                        time: '7h ago',
                        title: 'Wildlife Institute of India Completes Snow Leopard Census across Hemis & Zanskar',
                        href: `${langPrefix}/latest`,
                      },
                      {
                        id: 'disp-3',
                        code: 'PP',
                        category: 'TRANSIT ARCHITECTURE',
                        time: '11h ago',
                        title: 'Rajouri-Poonch National Highway Realignment Nears Milestone with 4 Major Tunnels',
                        href: `${langPrefix}/latest`,
                      },
                    ]
                ).map((dispatch) => (
                  <article key={dispatch.id} className="flex space-x-2 sm:space-x-3 py-1.5 sm:py-2 border-b border-stone-100 last:border-b-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-stone-100 border border-stone-200 flex-shrink-0 flex items-center justify-center font-serif text-stone-400 font-bold text-xs sm:text-sm">
                      {dispatch.code}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1 text-[8.5px] sm:text-[9.5px] text-stone-500 mb-0.5">
                        <span className="font-semibold text-stone-700 truncate">{dispatch.category}</span>
                        <span>•</span>
                        <span className="shrink-0">{dispatch.time}</span>
                      </div>
                      <h4 className="text-[11.5px] sm:text-[12.5px] font-semibold text-stone-950 leading-snug line-clamp-2">
                        <Link href={dispatch.href} className="hover:text-stone-700 transition">
                          {dispatch.title}
                        </Link>
                      </h4>
                    </div>
                  </article>
                ))}
              </div>
              <Link
                href={`${langPrefix}/latest`}
                className="w-full py-1.5 sm:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[10px] sm:text-[11px] font-bold tracking-wide transition-colors border border-stone-300/80 flex items-center justify-center space-x-1.5"
              >
                <span>CHRONOLOGICAL RECORD ARCHIVE</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </Link>
            </section>

            {/* Global Conflict & War Radar (Mobile Live Wire) */}
            {conflictNews && conflictNews.length > 0 && (
              <section className="bg-white p-3.5 rounded-xl border border-red-200/80 shadow-xs font-sans" data-purpose="conflict-radar-mobile">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-red-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-red-950">
                      Conflict &amp; War Radar
                    </h3>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[8.5px] font-bold font-mono">
                    LIVE WIRE
                  </span>
                </div>
                <div className="space-y-2.5 divide-y divide-stone-100">
                  {conflictNews.slice(0, 3).map((item) => (
                    <article key={item.id} className="pt-2 first:pt-0">
                      <div className="flex items-center justify-between text-[8.5px] mb-1">
                        <span className="font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                          {item.badge}
                        </span>
                        <span className="text-stone-400 font-mono text-[8px] truncate max-w-[130px]">{item.source}</span>
                      </div>
                      <h4 className="text-xs font-serif font-bold text-stone-900 leading-snug hover:text-red-700 transition">
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          {item.title} <span className="text-[9px] text-stone-400">↗</span>
                        </a>
                      </h4>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Discover & Frontier Sciences (Mobile Wire) */}
            {discoverNews && discoverNews.length > 0 && (
              <section className="bg-[#0F172A] text-white p-3.5 rounded-xl shadow-xs font-sans" data-purpose="discover-wire-mobile">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 text-xs">🔭</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Discover &amp; Frontier Wire
                    </h3>
                  </div>
                  <span className="text-[8.5px] font-mono text-cyan-300">Global Labs</span>
                </div>
                <div className="space-y-2 divide-y divide-slate-800">
                  {discoverNews.slice(0, 2).map((item) => (
                    <article key={item.id} className="pt-2 first:pt-0">
                      <div className="flex items-center justify-between text-[8.5px] mb-1 font-mono">
                        <span className="text-cyan-300 font-bold uppercase">{item.badge}</span>
                        <span className="text-slate-400">{item.source}</span>
                      </div>
                      <h4 className="font-serif text-xs font-bold text-slate-100 hover:text-cyan-300 leading-snug">
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          {item.title} <span className="text-[9px] text-slate-400">↗</span>
                        </a>
                      </h4>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Broadsheet Dispatches & Regional Reports (Mobile Stream) */}
            {streamArticles && streamArticles.length > 0 && (
              <section className="space-y-3 font-sans" data-purpose="field-dispatches-mobile">
                <div className="flex items-center justify-between pb-1.5 border-b border-stone-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-stone-900 inline-block" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                      Field Dispatches &amp; Reports
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400">
                    {streamArticles.length} Stories
                  </span>
                </div>
                <div className="space-y-3">
                  {streamArticles.slice(0, 8).map((art) => (
                    <article key={art.id} className="p-3 bg-white rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
                      <div>
                        {art.featured_image_url && (
                          <div className="relative w-full h-32 rounded-lg overflow-hidden bg-stone-100 mb-2">
                            <Image
                              src={getOptimizedMediaUrl(art.featured_image_url, 400)}
                              alt={art.title}
                              fill
                              sizes="(max-width: 640px) 100vw, 360px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mb-1.5 text-[9.5px]">
                          <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-stone-100 text-stone-800">
                            {art.category}
                          </span>
                          {art.district && (
                            <span className="font-semibold text-[#0891B2]">
                              {getDistrictDisplayName(art.district)}
                            </span>
                          )}
                        </div>
                        <h4 className="font-serif text-sm font-bold text-[#0F172A] leading-snug hover:text-[#0891B2] transition mb-1">
                          <Link href={getArtHref(art)}>
                            {art.title}
                          </Link>
                        </h4>
                        {art.excerpt && (
                          <p className="text-[11.5px] text-stone-600 line-clamp-2 leading-relaxed mb-2">
                            {art.excerpt}
                          </p>
                        )}
                      </div>
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
                        <span>By {art.author_display_name || 'Correspondent'}</span>
                        <span suppressHydrationWarning>{formatArticleDate(art.published_at)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Corridor Feature Dossiers (Mobile) */}
            {dossierArticles && dossierArticles.length > 0 && (
              <section className="space-y-3 font-sans" data-purpose="dossiers-mobile">
                <div className="flex items-center justify-between pb-1.5 border-b border-stone-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                    Feature Dossiers
                  </h3>
                  <Link href={`${langPrefix}/latest`} className="text-[10px] text-[#0891B2] font-semibold">
                    All Archives →
                  </Link>
                </div>
                <div className="space-y-2.5">
                  {dossierArticles.slice(0, 3).map((art) => (
                    <article key={art.id} className="p-3 bg-white rounded-xl border border-stone-200 shadow-xs">
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-cyan-100 text-cyan-800 inline-block mb-1">
                        {art.district ? getDistrictDisplayName(art.district) : 'Corridor'} • {art.category}
                      </span>
                      <h4 className="font-serif text-sm font-bold text-stone-900 leading-snug mb-1 hover:text-[#0891B2] transition">
                        <Link href={getArtHref(art)}>
                          {art.title}
                        </Link>
                      </h4>
                      {art.excerpt && (
                        <p className="text-[11px] text-stone-600 line-clamp-2 leading-relaxed">
                          {art.excerpt}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Mobile Pagination Controls */}
            {paginationMeta && (
              <div className="pt-2 font-sans" data-purpose="pagination-mobile">
                <PaginationControls meta={paginationMeta} theme={theme} />
              </div>
            )}
          </main>
        </div>

        {/* ========================================================================= */}
        {/* 2. DESKTOP & TABLET VIEW (hidden md:block): Rich 3-Column Broadsheet Grid */}
        {/* ========================================================================= */}
        <div className="hidden md:block">
          {/* Top Developing Alert Ribbon */}
          {showDevelopingRibbon && (
            <section className="w-full bg-[#0F172A] text-white py-2.5 px-4 md:px-8 border-b border-slate-800 shadow-sm font-sans">
              <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto flex items-center justify-between gap-2">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <span className="flex items-center px-2 py-0.5 bg-[#DC2626] text-white text-[11px] font-bold tracking-widest uppercase rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block mr-1.5" />
                    {developingBadge}
                  </span>
                  <p className="text-xs text-white/90 truncate font-medium">
                    {developingHeadline}
                  </p>
                </div>
                <div className="flex items-center space-x-4 text-[11px] text-slate-300 whitespace-nowrap">
                  {activeTelemetry.live_wire?.verified !== false && (
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      ✓ Verified Wire
                    </span>
                  )}
                  <span className="text-slate-600">|</span>
                  <span>Synced: {activeTelemetry.live_wire?.synced_time || 'LIVE'}</span>
                </div>
              </div>
            </section>
          )}

          {/* Contextual Telemetry Strip (National / International / Mountain Transit) */}
          {isNational ? (
            <section className="w-full bg-white border-b border-slate-200 py-3 px-4 md:px-8 font-sans">
              <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 text-[11px]">
                    <span className="text-red-600 font-bold">🏛️</span>
                    <span>UNION GOVERNANCE &amp; CONSTITUTIONAL WIRE</span>
                  </span>
                  <span className="text-[11px] text-[#0891B2] font-semibold">
                    Gazette &bull; Supreme Court &bull; Parliament →
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/60">
                    <span className="font-bold text-xs text-amber-950">Parliament of India</span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block" />
                      <span>LOK &amp; RAJYA SABHA</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-blue-200/80 bg-blue-50/60">
                    <span className="font-bold text-xs text-blue-950">Supreme Court of India</span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase flex items-center gap-1 bg-blue-100 text-blue-900 border border-blue-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                      <span>CONSTITUTION BENCH</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60">
                    <span className="font-bold text-xs text-emerald-950">Union Macro Economy</span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                      <span>RBI REPO 6.50% &bull; GST</span>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          ) : isInternational ? (
            <section className="w-full bg-white border-b border-slate-200 py-3 px-4 md:px-8 font-sans">
              <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 text-[11px]">
                    <span className="text-blue-600 font-bold">🌐</span>
                    <span>GLOBAL DIPLOMATIC &amp; MULTILATERAL WIRE</span>
                  </span>
                  <span className="text-[11px] text-[#0891B2] font-semibold">
                    UN HQ &bull; The Hague &bull; G20 Track →
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-blue-200/80 bg-blue-50/60">
                    <span className="font-bold text-xs text-blue-950">United Nations HQ</span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase flex items-center gap-1 bg-blue-100 text-blue-900 border border-blue-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                      <span>UNSC &amp; UNGA SYNC</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-purple-200/80 bg-purple-50/60">
                    <span className="font-bold text-xs text-purple-950">The Hague / ICJ</span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase flex items-center gap-1 bg-purple-100 text-purple-900 border border-purple-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" />
                      <span>TREATY &amp; MARITIME</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60">
                    <span className="font-bold text-xs text-emerald-950">Global Markets &amp; Forex</span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                      <span>BRENT $74.2 &bull; DXY</span>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="w-full bg-white border-b border-slate-200 py-3 px-4 md:px-8 font-sans">
              <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 text-[11px]">
                    <span>🏔️</span>
                    <span>CORRIDOR MOUNTAIN TRANSIT &amp; PASS TELEMETRY</span>
                  </span>
                  <Link href={`${langPrefix}/transit`} className="text-[11px] text-[#0891B2] font-semibold hover:underline">
                    Live Traffic Advisories →
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {activeTelemetry.mountain_passes.slice(0, 3).map((pass) => (
                    <Link
                      key={pass.id}
                      href={`${langPrefix}/transit#${pass.id}`}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 bg-[#FAF8F5] hover:bg-[#F3EFEA] transition"
                    >
                      <span className="font-bold text-xs text-[#0F172A]">{pass.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase flex items-center gap-1 ${
                          pass.status === 'open'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : pass.status === 'caution'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                        <span>{pass.status_label}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Front Page Top Header Leaderboard Ad */}
          {leaderboardAd && (
            <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto px-4 md:px-8 mt-4 mb-2">
              <LeaderboardAd ad={leaderboardAd} />
            </div>
          )}

          {/* Dynamic Broadsheet Newspaper Layout (Desktop & Tablet) */}
          {(() => {
            const activeLayout = layoutConfig || DEFAULT_HOMEPAGE_LAYOUT;
            const hiddenSet = new Set(activeLayout.hidden || []);

            const leftSectionIds = (activeLayout.columns?.left || DEFAULT_HOMEPAGE_LAYOUT.columns.left).filter(
              (id) => !hiddenSet.has(id)
            );
            const centerSectionIds = (activeLayout.columns?.center || DEFAULT_HOMEPAGE_LAYOUT.columns.center).filter(
              (id) => !hiddenSet.has(id)
            );
            const rightSectionIds = (activeLayout.columns?.right || DEFAULT_HOMEPAGE_LAYOUT.columns.right).filter(
              (id) => !hiddenSet.has(id)
            );
            const fullWidthBottomSectionIds = (
              activeLayout.columns?.full_width_bottom || DEFAULT_HOMEPAGE_LAYOUT.columns.full_width_bottom
            ).filter((id) => !hiddenSet.has(id));

            // Section Renderers
            const renderBureauWire = (key = 'bureau_wire') => (
              <div key={key} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-sans" data-purpose="bureau-wire">
                <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F172A] flex items-center gap-1.5">
                    <span className="text-red-600 animate-pulse">●</span>
                    <span>{wireColumnTitle}</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Live Stream</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-4">{wireColumnDesc}</p>

                <div className="space-y-3.5">
                  {(wireArticles.length > 0 ? wireArticles : recentArticles.slice(0, 5)).map((art, idx) => (
                    <article key={art.id} className="p-3 bg-[#f5f3f0] rounded-xl hover:bg-slate-100 transition">
                      <div className="flex items-center justify-between mb-1 text-[10px] text-slate-500">
                        <span className="font-bold text-[#0891B2] uppercase">
                          {art.district ? getDistrictDisplayName(art.district) : art.category}
                        </span>
                        <span>{13 - idx * 2}:28 IST</span>
                      </div>
                      <h4 className="text-xs font-bold font-serif text-[#0F172A] leading-snug line-clamp-2 hover:text-[#0891B2] transition">
                        <Link href={getArtHref(art)}>{art.title}</Link>
                      </h4>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                        <span>By {art.author_display_name || 'Staff'}</span>
                        <span className="text-emerald-600 font-bold">✓ Vetted</span>
                      </div>
                    </article>
                  ))}
                </div>

                <Link
                  href={`${langPrefix}/latest`}
                  className="mt-4 block w-full py-2 bg-slate-900 text-white text-center text-[11px] font-bold uppercase tracking-wider rounded-xl shadow-sm hover:bg-slate-800 transition"
                >
                  View All District Filings →
                </Link>
              </div>
            );

            const renderTerritorialMap = (key = 'territorial_map') => (
              <div key={key} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-sans" data-purpose="territorial-map">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F172A] flex items-center gap-1.5">
                    <span>🗺️</span>
                    <span>Territorial Bureau Map</span>
                  </h3>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Open-Meteo Live
                  </span>
                </div>
                <div className="w-full h-40 rounded-xl bg-slate-900 relative overflow-hidden flex flex-col justify-between p-3 text-white">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/40 to-transparent" />
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                      LIVE RADAR SYNC
                    </span>
                    {weather && weather[0] && typeof weather[0].temp_c === 'number' && (
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {weather[0].temp_c}°C • {weather[0].weather_desc || 'Clear'}
                      </span>
                    )}
                  </div>
                  <div className="relative z-10">
                    <p className="text-xs font-bold uppercase tracking-wider">Srinagar Central Station</p>
                    <p className="text-[10px] text-slate-300 font-mono">34.0837° N, 74.7973° E • Elevation 1,585m</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
                  Real-time bureau telemetry across 5 regional operational hubs linking valley, chenab gorges, and ladakh plateau.
                </p>
              </div>
            );

            const renderConflictRadar = (key = 'conflict_radar') => {
              if (!conflictNews || conflictNews.length === 0) return null;
              return (
                <div key={key} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-sans" data-purpose="conflict-radar">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                      </span>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F172A]">
                        Conflict &amp; War Radar
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[9px] font-bold uppercase tracking-wider font-mono">
                      LIVE RADAR
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mb-3 leading-snug">
                    Real-time defense, conflict corridors, and UN peace operations intelligence.
                  </p>

                  <div className="space-y-3.5 divide-y divide-slate-100">
                    {conflictNews.slice(0, 5).map((item) => (
                      <article key={item.id} className="pt-3 first:pt-0">
                        <div className="flex items-center justify-between text-[9px] mb-1">
                          <span className="font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded tracking-wide border border-red-100">
                            {item.badge}
                          </span>
                          <span className="text-slate-400 font-mono truncate max-w-[120px]">{item.source}</span>
                        </div>
                        <h4 className="text-xs font-serif font-bold text-[#0F172A] leading-snug hover:text-red-700 transition">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline flex items-start gap-1"
                          >
                            <span>{item.title}</span>
                            <span className="text-[10px] text-slate-400 inline-block font-sans">↗</span>
                          </a>
                        </h4>
                        {item.summary && (
                          <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                            {item.summary}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>UN Peace &amp; Global Syndicated</span>
                    <Link href={`${langPrefix}/international`} className="text-[#0891B2] font-semibold hover:underline">
                      War &amp; World Desk →
                    </Link>
                  </div>
                </div>
              );
            };

            const renderLeadHeroGroup = (key = 'lead_hero_group') => {
              const leadArticle = heroArticle || recentArticles[0] || allArticles[0] || FALLBACK_BROADSHEET_ARTICLES[0];
              return (
              <div key={key} className="space-y-8 font-sans" data-purpose="lead-hero-group">
                {leadArticle && (
                  <article className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm font-serif">
                    <div className="flex items-center justify-between mb-3 text-xs font-sans">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 bg-red-600 text-white font-bold uppercase tracking-wider rounded text-[10px]">
                          {leadArticle.category}
                        </span>
                        {leadArticle.district && (
                          <span className="text-[#0891B2] font-semibold">
                            {getDistrictDisplayName(leadArticle.district)}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        7 Min In-Depth Read
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0F172A] leading-tight mb-3 hover:text-slate-700 transition">
                      <Link href={getArtHref(leadArticle)}>
                        {leadArticle.title}
                      </Link>
                    </h1>

                    {leadArticle.excerpt && (
                      <p className="font-sans text-base text-slate-600 leading-relaxed mb-4">
                        {leadArticle.excerpt}
                      </p>
                    )}

                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 text-xs font-sans text-slate-500">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs">
                          {leadArticle.author_display_name ? leadArticle.author_display_name[0]?.toUpperCase() : 'K'}
                        </div>
                        <div>
                          <span className="font-bold text-[#0F172A] block">{leadArticle.author_display_name || 'Staff Correspondent'}</span>
                          <span className="text-[10px]">{leadArticle.district ? getDistrictDisplayName(leadArticle.district) : 'Newsdesk'}</span>
                        </div>
                      </div>
                      <div className="text-right" suppressHydrationWarning>
                        <span className="block">{formatArticleDate(leadArticle.published_at)}</span>
                        <span className="text-[10px] text-slate-400">06:00 IST Dispatch</span>
                      </div>
                    </div>

                    {leadArticle.featured_image_url && (
                      <div className="relative w-full h-[280px] sm:h-[360px] rounded-xl overflow-hidden bg-slate-900 shadow-sm mb-4">
                        <Image
                          src={getOptimizedMediaUrl(leadArticle.featured_image_url, 720)}
                          alt={leadArticle.title}
                          fill
                          priority
                          fetchPriority="high"
                          sizes="(max-width: 1024px) 100vw, 750px"
                          className="object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/60 to-transparent text-white flex justify-between items-center text-[11px] font-sans">
                          <span className="truncate max-w-sm">Regional documentary record verified by {brandName} Visual Desk.</span>
                          <span className="text-slate-300">Photo: {brandName}</span>
                        </div>
                      </div>
                    )}

                    {/* Key Analytical Takeaways Box */}
                    <div className="p-4 bg-[#fbf9f4] rounded-xl border border-amber-200/80 font-sans">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm bg-[#DC2626] inline-block" />
                        <span>KEY ANALYTICAL TAKEAWAYS — BUREAU ECONOMIC DESK</span>
                      </h3>
                      <ul className="space-y-2 text-xs text-slate-700">
                        {(curation?.takeaways && curation.takeaways.length > 0
                          ? curation.takeaways
                          : [
                              '€4.2M allocated towards high-resolution hyperspectral scanning of Sharda, Dogra, and Persian scripts.',
                              'Establishment of twin digital archive locales in Graz and Srinagar to safeguard provenance records.',
                              'Direct scholarship endowments created for doctoral linguistics research at Jammu and Kashmir universities.'
                            ]
                        ).map((point, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2">
                            <span className="text-[#0891B2] font-bold mt-0.5">•</span>
                            <span className="leading-relaxed">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                )}

                {/* Secondary Split Sub-Articles (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-sans">
                  {subArticles.map((art) => (
                    <article key={art.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-800 inline-block mb-2">
                          {art.category}
                        </span>
                        <h3 className="font-serif text-lg font-bold text-[#0F172A] leading-snug mb-2 hover:text-[#0891B2] transition">
                          <Link href={getArtHref(art)}>
                            {art.title}
                          </Link>
                        </h3>
                        {art.excerpt && (
                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-3">
                            {art.excerpt}
                          </p>
                        )}
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>By {art.author_display_name || 'Correspondent'}</span>
                        <span>4 min read</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          };

            const renderCivicProblems = (key = 'civic_problems') => {
              if (!problemArticle && scope && scope.type !== 'home') return null;
              return (
                <div key={key} className="bg-white p-5 rounded-2xl border border-amber-200/90 shadow-sm bg-gradient-to-br from-white via-amber-50/25 to-orange-50/30 font-sans" data-purpose="civic-problems">
                  <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-amber-100">
                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-600/10 text-amber-700 border border-amber-600/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse inline-block" />
                      Problems • Civic Issues
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Ground Grievances</span>
                  </div>

                  {problemArticle ? (
                    <>
                      <div className="flex items-center gap-2 mb-1.5">
                        {problemArticle.district && (
                          <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-100 text-slate-700">
                            {getDistrictDisplayName(problemArticle.district)}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">By {problemArticle.author_display_name || 'Editor'}</span>
                      </div>
                      <h3 className="font-serif text-base font-bold text-[#0F172A] leading-snug mb-2 hover:text-[#0891B2] transition">
                        <Link href={getArtHref(problemArticle)}>
                          {problemArticle.title}
                        </Link>
                      </h3>
                      {problemArticle.excerpt && (
                        <p className="text-xs text-slate-600 font-serif line-clamp-2 leading-relaxed mb-3">
                          {problemArticle.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                        <span className="text-slate-400">{formatArticleDate(problemArticle.published_at)}</span>
                        <Link
                          href={`${langPrefix}/category/problems`}
                          className="font-bold text-amber-700 hover:text-amber-800 transition flex items-center gap-1"
                        >
                          All J&amp;K Problems →
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="py-2 text-center text-xs text-slate-500">
                      <p className="italic">Editorial ground grievances &amp; civic issues desk.</p>
                      <Link
                        href={`${langPrefix}/category/problems`}
                        className="mt-2 inline-block text-[11px] font-bold text-amber-700 hover:underline"
                      >
                        View Problems Archive →
                      </Link>
                    </div>
                  )}
                </div>
              );
            };

            const renderInternationalWire = (key = 'international_wire') => {
              if (scope && scope.type !== 'home') return null;
              return (
                <div key={key} className="bg-white p-5 rounded-2xl border border-sky-200/90 shadow-sm bg-gradient-to-br from-white via-sky-50/25 to-blue-50/30 font-sans" data-purpose="international-wire">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-sky-100">
                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-sky-600/10 text-sky-700 border border-sky-600/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                      <span>🌐 International Wire</span>
                    </span>
                    <Link
                      href={`${langPrefix}/international`}
                      className="text-[10px] font-mono font-bold text-sky-700 hover:text-sky-900 transition flex items-center gap-1"
                    >
                      <span>World Desk</span>
                      <span>→</span>
                    </Link>
                  </div>

                  {internationalArticle ? (
                    <>
                      {internationalArticle.featured_image_url && (
                        <div className="relative w-full h-32 rounded-xl overflow-hidden mb-3 border border-sky-100 shadow-xs">
                          <Image
                            src={getOptimizedMediaUrl(internationalArticle.featured_image_url, 450)}
                            alt={internationalArticle.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 320px"
                          />
                          <div className="absolute top-2 left-2 bg-[#0F172A]/85 backdrop-blur-xs text-white px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded">
                            Global Spotlight
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-sky-100 text-sky-800">
                          International
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {internationalArticle.author_display_name || 'Diplomatic Desk'}
                        </span>
                      </div>

                      <h3 className="font-serif text-base font-bold text-[#0F172A] leading-snug mb-2 hover:text-[#0891B2] transition">
                        <Link href={getArtHref(internationalArticle)}>
                          {internationalArticle.title}
                        </Link>
                      </h3>

                      {internationalArticle.excerpt && (
                        <p className="text-xs text-slate-600 font-serif line-clamp-2 leading-relaxed mb-3">
                          {internationalArticle.excerpt}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                        <span className="text-slate-400" suppressHydrationWarning>
                          {formatArticleDate(internationalArticle.published_at)}
                        </span>
                        <Link
                          href={getArtHref(internationalArticle)}
                          className="font-bold text-sky-700 hover:text-sky-900 transition flex items-center gap-0.5"
                        >
                          <span>Read Full Wire</span>
                          <span>→</span>
                        </Link>
                      </div>

                      {internationalArticles && internationalArticles.length > 1 && (
                        <div className="mt-3 pt-3 border-t border-sky-100/80 space-y-2">
                          {internationalArticles.slice(1, 3).map((item) => (
                            <div key={item.id} className="text-xs">
                              <Link
                                href={getArtHref(item)}
                                className="font-medium text-slate-700 hover:text-sky-700 line-clamp-1 transition flex items-center gap-1.5"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                <span className="truncate">{item.title}</span>
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-2.5 text-center text-xs text-slate-500">
                      <p className="italic">Monitoring United Nations, diplomatic accords, and global security intelligence.</p>
                      <Link
                        href={`${langPrefix}/international`}
                        className="mt-2 inline-block text-[11px] font-bold text-sky-700 hover:underline"
                      >
                        Open International Desk →
                      </Link>
                    </div>
                  )}
                </div>
              );
            };

            const renderEditorialRecord = (key = 'editorial_record') => {
              const edConfig = editorialDeskSettings?.editorial_of_record;
              if (edConfig && edConfig.enabled === false) return null;

              let edLink = `${langPrefix}/category/opinion`;
              if (edConfig?.link_mode === 'custom' && edConfig.custom_url) {
                edLink = edConfig.custom_url;
              } else if (editorialArticle) {
                edLink = getArtHref(editorialArticle);
              }

              const edVolume = edConfig?.volume_badge || 'Vol. LXXIV';
              const edTitle = edConfig?.title || (editorialArticle ? editorialArticle.title : 'The Pluralistic Pulse of the Corridors: Why Regional Federalism Matters');
              const edQuote = edConfig?.quote || (editorialArticle ? (editorialArticle.excerpt || editorialArticle.title) : '“Jammu and Kashmir’s socio-cultural geography has never been a monolithic plateau, but a rich confluence of mountain rivers, linguistic nuances, and shared resilience.”');
              const edAuthor = edConfig?.author_name || editorialArticle?.author_display_name || 'Editorial Board';
              const edInitials = edConfig?.author_initials || (editorialArticle?.author_display_name && editorialArticle.author_display_name.trim().length > 0 ? editorialArticle.author_display_name.trim()[0].toUpperCase() : 'EB');
              const edSubtext = edConfig?.institution_subtext || (editorialArticle?.district ? getDistrictDisplayName(editorialArticle.district) : 'Srinagar & Jammu Joint Chancellery');

              return (
                <div key={key} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-sans" data-purpose="editorial-record">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-[#0F172A] text-white">
                      Editorial of Record
                    </span>
                    <span className="text-[11px] text-slate-400 font-serif">{edVolume}</span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-[#0F172A] leading-tight mb-2 hover:text-[#0891B2] transition">
                    <Link href={edLink}>{edTitle}</Link>
                  </h3>
                  <p className="text-xs text-slate-600 italic font-serif leading-relaxed mb-3">
                    “{edQuote.replace(/^["“]|["”]$/g, '')}”
                  </p>
                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                    <div className="w-7 h-7 rounded-full bg-[#1E293B] text-white flex items-center justify-center font-bold text-xs">
                      {edInitials}
                    </div>
                    <div className="text-[11px]">
                      <span className="font-bold text-[#0F172A] block">{edAuthor}</span>
                      <span className="text-slate-400">{edSubtext}</span>
                    </div>
                  </div>
                </div>
              );
            };

            const renderCorridorVoices = (key = 'corridor_voices') => {
              const corridorVoices = editorialDeskSettings?.voices_of_corridors && editorialDeskSettings.voices_of_corridors.length > 0
                ? editorialDeskSettings.voices_of_corridors.filter((v) => v.enabled !== false)
                : activeTelemetry.voices_of_corridors;

              if (!corridorVoices || corridorVoices.length === 0) return null;

              return (
                <div key={key} className="bg-[#efeeeb] p-5 rounded-2xl border border-slate-200 shadow-sm font-sans" data-purpose="corridor-voices">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F172A] mb-3 flex items-center gap-1.5">
                    <span>🗣️</span>
                    <span>Voices of the Corridors</span>
                  </h3>
                  <div className="space-y-3">
                    {corridorVoices.map((voice) => (
                      <div key={voice.id} className="p-3 bg-white rounded-xl shadow-sm border border-slate-200/60">
                        <p className="text-xs text-slate-800 font-serif mb-2 leading-relaxed">
                          “{voice.quote.replace(/^["“]|["”]$/g, '')}”
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans">
                          <span className="font-bold text-[#0891B2]">{voice.speaker}</span>
                          <span>{voice.location}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            };

            const renderMountainTransit = (key = 'mountain_transit') => (
              <div key={key} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-sans" data-purpose="mountain-transit">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F172A] flex items-center gap-1.5">
                    <span>🏔️</span>
                    <span>Mountain Transit Status</span>
                  </h3>
                  <Link href={`${langPrefix}/transit`} className="text-[10px] font-bold text-[#0891B2] hover:underline">
                    All Passes →
                  </Link>
                </div>
                <div className="space-y-2 text-xs">
                  {activeTelemetry.mountain_passes.slice(0, 4).map((pass) => (
                    <Link
                      key={pass.id}
                      href={`${langPrefix}/transit#${pass.id}`}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#f5f3f0] hover:bg-[#eae8e5] transition group"
                    >
                      <div>
                        <span className="font-bold text-[#0F172A] block group-hover:text-[#0891B2] transition">{pass.name}</span>
                        <span className="text-[10px] text-slate-500">{pass.advisory_title || pass.corridor}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          pass.status === 'open'
                            ? 'bg-emerald-100 text-emerald-800'
                            : pass.status === 'caution'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {pass.status_label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );

            const renderCivicPartner = (key = 'civic_partner') => {
              if (!isMonetizationActive || !activeTelemetry.civic_initiative) return null;
              return (
                <div key={key} className="p-5 bg-[#eae8e5] rounded-2xl border border-slate-300 shadow-sm text-center font-sans" data-purpose="civic-partner">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-2">
                    {activeTelemetry.civic_initiative.badge}
                  </span>
                  <div className="p-4 bg-white rounded-xl shadow-sm flex flex-col items-center">
                    <span className="text-3xl mb-1">☀️</span>
                    <h4 className="text-xs font-bold text-[#0F172A] mb-1 font-serif">
                      {activeTelemetry.civic_initiative.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
                      {activeTelemetry.civic_initiative.description}
                    </p>
                    <a
                      href={activeTelemetry.civic_initiative.cta_link}
                      className="px-3.5 py-1.5 bg-[#0F172A] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-slate-800 transition"
                    >
                      {activeTelemetry.civic_initiative.cta_text} →
                    </a>
                  </div>
                </div>
              );
            };

            const renderDiscoverWire = (key = 'discover_wire', mode: 'column' | 'full_width' = 'full_width') => {
              if (!discoverNews || discoverNews.length === 0) return null;
              if (mode === 'column') {
                return (
                  <div key={key} className="bg-[#0F172A] text-white p-5 rounded-2xl shadow-sm border border-slate-800 font-sans" data-purpose="discover-wire-column">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                        <span>🔭</span>
                        <span>Discover &amp; Science Wire</span>
                      </span>
                      <span className="text-[9px] font-mono text-cyan-300">Phys.org</span>
                    </div>
                    <div className="space-y-3">
                      {discoverNews.slice(0, 2).map((item) => (
                        <article key={item.id} className="pt-2 first:pt-0">
                          <div className="flex items-center justify-between text-[9px] mb-1 font-mono">
                            <span className="text-cyan-300 font-bold uppercase">{item.badge}</span>
                            <span className="text-slate-400">{item.source}</span>
                          </div>
                          <h4 className="font-serif text-xs font-bold text-slate-100 hover:text-cyan-300 leading-snug">
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              {item.title} <span className="text-[9px] text-slate-400">↗</span>
                            </a>
                          </h4>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <section key={key} className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto px-4 md:px-8 py-4 w-full font-sans" data-purpose="discover-wire-full">
                  <div className="bg-[#0F172A] text-white p-6 sm:p-7 rounded-2xl shadow-sm border border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 pb-3 border-b border-slate-800 gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            DISCOVER &amp; FRONTIER SCIENCES WIRE
                          </span>
                          <span className="text-xs text-slate-400 font-mono">Open Global Research &amp; Planetary Systems</span>
                        </div>
                        <h3 className="font-serif text-xl sm:text-2xl font-bold text-white">
                          Scientific Discoveries, Climate Models &amp; Clean Energy
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">Synced: Phys.org &amp; Global Labs</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {discoverNews.slice(0, 4).map((item) => (
                        <article
                          key={item.id}
                          className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-cyan-500/50 transition flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between text-[10px] mb-2 font-mono">
                              <span className="text-cyan-300 font-bold uppercase tracking-wide">{item.badge}</span>
                              <span className="text-slate-400 truncate max-w-[100px]">{item.source}</span>
                            </div>
                            <h4 className="font-serif text-sm font-bold text-slate-100 hover:text-cyan-300 leading-snug transition mb-2">
                              <a href={item.url} target="_blank" rel="noopener noreferrer">
                                {item.title} <span className="text-[10px] text-slate-400">↗</span>
                              </a>
                            </h4>
                            {item.summary && (
                              <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">{item.summary}</p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              );
            };

            const renderFieldDispatches = (key = 'field_dispatches', mode: 'column' | 'full_width' = 'full_width') => {
              if (!streamArticles || streamArticles.length === 0) return null;
              if (mode === 'column') {
                return (
                  <div key={key} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm font-sans space-y-3" data-purpose="field-dispatches-column">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs bg-slate-900 inline-block" />
                        <span>Field Dispatches</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{streamArticles.length} Stories</span>
                    </div>
                    <div className="space-y-3">
                      {streamArticles.slice(0, 4).map((art) => (
                        <article key={art.id} className="p-3 bg-[#f5f3f0] rounded-xl hover:bg-slate-100 transition">
                          <span className="text-[9.5px] font-bold text-[#0891B2] uppercase block mb-1">
                            {art.category} {art.district ? `• ${getDistrictDisplayName(art.district)}` : ''}
                          </span>
                          <h4 className="text-xs font-bold font-serif text-[#0F172A] leading-snug line-clamp-2">
                            <Link href={getArtHref(art)}>{art.title}</Link>
                          </h4>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <section key={key} className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto px-4 md:px-8 py-8 w-full font-sans" data-purpose="field-dispatches-full">
                  <div className="flex items-center justify-between pb-3 mb-6 border-b-2 border-slate-900">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 bg-slate-900 inline-block" />
                      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
                        Broadsheet Dispatches &amp; Regional Investigations
                      </h2>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      Showing {streamArticles.length} Verified Field Reports
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {streamArticles.map((art) => (
                      <article
                        key={art.id}
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                      >
                        <div>
                          {art.featured_image_url && (
                            <div className="relative w-full h-40 rounded-xl overflow-hidden bg-slate-100 mb-3.5">
                              <Image
                                src={getOptimizedMediaUrl(art.featured_image_url, 480)}
                                alt={art.title}
                                fill
                                sizes="(max-width: 1024px) 50vw, 320px"
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-800">
                              {art.category}
                            </span>
                            {art.district && (
                              <span className="text-[10px] font-semibold text-[#0891B2]">
                                {getDistrictDisplayName(art.district)}
                              </span>
                            )}
                          </div>
                          <h3 className="font-serif text-base font-bold text-[#0F172A] leading-snug mb-2 hover:text-[#0891B2] transition">
                            <Link href={getArtHref(art)}>{art.title}</Link>
                          </h3>
                          {art.excerpt && (
                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-3">{art.excerpt}</p>
                          )}
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <span>By {art.author_display_name || 'Correspondent'}</span>
                          <span suppressHydrationWarning>{formatArticleDate(art.published_at)}</span>
                        </div>
                      </article>
                    ))}
                  </div>

                  {leaderboardFeedAd && (
                    <div className="pt-6 font-sans">
                      <LeaderboardAd ad={leaderboardFeedAd} />
                    </div>
                  )}

                  {paginationMeta && (
                    <div className="pt-8 font-sans">
                      <PaginationControls meta={paginationMeta} theme={theme} />
                    </div>
                  )}
                </section>
              );
            };

            const renderWeatherSensors = (key = 'weather_sensors') => {
              if (!weather || weather.length === 0) return null;
              return (
                <section key={key} className="w-full bg-[#efeeeb] border-y border-slate-300/80 py-8 px-4 md:px-8 font-sans" data-purpose="weather-sensors">
                  <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-emerald-100 text-emerald-800">
                            Open-Source Sensor Stream
                          </span>
                          <span className="text-xs text-slate-500 font-mono">Open-Meteo Realtime Atmospheric Telemetry</span>
                        </div>
                        <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F172A]">
                          Territorial Meteorological &amp; Corridor Sensors
                        </h2>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Live 5-Min Verified Satellite Stream</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {weather.map((st) => (
                        <div key={st.station_id} className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
                          <div className="flex items-center justify-between mb-1 text-[10px] text-slate-500 font-mono">
                            <span className="font-bold uppercase text-[#0891B2] truncate">{st.region}</span>
                            <span>{st.elevation}</span>
                          </div>
                          <h4 className="text-xs font-bold text-[#0F172A] truncate mb-2">{st.name}</h4>
                          <div className="flex items-baseline justify-between">
                            <span className="font-serif text-2xl font-bold text-[#0F172A]">{st.temp_c}°C</span>
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {st.weather_desc}
                            </span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                            <span>Wind: {st.wind_kph} km/h</span>
                            <span
                              className={`font-bold capitalize ${
                                st.status === 'optimal' ? 'text-emerald-600' : st.status === 'harsh' ? 'text-blue-600' : 'text-amber-600'
                              }`}
                            >
                              {st.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            };

            const renderMandiTelemetry = (key = 'mandi_telemetry') => (
              <section key={key} className="w-full bg-[#FAF8F5] border-b border-slate-200 py-8 px-4 md:px-8 font-sans" data-purpose="mandi-telemetry">
                <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-2">
                    <div>
                      <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F172A]">
                        Agricultural &amp; Commodity Mandi Telemetry
                      </h2>
                      <p className="text-xs text-slate-600">
                        Direct spot pricing from registered terminal markets across Jammu, Srinagar, Sopore, and Kishtwar.
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                      <span className="text-emerald-600 font-bold">●</span>
                      <span>Terminal Feed Synced</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {activeTelemetry.mandi_commodities.slice(0, 4).map((item) => (
                      <div key={item.id} className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-slate-800 uppercase bg-slate-100 px-2 py-0.5 rounded">
                            {item.market_name}
                          </span>
                          <span
                            className={`text-[11px] font-bold ${
                              item.trend === 'up' ? 'text-emerald-600' : item.trend === 'down' ? 'text-red-600' : 'text-slate-500'
                            }`}
                          >
                            {item.change_pct} {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : ''}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#0F172A]">{item.commodity_name}</h4>
                        <p className="font-serif text-xl font-bold text-[#0F172A] my-1">
                          {item.price} <span className="text-xs font-normal text-slate-500 font-sans">{item.unit}</span>
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                          <span>{item.stat_left}</span>
                          <span className="font-semibold text-slate-700">{item.stat_right}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

            const renderFeatureDossiers = (key = 'feature_dossiers') => (
              <section key={key} className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto px-4 md:px-8 py-10 w-full font-sans" data-purpose="feature-dossiers">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <h2 className="font-serif text-2xl font-bold text-[#0F172A]">Corridor Feature Dossiers</h2>
                  </div>
                  <Link href={`${langPrefix}/latest`} className="text-xs font-bold uppercase tracking-wider text-[#0891B2] hover:underline">
                    Browse Complete Archives →
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dossierArticles.map((art, idx) => {
                    const badgeColors = [
                      'bg-emerald-100 text-emerald-800',
                      'bg-cyan-100 text-cyan-800',
                      'bg-blue-100 text-blue-800',
                      'bg-amber-100 text-amber-800',
                      'bg-purple-100 text-purple-800',
                      'bg-stone-200 text-stone-800',
                    ];
                    const badgeClass = badgeColors[idx % badgeColors.length];

                    return (
                      <article
                        key={art.id}
                        className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                      >
                        <div>
                          {art.featured_image_url && (
                            <div className="relative w-full h-40 bg-slate-100 overflow-hidden">
                              <Image
                                src={getOptimizedMediaUrl(art.featured_image_url, 480)}
                                alt={art.title}
                                fill
                                sizes="(max-width: 768px) 100vw, 360px"
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="p-5 space-y-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded inline-block ${badgeClass}`}>
                              {art.district ? getDistrictDisplayName(art.district) : 'Territorial Corridor'} • {art.category}
                            </span>
                            <h3 className="font-serif text-lg font-bold text-[#0F172A] leading-snug hover:text-[#0891B2] transition">
                              <Link href={getArtHref(art)}>{art.title}</Link>
                            </h3>
                            {art.excerpt && (
                              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{art.excerpt}</p>
                            )}
                          </div>
                        </div>
                        <div className="px-5 py-3 bg-[#f5f3f0] border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span>By {art.author_display_name || 'Correspondent'}</span>
                          <span suppressHydrationWarning>{formatArticleDate(art.published_at)}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );

            const renderSection = (id: HomepageSectionId, mode: 'column' | 'full_width' = 'column') => {
              switch (id) {
                case 'bureau_wire':
                  return renderBureauWire();
                case 'territorial_map':
                  return renderTerritorialMap();
                case 'conflict_radar':
                  return renderConflictRadar();
                case 'lead_hero_group':
                  return renderLeadHeroGroup();
                case 'civic_problems':
                  return renderCivicProblems();
                case 'international_wire':
                  return renderInternationalWire();
                case 'editorial_record':
                  return renderEditorialRecord();
                case 'corridor_voices':
                  return renderCorridorVoices();
                case 'mountain_transit':
                  return renderMountainTransit();
                case 'civic_partner':
                  return renderCivicPartner();
                case 'discover_wire':
                  return renderDiscoverWire('discover_wire', mode);
                case 'field_dispatches':
                  return renderFieldDispatches('field_dispatches', mode);
                case 'weather_sensors':
                  return renderWeatherSensors();
                case 'mandi_telemetry':
                  return renderMandiTelemetry();
                case 'feature_dossiers':
                  return renderFeatureDossiers();
                default:
                  return null;
              }
            };

            return (
              <>
                {/* 3-Column Broadsheet Trifold */}
                <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto px-4 md:px-8 py-8 w-full">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* LEFT COLUMN (3 cols) */}
                    <aside className="lg:col-span-3 space-y-6 font-sans">
                      {leftSectionIds.map((id) => renderSection(id, 'column'))}
                      {leftRailAd && (
                        <div className="sticky top-28 z-10 self-start">
                          <SidebarAd ad={leftRailAd} />
                        </div>
                      )}
                    </aside>

                    {/* CENTER COLUMN (6 cols) */}
                    <main className="lg:col-span-6 space-y-8 font-sans">
                      {centerSectionIds.map((id) => renderSection(id, 'column'))}
                    </main>

                    {/* RIGHT COLUMN (3 cols) */}
                    <aside className="lg:col-span-3 space-y-6 font-sans">
                      {rightSectionIds.map((id) => renderSection(id, 'column'))}
                      {sidebarAd && (
                        <div className="sticky top-28 z-10 self-start">
                          <SidebarAd ad={sidebarAd} />
                        </div>
                      )}
                    </aside>
                  </div>
                </div>

                {/* FULL-WIDTH LOWER SECTIONS */}
                {fullWidthBottomSectionIds.map((id) => renderSection(id, 'full_width'))}
              </>
            );
          })()}
        </div>

        {/* Unified Responsive Public Newspaper Footer (Mobile, Tablet & Desktop) */}
        <SiteFooter
          lang={lang}
          theme={theme}
          contactSettings={contactSettings}
          brandSettings={navbarSettings?.brand}
          variant={footerVariant}
        />
      </div>
    </div>
  );
}
