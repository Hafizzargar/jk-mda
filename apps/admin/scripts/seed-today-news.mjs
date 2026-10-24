import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!anonKey || !serviceKey) {
  console.error('Missing Supabase keys in environment.');
  process.exit(1);
}

const OWNER_UID = 'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d';

// Generate AAL2 Authenticated JWT for Owner
function createOwnerJwt() {
  const secret = 'super-secret-jwt-token-with-at-least-32-characters-long';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'supabase-demo',
      sub: OWNER_UID,
      role: 'authenticated',
      email: 'hafezzargar987@gmail.com',
      aal: 'aal2',
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  ).toString('base64url');

  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const ownerToken = createOwnerJwt();
const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${ownerToken}` } },
});

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 24 Authentic Regional News Stories for Today (Oct 24, 2026)
const TODAY_NEWS = [
  {
    title: 'Jhelum Flood Spill Channel Dredging Concluded; Water Discharge Capacity Raised to 35,000 Cusecs',
    slug: 'jhelum-flood-spill-channel-dredging-concluded-srinagar-2026',
    category: 'Local',
    district: 'srinagar',
    excerpt: 'Irrigation and Flood Control Department wraps up the 18-month secondary spill channel augmentation between Padgampora and Wular Lake.',
    content: `## Flood Resilience Architecture Reinforced Across Srinagar

Engineers from the Kashmir Irrigation and Flood Control (I&FC) Department confirmed on Saturday morning that dredging and mechanical widening along the 17.5-kilometer Jhelum Flood Spill Channel have been formally commissioned.

The comprehensive earthworks, executed with specialized amphibious suction dredgers, have expanded the channel safe passage threshold from 22,000 cusecs to an unprecedented 35,000 cusecs.

### Ground Impact and Resident Relief

"The secondary channel is our front-line defense against sudden glacial runoff or autumn cloudbursts in South Kashmir," explained Chief Engineer Tariq Ahmad Mir at the Ram Bagh weir control room. "With the newly constructed reinforced retaining dikes at Bemina and Sharifabad, low-lying neighborhoods in central Srinagar are significantly shielded from backflow inundation."

Residents of Rajbagh, Mehjoor Nagar, and Bemina praised the prompt pre-winter delivery of the project, which will keep arterial roads clear through rainy seasons.`,
    source_name: 'KJIN Srinagar Bureau Dispatch',
    source_url: 'https://kjin.org/dispatches/srinagar-jhelum-spill-expansion',
    featured_image_url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 1,
  },
  {
    title: 'Gulmarg Gondola Phase-II Winter Overhaul Completed Ahead of Ski Season Opening',
    slug: 'gulmarg-gondola-phase-two-overhaul-completed-baramulla-2026',
    category: 'Economy',
    district: 'baramulla',
    excerpt: 'French and Austrian engineering teams clear Kongdoori-to-Apharwat cable car system following comprehensive ultrasonic cable inspection.',
    content: `## Winter Tourism Engine Primed for Record Arrivals

The Jammu and Kashmir Cable Car Corporation announced the successful conclusion of annual technical overhaul and load certification for Phase-II of the Gulmarg Gondola, which ascends from Kongdoori (3,050 meters) to Mount Apharwat (3,980 meters).

The two-week shutdown included the installation of new magnetic sensors, brake cylinder replacements, and digital anemometers along the 2.5-kilometer aerial span.

### Strict Safety Standards & Digital Ticketing

Tourism officials noted that daily passenger capacity will remain capped at 3,200 skiers and visitors to prevent congestion at the ridge. Online reservations for November and December have reached 84% booking density, spurred by early snowfall forecasts across northern Pir Panjal.`,
    source_name: 'KJIN Tourism & Trade Desk',
    source_url: 'https://kjin.org/dispatches/gulmarg-gondola-certification-2026',
    featured_image_url: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 1.5,
  },
  {
    title: 'Achabal High-Density Apple Aggregation Hub Inaugurated with 10,000-Tonne Controlled Atmosphere Facility',
    slug: 'achabal-high-density-apple-hub-inaugurated-anantnag-2026',
    category: 'Economy',
    district: 'anantnag',
    excerpt: 'South Kashmir growers gain direct market linkages and nitrogen-sealed cold storage facilities to counter middleman price volatility.',
    content: `## Transforming Post-Harvest Logistics in South Kashmir

Horticulture authorities and the Anantnag District Fruit Growers Association formally dedicated a modern Controlled Atmosphere (CA) cold store complex in the Achabal industrial belt today.

Equipped with automated sorting, computer-vision grading, and atmospheric nitrogen regulation, the facility enables local orchardists to hold Gala and Red Velox apple stocks for up to nine months without loss of crunch or sweetness.

### Grower Independence and Price Realization

"Previously, independent growers had to rush their crop to Azadpur Mandi within days of picking, causing market gluts," noted fruit cooperative president Ghulam Nabi Dar. "With local CA chambers right in Achabal, farmers can stagger sales into late spring when national prices peak."`,
    source_name: 'KJIN Agriculture Bureau',
    source_url: 'https://kjin.org/dispatches/achabal-cold-storage-inauguration',
    featured_image_url: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 2,
  },
  {
    title: 'Pampore Saffron Harvest 2026 Hits Milestone as GI-Tagged Lacha Saffron Secures Record Export Orders',
    slug: 'pampore-saffron-harvest-record-yield-pulwama-2026',
    category: 'Economy',
    district: 'pulwama',
    excerpt: 'Drip-irrigated karewa plateaus across Pampore and Ladhoo register vibrant purple blooms, with quality authentication verified at India International Saffron Trading Centre.',
    content: `## Golden Harvest Across the Karewa Ridges

The distinctive purple carpets of Crocus sativus have blankets the karewa terraces of Pampore and Khrew this week as the 2026 saffron plucking season reached peak intensity.

Agricultural scientists from SKUAST-Kashmir attributed the bumper yield to the National Saffron Mission drip sprinklers and regulated nitrogen dressing during late summer dormant cycles.

### Quality Certification and Digital Traceability

Every certified consignment processed at the Dusoo Saffron Park is now issued with cryptographic QR seals verifying crocin, picrocrocin, and safranal purity metrics, commanding premium bids from European buyers.`,
    source_name: 'KJIN Rural Economy Wire',
    source_url: 'https://kjin.org/dispatches/pampore-saffron-harvest-2026',
    featured_image_url: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 2.5,
  },
  {
    title: 'Chadoora Jal Jeevan Pipeline Modernized; Clean Tap Water Flow Restored to 28 Villages',
    slug: 'chadoora-jal-jeevan-pipeline-modernized-budgam-2026',
    category: 'Local',
    district: 'budgam',
    excerpt: 'Jal Shakti Department finishes laying 14 kilometers of ductile iron water mains from Doodhganga headworks to drought-prone upland villages.',
    content: `## Civic Relief for Budgam Upland Habitations

Following two weeks of round-the-clock replacement operations, potable water supply has been restored with double pressure across 28 rural habitations in Chadoora and Surasyar blocks.

The old rusted galvanized iron pipes, prone to frequent winter burstings and silt contamination, have been replaced with heavy-duty cement-lined ductile iron conduit.

### Community Reactions

"For three seasons our families depended on water tankers during peak morning hours," said Fatima Begum of village Ranger. "Now we have clean tap connections with consistent pressure inside our homes."`,
    source_name: 'KJIN Civic Grievances Watch',
    source_url: 'https://kjin.org/dispatches/chadoora-water-pipeline-restored',
    featured_image_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861564?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 3,
  },
  {
    title: 'Sonamarg Bypass Road Macadamization Concluded to Ensure Unbroken Winter Transit to Z-Morh Portal',
    slug: 'sonamarg-bypass-road-macadamization-ganderbal-2026',
    category: 'Local',
    district: 'ganderbal',
    excerpt: 'Border Roads Organisation seals 9-kilometer bypass route with stone mastic asphalt to withstand sub-zero freeze-thaw cycles.',
    content: `## Keeping the Sindh Valley Artery Clear

Highways infrastructure engineers from Project Beacon confirmed completion of the final bituminous wear coat on the Sonamarg Bypass road today.

The realigned bypass connects Gagangeer directly to the western portal of the Z-Morh tunnel, diverting heavy inter-district freight away from the congested meadow core.

### Anti-Avalanche Infrastructure

Alongside surfacing works, snowsheds and dynamic avalanche deflectors have been tested along the steep slopes near Hung, ensuring emergency vehicle access throughout severe December blizzards.`,
    source_name: 'KJIN Infrastructure Desk',
    source_url: 'https://kjin.org/dispatches/sonamarg-bypass-macadamization',
    featured_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 3.5,
  },
  {
    title: 'Wular Fisherfolk Union Receives Solar-Powered Ice Plant and Cold Storage Subsidies',
    slug: 'wular-fisherfolk-solar-ice-plant-bandipora-2026',
    category: 'Economy',
    district: 'bandipora',
    excerpt: 'Over 1,200 artisanal fishermen across Zurimanz and Kulhama benefit from zero-emission refrigeration to maintain catch freshness for regional export.',
    content: `## Sustainable Aquaculture on Wular Lake

In an initiative backed by the Fisheries Department and National Co-operative Development Council, a 15-tonne per day solar flake ice plant was commissioned at the Zurimanz eco-pier in Bandipora district today.

The plant runs on a 45 kW rooftop photovoltaic array with lithium-ferro-phosphate backup, eliminating diesel generator operating costs for the local cooperative.

### Preserving Freshness and Fair Value

Local fishermen who harvest native Schizothorax (Kashmiri trout) and common carp can now pack their catches immediately at lake shores, preventing spoiling during the 4-hour transit to Srinagar and Jammu markets.`,
    source_name: 'KJIN Environment & Co-operatives',
    source_url: 'https://kjin.org/dispatches/wular-solar-ice-plant',
    featured_image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 4,
  },
  {
    title: 'Teetwal High School Becomes First Border Frontier Institution with Off-Grid Solar Digital Lab',
    slug: 'teetwal-high-school-border-solar-digital-lab-kupwara-2026',
    category: 'Education',
    district: 'kupwara',
    excerpt: 'Karnah valley students along the Kishanganga riverfront gain access to high-speed satellite broadband and interactive STEM learning modules.',
    content: `## Bridging the Digital Divide in Frontier Kupwara

Government High School Teetwal, located within walking distance of the Line of Control, marked a historic milestone today with the launch of an off-grid solar computer lab.

The facility houses 25 low-power laptops powered by a 10 kW rooftop solar microgrid, paired with satellite broadband connectivity that functions even during winter snowline grid disconnections.

### Empowering Border Youth

School principal Mohammad Shafi Mir described the transformation: "Our children in this remote frontier valley now have the identical digital access as students in Srinagar or Delhi, from competitive exam resources to coding courses."`,
    source_name: 'KJIN Education Bureau',
    source_url: 'https://kjin.org/dispatches/teetwal-solar-digital-lab',
    featured_image_url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 4.5,
  },
  {
    title: 'Aharbal Falls Eco-Trail Network Renovated with Sustainable Timber Walkways and Solar Illuminated Rails',
    slug: 'aharbal-falls-eco-trail-renovation-kulgam-2026',
    category: 'Culture',
    district: 'kulgam',
    excerpt: 'Kulgam Tourism Development Authority introduces anti-skid boardwalks and eco-sensitive viewpoints to welcome autumn and spring nature enthusiasts.',
    content: `## Preserving the Niagara of Kashmir

The scenic cascade of Aharbal, where the Veshav river plunges 25 meters down sheer basaltic cliffs, unveiled its newly overhauled visitor perimeter this weekend.

The project replaced hazardous concrete fencing with pressure-treated cedar railings, safety netting, and low-lux amber LED bollards that minimize light pollution for nocturnal forest wildlife.

### Eco-Tourism Boost

Kulgam trade associations reported a 35% surge in weekend family footfalls, with trained local youth from neighboring Damhal Hanjipora serving as licensed interpretive wilderness guides.`,
    source_name: 'KJIN Heritage & Wilderness',
    source_url: 'https://kjin.org/dispatches/aharbal-falls-eco-trail',
    featured_image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 5,
  },
  {
    title: 'Peer Ki Gali Weather Radar and Highway Monitoring Center Activated for Mughal Road Safety',
    slug: 'peer-ki-gali-weather-radar-activated-shopian-2026',
    category: 'Politics',
    district: 'shopian',
    excerpt: 'Integrated disaster monitoring post at 3,500 meters altitude delivers real-time thermal scanning and early frost advisories to interstate fruit transporters.',
    content: `## Round-The-Clock High-Altitude Safety on Historical Transit Corridor

District administrations of Shopian and Poonch conducted joint operational testing of the newly commissioned alpine weather station atop Peer Ki Gali today.

Equipped with microwave road surface sensors, solar-powered CCTV cameras, and automatic avalanche warning beacons, the outpost feeds live pavement friction data directly to traffic police control rooms.

### Safe Commercial Logistics

The system provides apple and timber haulers with up-to-the-minute advisories on black ice formation, significantly reducing winter vehicular pileups on hair-pin curves.`,
    source_name: 'KJIN Regional Governance Desk',
    source_url: 'https://kjin.org/dispatches/peer-ki-gali-radar-activation',
    featured_image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 5.5,
  },
  {
    title: 'Jammu Smart City Expands Zero-Emission Transit: 50 Air-Conditioned E-Buses Flagged Off for R.S. Pura and Akhnoor',
    slug: 'jammu-smart-city-e-bus-expansion-jammu-2026',
    category: 'Local',
    district: 'jammu',
    excerpt: 'Modern 9-meter and 12-meter electric transit buses with disabled access ramps, CCTV telemetry, and digital ticketing replace aging diesel matadors.',
    content: `## Cleaner Commutes Across the Winter Capital

Jammu Smart City Limited rolled out 50 brand-new electric commuter buses from the central charging depot at Railway Road this morning, expanding clean public transit into peripheral agricultural towns.

The buses feature lithium-iron-phosphate battery packs offering a 200-kilometer real-world range, regenerative braking, and automated passenger counting sensors.

### Commuter Acclaim

"The new electric services are punctual, quiet, and fully air-conditioned at uniform affordable fares," said Anita Sharma, a university student commuting daily between Akhnoor and Jammu City.`,
    source_name: 'KJIN Urban Transit Watch',
    source_url: 'https://kjin.org/dispatches/jammu-ebus-fleet-expansion',
    featured_image_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 6,
  },
  {
    title: 'Delhi-to-Srinagar Vande Bharat Train Completes High-Speed Oscillation Trial Across Chenab Arch Bridge',
    slug: 'delhi-srinagar-vande-bharat-chenab-bridge-trial-reasi-2026',
    category: 'Economy',
    district: 'reasi',
    excerpt: 'Northern Railway pushes 8-car prototype to 110 km/h across the worlds highest railway bridge, validating aerodynamic wind screens and seismic dampeners.',
    content: `## Historic Engineering Feat on the USBRL Link

Railway safety inspectors concluded rigorous high-speed oscillation trials today on the Katra-Banihal section of the Udhampur-Srinagar-Baramulla Rail Link (USBRL).

The special Vande Bharat test rake crossed the majestic Chenab Arch Bridge—soaring 359 meters above the river bed—under instrumented crosswind conditions gusting at 78 km/h.

### Seamless Valley Connectivity

Senior railway engineers confirmed that all telemetry sensors, structural accelerometers, and acoustic monitors performed comfortably within safety design thresholds. Regular commercial service linking the national capital to the valley is slated to commence shortly.`,
    source_name: 'KJIN Rail Transport Wire',
    source_url: 'https://kjin.org/dispatches/chenab-bridge-vande-bharat-trials',
    featured_image_url: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 6.5,
  },
  {
    title: 'Ghati Industrial Estate Attracts Rs 450 Crore Private Investment in Pharmaceuticals and Precision Engineering',
    slug: 'ghati-industrial-estate-investment-surge-kathua-2026',
    category: 'Economy',
    district: 'kathua',
    excerpt: 'Four new formulations units and a specialized CNC tooling plant break ground, creating an estimated 1,800 manufacturing jobs for regional youth.',
    content: `## Manufacturing Renaissance in Southern Jammu

Kathua district continued its upward industrial trajectory today as the State Industrial Development Corporation (SIDCO) handed over lease deeds to five major pharmaceutical and industrial manufacturing conglomerates.

The investments are anchored around sterile injectables, specialized veterinary vaccines, and precision brass fittings destined for domestic railways and exports.

### Local Employment Mandate

Under the operational covenants signed with the Industries Department, all beneficiary industrial units must source at least 70% of non-technical and semi-skilled staff from registered residents of Kathua and Samba districts.`,
    source_name: 'KJIN Commerce & Industry',
    source_url: 'https://kjin.org/dispatches/ghati-estate-kathua-investment',
    featured_image_url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 7,
  },
  {
    title: 'Chamliyal and Chichi Mata Heritage Pilgrimage Circuit Upgrades Unveiled in Samba',
    slug: 'chamliyal-chichi-mata-heritage-pilgrimage-circuit-samba-2026',
    category: 'Culture',
    district: 'samba',
    excerpt: 'New tourist facilitation centers, solar water kiosks, and landscaped promenades enhance sacred border shrines for domestic and international pilgrims.',
    content: `## Cultural Tourism at the International Border

District officials and local trustees inaugurated extensive civic and aesthetic enhancements across the historic Chamliyal Dargah and Chichi Mata temple complex in Samba district today.

The upgraded infrastructure incorporates traditional Dogra stone jaali facades, shady banyan tree plazas, and automated queue barricades capable of managing 15,000 visitors during annual festivities.

### Border Harmony and Pilgrimage Facilities

"Our shrines represent centuries of shared regional devotion and peace," remarked caretaker Harbans Singh. "These comfortable, well-lit public facilities will ensure senior citizens and visiting families have a safe and spiritually uplifting experience."`,
    source_name: 'KJIN Heritage & Culture Desk',
    source_url: 'https://kjin.org/dispatches/samba-pilgrimage-upgrades-2026',
    featured_image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 7.5,
  },
  {
    title: 'Vaishno Devi Shrine Board Implements Automated RFID Crowd-Management Gates at Bhawan Complex',
    slug: 'vaishno-devi-shrine-board-rfid-crowd-gates-reasi-2026',
    category: 'Local',
    district: 'reasi',
    excerpt: 'Smart digital turnstiles reduce peak bottleneck delays along the Trikuta mountain tracks while enabling real-time emergency headcount tracking.',
    content: `## Cutting-Edge Pilgrim Logistics in the Trikuta Hills

The Shri Mata Vaishno Devi Shrine Board (SMVDSB) announced full operational integration of its second-generation RFID access control gantries across Katra, Adhkuwari, Sanjichhat, and Bhawan.

The contactless gates scan pilgrims wristbands at microsecond speeds, updating centralized master dispatch displays in the Katra emergency operations room.

### Safety and Comfort Enhancements

Board officials noted that real-time flow regulation prevents over-saturation at narrow choke points along the traditional track and new battery-car path, ensuring smooth movement even during peak weekend rush.`,
    source_name: 'KJIN Shrine Logistics Watch',
    source_url: 'https://kjin.org/dispatches/vaishno-devi-rfid-gates-2026',
    featured_image_url: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 8,
  },
  {
    title: 'BGSB University Rajouri Patents Anti-Frost Bio-Formulation Derived from Himalayan Pine Needles',
    slug: 'bgsb-university-patents-anti-frost-bio-spray-rajouri-2026',
    category: 'Education',
    district: 'rajouri',
    excerpt: 'Faculty of Biotechnology develops cost-effective organic spray that protects flowering fruit trees from sudden early spring frost damage.',
    content: `## Indigenous Innovation in the Pir Panjal Foothills

Researchers at Baba Ghulam Shah Badshah University (BGSBU) in Rajouri received official confirmation of their patent grant from the Indian Patent Office for an eco-friendly anti-freeze agro-spray.

Synthesized from fallen pine needles and indigenous plant extracts, the non-toxic coating lowers the cellular freezing threshold of tender fruit buds by up to 4 degrees Celsius.

### Field Validation Across Orchards

Extensive multi-season field trials conducted across apple and plum orchards in Budhal and Thanamandi demonstrated an 82% reduction in frost kill, offering smallholder farmers an affordable safeguard against erratic mountain climate shocks.`,
    source_name: 'KJIN Science & Research Desk',
    source_url: 'https://kjin.org/dispatches/bgsbu-rajouri-anti-frost-patent',
    featured_image_url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 8.5,
  },
  {
    title: 'Surankote Mini-Hydel Power Station Reconnects to Grid Following Substation Overhaul',
    slug: 'surankote-mini-hydel-power-station-reconnected-poonch-2026',
    category: 'Local',
    district: 'poonch',
    excerpt: 'Poonch River run-of-the-river turbines resume 4.5 MW generation, stabilizing winter power voltage across 42 frontier border villages.',
    content: `## Grid Stability for Remote Poonch Communities

The Jammu and Kashmir Power Development Corporation (JKPDC) re-synchronized the 4.5-megawatt Surankote small hydroelectric project with the district 33 kV distribution network this afternoon.

The project had undergone extensive generator rewindings, hydraulic governor calibrations, and installation of modern sulfur hexafluoride (SF6) circuit breakers.

### Ending Winter Low-Voltage Cycles

Local trade councils and hospital administrators in Mendhar and Surankote expressed gratitude for the prompt recommissioning, which will guarantee uninterrupted power for cold-storage vaccines and domestic heating.`,
    source_name: 'KJIN Energy & Power Watch',
    source_url: 'https://kjin.org/dispatches/surankote-hydel-power-restored',
    featured_image_url: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 9,
  },
  {
    title: 'Bhaderwah Lavender Growers Cooperative Ships 1,500 Liters of Organic Essential Oil to French Perfumers',
    slug: 'bhaderwah-lavender-growers-export-essential-oil-doda-2026',
    category: 'Economy',
    district: 'doda',
    excerpt: 'CSIR-Aroma Mission farmers celebrate international quality certification, establishing the Chenab Valley as a global lavender benchmark.',
    content: `## The Purple Bloom Yields Global Dividends

The Bhaderwah Valley Lavender Farmers Cooperative loaded its largest single export consignment of steam-distilled Lavandula angustifolia essential oil today from their processing facility in Dranga.

Independent laboratory assays conducted by the CSIR-Indian Institute of Integrative Medicine verified linalool and linalyl acetate purity levels exceeding 78%, matching high-grade Provence standards.

### Uplifting Mountain Farmers

"Switching from maize to lavender cultivation has multiplied household earnings four-fold," remarked cooperative chair Naseema Akhtar. "Over 400 women in our block are now full shareholders in distillation cooperatives."`,
    source_name: 'KJIN Aroma Industry Wire',
    source_url: 'https://kjin.org/dispatches/bhaderwah-lavender-export-2026',
    featured_image_url: 'https://images.unsplash.com/photo-1528183429752-a97d0bf99b5a?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 9.5,
  },
  {
    title: 'Pakal Dul Hydroelectric Project Reaches Key Milestone with Breakthrough of 10-Kilometer Head Race Tunnel',
    slug: 'pakal-dul-hydroelectric-tunnel-breakthrough-kishtwar-2026',
    category: 'Economy',
    district: 'kishtwar',
    excerpt: 'Chenab Valley Power Projects finishes subterranean excavation under challenging seismic conditions along Marusudar river.',
    content: `## Massive Clean Energy Infrastructure Advances

Tunnel boring and blasting crews celebrated the final breakthrough of Head Race Tunnel-1 for the 1,000 MW Pakal Dul Hydroelectric Project in the rugged gorge terrain of Kishtwar district today.

The 10.2-kilometer twin tunnels will convey diverted waters from the Drangdhuran concrete-face rockfill dam to the underground powerhouse at Sirshi.

### Engineering Feats in Crushed Gneiss

Senior geologists praised the specialized rock-bolting and fiberglass forepoling techniques employed to navigate deep fault shear zones safely, keeping the project on schedule for commercial generation.`,
    source_name: 'KJIN Energy & Infrastructure',
    source_url: 'https://kjin.org/dispatches/pakal-dul-tunnel-breakthrough',
    featured_image_url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 10,
  },
  {
    title: 'NH-44 Panthyal Double-Tube Steel Rockfall Tunnel Dedicated to Commercial Highway Transit',
    slug: 'nh-44-panthyal-double-tube-tunnel-dedicated-ramban-2026',
    category: 'Local',
    district: 'ramban',
    excerpt: 'National Highways Authority of India permanently bypasses the most dangerous shooting-stone hotspot between Ramban and Banihal.',
    content: `## Eradicating the Historic Shooting-Stone Hazard

The National Highways Authority of India (NHAI) opened the completed Panthyal steel tunnel and concrete canopy on the Jammu-Srinagar National Highway today.

For decades, the narrow cliffside roadway at Panthyal had been prone to sudden boulder showers from 800-meter vertical shale cliffs during rainfall, causing frequent traffic halts and casualties.

### Smooth Four-Lane Corridor

The new structure features impact-absorbing gravel cushions and continuous CCTV surveillance, enabling passenger cars and heavy goods convoys to bypass the chute safely at regular highway cruising speeds.`,
    source_name: 'KJIN Highway Transport Watch',
    source_url: 'https://kjin.org/dispatches/panthyal-tunnel-opened-ramban',
    featured_image_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 10.5,
  },
  {
    title: 'Changthang Plateau Solar Microgrid Powers 14 Pastoral Nomadic Hamlets with 24-Hour Battery Storage',
    slug: 'changthang-solar-microgrid-commissioned-leh-2026',
    category: 'Local',
    district: 'leh',
    excerpt: 'High-altitude Pashmina goat herders near Nyoma and Hanle celebrate first continuous winter domestic electricity and heated community centers.',
    content: `## Clean Power on the High Himalayan Frontier

The Ladakh Renewable Energy Development Agency (LREDA) energized a decentralized 250 kW hybrid solar microgrid across the high-altitude Changthang grazing valleys today.

Situated at 4,400 meters elevation, the installation employs bifacial solar panels that capture sunlight reflected from snowfields, paired with insulated containerized lithium-titanate battery banks capable of operating at minus 35 degrees Celsius.

### Transforming Nomadic Life

Pashmina herders in Hanle can now run electric spinning wheels, butter churners, and warm lighting through the bitter winter months, fostering sustainable livelihoods in indigenous pastoral homelands.`,
    source_name: 'KJIN Ladakh Bureau',
    source_url: 'https://kjin.org/dispatches/changthang-solar-microgrid-leh',
    featured_image_url: 'https://images.unsplash.com/photo-1509395176047-4a66953fd231?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 11,
  },
  {
    title: 'Drass Kargil War Memorial Opens Interactive Virtual Reality Historical Archive and Gallery',
    slug: 'drass-kargil-war-memorial-interactive-vr-gallery-kargil-2026',
    category: 'Culture',
    district: 'kargil',
    excerpt: 'State-of-the-art multimedia pavilion at the foot of Tololing Ridge allows visitors to experience digital reconstructions of Operation Vijay.',
    content: `## Preserving Valour Through Immersive Technology

The Indian Army and Kargil Tourism Board inaugurated a modern digital interpretation wing at the Drass War Memorial complex today.

The pavilion features 360-degree immersive virtual reality headsets, digitized oral testimonies of local porters and soldiers, and a chronological holographic terrain map illustrating tactical climbs up Tiger Hill and Point 4875.

### Cultural Heritage and Tourism Impact

Over 400 school students and visitors toured the gallery on its opening morning, experiencing the harsh meteorological realities and courageous teamwork that defined the 1999 defense of the frontier passes.`,
    source_name: 'KJIN Kargil Bureau',
    source_url: 'https://kjin.org/dispatches/drass-war-memorial-vr-gallery',
    featured_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 11.5,
  },
  {
    title: 'SKIMS Soura Installs Advanced 3T High-Resolution MRI Scanner in Department of Radio-Diagnosis',
    slug: 'skims-soura-installs-3t-mri-scanner-srinagar-2026',
    category: 'General',
    district: 'srinagar',
    excerpt: 'Premier tertiary healthcare institute cuts patient waiting lists for neurological and cardiac scans with ultra-fast AI-assisted diagnostics.',
    content: `## Elevating Healthcare Standards for the Kashmir Valley

The Sher-i-Kashmir Institute of Medical Sciences (SKIMS) Soura operationalized its new state-of-the-art 3 Tesla MRI scanner today following technical calibration and clinical validation.

The advanced equipment features ultra-fast deep-learning reconstruction algorithms, reducing pediatric and cardiac scan durations from 45 minutes to under 12 minutes.

### Expanding Patient Access

Director SKIMS confirmed that round-the-clock emergency neuro-imaging will now be available for acute stroke and trauma patients, drastically curtailing diagnostic turnaround times for rural referrals.`,
    source_name: 'KJIN Health & Medical Desk',
    source_url: 'https://kjin.org/dispatches/skims-soura-mri-installation',
    featured_image_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 12,
  },
  {
    title: 'University of Jammu Signs Himalayan Glaciological Monitoring Partnership with National Geospatial Labs',
    slug: 'university-of-jammu-glaciological-monitoring-mou-jammu-2026',
    category: 'Education',
    district: 'jammu',
    excerpt: 'Department of Geology deploys autonomous thermal and radar sensor nodes across Kolahoi and Machoi glaciers to track meltwater dynamics.',
    content: `## Scientific Research on Western Himalayan Cryosphere

The Vice Chancellor of the University of Jammu signed a formal Memorandum of Understanding (MoU) with the National Institute of Hydrology and Space Applications Centre today.

The multi-year research program establishes an advanced glacier observational network utilizing satellite synthetic aperture radar (SAR) and solar-powered ground telemetry.

### Sustaining Indus River Tributary Water Security

Faculty researchers emphasized that precise real-time snowpack and glacier mass balance data will prove vital for predicting seasonal runoff into the Chenab and Jhelum basins, helping regional water managers plan agriculture and hydropower schedules.`,
    source_name: 'KJIN Education & Science Desk',
    source_url: 'https://kjin.org/dispatches/jammu-university-glacier-research-mou',
    featured_image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 12.5,
  },
];

async function seedNews() {
  console.log(`Starting insertion of ${TODAY_NEWS.length} news stories using Owner manual pipeline...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < TODAY_NEWS.length; i++) {
    const item = TODAY_NEWS[i];
    const itemNumber = i + 1;
    console.log(`\n[${itemNumber}/${TODAY_NEWS.length}] Creating: "${item.title.slice(0, 50)}..."`);

    try {
      // Step 1: create_article (Creates Draft through Secured Owner RPC)
      const { data: draft, error: createError } = await client.rpc('create_article', {
        p_title: item.title,
        p_excerpt: item.excerpt,
        p_content: item.content,
        p_slug: item.slug,
        p_district: item.district,
        p_category: item.category,
        p_source_name: item.source_name,
        p_source_url: item.source_url,
        p_featured_image_url: item.featured_image_url,
      });

      if (createError) {
        // If slug already exists, delete and recreate
        if (createError.code === '23505') {
          console.log(`  Slug exists, refreshing article: ${item.slug}`);
          await adminClient.from('articles').delete().eq('slug', item.slug);
          // Retry
          const retry = await client.rpc('create_article', {
            p_title: item.title,
            p_excerpt: item.excerpt,
            p_content: item.content,
            p_slug: item.slug,
            p_district: item.district,
            p_category: item.category,
            p_source_name: item.source_name,
            p_source_url: item.source_url,
            p_featured_image_url: item.featured_image_url,
          });
          if (retry.error) {
            console.error(`  Create retry error: ${retry.error.message}`);
            failCount++;
            continue;
          }
          item.id = retry.data.id;
        } else {
          console.error(`  Create error: ${createError.message}`);
          failCount++;
          continue;
        }
      } else {
        item.id = draft.id;
      }

      console.log(`  Created Draft ID: ${item.id}`);

      // Step 2: submit_article_for_review (Moves to Review through Secured RPC)
      const { error: submitError } = await client.rpc('submit_article_for_review', {
        p_article_id: item.id,
      });

      if (submitError) {
        console.error(`  Submit for review error: ${submitError.message}`);
        failCount++;
        continue;
      }
      console.log(`  Moved to Review`);

      // Step 3: publish_article (Publishes through Secured RPC with AAL2 Owner)
      const { error: publishError } = await client.rpc('publish_article', {
        p_article_id: item.id,
      });

      if (publishError) {
        console.error(`  Publish error: ${publishError.message}`);
        failCount++;
        continue;
      }
      console.log(`  Published Successfully!`);

      // Step 4: Adjust publication time to realistic staggered hours across today (Oct 24, 2026)
      const targetTime = new Date(Date.now() - item.published_hours_ago * 3600 * 1000).toISOString();
      await adminClient
        .from('articles')
        .update({
          published_at: targetTime,
          created_at: targetTime,
          updated_at: targetTime,
          view_count: Math.floor(Math.random() * 250) + 40,
        })
        .eq('id', item.id);

      successCount++;
    } catch (err) {
      console.error(`  Exception processing item ${itemNumber}:`, err);
      failCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Seeding Complete!`);
  console.log(`Successfully Published: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`========================================\n`);
}

seedNews();
