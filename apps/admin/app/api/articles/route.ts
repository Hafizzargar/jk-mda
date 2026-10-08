import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

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

    // Call the secured database RPC
    const { data, error } = await userClient.rpc('create_article', {
      p_title: title.trim(),
      p_excerpt: excerpt ? String(excerpt).trim() : null,
      p_content: content.trim(),
      p_slug: slug.trim(),
      p_district: district ? String(district).trim() : null,
      p_category: category ? String(category).trim() : 'General',
      p_source_name: source_name ? String(source_name).trim() : null,
      p_source_url: source_url ? String(source_url).trim() : null,
      p_featured_image_url: featured_image_url ? String(featured_image_url).trim() : null
    });

    if (error) {
      console.error('create_article RPC failed:', error);
      return new Response(JSON.stringify({ error: 'Unable to create article' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Error creating article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
