import { hasNonLatinScript, ensureEnglishTitle, ensureEnglishText } from '@/lib/sanitize';
import { resolveAuthorForArticle } from '@/lib/journalists';

export function getCorrespondentByBeat(article: { district?: string | null; category?: string | null; title?: string | null }): string {
  const dist = (article.district || '').toLowerCase().trim();
  const cat = (article.category || '').toLowerCase().trim();
  const title = (article.title || '').toLowerCase();

  if (title.includes('bhaderwah') || dist === 'bhaderwah') return 'Tariq Lone';
  if (title.includes('kishtwar') || dist === 'kishtwar') return 'Farooq Mir';
  if (title.includes('ramban') || title.includes('banihal') || dist === 'ramban') return 'Altaf Hussain Wani';
  if (title.includes('poonch') || dist === 'poonch' || title.includes('rajouri') || dist === 'rajouri') return 'Ghulam Nabi Raina';
  if (title.includes('leh') || title.includes('kargil') || title.includes('ladakh') || dist === 'leh' || dist === 'kargil') return 'Tsering Namgyal';
  if (title.includes('saffron') || title.includes('apple') || title.includes('mandi') || dist === 'pulwama') return 'Irfan Ahmad Dar';
  if (title.includes('dal lake') || title.includes('glacier') || title.includes('climate') || cat.includes('environment') || cat.includes('health')) return 'Dr. Zahoor Rather';

  const journalist = resolveAuthorForArticle(article.district, article.category);
  return journalist.name;
}

export function applyTranslations<
  T extends {
    article_translations?: { language_code: string; title: string; excerpt?: string | null }[];
    title: string;
    excerpt?: string | null;
    content?: string;
    author_display_name?: string | null;
    district?: string | null;
    category?: string | null;
  }
>(articles: T[], lang: string = 'en'): T[] {
  return articles.map((article) => {
    let author = article.author_display_name?.trim();
    if (!author || author === 'Hafeez Zargar' || author === 'Hafiz Zargar' || author === 'KJCPL Team' || author === 'Team' || author.startsWith('KJIN ') || author === 'KJIN') {
      author = getCorrespondentByBeat(article);
    } else if (author.includes('KJIN')) {
      author = author.replace(/\bKJIN\b/g, 'KJCPL');
    } else if (author.startsWith('KCPJLN')) {
      author = author.replace(/\bKCPJLN\b/g, 'KJCPL');
    }

    let title = article.title;
    let excerpt = article.excerpt;

    if (lang && lang !== 'en') {
      const translation = article.article_translations?.find((t) => t.language_code === lang);
      if (translation) {
        if (translation.title) title = translation.title;
        if (translation.excerpt) excerpt = translation.excerpt;
      }
    } else {
      // English edition (/en/ or default): strictly English headlines and excerpts
      if (hasNonLatinScript(title)) {
        title = ensureEnglishTitle(title, excerpt, article.content);
      }
      if (hasNonLatinScript(excerpt)) {
        excerpt = ensureEnglishText(excerpt, '');
      }
    }

    return {
      ...article,
      title,
      excerpt,
      author_display_name: author,
    };
  });
}
