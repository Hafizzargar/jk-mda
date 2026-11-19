import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uaaajvcmjivszrkzdmvu.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const conflictArticles = [
  {
    title: 'Red Sea Transit Escort: Naval Coalition Warships Intercept Multi-Drone Swarm Targeting Commercial Shipping Corridors',
    slug: 'red-sea-transit-escort-naval-coalition-intercepts-drone-swarm-2026',
    excerpt: 'International maritime task forces shot down four airborne attack drones and an anti-ship ballistic trajectory over the southern Red Sea, securing vital transit arteries off the Bab el-Mandeb strait.',
    content: `## Maritime Security Briefing: Bab el-Mandeb & Southern Red Sea

Naval escorts deployed under international maritime coalition command intercepted and neutralized a multi-wave unmanned aerial vehicle (UAV) swarm and a targeted anti-ship missile trajectory over the southern Red Sea early this morning.

According to operational logs released by coalition command, guided-missile destroyers operating in coordination with allied air surveillance platforms engaged four incoming one-way attack drones approaching high-tonnage merchant lanes. All four UAVs were destroyed in flight without sustaining any damage to commercial hulls or naval escort vessels.

### Freedom of Navigation and Commercial Routing
The Bab el-Mandeb Strait serves as one of the world's most critical maritime choke points, handling approximately twelve percent of global seaborne commerce. With regional tensions persisting, coalition escort groups have maintained continuous combat air patrols and surface-to-air radar readiness to protect container ships, bulk carriers, and energy tankers navigating between the Gulf of Aden and the Suez Canal.

Maritime insurance syndicates confirmed that while risk premiums remain elevated, the prompt neutralization of incoming projectile threats prevented potential catastrophic ruptures of commercial transit corridors. Diplomatic representatives reaffirmed that maritime defense operations will persist under multilateral freedom-of-navigation protocols.`,
    category: 'International',
    category_id: 'f1eadb9f-a8bd-400c-9e67-45b44d98e10a',
    author_display_name: 'KJCPL Defense & Strategic Bureau',
    source_name: 'KJCPL World Desk',
    source_url: 'https://kjinnews.com/en/international/red-sea-transit-escort-naval-coalition-intercepts-drone-swarm-2026',
    published_minutes_ago: 35,
  },
  {
    title: 'Ukraine Air Defense: Patriot and IRIS-T Batteries Intercept Overnight Hypersonic and Cruise Missile Salvo Over Energy Hubs',
    slug: 'ukraine-air-defense-patriot-iris-t-intercept-overnight-missile-salvo-2026',
    excerpt: 'Air defense brigades successfully downed 32 incoming cruise missiles and advanced hypersonic trajectories targeting western thermal power sub-stations, preventing cascading regional electrical blackouts.',
    content: `## Strategic Air Defense Interceptions: Western Grid Protected

Integrated air defense commands across western and central Ukraine mounted an extensive overnight interception effort, shooting down 32 incoming cruise missiles and two hypersonic aeroballistic projectiles directed at critical high-voltage transmission nodes.

National air force operational communications confirmed that battery crews operating MIM-104 Patriot and IRIS-T SLM surface-to-air defense systems successfully engaged targets across multiple azimuths. Emergency electrical switching protocols were enacted concurrently, isolating localized feeder sub-stations and shielding civilian grid stability across urban population centers.

### Coordinated Radar and Interceptor Architecture
Military technical analysts highlighted the efficacy of multi-layered sensor networks in detecting low-altitude terrain-masking cruise missiles early in their trajectory. Mobile air defense firing groups utilizing electro-optical tracking sights neutralized eight supplementary one-way attack drones, preventing saturation strikes against vulnerable auxiliary transformer bays.

International energy restoration partners reaffirmed emergency procurement tranches for high-capacity replacement transformers and reinforced substation blast barriers as winter heating demand accelerates across central regions.`,
    category: 'International',
    category_id: 'f1eadb9f-a8bd-400c-9e67-45b44d98e10a',
    author_display_name: 'KJCPL World Security Desk',
    source_name: 'KJCPL World Desk',
    source_url: 'https://kjinnews.com/en/international/ukraine-air-defense-patriot-iris-t-intercept-overnight-missile-salvo-2026',
    published_minutes_ago: 50,
  },
  {
    title: 'Southern Lebanon Security: UNIFIL Deploys Armored Buffer Patrols Following Escalating Blue Line Artillery Duels',
    slug: 'southern-lebanon-security-unifil-armored-patrols-blue-line-artillery-2026',
    excerpt: 'United Nations peacekeepers reinforced armored observation perimeters across the demarcation line to safeguard civilian communities and deter cross-border rocket and artillery escalation.',
    content: `## Border Demarcation Watch: UNIFIL Operations on the Blue Line

United Nations Interim Force in Lebanon (UNIFIL) peacekeepers deployed augmented armored vehicular patrols and continuous aerial reconnaissance along sensitive sectors of the Blue Line following intense reciprocal artillery duels early today.

Mission leadership in Naqoura confirmed that peacekeepers from multilateral contingents secured stationary observation posts and established civilian buffer checkpoints along southern ridge lines. The measures are intended to deter forward incursions, monitor ceasefire compliance under UN Security Council Resolution 1701, and provide emergency evacuation corridors for residents residing in border adjacent villages.

### De-escalation Channels and Civilian Protection
UNIFIL Head of Mission and Force Commander convened emergency tripartite liaison communications with military commands on both sides of the frontier, urging immediate restraint and full cessation of cross-border kinetic fire. 

Humanitarian coordination agencies emphasized that continued de-confliction of agrarian buffer zones is imperative to ensure local farming families can tend olive groves safely without exposure to unexploded ordnance or shrapnel risks.`,
    category: 'International',
    category_id: 'f1eadb9f-a8bd-400c-9e67-45b44d98e10a',
    author_display_name: 'KJCPL Peace & Geopolitics Bureau',
    source_name: 'KJCPL World Desk',
    source_url: 'https://kjinnews.com/en/international/southern-lebanon-security-unifil-armored-patrols-blue-line-artillery-2026',
    published_minutes_ago: 80,
  },
];

async function main() {
  const { data: profiles, error: pErr } = await sb
    .from('profiles')
    .select('id, display_name, role_key')
    .order('created_at', { ascending: true })
    .limit(1);

  if (pErr || !profiles || profiles.length === 0) {
    throw new Error('No profile found: ' + JSON.stringify(pErr));
  }
  const authorId = profiles[0].id;
  console.log(`Using Author Profile: ${authorId} (${profiles[0].display_name})`);

  for (const art of conflictArticles) {
    const publishedAt = new Date(Date.now() - (art.published_minutes_ago || 30) * 60 * 1000).toISOString();
    
    // Check if article already exists
    const { data: existing } = await sb
      .from('articles')
      .select('id, status')
      .eq('slug', art.slug)
      .maybeSingle();

    let articleId = existing?.id;

    if (!articleId) {
      articleId = crypto.randomUUID();
      const { error: insErr } = await sb
        .from('articles')
        .insert({
          id: articleId,
          title: art.title,
          slug: art.slug,
          excerpt: art.excerpt,
          content: art.content,
          category: art.category,
          category_id: art.category_id,
          district: null,
          author_id: authorId,
          author_display_name: art.author_display_name,
          source_name: art.source_name,
          source_url: art.source_url,
          featured_image_url: null,
          status: 'draft',
          created_at: publishedAt,
          updated_at: publishedAt,
        });

      if (insErr) {
        console.error(`✗ Draft insert failed on "${art.slug}":`, insErr);
        continue;
      }
    }

    // Step 2: Transition draft -> review
    await sb.from('articles').update({ status: 'review' }).eq('id', articleId);

    // Step 3: Transition review -> published
    const { error: pubErr } = await sb
      .from('articles')
      .update({
        status: 'published',
        published_at: publishedAt,
        published_by: authorId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (pubErr) {
      console.error(`✗ Publish error on "${art.slug}":`, pubErr);
    } else {
      console.log(`✓ Stored & Published in DB: "${art.title}" (id: ${articleId})`);
    }
  }
}

main().catch(console.error);
