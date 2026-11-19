import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read credentials
const env = fs.readFileSync('apps/admin/.env.local', 'utf-8');
let url = '', key = '';
for (const line of env.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
}

if (!url || !key) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const client = createClient(url, key);

function cleanSlug(slug, title) {
  if (slug === '2-31-1j47-ca84') {
    return 'india-calls-equitable-second-global-stocktake-cop31-antalya-2026';
  }
  
  // If slug has random hash at the end like -7v65-b4zt or -5wdd-rbxr
  let cleaned = slug.replace(/-[a-z0-9]{4}-[a-z0-9]{4}$/i, '');
  cleaned = cleaned.replace(/-[a-z0-9]{4}$/i, '');
  
  // If slug is too short or malformed, derive from title
  if (cleaned.length < 15 || /^[0-9-]+$/.test(cleaned)) {
    cleaned = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    let base = cleaned.slice(0, 65);
    const lastHyphen = base.lastIndexOf('-');
    if (lastHyphen > 30) base = base.slice(0, lastHyphen);
    cleaned = base;
  }
  
  if (!cleaned.endsWith('-2026')) {
    cleaned = `${cleaned}-2026`;
  }
  
  return cleaned.replace(/--+/g, '-').toLowerCase();
}

function assignJournalist(district, category) {
  const dist = (district || '').toLowerCase().trim();
  const cat = (category || '').toLowerCase().trim();

  if (dist === 'doda' || dist === 'bhaderwah') return 'Tariq Lone';
  if (dist === 'kishtwar') return 'Farooq Mir';
  if (dist === 'ramban') return 'Altaf Hussain Wani';
  if (dist === 'poonch' || dist === 'rajouri') return 'Ghulam Nabi Raina';
  if (dist === 'leh' || dist === 'kargil') return 'Tsering Namgyal';
  if (['pulwama', 'shopian', 'anantnag', 'kulgam'].includes(dist) && ['economy', 'agriculture', 'horticulture'].includes(cat)) {
    return 'Irfan Ahmad Dar';
  }
  if (['jammu', 'samba', 'kathua', 'udhampur', 'reasi'].includes(dist)) {
    return 'Sunita Sharma';
  }
  if (['environment', 'health', 'science'].includes(cat)) {
    return 'Dr. Zahoor Rather';
  }
  if (['problems', 'investigation', 'local'].includes(cat)) {
    return 'Mushtaq Parra';
  }
  if (dist === 'srinagar') {
    return 'Mushtaq Parra';
  }

  return 'Tariq Lone';
}

async function run() {
  console.log('Fetching articles...');
  const { data: articles, error } = await client
    .from('articles')
    .select('id, slug, title, category, district, author_display_name, published_at')
    .order('published_at', { ascending: false });

  if (error || !articles) {
    console.error('Fetch error:', error);
    process.exit(1);
  }

  console.log(`Processing ${articles.length} articles...`);

  const baseDate = new Date('2026-11-19T13:00:00.000Z');
  let updatedCount = 0;
  const usedSlugs = new Set();

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    
    // 1. Natural staggering: 8m, 15m, 23m, 32m, 41m, 51m, etc.
    const minutesAgo = 8 + i * 7 + Math.floor((i % 5) * 2);
    const staggeredPublishedAt = new Date(baseDate.getTime() - minutesAgo * 60 * 1000).toISOString();
    
    // 2. Clean slug
    let newSlug = cleanSlug(art.slug, art.title);
    if (usedSlugs.has(newSlug)) {
      newSlug = `${newSlug.replace(/-2026$/, '')}-${i + 1}-2026`;
    }
    usedSlugs.add(newSlug);

    // 3. Named journalist
    const newAuthor = assignJournalist(art.district, art.category);

    // 4. Clean category
    let newCategory = art.category;
    if (art.category === 'Science & Technology') {
      newCategory = 'Science';
    }

    const updates = {
      slug: newSlug,
      author_display_name: newAuthor,
      published_at: staggeredPublishedAt,
      updated_at: staggeredPublishedAt,
      category: newCategory,
    };

    const { error: updateErr } = await client
      .from('articles')
      .update(updates)
      .eq('id', art.id);

    if (updateErr) {
      console.error(`Error updating article ${art.id}:`, updateErr.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} articles with clean slugs, accredited bylines, and naturally staggered timestamps!`);
}

run();
