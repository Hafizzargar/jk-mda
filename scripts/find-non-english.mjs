import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('apps/admin/.env.local', 'utf8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[m[1]] = val;
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Fetch articles with non-ASCII or Devanagari titles
const { data: articles } = await supabase.from('articles').select('id, title, slug, category, status');
console.log('Total articles in DB:', articles?.length);

for (const a of (articles || [])) {
  const hasDevanagari = /[\u0900-\u097F]/.test(a.title);
  if (hasDevanagari || a.slug.includes('2-31-1j47-ca84')) {
    console.log('NON-ENGLISH ARTICLE FOUND:', { id: a.id, title: a.title, slug: a.slug });
  }
}

// 2. Check ai_drafts
const { data: drafts } = await supabase.from('ai_drafts').select('id, source_title, status');
console.log('Total ai_drafts in DB:', drafts?.length);
for (const d of (drafts || [])) {
  const hasDevanagari = /[\u0900-\u097F]/.test(d.source_title);
  if (hasDevanagari) {
    console.log('NON-ENGLISH DRAFT FOUND:', { id: d.id, source_title: d.source_title });
  }
}
