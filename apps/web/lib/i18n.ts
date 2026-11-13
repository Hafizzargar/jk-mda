export function applyTranslations<
  T extends {
    article_translations?: { language_code: string; title: string; excerpt?: string | null }[];
    title: string;
    excerpt?: string | null;
    author_display_name?: string | null;
  }
>(articles: T[], lang: string): T[] {
  return articles.map((article) => {
    let author = article.author_display_name;
    if (author === 'KCPJLN' || (author && author.startsWith('KCPJLN'))) {
      author = 'KJIN';
    }

    if (!lang || lang === 'en') {
      return {
        ...article,
        author_display_name: author,
      };
    }

    const translation = article.article_translations?.find(
      (t: { language_code: string; title: string; excerpt?: string | null }) => t.language_code === lang
    );

    if (translation) {
      return {
        ...article,
        author_display_name: author,
        title: translation.title || article.title,
        excerpt: translation.excerpt || article.excerpt,
      };
    }

    return {
      ...article,
      author_display_name: author,
    };
  });
}
