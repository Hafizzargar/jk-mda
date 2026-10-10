export function applyTranslations<T extends { article_translations?: { language_code: string, title: string, excerpt?: string | null }[], title: string, excerpt?: string | null }>(articles: T[], lang: string): T[] {
  if (!lang || lang === 'en') return articles;
  
  return articles.map(article => {
    const translation = article.article_translations?.find((t: { language_code: string, title: string, excerpt?: string | null }) => t.language_code === lang);
    if (translation) {
      return {
        ...article,
        title: translation.title || article.title,
        excerpt: translation.excerpt || article.excerpt,
      };
    }
    return article;
  });
}
