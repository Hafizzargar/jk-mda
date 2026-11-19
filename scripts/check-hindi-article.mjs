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

const { data: article } = await supabase.from('articles').select('*').ilike('slug', '%2-31-1j47-ca84%').maybeSingle();
console.log('Article found by slug:', article ? {
  id: article.id,
  title: article.title,
  slug: article.slug,
  content: article.content?.slice(0, 200),
  excerpt: article.excerpt,
} : null);

if (!article) {
  const { data: allArticles } = await supabase.from('articles').select('id, title, slug, created_at').order('created_at', { ascending: false }).limit(10);
  console.log('Recent articles:', allArticles);
}
