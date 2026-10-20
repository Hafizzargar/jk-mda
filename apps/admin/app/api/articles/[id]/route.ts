import { authenticateEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { validateArticleInput, UUID_PATTERN } from '@/lib/article-validation';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // We only authenticate at the edge. The database RPC update_article enforces whether the user 
    // has article.review (for reviewers) or article.create (for authors editing their own drafts).
    const authorization = await authenticateEmployeeRequest(request);
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    const { userClient } = authorization;
    const { id } = await context.params;

    if (!id || typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      return new Response(JSON.stringify({ error: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
    const { data, error } = await userClient.rpc('update_article', {
      p_article_id: id,
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
      console.error('update_article RPC failed:', error);

      if (error.code === 'P0001') {
        if (error.message === 'Article not found') {
          return new Response(JSON.stringify({ error: 'Article not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (error.message === 'Unauthorized to edit this article in its current state') {
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

      if (error.code === '23505') {
        return new Response(JSON.stringify({ error: 'An article with this slug already exists' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Unable to update article' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('Error updating article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
