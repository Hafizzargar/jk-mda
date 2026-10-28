import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const OWNER_UID = 'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d';

function createOwnerJwt() {
  const secret = 'super-secret-jwt-token-with-at-least-32-characters-long';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'supabase-demo',
      sub: OWNER_UID,
      role: 'authenticated',
      email: 'hafizzargar6@gmail.com',
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

const INTERNATIONAL_STORIES = [
  {
    title: 'Kashmir GI-Tagged Saffron and Organic Walnuts Secure Direct Trade Protocol with Gulf Cooperation Council at Dubai Expo',
    slug: 'kashmir-saffron-walnut-trade-protocol-dubai-gcc-2026',
    category: 'International',
    district: 'srinagar',
    excerpt: 'Agri-export consortium ink bilateral supply framework establishing zero-tariff cold corridors between Srinagar International Airport and UAE air cargo hubs.',
    content: `## Cross-Border Agricultural Diplomacy Expands Kashmir Export Footprint

A high-level trade delegation comprising Kashmir valley agri-producers, Srinagar Chamber of Commerce representatives, and UAE trade officials signed a milestone memorandum of trade in Dubai today.

The bilateral agreement facilitates direct air-freight routing for certified Grade-1 saffron, organic walnuts, and freeze-dried honey from Srinagar International Airport directly to major distribution centers across Dubai, Abu Dhabi, Doha, and Riyadh.

### Cryptographic Authenticity and Fast-Track Clearance

"Under the newly ratified protocol, consignments carrying official GI cryptographic tags will benefit from pre-arrival electronic customs clearance," stated Farooq Ahmad Wani, Director of the Kashmir Export Promotion Council. "This reduces shelf transit time by nearly 72 hours, ensuring the volatile aromatic oils of Kashmiri saffron arrive in peak condition."

Gulf supermarket chains have committed to an initial aggregate procurement volume of $14.5 million across the upcoming winter quarter, representing a historic high for valley horticulture cooperatives.`,
    source_name: 'KJIN International Trade Desk (Dubai)',
    source_url: 'https://kjin.org/dispatches/kashmir-gcc-trade-accord-2026',
    featured_image_url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 0.8,
  },
  {
    title: 'International Cryosphere Consortium and University of Kashmir Launch Joint Glacier Observation Mission on Kolahoi and Siachen',
    slug: 'international-glacier-observation-mission-kolahoi-siachen-2026',
    category: 'International',
    district: 'anantnag',
    excerpt: 'Swiss, Austrian, and Himalayan glaciologists deploy autonomous radar beacons to track high-altitude meltwater dynamics across the western Himalayas.',
    content: `## Global Climate Scientists Converge on Himalayan Glacial Basins

The International Cryosphere Climate Initiative (ICCI) in partnership with the University of Kashmir Earth Sciences Department today initiated a collaborative 36-month field research mission monitoring glacier volume trends across the Kolahoi, Thajiwas, and northern Pir Panjal ice fields.

Equipped with solar-powered deep-penetrating radar arrays and satellite telemetry beacons, the joint research team aims to provide real-time streamflow forecasts to valley irrigation boards and downstream hydropower facilities.

### Science Diplomacy and Mountain Ecosystem Protection

Lead glaciologist Dr. Elena Keller of the Zurich Alpine Research Institute emphasized the global stakes: "The glaciers of Jammu, Kashmir, and Ladakh represent the water tower of South Asia. Collaborative telemetry gives local communities predictive warnings against glacial lake outburst floods (GLOFs) while informing international carbon reduction targets."

The research data will be made openly accessible to academic institutions worldwide through the Global Cryosphere Telemetry Portal.`,
    source_name: 'KJIN Science & Global Affairs Desk',
    source_url: 'https://kjin.org/dispatches/international-glacier-mission-2026',
    featured_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 2.2,
  },
  {
    title: 'J&K Diaspora Cultural Alliance Concludes European Conclave in Vienna with Pledges for Heritage Digitization',
    slug: 'jk-diaspora-cultural-conclave-vienna-heritage-digitization-2026',
    category: 'International',
    district: 'srinagar',
    excerpt: 'Over 400 scholars, artists, and overseas diaspora representatives establish a multi-million euro foundation to preserve Kashmiri and Dogri archival manuscripts.',
    content: `## Connecting Global Heritage to the Valley and Plains

The 2026 Global Jammu and Kashmir Diaspora Summit drew to a triumphant close in Vienna on Friday evening, concluding three days of symposiums on historical manuscript conservation, traditional carpet craftsmanship, and multilingual linguistic education.

Delegates from the United Kingdom, Germany, North America, and the Gulf pledged the creation of the International Valley Heritage Endowment, funding digital archiving of rare 16th-century Sharada, Persian, and Dogri manuscripts currently housed in private European libraries and regional archives.

### Cross-Cultural Bridges

"Our connection to our homeland remains vibrant across generations," said diaspora council president Dr. Mehmooda Akhtar. "By digitizing these treasures with high-resolution multispectral scanning, we are making our shared cultural legacy accessible to youth in Srinagar, Jammu, and around the globe."

The foundation will begin its first wave of digitization grants in partnership with the SP Museum and the Dogra Art Gallery early next month.`,
    source_name: 'KJIN Global Diaspora Bureau (Vienna)',
    source_url: 'https://kjin.org/dispatches/diaspora-conclave-vienna-2026',
    featured_image_url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=80',
    published_hours_ago: 4.5,
  },
];

async function seedInternationalNews() {
  console.log(`Starting International News Seeding...`);

  for (const item of INTERNATIONAL_STORIES) {
    try {
      console.log(`\nCreating: "${item.title}"`);
      const { data: draft, error: createError } = await client.rpc('create_article', {
        p_title: item.title,
        p_slug: item.slug,
        p_category: item.category,
        p_district: item.district,
        p_excerpt: item.excerpt,
        p_content: item.content,
        p_source_name: item.source_name,
        p_source_url: item.source_url,
        p_featured_image_url: item.featured_image_url,
      });

      let articleId = draft?.id;
      if (createError) {
        if (createError.message?.includes('duplicate') || createError.code === '23505') {
          const { data: existing } = await adminClient
            .from('articles')
            .select('id')
            .eq('slug', item.slug)
            .single();
          articleId = existing?.id;
        } else {
          console.error(`  Create error:`, createError.message);
          continue;
        }
      }

      console.log(`  Article ID: ${articleId}`);

      // Submit for review
      await client.rpc('submit_article_for_review', { p_article_id: articleId });
      // Publish
      await client.rpc('publish_article', { p_article_id: articleId });

      // Stagger published_at
      const targetTime = new Date(Date.now() - item.published_hours_ago * 3600 * 1000).toISOString();
      await adminClient
        .from('articles')
        .update({
          published_at: targetTime,
          created_at: targetTime,
          updated_at: targetTime,
          view_count: Math.floor(Math.random() * 150) + 50,
        })
        .eq('id', articleId);

      console.log(`  Published successfully in International!`);
    } catch (err) {
      console.error(`  Error:`, err);
    }
  }
  console.log(`\nSeeding completed successfully!`);
}

seedInternationalNews();
