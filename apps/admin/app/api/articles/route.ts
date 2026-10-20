import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { validateArticleInput } from '@/lib/article-validation';

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
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validation = validateArticleInput(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: validation.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const {
      title,
      slug,
      content,
      excerpt,
      category,
      district,
      source_name,
      source_url,
      featured_image_url,
    } = validation.data;

    // Call the secured database RPC
    const { data, error } = await userClient.rpc('create_article', {
      p_title: title,
      p_excerpt: excerpt,
      p_content: content,
      p_slug: slug,
      p_district: district,
      p_category: category,
      p_source_name: source_name,
      p_source_url: source_url,
      p_featured_image_url: featured_image_url,
    });

    if (error) {
      console.error('create_article RPC failed:', error);
      const clientMessage =
        error.code === '23505'
          ? 'An article with this slug already exists'
          : 'Unable to create article';
      return new Response(JSON.stringify({ error: clientMessage }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('Error creating article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
