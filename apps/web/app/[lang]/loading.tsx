'use client';

import { useState, useEffect } from 'react';

export interface DistrictFact {
  id: string;
  name: string;
  division: 'Kashmir Valley' | 'Jammu Division' | 'Ladakh Frontier';
  moniker: string;
  famousFor: string;
  highlights: string[];
  fastFact: string;
}

export const JK_DISTRICT_FACTS: DistrictFact[] = [
  {
    id: 'pulwama',
    name: 'Pulwama',
    division: 'Kashmir Valley',
    moniker: 'The Saffron & Cricket Bat Capital of India',
    famousFor: 'World-renowned Kashmir Saffron (Kong) cultivated in the elevated karewas of Pampore with an exclusive GI tag, vast Golden Delicious apple orchards, the Sangam-Halmulla cricket bat manufacturing belt supplying international cricketers, and the historic 9th-century Avantishwar temple.',
    highlights: ['GI Kashmir Saffron (Pampore)', 'Kashmir Willow Bat Hub (Sangam)', 'Golden Apple Orchards', 'Ancient Avantishwar Ruins'],
    fastFact: 'Pampore is the only place in South Asia where saffron has been cultivated continuously for over 2,500 years.',
  },
  {
    id: 'srinagar',
    name: 'Srinagar',
    division: 'Kashmir Valley',
    moniker: 'The Summer Capital & UNESCO Creative City',
    famousFor: 'World-famous Dal and Nigeen Lakes with iconic handcrafted Shikaras, UNESCO Creative City for Crafts and Folk Arts, GI-certified hand-knotted silk carpets, delicate Pashmina shawls, historic Jamia Masjid, and imperial Mughal Gardens (Shalimar & Nishat).',
    highlights: ['GI Hand-Knotted Silk Carpets', 'Dal Lake & Houseboats', 'Mughal Terraced Gardens', 'Pashmina & Papier-Mâché'],
    fastFact: 'Srinagar was designated a UNESCO Creative City of Crafts & Folk Arts for its centuries-old artisanal guilds.',
  },
  {
    id: 'reasi',
    name: 'Reasi',
    division: 'Jammu Division',
    moniker: 'World’s Highest Rail Arch Bridge & Sacred Shrines',
    famousFor: 'Home to the World’s Highest Railway Arch Bridge over the Chenab River (359 meters high, 35m taller than the Eiffel Tower), the sacred pilgrimage Shrine of Shri Mata Vaishno Devi at Katra, the historic Bhimgarh Fort, and the Shiv Khori cave shrine.',
    highlights: ['Chenab Arch Rail Bridge (359m)', 'Mata Vaishno Devi Shrine', 'Historic Bhimgarh Fort', 'Shiv Khori Cave'],
    fastFact: 'The Chenab Rail Bridge stands 359 meters above the river bed, engineered to withstand blast forces and earthquake intensity up to Zone V.',
  },
  {
    id: 'anantnag',
    name: 'Anantnag (Islamabad)',
    division: 'Kashmir Valley',
    moniker: 'Land of Countless Springs & Ancient Sun Temples',
    famousFor: 'Gushing freshwater springs of Verinag (origin of River Jhelum), Kokernag botanical springs, Achabal royal Mughal cascades, the magnificent 8th-century Martand Sun Temple, and the primary industrial hub for export-quality Kashmir Willow cricket bats.',
    highlights: ['Verinag (Jhelum River Source)', 'Martand Sun Temple', 'Kokernag Botanical Springs', 'Kashmir Willow Bat Industry'],
    fastFact: 'The 8th-century Martand Sun Temple built by King Lalitaditya Muktapida is one of the grandest stone architectures in Indian history.',
  },
  {
    id: 'kathua',
    name: 'Kathua',
    division: 'Jammu Division',
    moniker: 'Gateway to J&K & Cradle of Basohli Art',
    famousFor: 'World-heritage Basohli Miniature Painting school (GI Tagged) celebrated for intense colors and deep expressive eyes, the vast freshwater lake of Ranjit Sagar Dam, historic Jasrota Fort ruins, and the primary cultural and industrial gateway to Jammu and Kashmir.',
    highlights: ['GI Basohli Miniature Paintings', 'Ranjit Sagar Dam Basin', 'Gateway to Jammu & Kashmir', 'Jasrota Wildlife Sanctuary'],
    fastFact: 'Basohli paintings received the prestigious Geographical Indication (GI) tag in 2023, the first craft from Jammu division to be awarded.',
  },
  {
    id: 'doda',
    name: 'Doda',
    division: 'Jammu Division',
    moniker: 'Lavender Capital of India & The Purple Revolution',
    famousFor: 'The historic epicenter of India’s Purple Revolution in Bhaderwah (often called Mini Kashmir), high-altitude meadows of Jai and Guldanda, pristine pine forests, and massive production of therapeutic Lavender oil under the CSIR Aroma Mission.',
    highlights: ['Purple Revolution (Lavender Capital)', 'Bhaderwah Valley', 'Jai & Padri High Meadows', 'Chenab River Basin'],
    fastFact: 'Bhaderwah farmers sparked India’s national Purple Revolution under the Aroma Mission, replacing traditional maize with high-value lavender.',
  },
  {
    id: 'baramulla',
    name: 'Baramulla',
    division: 'Kashmir Valley',
    moniker: 'Gateway of Kashmir & Sopore Fruit Hub',
    famousFor: 'Sopore fruit market (the second-largest wholesale fruit mandi in Asia), the gateway to the world-famous ski resort of Gulmarg and Apharwat Peak, the ancient Buddhist stupa of Ushkar, and the historic course of the Jhelum River entering the gorge.',
    highlights: ['Sopore Fruit Mandi (Asia’s 2nd Largest)', 'Gateway to Gulmarg Ski Slopes', 'Eco-Tourism in Uri', 'Ancient Ushkar Stupa'],
    fastFact: 'Sopore mandi trades over 1.5 million metric tons of fresh apples and pears annually to markets across India and abroad.',
  },
  {
    id: 'shopian',
    name: 'Shopian',
    division: 'Kashmir Valley',
    moniker: 'The Apple Bowl of Kashmir',
    famousFor: 'Renowned for producing the highest density of premium export-quality A-grade delicious apples in India, the historical staging pass of the Mughal Road over Peer Ki Gali, and the biodiverse Hirpora Wildlife Sanctuary protecting the endangered Markhor goat.',
    highlights: ['India’s Premier Apple Bowl', 'Historic Mughal Road Pass', 'Peer Ki Gali Scenic Pass', 'Hirpora Markhor Sanctuary'],
    fastFact: 'Shopian apples are famous for their deep crimson blush, high sugar content, and exceptional shelf life.',
  },
  {
    id: 'kishtwar',
    name: 'Kishtwar',
    division: 'Jammu Division',
    moniker: 'Land of Sapphire, Saffron & Hydro Energy',
    famousFor: 'World-rare, velvety cornflower-blue Sapphires of Paddar (unmatched in gemstone quality), high-plateau Kishtwar Saffron, pristine trekking valleys of Marwah and Wadwan, and the largest clean hydroelectric energy cluster in northern India.',
    highlights: ['Rare Paddar Blue Sapphires', 'Kishtwar High-Altitude Saffron', 'Marwah-Wadwan Valleys', 'Hydroelectric Power Hub'],
    fastFact: 'Paddar sapphires found at 4,500m in Kishtwar are regarded by gemologists worldwide as having the rarest cornflower-blue optical brilliance.',
  },
  {
    id: 'bandipora',
    name: 'Bandipora',
    division: 'Kashmir Valley',
    moniker: 'Land of Alim, Adab & Aab (Knowledge, Art & Water)',
    famousFor: 'Hosts Wular Lake (one of Asia’s largest freshwater lakes and prime Ramsar wetland), the premier harvest center for water chestnuts (Singhara) and freshwater fish, and the scenic mountain gateway leading to the pristine border paradise of Gurez Valley.',
    highlights: ['Wular Lake (Ramsar Wetland)', 'Singhara (Water Chestnut) Harvest', 'Gateway to Gurez Valley', 'Kishan-Ganga Hydro Corridor'],
    fastFact: 'Wular Lake acts as a natural flood reservoir for the entire Kashmir valley and supports over 60% of the valley’s local freshwater fish harvest.',
  },
  {
    id: 'ganderbal',
    name: 'Ganderbal',
    division: 'Kashmir Valley',
    moniker: 'District of Alpine Lakes & Sindh River',
    famousFor: 'The Meadow of Gold Sonamarg, the emerald waters of Sindh River known for brown and rainbow trout angling, the sacred Kheer Bhawani Shrine at Tulmulla, and the starting trailhead for the Great Alpine Lakes trek (Gangabal, Vishansar, Gadsar).',
    highlights: ['Sonamarg (Meadow of Gold)', 'Kheer Bhawani Sacred Shrine', 'Great Alpine Lakes (Gangabal)', 'Sindh River Trout Angling'],
    fastFact: 'Gangabal Lake situated at the foot of Mount Harmukh (5,142m) is held in deep reverence and is known as the Ganga of Kashmir.',
  },
  {
    id: 'budgam',
    name: 'Budgam',
    division: 'Kashmir Valley',
    moniker: 'Cradle of Sufism & Rolling Meadow Glades',
    famousFor: 'The historic shrine of Sheikh Noor-ud-Din Noorani (Nund Rishi) at Charar-i-Sharief, the whispering pine meadows of Doodhpathri (Valley of Milk), the tranquil pastures of Yusmarg, and traditional Kani shawl craftsmanship in rural hamlets.',
    highlights: ['Charar-i-Sharief Sufi Shrine', 'Doodhpathri (Valley of Milk)', 'Yusmarg Alpine Glades', 'Traditional Kani Shawl Weaving'],
    fastFact: 'Kani shawls from Budgam are woven with wooden needles (kanis) and can take up to a year of artisan labor per single masterpiece.',
  },
  {
    id: 'kupwara',
    name: 'Kupwara',
    division: 'Kashmir Valley',
    moniker: 'The Emerald Frontier of Lolab & Bungus',
    famousFor: 'The untouched dense deodar forests of Lolab Valley (praised by poet Allama Iqbal), the high-altitude untouched meadow expanse of Bungus Valley, ancient spring corridors of Sharda Peeth, and rich walnut exports.',
    highlights: ['Pristine Lolab Valley', 'Bungus Eco-Paradise Meadow', 'Kalaroos Ancient Caves', 'High-Yield Organic Walnuts'],
    fastFact: 'Bungus Valley is a pristine 300-sq-km alpine grassland bowl surrounded by snow-capped Rajwar and Shamsabari mountain ranges.',
  },
  {
    id: 'kulgam',
    name: 'Kulgam',
    division: 'Kashmir Valley',
    moniker: 'Rice Bowl of Kashmir & Aharbal Falls',
    famousFor: 'Extensive fertile paddy landscapes earning the moniker Rice Bowl, the roaring 25-meter Aharbal Waterfall (frequently termed the Niagara of Kashmir), and the venerated shrine of Hazrat Syed Simnani in the town center.',
    highlights: ['Aharbal Waterfall (Niagara of J&K)', 'Rice Bowl of the Valley', 'Veshaw River Trout Basin', 'Hazrat Syed Simnani Shrine'],
    fastFact: 'The Veshaw River crashing over Aharbal’s granite gorge creates one of the most powerful natural acoustic echoes in the Himalayas.',
  },
  {
    id: 'jammu',
    name: 'Jammu',
    division: 'Jammu Division',
    moniker: 'The City of Temples & Royal Dogra Seat',
    famousFor: 'The Winter Capital of J&K, ancient 3,000-year-old Bahu Fort and Bawe Wali Mata Temple, the grand Mubarak Mandi Royal Palace complex, Raghunath Temple, and the historic cultural lifeline of the Surya Putri Tawi River.',
    highlights: ['Bahu Fort & Bagh-e-Bahu', 'Mubarak Mandi Dogra Palace', 'Historic Raghunath Temple', 'Tawi Riverfront & Trade Hub'],
    fastFact: 'Bahu Fort is believed to be the oldest standing fortification in Jammu city, originally founded by Raja Bahulochan over 3,000 years ago.',
  },
  {
    id: 'poonch',
    name: 'Poonch',
    division: 'Jammu Division',
    moniker: 'Historic Frontier & Noori Chamb Falls',
    famousFor: 'The commanding 18th-century Poonch Fort overlooking the Betar river, the historic Noori Chamb waterfall named after Mughal Empress Nur Jahan, the revered Swami Buddha Amarnath Temple at Mandi, and the rugged passes of the Pir Panjal.',
    highlights: ['Historic Poonch Fort', 'Noori Chamb Royal Waterfall', 'Swami Buddha Amarnath Shrine', 'Pir Panjal Border Valleys'],
    fastFact: 'Empress Nur Jahan was so enchanted by the silver cascades of Noori Chamb that an imperial mirror was mounted for her to gaze upon the mist.',
  },
  {
    id: 'rajouri',
    name: 'Rajouri',
    division: 'Jammu Division',
    moniker: 'Vale of Seven Lakes & Mughal Passages',
    famousFor: 'Chingus Sarai on the Mughal Road (where Emperor Jahangir’s mortal remains were preserved), the alpine lakes of Kotranka (Seven Lakes / Kator Sar), the historical fort of Dhanidhar, and traditional Chikri woodcraft.',
    highlights: ['Chingus Sarai on Mughal Road', 'Seven Alpine Lakes of Kotranka', 'Dhanidhar Historical Fort', 'Traditional Chikri Woodcraft'],
    fastFact: 'Chikri woodcraft from Rajouri is a traditional art of carving fine-grained pale yellow wood into intricate combs, boxes, and heirlooms.',
  },
  {
    id: 'udhampur',
    name: 'Udhampur',
    division: 'Jammu Division',
    moniker: 'Northern Command HQ & Ancient Krimchi Temples',
    famousFor: 'Strategic headquarters of the Indian Army’s Northern Command, the 8th-century Krimchi group of temples (popularly known as Pandava Temples with classical Nagara architecture), and the holy Devika stream revered as the elder sister of River Ganga.',
    highlights: ['Krimchi 8th-Century Temples', 'Northern Army Command HQ', 'Sacred Devika River Stream', 'Gateway to Patnitop Hills'],
    fastFact: 'The Krimchi temple complex consists of five stone temples with exquisite carvings dating back to the 8th–9th century CE.',
  },
  {
    id: 'ramban',
    name: 'Ramban',
    division: 'Jammu Division',
    moniker: 'Chenab Gorges & Railway Engineering Hub',
    famousFor: 'The picturesque hill resorts of Patnitop and Sanasar with cedar forest canopies, the dramatic Chenab river canyon, and the historic 12.75 km T-49 tunnel — the longest transportation railway tunnel in India on the USBRL link.',
    highlights: ['T-49 Longest Rail Tunnel (12.75km)', 'Patnitop & Sanasar Hill Resorts', 'Chenab River Canyon', 'Banihal Pass Route'],
    fastFact: 'Tunnel T-49 between Sumber and Arpinchala in Ramban is India’s longest railway tunnel, exceeding the famous Pir Panjal tunnel.',
  },
  {
    id: 'samba',
    name: 'Samba',
    division: 'Jammu Division',
    moniker: 'Land of Brave Martyrs & Traditional Chhint',
    famousFor: 'Centuries-old heritage of traditional hand-block Calico printing (Samba Chhint), the 19th-century Samba Fort situated on a hillock, and an illustrious legacy of producing high decorations of military valor for the Indian Armed Forces.',
    highlights: ['Samba Chhint (Calico Printing)', 'Historical Samba Fort', 'Land of Gallantry & Warriors', 'Mansar Lake Heritage Corridor'],
    fastFact: 'Samba is traditionally revered as the "City of Warriors" due to its legendary contribution of decorated officers to the Indian Armed Forces.',
  },
  {
    id: 'kargil',
    name: 'Kargil',
    division: 'Ladakh Frontier',
    moniker: 'Himalayan Crossroads & Majestic Suru Valley',
    famousFor: 'The breathtaking Suru Valley with panoramic views of the Nun and Kun Himalayan twin peaks (7,135m), ancient rock-carved Maitreya Buddha statues in Mulbekh, the Zojila Pass & Tunnel lifeline, and rich apricot fruit orchards.',
    highlights: ['Nun-Kun Mountain Peaks (7,135m)', 'Mulbekh Giant Rock Buddha', 'Suru Alpine Valley', 'Apricot (Raktsey Karpo) Orchards'],
    fastFact: 'Ladakhi Shakarpara and Raktsey Karpo apricots from Kargil are renowned for having the highest natural brix sweetness index in the world.',
  },
  {
    id: 'leh',
    name: 'Leh',
    division: 'Ladakh Frontier',
    moniker: 'High-Altitude Cold Desert & Ancient Gompas',
    famousFor: 'The turquoise high-altitude saline lakes of Pangong Tso and Tso Moriri, Khardung La (one of the highest motorable passes at 5,359m), the 17th-century Leh Palace, and magnificent Tibetan Buddhist monasteries of Hemis, Thiksey, and Diskit in Nubra.',
    highlights: ['Pangong Tso & Tso Moriri Lakes', 'Khardung La Pass (5,359m)', 'Thiksey & Hemis Monasteries', 'Nubra Valley Sand Dunes'],
    fastFact: 'Pangong Tso located at 4,225m changes colors through azure blue, turquoise green, and indigo as the sun moves across the Himalayan sky.',
  },
];

export default function Loading() {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [activeDistrictIndex, setActiveDistrictIndex] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [fadeState, setFadeState] = useState<'fade-in' | 'fade-out'>('fade-in');

  // Detect theme (light vs dark w.r.t active template)
  useEffect(() => {
    const checkTheme = () => {
      const themeAttr = document.documentElement.getAttribute('data-theme');
      if (themeAttr === 'dark') {
        setIsDark(true);
      } else if (themeAttr === 'light') {
        setIsDark(false);
      } else {
        const isDarkSys = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(isDarkSys);
      }
    };

    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  // Smoothly rotate through J&K districts every 3.5 seconds
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setFadeState('fade-out');
      setTimeout(() => {
        setActiveDistrictIndex((prev) => (prev + 1) % JK_DISTRICT_FACTS.length);
        setFadeState('fade-in');
      }, 250);
    }, 3800);
    return () => clearInterval(interval);
  }, [autoRotate]);

  const currentDistrict = JK_DISTRICT_FACTS[activeDistrictIndex] ?? JK_DISTRICT_FACTS[0];

  const handleNextDistrict = () => {
    setAutoRotate(false);
    setFadeState('fade-out');
    setTimeout(() => {
      setActiveDistrictIndex((prev) => (prev + 1) % JK_DISTRICT_FACTS.length);
      setFadeState('fade-in');
    }, 150);
  };

  const handlePrevDistrict = () => {
    setAutoRotate(false);
    setFadeState('fade-out');
    setTimeout(() => {
      setActiveDistrictIndex((prev) => (prev - 1 + JK_DISTRICT_FACTS.length) % JK_DISTRICT_FACTS.length);
      setFadeState('fade-in');
    }, 150);
  };

  const handleSelectDistrict = (index: number) => {
    setAutoRotate(false);
    setFadeState('fade-out');
    setTimeout(() => {
      setActiveDistrictIndex(index);
      setFadeState('fade-in');
    }, 150);
  };

  return (
    <div
      className={`min-h-[85vh] flex flex-col items-center justify-center px-4 py-12 transition-colors duration-200 select-none ${isDark ? 'bg-transparent text-slate-100' : 'bg-transparent text-slate-900'
        }`}
    >
      {/* 1. Animated Newsroom Aperture & Orbital Pulse (NO dummy skeleton!) */}
      <div className="flex flex-col items-center text-center max-w-xl mx-auto mb-8">
        <div className="relative flex items-center justify-center w-24 h-24 mb-5">
          {/* Outer radial glow */}
          <div
            className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${isDark
                ? 'bg-gradient-to-tr from-amber-500/20 via-red-500/20 to-cyan-500/20'
                : 'bg-gradient-to-tr from-red-500/15 via-amber-400/20 to-emerald-400/15'
              }`}
          />

          {/* Outer pulsing ring */}
          <span className="absolute inset-0 rounded-full border border-red-500/30 animate-ping opacity-60" />

          {/* Rotating dashed orbital compass */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-red-500/40 animate-[spin_12s_linear_infinite]" />

          {/* Inner counter-rotating gradient arc */}
          <div className="absolute inset-2 rounded-full border-2 border-t-red-600 border-r-amber-500 border-b-transparent border-l-transparent animate-[spin_2s_linear_infinite]" />

          {/* Center Brand Emblem Badge */}
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-red-600 via-rose-700 to-amber-600 text-white font-serif font-black text-2xl shadow-red-950/20 ring-4 ring-white/50 dark:ring-slate-900/50">
            K
          </div>
        </div>

        {/* Brand Tagline & Live Radar status */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono font-semibold tracking-wider uppercase backdrop-blur-xs transition-colors duration-200 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
            </span>
            <span className={isDark ? 'text-red-400' : 'text-red-700'}>
              KJIN Newsdesk • Live Dispatch Relay
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Connecting Jammu &amp; Kashmir Field Bureaus
          </h1>

          <p
            className={`text-xs sm:text-sm font-mono tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
          >
            Fetching verified journalism across 22 districts...
          </p>
        </div>

        {/* Animated Gradient Progress Indicator */}
        <div
          className={`w-64 h-1.5 rounded-full overflow-hidden mt-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'
            }`}
        >
          <div className="h-full w-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 animate-[pulse_1.5s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* 2. Engaging J&K District Heritage Spotlight Card (What each district is famous for!) */}
      <div
        className={`w-full max-w-2xl rounded-3xl p-6 sm:p-8 transition-all duration-300 shadow-xl border ${isDark
            ? 'bg-slate-900/90 border-slate-800/80 shadow-slate-950/40 text-slate-100'
            : 'bg-white border-amber-200/90 shadow-amber-950/5 text-slate-900'
          }`}
      >
        {/* Card Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-xs ${isDark
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}
            >
              🏔️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  J&amp;K District Heritage Spotlight
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${isDark
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : 'bg-amber-50 text-amber-900 border border-amber-200'
                    }`}
                >
                  {currentDistrict.division}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
                {currentDistrict.name}
              </h2>
            </div>
          </div>

          {/* Previous / Next Controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto font-mono text-xs">
            <button
              type="button"
              onClick={handlePrevDistrict}
              className={`px-3 py-1.5 rounded-xl border transition active:scale-95 cursor-pointer ${isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-xs'
                }`}
              aria-label="Previous District"
            >
              ◀ Prev
            </button>
            <span
              className={`px-2 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
            >
              {activeDistrictIndex + 1} / {JK_DISTRICT_FACTS.length}
            </span>
            <button
              type="button"
              onClick={handleNextDistrict}
              className={`px-3 py-1.5 rounded-xl border transition active:scale-95 cursor-pointer ${isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-xs'
                }`}
              aria-label="Next District"
            >
              Next ▶
            </button>
          </div>
        </div>

        {/* Animated District Content with Smooth Fade */}
        <div
          className={`transition-opacity duration-200 ${fadeState === 'fade-in' ? 'opacity-100' : 'opacity-20'
            }`}
        >
          {/* Moniker / Title */}
          <div className="mb-3.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-red-700 dark:text-red-400 font-bold block mb-0.5">
              Famed Identity:
            </span>
            <p className="text-base sm:text-lg font-serif italic font-semibold text-slate-800 dark:text-slate-200">
              &ldquo;{currentDistrict.moniker}&rdquo;
            </p>
          </div>

          {/* What It Is Famous For */}
          <div className="mb-5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-1">
              What This District Is Famous For:
            </span>
            <p className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300">
              {currentDistrict.famousFor}
            </p>
          </div>

          {/* Key Heritage Highlights Pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {currentDistrict.highlights.map((highlight, idx) => (
              <span
                key={idx}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${isDark
                    ? 'bg-slate-800/90 text-amber-300 border-amber-500/30'
                    : 'bg-amber-50 text-amber-950 border-amber-300/80 font-semibold shadow-2xs'
                  }`}
              >
                ✦ {highlight}
              </span>
            ))}
          </div>

          {/* Did You Know? Fast Fact Callout */}
          <div
            className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed flex items-start gap-3 transition-colors duration-200 ${isDark
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                : 'bg-amber-50/80 border-amber-300/70 text-amber-950'
              }`}
          >
            <span className="text-xl select-none mt-0.5">💡</span>
            <div>
              <span className="font-bold uppercase tracking-wider text-[11px] font-mono block mb-0.5">
                Did you know?
              </span>
              <span>{currentDistrict.fastFact}</span>
            </div>
          </div>
        </div>

        {/* Interactive District Quick Switcher Chips */}
        <div className="mt-6 pt-5 border-t border-amber-500/20">
          <div className="flex items-center justify-between mb-3 text-[11px] font-mono">
            <span className="text-slate-500 uppercase font-semibold">
              Tap any district to explore heritage:
            </span>
            <span className="text-slate-400">
              {autoRotate ? 'Auto-cycling' : 'Selected'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {JK_DISTRICT_FACTS.map((district, idx) => (
              <button
                key={district.id}
                type="button"
                onClick={() => handleSelectDistrict(idx)}
                className={`text-xs font-mono px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer ${activeDistrictIndex === idx
                    ? isDark
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-amber-800 text-white font-bold shadow-xs'
                    : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-slate-100 hover:bg-amber-100/70 text-slate-700 border border-slate-200'
                  }`}
              >
                {district.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
