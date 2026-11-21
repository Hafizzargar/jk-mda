export interface ArticleRedirect {
  sourceCategory: string;
  sourceSlug: string;
  targetCategory: string;
  targetSlug: string;
}

export const ARTICLE_REDIRECTS: ArticleRedirect[] = [
  {
    sourceCategory: 'national',
    sourceSlug: 'isro-validates-cryogenic-engine-next-gen-heavy-orbital-launches-2026',
    targetCategory: 'national',
    targetSlug: 'isro-validates-cryogenic-upper-stage-gaganyaan-orbital-module-2026',
  },
  {
    sourceCategory: 'national',
    sourceSlug: 'isro-heavy-lift-launch-vehicle-gaganyaan-orbital-test',
    targetCategory: 'national',
    targetSlug: 'isro-validates-cryogenic-upper-stage-gaganyaan-orbital-module-2026',
  },
];

export function findArticleRedirect(category: string, slug: string): ArticleRedirect | undefined {
  const normalizedCategory = category.toLowerCase().trim();
  const normalizedSlug = slug.toLowerCase().trim();
  return ARTICLE_REDIRECTS.find(
    (redirect) =>
      redirect.sourceCategory === normalizedCategory &&
      redirect.sourceSlug === normalizedSlug,
  );
}

export function getArticleRedirectPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/en\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return undefined;
  const redirect = findArticleRedirect(match[1], match[2]);
  return redirect ? `/en/${redirect.targetCategory}/${redirect.targetSlug}` : undefined;
}
