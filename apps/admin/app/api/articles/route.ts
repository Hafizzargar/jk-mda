import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

const optionalString = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('INVALID_STRING_FIELD');
  const trimmed = value.trim();
  return trimmed || null;
};

export async function POST(request: Request) {
  try {
    const authorization = await authorizeEmployeeRequest(request, 'article.create');
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    const { userClient } = authorization;

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { 
      title, 
      excerpt, 
      content, 
      slug, 
      district, 
      category, 
      source_name, 
      source_url, 
      featured_image_url 
    } = body;

    // Type checking and basic string presence
    if (
      typeof title !== 'string' ||
      typeof slug !== 'string' ||
      typeof content !== 'string' ||
      !title.trim() ||
      !slug.trim() ||
      !content.trim()
    ) {
      return new Response(JSON.stringify({ error: 'Title, slug, and content are required and must be strings' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let p_excerpt, p_district, p_category, p_source_name, p_source_url, p_featured_image_url;
    
    try {
      p_excerpt = optionalString(excerpt);
      p_district = optionalString(district);
      p_category = optionalString(category) || 'General';
      p_source_name = optionalString(source_name);
      p_source_url = optionalString(source_url);
      p_featured_image_url = optionalString(featured_image_url);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid type for optional string field' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Call the secured database RPC
    const { data, error } = await userClient.rpc('create_article', {
      p_title: title.trim(),
      p_excerpt,
      p_content: content.trim(),
      p_slug: slug.trim(),
      p_district,
      p_category,
      p_source_name,
      p_source_url,
      p_featured_image_url
    });

    if (error) {
      console.error('create_article RPC failed:', error);
      return new Response(JSON.stringify({ error: 'Unable to create article' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    console.error('Error creating article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
