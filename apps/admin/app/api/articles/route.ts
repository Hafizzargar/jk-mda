import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { validateArticleInput } from '@/lib/article-validation';
import { readBoundedJson, MAX_ARTICLE_PAYLOAD_BYTES } from '@/lib/request-utils';

export async function POST(request: Request) {
  try {
    const authorization = await authorizeEmployeeRequest(request, 'article.create');
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    const { userClient } = authorization;

    const bodyResult = await readBoundedJson(request, MAX_ARTICLE_PAYLOAD_BYTES);
    if (!bodyResult.success) {
      return new Response(JSON.stringify({ error: bodyResult.error }), {
        status: bodyResult.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validation = validateArticleInput(bodyResult.data);
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

      // Client error: duplicate slug
      if (error.code === '23505') {
        return new Response(JSON.stringify({ error: 'An article with this slug already exists' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Client error: explicit permission/auth failures from RPC
      if (error.code === 'P0001') {
        if (error.message === 'Article creation permission required') {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (error.message === 'Authenticated employee required') {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Server failure: hide unexpected database internals
      return new Response(JSON.stringify({ error: 'Unable to create article' }), {
        status: 500,
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
