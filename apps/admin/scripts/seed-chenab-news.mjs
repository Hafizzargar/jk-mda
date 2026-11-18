import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Fetch author profile
const { data: profiles, error: profileErr } = await supabase
  .from('profiles')
  .select('id, display_name, role_key')
  .order('created_at', { ascending: true })
  .limit(1);

if (profileErr || !profiles || profiles.length === 0) {
  console.error('Failed to find author profile:', profileErr);
  process.exit(1);
}

const authorId = profiles[0].id;
console.log(`Using Author Profile ID: ${authorId} (${profiles[0].display_name})`);

const CHENAB_ARTICLES = [
  {
    slug: 'doda-winter-health-outreach-fleet-marmat-kastigarh-2026',
    title: 'Doda Administration Deploys 4x4 Mobile Health Outreach Fleet to Highland Panchayats in Marmat and Kastigarh',
    excerpt: 'District health authorities operationalize all-terrain mobile clinics equipped with point-of-care diagnostics, ultrasound telemetry, and emergency medicine supplies for 28 snow-vulnerable mountain villages.',
    category: 'Local News',
    district: 'doda',
    author_display_name: 'Tariq Ahmad Mir',
    featured_image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80',
    view_count: 850,
    published_hours_ago: 1,
    content: `## Highland Medical Preparedness Mobilized Across Chenab Ridges

DODA — As sub-zero temperatures and seasonal snowfall begin isolating remote mountain settlements, the District Administration of Doda in coordination with the Directorate of Health Services Jammu has formally commissioned a dedicated fleet of 4x4 Mobile Health Care Units designed to traverse rugged, unpaved terrains across the Marmat, Kastigarh, and Dessa sectors.

The specialized vehicles are outfitted with point-of-care hematology analyzers, portable ultrasound units, cardiac monitors, and cold-chain transport for critical vaccines and emergency obstetrics medicines.

### Addressing Winter Isolation in Remote Panchayats

Historically, residents of highland hamlets like Behota, Mangota, and Goha faced grueling multiple-hour treks on foot over ice-encrusted bridle paths to access primary health centers in Doda town. 

"Our objective is to reverse the traditional dynamic: rather than expecting ailing villagers to negotiate treacherous mountain trails in the dead of winter, specialized healthcare teams are being dispatched directly to village panchayat ghars on weekly rotating timetables," stated Chief Medical Officer Doda.

The mobile units are staffed by medical officers, trained mid-level health providers, and emergency nursing personnel. A satellite telemetry uplink allows on-ground practitioners to consult directly with senior specialists at Government Medical College (GMC) Doda for acute trauma or pediatric interventions.

### Emergency Evacuation Protocols

The outreach program also establishes synchronized coordination with the district disaster management cell. In cases requiring immediate surgical tertiary intervention, the teams carry designated GPS transponders capable of coordinating with the divisional helicopter evacuation protocol during heavy road blockades.

Essential buffers of life-saving therapeutics, oxygen cylinders, and anti-rabies and anti-venom serums have been pre-positioned across auxiliary nursing stations, ensuring uninterrupted primary care throughout the winter season.`,
  },
  {
    slug: 'pakal-dul-hydroelectric-project-underground-powerhouse-marusudar-kishtwar-2026',
    title: '1,000 MW Pakal Dul Hydroelectric Project Reaches Major Civil Engineering Milestone in Kishtwar',
    excerpt: 'Underground machine hall cavern excavation wraps up along the Marusudar River tributary, clearing the way for turbine electromechanical erection ahead of 2027 grid synchronisation.',
    category: 'Economy',
    district: 'kishtwar',
    author_display_name: 'Amit Sharma',
    featured_image_url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1200&q=80',
    view_count: 1120,
    published_hours_ago: 3,
    content: `## Engineering Breakthrough on the Marusudar Tributary

KISHTWAR — Construction of the 1,000 MW Pakal Dul Hydroelectric Project, Jammu and Kashmir's largest hydro generation asset, reached a decisive milestone on Wednesday as engineers achieved the final structural breakthrough of the massive underground powerhouse cavern at Arzi.

The machine hall cavern, excavated deep within the gneissic rock foundations of the Pir Panjal range, measures 232 meters in length and over 50 meters in height. The project is being executed by Chenab Valley Power Projects Private Limited (CVPPPL), a joint venture between NHPC Limited and the Jammu and Kashmir State Power Development Corporation (JKSPDC).

### Harnessing Glacial Runoff

Pakal Dul is located on the Marusudar River, the largest tributary of the Chenab. Unlike traditional run-of-the-river setups, the project utilizes a 167-meter-tall concrete-face rockfill dam (CFRD) at Drangdhuran, which channels water through twin 10-kilometer-long head race tunnels toward the underground powerhouse downstream.

"Excavating an underground chamber of this magnitude amidst complex Himalayan thrust zones required continuous acoustic micro-seismic monitoring and automated convergence sensors," explained a chief civil engineer at the project site. "The structural integrity of the crown arch and rock bolts has been fully validated under hydrostatic test pressures."

### Clean Energy and Regional Economic Renaissance

With powerhouse excavation complete, mechanical teams have begun erecting heavy crane girders to install the four 250 MW high-head Francis turbines. Once commercially operational in late 2027, Pakal Dul is projected to generate over 3,330 million units of green electrical energy annually, bolstering the northern regional grid and providing 12% free electricity plus local area development funding directly to Kishtwar district.

Environmental engineers have deployed silt exclusion chambers to protect downstream river ecosystems, ensuring that minimal sediment impacts seasonal trout habitats along the lower Chenab watershed.`,
  },
  {
    slug: 'ramban-nh44-rockfall-protection-mehar-cafeteria-slope-stabilization-2026',
    title: 'NHAI and Ramban Administration Commission Pre-Cast Rockfall Canopies Along Vulnerable Mehar-Cafeteria Stretch',
    excerpt: 'Heavy-duty Swiss-engineered flexible wire netting and high-impact deflection galleries installed along critical slide zones on NH-44 to safeguard winter vehicular convoys.',
    category: 'Transit',
    district: 'ramban',
    author_display_name: 'Pooja Jamwal',
    featured_image_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    view_count: 980,
    published_hours_ago: 5,
    content: `## High-Tech Geotechnical Fortification Along Jammu-Srinagar Arterial Link

RAMBAN — In a decisive effort to curb seasonal transit blockades and protect commercial and passenger convoys, the National Highways Authority of India (NHAI) in partnership with the Ramban district administration has formally operationalized pre-cast rockfall protection canopies along the notoriously unstable Mehar-Cafeteria stretch of National Highway 44.

The 900-meter sector, situated just north of Ramban town along the sheer shale slopes flanking the Chenab River gorge, has historically been the primary choke point during rainfall and winter freeze-thaw cycles, triggering shooting stones and mudslides that paralyzed traffic for days.

### Multi-Tiered Deflection Architecture

The engineering intervention combines reinforced concrete rock-shed canopies with Swiss-designed high-tensile flexible steel ring nets capable of absorbing dynamic boulder impacts exceeding 5,000 kilojoules.

Geotechnical specialists drilled deep prestressed rock anchors up to 25 meters into the fractured rock face, affixing high-tensile wire mesh to catch falling scree before it reaches the dual-carriageway asphalt.

"The Mehar corridor was our greatest operational vulnerability on the entire four-lane Jammu-Srinagar corridor," remarked a senior project director for NHAI. "The completion of these protective galleries ensures that even when upper ridges shed rock fragments during sudden rainstorms, vehicular movement beneath the canopies remains completely safe and unhindered."

### Real-Time Optical Surveillance

Traffic Control Unit (TCU) Ramban has integrated optical laser sensors and thermal camera arrays overlooking the active slopes. In the event that rock retention nets detect unusual tension spikes, automated electronic message signs located five kilometers north and south immediately warn oncoming drivers to halt safely.

With winter transport convoys transporting essential goods, fruit dispatches, and emergency travelers between Jammu and Srinagar, the fortification marks a major boost to regional transit reliability.`,
  },
  {
    slug: 'kishtwar-saffron-cooperative-receives-gi-tagged-processing-hub-paddar-2026',
    title: 'Kishtwar Saffron and Walnut Growers Launch Solar-Powered Controlled Drying and Packaging Hub in Paddar',
    excerpt: 'Highland farming cooperative establishes state-of-the-art grading facility, eliminating transit spoilage and guaranteeing authentic GI origin traceability for regional growers.',
    category: 'Economy',
    district: 'kishtwar',
    author_display_name: 'KJCPL Chenab Bureau',
    featured_image_url: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=1200&q=80',
    view_count: 670,
    published_hours_ago: 7,
    content: `## Highland Agro-Innovation Boosts Farm Incomes in Chenab Valley

PADDAR (KISHTWAR) — Farmers cultivating indigenous highland saffron and wild organic walnuts across the high slopes of Paddar, Chhatroo, and Pochhal have officially inaugurated their first farmer-owned, solar-powered aggregation, quality certification, and vacuum packaging facility.

Kishtwar saffron—cultivated at elevations above 1,750 meters—is celebrated for its intense crocin concentration, rich floral aroma, and deep crimson stigmas. However, traditional post-harvest drying under open-air atmospheric conditions often exposed crops to sudden unseasonal snow and ambient humidity, degrading essential oil quality.

### Solar-Assisted Moisture Regulation

The newly commissioned hub incorporates solar-powered dehumidified drying chambers that reduce crop moisture from 80% to the optimal 8% threshold within six hours, fully preserving medicinal and aromatic compounds.

"By shifting from sun-drying to controlled clean chambers, our growers retain Grade-1 coloring and crocin density, commanding up to 35% higher price realization on direct wholesale markets," stated Ghulam Hassan Malik, chairman of the Paddar Saffron and Walnut Growers Collective.

The facility also features laser optical sorting tables for high-altitude walnuts and cold storage chambers powered by a dedicated 45 kW rooftop solar array with lithium-ferrophosphate battery reserves.

### Direct Market Traceability

Every batch processed at the hub receives an authenticated digital QR code indicating harvest date, elevation, and laboratory test purity results. This enables regional producers to bypass predatory broker intermediaries and sell directly to specialty apothecaries, culinary exporters, and premium domestic retail partners in Delhi, Mumbai, and Bengaluru.`,
  },
];

console.log(`\nSeeding ${CHENAB_ARTICLES.length} new Chenab Valley news articles to database...\n`);

let successCount = 0;
let failCount = 0;

for (const art of CHENAB_ARTICLES) {
  const publishedAt = new Date(Date.now() - 3600 * 1000 * art.published_hours_ago).toISOString();

  // Check if article already exists
  const { data: existing } = await supabase
    .from('articles')
    .select('id, status')
    .eq('slug', art.slug)
    .maybeSingle();

  let articleId = existing?.id;

  try {
    if (!articleId) {
      articleId = crypto.randomUUID();
      const { error: insErr } = await supabase
        .from('articles')
        .insert({
          id: articleId,
          title: art.title,
          slug: art.slug,
          excerpt: art.excerpt,
          content: art.content,
          category: art.category,
          district: art.district,
          author_id: authorId,
          author_display_name: art.author_display_name,
          featured_image_url: art.featured_image_url,
          status: 'draft',
          created_at: publishedAt,
          updated_at: publishedAt,
        });

      if (insErr) {
        console.error(`✗ Draft insert error on "${art.slug}":`, insErr.message);
        failCount++;
        continue;
      }
    }

    // Step 2: Transition draft -> review
    await supabase
      .from('articles')
      .update({ status: 'review' })
      .eq('id', articleId);

    // Step 3: Transition review -> published
    const { error: pubErr } = await supabase
      .from('articles')
      .update({
        status: 'published',
        published_at: publishedAt,
        published_by: authorId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (pubErr) {
      console.error(`✗ Publish error on "${art.slug}":`, pubErr.message);
      failCount++;
      continue;
    }

    console.log(`✓ Stored & Published in DB: "${art.title}" (${art.category} • ${art.district})`);
    successCount++;
  } catch (err) {
    console.error(`✗ Exception on "${art.slug}":`, err.message);
    failCount++;
  }
}

console.log(`\n========================================`);
console.log(`Done! Successfully Stored & Published in DB: ${successCount} | Failed: ${failCount}`);
console.log(`========================================\n`);
