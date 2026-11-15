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
    if (author === 'KCPJLN' || (author && author.startsWith('KCPJLN'))) {
      author = 'KJIN';
    }

    return {
      ...article,
      author_display_name: author,
    };
  });
}
