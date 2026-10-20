export const MAX_TITLE_LENGTH = 255;
export const MIN_TITLE_LENGTH = 1;
export const MAX_SLUG_LENGTH = 255;
export const MIN_SLUG_LENGTH = 1;
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_EXCERPT_LENGTH = 1000;
export const MIN_CONTENT_LENGTH = 1;
export const MAX_CONTENT_LENGTH = 200_000; // 200k characters (~35k words), bounds body against DoS
export const MAX_URL_LENGTH = 2048;
export const URL_REGEX = /^https?:\/\/.+/;
export const MAX_SOURCE_NAME_LENGTH = 255;
export const MAX_TAXONOMY_LENGTH = 100;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidatedArticleInput {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string;
  district: string | null;
  source_name: string | null;
  source_url: string | null;
  featured_image_url: string | null;
}

export type ArticleValidationResult =
  | { success: true; data: ValidatedArticleInput }
  | { success: false; error: string; status: number };

const parseOptionalString = (value: unknown, fieldName: string): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new Error(`Invalid type for ${fieldName}: must be a string`);
  }
  const trimmed = value.trim();
  return trimmed || null;
};

export function validateHttpUrl(
  rawUrl: string,
  fieldName: string
): { valid: true; url: string } | { valid: false; error: string } {
  const trimmed = rawUrl.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    return { valid: false, error: `${fieldName} must not exceed ${MAX_URL_LENGTH} characters` };
  }
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\')) {
    return { valid: false, error: `${fieldName} must not be a protocol-relative URL` };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: `${fieldName} must be a valid, well-formed URL` };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `${fieldName} must be an HTTP or HTTPS URL` };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, error: `${fieldName} must not contain user credentials` };
  }
  if (!parsed.hostname || parsed.hostname.length === 0) {
    return { valid: false, error: `${fieldName} must contain a valid hostname` };
  }
  return { valid: true, url: parsed.href };
}

export function validateArticleInput(body: unknown): ArticleValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { success: false, error: 'Invalid request body', status: 400 };
  }

  const payload = body as Record<string, unknown>;
  const { title, slug, content, excerpt, district, category, source_name, source_url, featured_image_url } = payload;

  // 1. Title validation
  if (typeof title !== 'string') {
    return { success: false, error: 'Title is required and must be a string', status: 400 };
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length < MIN_TITLE_LENGTH || trimmedTitle.length > MAX_TITLE_LENGTH) {
    return {
      success: false,
      error: `Title must be between ${MIN_TITLE_LENGTH} and ${MAX_TITLE_LENGTH} characters`,
      status: 400,
    };
  }

  // 2. Slug validation (matching articles_slug_format & articles_slug_length)
  if (typeof slug !== 'string') {
    return { success: false, error: 'Slug is required and must be a string', status: 400 };
  }
  const trimmedSlug = slug.trim();
  if (trimmedSlug.length < MIN_SLUG_LENGTH || trimmedSlug.length > MAX_SLUG_LENGTH) {
    return {
      success: false,
      error: `Slug must be between ${MIN_SLUG_LENGTH} and ${MAX_SLUG_LENGTH} characters`,
      status: 400,
    };
  }
  if (!SLUG_REGEX.test(trimmedSlug)) {
    return {
      success: false,
      error: 'Slug must contain only lowercase alphanumeric characters and single hyphens (e.g. "my-article-slug")',
      status: 400,
    };
  }

  // 3. Content validation (matching articles_content_nonempty and bounded max)
  if (typeof content !== 'string') {
    return { success: false, error: 'Content is required and must be a string', status: 400 };
  }
  const trimmedContent = content.trim();
  if (trimmedContent.length < MIN_CONTENT_LENGTH) {
    return { success: false, error: 'Article content cannot be empty', status: 400 };
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return {
      success: false,
      error: `Article content exceeds maximum allowed length of ${MAX_CONTENT_LENGTH} characters`,
      status: 400,
    };
  }

  // Optional string fields parsing
  let p_excerpt: string | null;
  let p_district: string | null;
  let p_category: string;
  let p_source_name: string | null;
  let p_source_url: string | null;
  let p_featured_image_url: string | null;

  try {
    p_excerpt = parseOptionalString(excerpt, 'excerpt');
    p_district = parseOptionalString(district, 'district');
    p_category = parseOptionalString(category, 'category') || 'General';
    p_source_name = parseOptionalString(source_name, 'source_name');
    p_source_url = parseOptionalString(source_url, 'source_url');
    p_featured_image_url = parseOptionalString(featured_image_url, 'featured_image_url');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid optional string field';
    return { success: false, error: msg, status: 400 };
  }

  // 4. Excerpt length validation (matching articles_excerpt_length)
  if (p_excerpt && p_excerpt.length > MAX_EXCERPT_LENGTH) {
    return {
      success: false,
      error: `Excerpt must not exceed ${MAX_EXCERPT_LENGTH} characters`,
      status: 400,
    };
  }


  // 5. URL validation (parsing & verifying well-formed HTTP/HTTPS URLs)
  if (p_source_url) {
    const urlCheck = validateHttpUrl(p_source_url, 'Source URL');
    if (!urlCheck.valid) {
      return {
        success: false,
        error: urlCheck.error,
        status: 400,
      };
    }
    p_source_url = urlCheck.url;
  }

  if (p_featured_image_url) {
    const urlCheck = validateHttpUrl(p_featured_image_url, 'Featured image URL');
    if (!urlCheck.valid) {
      return {
        success: false,
        error: urlCheck.error,
        status: 400,
      };
    }
    p_featured_image_url = urlCheck.url;
  }

  // 6. Source name length validation
  if (p_source_name && p_source_name.length > MAX_SOURCE_NAME_LENGTH) {
    return {
      success: false,
      error: `Source name must not exceed ${MAX_SOURCE_NAME_LENGTH} characters`,
      status: 400,
    };
  }

  // 7. District and Category length validation
  if (p_district && p_district.length > MAX_TAXONOMY_LENGTH) {
    return {
      success: false,
      error: `District must not exceed ${MAX_TAXONOMY_LENGTH} characters`,
      status: 400,
    };
  }
  if (p_category && p_category.length > MAX_TAXONOMY_LENGTH) {
    return {
      success: false,
      error: `Category must not exceed ${MAX_TAXONOMY_LENGTH} characters`,
      status: 400,
    };
  }

  return {
    success: true,
    data: {
      title: trimmedTitle,
      slug: trimmedSlug,
      content: trimmedContent,
      excerpt: p_excerpt,
      category: p_category,
      district: p_district,
      source_name: p_source_name,
      source_url: p_source_url,
      featured_image_url: p_featured_image_url,
    },
  };
}
