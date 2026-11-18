export function applyTranslations<
  T extends {
    article_translations?: { language_code: string; title: string; excerpt?: string | null }[];
    title: string;
    excerpt?: string | null;
    author_display_name?: string | null;
  }
>(articles: T[], _lang?: string): T[] {
  return articles.map((article) => {
    let author = article.author_display_name;
    if (!author || author === 'KJCPL Team' || author === 'Team') {
      author = 'Hafiz Zargar';
    } else if (author.includes('KJIN')) {
      author = author.replace(/\bKJIN\b/g, 'KJCPL');
    } else if (author.startsWith('KCPJLN')) {
      author = author.replace(/\bKCPJLN\b/g, 'KJCPL');
    }

    return {
      ...article,
      author_display_name: author,
    };
  });
}
