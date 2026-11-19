/**
 * Authoritative District & Town Dossiers for Jammu, Kashmir, and Ladakh
 * Powers SEO-rich introductions, local demographics, and geographical context.
 */

export interface DistrictDossier {
  name: string;
  tagline: string;
  intro: string;
  headquarters: string;
  keyArteries: string;
  primaryEconomy: string;
  specialStatus: string;
}

export const DISTRICT_DOSSIERS: Record<string, DistrictDossier> = {
  doda: {
    name: 'Doda',
    tagline: 'Chenab Valley Mountain Basin & Highland Corridors',
    intro: 'Doda is a prominent mountain district in the Chenab Valley, framed by the Great Himalayan and Pir Panjal ranges. The district is characterized by steep river gorge topography along the Chenab, terraced walnut and olive groves, and high-altitude administrative blocks connecting Bhaderwah, Thathri, and Gandoh.',
    headquarters: 'Doda Town',
    keyArteries: 'NH-244 (Batote-Kishtwar-Sinthan Highway), Pul Doda link',
    primaryEconomy: 'Horticulture (Walnuts & Apples), Hydropower, Forest Products',
    specialStatus: 'Chenab Valley Ground Bureau Hub',
  },
  bhaderwah: {
    name: 'Bhaderwah',
    tagline: 'Chota Kashmir, Deodar Highland Valley & Floriculture Belt',
    intro: 'Bhaderwah is a renowned high-altitude valley basin in the Chenab region, historically known as Chota Kashmir. Situated at 1,613 meters, it is surrounded by dense Himalayan deodar forests, alpine meadows, and the sacred Kailash Kund peak. It serves as an active hub for lavender cultivation, trout fisheries, and winter sports telemetry.',
    headquarters: 'Bhaderwah',
    keyArteries: 'Bhaderwah-Bani-Basohli Road, Bhaderwah-Chamba Border Link',
    primaryEconomy: 'Aroma Mission (Lavender), Floriculture, Eco-Tourism, Trout Aquaculture',
    specialStatus: 'Sub-District Mountain Tourism & Agricultural Corridor',
  },
  kishtwar: {
    name: 'Kishtwar',
    tagline: 'Land of Saffron, Sapphires & Hydropower Mega-Corridors',
    intro: 'Kishtwar forms the eastern mountainous bulwark of the Chenab Valley, bordering Ladakh and Himachal Pradesh. Famous for its Paddar sapphire mines and Kishtwari saffron, it is currently the focal center of India\'s largest run-of-the-river hydropower developments along the Chenab river basin.',
    headquarters: 'Kishtwar Town',
    keyArteries: 'NH-244, Sinthan Pass (connecting to Anantnag), Paddar Highway',
    primaryEconomy: 'Hydropower (Pakal Dul, Dul Hasti, Ratle), Saffron, Handicrafts',
    specialStatus: 'High-Altitude Strategic Energy & Mineral Corridor',
  },
  ramban: {
    name: 'Ramban',
    tagline: 'NH-44 Mountain Transit Arteries & Chenab Railway Hub',
    intro: 'Ramban occupies the central transit corridor of Jammu & Kashmir along the Chenab River gorge. It is the critical logistics gateway hosting the highest railway arch bridge in the world, the Banihal-Qazigund railway tunnel, and the landslide-prone Panthyal and Mehar bypasses on NH-44.',
    headquarters: 'Ramban Town',
    keyArteries: 'Jammu-Srinagar National Highway (NH-44), USBRL Railway Line',
    primaryEconomy: 'Highway Logistics, Rail Transit Infrastructure, Mountain Agriculture',
    specialStatus: 'Territorial Highway & Rail Telemetry Operations Hub',
  },
  poonch: {
    name: 'Poonch',
    tagline: 'Pir Panjal Border Highlands & Historic Mughal Road Gate',
    intro: 'Poonch is a historic frontier district situated on the southern slopes of the Pir Panjal range along the Line of Control. Surrounded by three sides by border perimeters, it encompasses the high-altitude Peer Ki Gali mountain pass (3,490m), the Surankote valley, and the historic Poonch Fort.',
    headquarters: 'Poonch Town',
    keyArteries: 'Mughal Road (NH-144A), Poonch-Rawalakot Cross-LoC Artery',
    primaryEconomy: 'Border Trade, Livestock Pastoralism, Mountain Maize & Walnuts',
    specialStatus: 'Pir Panjal Highland Security & Trans-Range Transit Desk',
  },
  rajouri: {
    name: 'Rajouri',
    tagline: 'Shivalik Foothills, Border Belt & Higher Education Center',
    intro: 'Rajouri links the Jammu plains to the Pir Panjal highlands, acting as an administrative, defense, and educational powerhouse. It is home to Baba Ghulam Shah Badshah University (BGSBU), expansive olive orchards, and vital forward defense lines in Nowshera, Sunderbani, and Thanamandi.',
    headquarters: 'Rajouri',
    keyArteries: 'NH-144A (Jammu-Poonch Corridor), Thanamandi-Buffliaz Link',
    primaryEconomy: 'Defense Services, University Academics, Agriculture, Olive Cultivation',
    specialStatus: 'Pir Panjal Administrative & Educational Command Desk',
  },
  leh: {
    name: 'Leh',
    tagline: 'Trans-Himalayan Capital, Khardung La & Changthang Nomads',
    intro: 'Leh is the capital of the Union Territory of Ladakh, situated at 3,500 meters in the upper Indus River basin. It spans the world\'s highest motorable mountain passes (Khardung La, Chang La), the nomadic Changthang pashmina pasturelands, and rapid solar microgrid clean energy transitions.',
    headquarters: 'Leh',
    keyArteries: 'Leh-Srinagar Highway (NH-1D via Zojila), Leh-Manali Highway',
    primaryEconomy: 'Pashmina Wool Processing, Solar Energy, Himalayan Tourism, Military Logistics',
    specialStatus: 'Ladakh Autonomous Hill Development Council Regional Desk',
  },
  kargil: {
    name: 'Kargil',
    tagline: 'Zojila Pass Gateway, Suru Valley & High-Altitude Defense',
    intro: 'Kargil lies at the crossroads of Kashmir, Ladakh, and Baltistan along the Suru and Wakha rivers. Anchored by the Drass sector—one of the coldest inhabited places on Earth—Kargil represents resilience, high-altitude border defense, and world-renowned Halman and Raktsey Karpo organic apricot harvests.',
    headquarters: 'Kargil Town',
    keyArteries: 'NH-1D (Srinagar-Leh Highway), Zojila Tunnel, Kargil-Zanskar Road',
    primaryEconomy: 'Organic Apricots (Raktsey Karpo), Cross-Mountain Logistics, Defense Services',
    specialStatus: 'Ladakh Frontier Transit & Mountain Defense Surveillance',
  },
  srinagar: {
    name: 'Srinagar',
    tagline: 'Summer Capital of J&K, Dal Lake & World Heritage Crafts',
    intro: 'Srinagar is the historic summer capital of Jammu and Kashmir, resting in the heart of the Kashmir Valley along both banks of the River Jhelum. Globally acclaimed for Dal Lake, Mughal gardens, and centuries-old artisan guilds producing certified Pashmina shawls, wood carving, and paper-mâché.',
    headquarters: 'Srinagar City',
    keyArteries: 'NH-44 (Pan-India Highway), Boulevard Road, Srinagar Ring Road',
    primaryEconomy: 'Handicrafts & Handlooms, International Tourism, Horticulture, Commerce',
    specialStatus: 'Central Editorial Headquarters & Directorate Operations',
  },
  pulwama: {
    name: 'Pulwama',
    tagline: 'Saffron Capital of India & Jhelum Karewa Agricultural Hub',
    intro: 'Pulwama is the agricultural and industrial nucleus of South Kashmir, encompassing the legendary saffron karewas of Pampore and major milk production cooperatives. It hosts premier high-density apple orchards, cold-atmosphere storage hubs, and prestigious research universities.',
    headquarters: 'Pulwama Town',
    keyArteries: 'NH-44 Expressway, Awantipora-Tral Corridor, Industrial Growth Centre IGC',
    primaryEconomy: 'GI-Tagged Saffron (Lacha & Mongra), Dairy Production, Apple Warehousing',
    specialStatus: 'Specialist Agriculture, Horticulture & GI-Tagging Desk',
  },
  anantnag: {
    name: 'Anantnag',
    tagline: 'South Kashmir Commercial Capital & High-Altitude Springs',
    intro: 'Anantnag is the southern gateway to the Kashmir Valley, renowned for its perennial freshwater springs, trout hatcheries at Kokernag, and apple wholesale markets. It serves as the primary base for the annual Amarnath Yatra pilgrimage circuit via Pahalgam.',
    headquarters: 'Anantnag Town',
    keyArteries: 'NH-44, Anantnag-Kishtwar Highway (via Sinthan Top), Pahalgam Road',
    primaryEconomy: 'Apple Wholesale Mandis, Kokernag Trout Hatcheries, Tourism & Willow Bats',
    specialStatus: 'South Kashmir Commercial, Fisheries & Pilgrimage Desk',
  },
  baramulla: {
    name: 'Baramulla',
    tagline: 'North Kashmir Gateway, Jhelum Gorge & Gulmarg Slopes',
    intro: 'Baramulla is North Kashmir\'s primary administrative and commercial city, positioned where the Jhelum river flows out toward the border gorge. It encompasses Gulmarg\'s world-class ski slopes, extensive apple orchards in Sopore, and critical railway links to Banihal.',
    headquarters: 'Baramulla Town',
    keyArteries: 'Srinagar-Baramulla-Uri Highway (NH-1), Sopore Mandi Link, USBRL Railway',
    primaryEconomy: 'Sopore Apple Fruit Mandi (Asia\'s 2nd Largest), Winter Sports Tourism, Timber',
    specialStatus: 'North Kashmir Regional Command & Horticulture Desk',
  },
  jammu: {
    name: 'Jammu',
    tagline: 'Winter Capital, City of Temples & Tawi Commercial Basin',
    intro: 'Jammu is the winter capital and largest metropolitan city of the Union Territory, situated on the banks of the Tawi River overlooking the Shivalik foothills. It acts as the central railhead, industrial center, and gateway for millions of Vaishno Devi pilgrims annually.',
    headquarters: 'Jammu City',
    keyArteries: 'NH-44, Jammu-Udhampur Expressway, Jammu Ring Road, Tawi River Arteries',
    primaryEconomy: 'Manufacturing, Trade Mandis, Tertiary Healthcare, Rail & Air Transport',
    specialStatus: 'Jammu Division Bureau & High Court Legal Desk',
  },
};

export function getDistrictDossier(slug: string): DistrictDossier {
  const norm = (slug || '').toLowerCase().trim();
  if (DISTRICT_DOSSIERS[norm]) {
    return DISTRICT_DOSSIERS[norm];
  }

  const capitalized = norm.charAt(0).toUpperCase() + norm.slice(1);
  return {
    name: capitalized,
    tagline: `${capitalized} District Field Coverage & Public Affairs`,
    intro: `Authoritative ground reporting, verified civic infrastructure dispatches, and public interest updates from ${capitalized} district, Jammu and Kashmir.`,
    headquarters: `${capitalized} Town`,
    keyArteries: 'District Highway Artery Network',
    primaryEconomy: 'Regional Agriculture, Public Sector Services, Local Commerce',
    specialStatus: 'Verified Grassroots Field Desk',
  };
}
