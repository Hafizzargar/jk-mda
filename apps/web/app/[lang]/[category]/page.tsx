import { redirect } from 'next/navigation';
import { isValidCategory } from '@/lib/taxonomy';

interface DynamicCategoryRouteProps {
  params: Promise<{
    lang: string;
    category: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DynamicCategoryRoute({ params, searchParams }: DynamicCategoryRouteProps) {
  const { lang, category } = await params;
  const resolvedSearchParams = await searchParams;
  const rawCat = (category || '').toLowerCase().trim();
  const langPrefix = lang && lang !== 'en' ? `/${lang}` : '';

  // Forward query parameters like ?page=2
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => queryParams.append(key, v));
      } else {
        queryParams.set(key, value);
      }
    }
  }
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  if (rawCat === 'articles' || rawCat === 'latest') {
    redirect(`${langPrefix}/latest${queryString}`);
  }

  if (rawCat === 'india' || rawCat === 'national') {
    redirect(`${langPrefix}/india${queryString}`);
  }

  if (rawCat === 'international') {
    redirect(`${langPrefix}/international${queryString}`);
  }

  if (rawCat === 'problem' || rawCat === 'problems') {
    redirect(`${langPrefix}/category/problems${queryString}`);
  }

  if (isValidCategory(rawCat)) {
    redirect(`${langPrefix}/category/${rawCat}${queryString}`);
  }

  // Fallback for unknown top-level slugs to homepage
  redirect(langPrefix || '/');
}
