import { authorizeEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { UUID_PATTERN } from '@/lib/article-validation';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    let authorization = await authorizeEmployeeRequest(request, 'article.publish');
    if (!isEmployeeAuthorization(authorization)) {
      authorization = await authorizeEmployeeRequest(request, 'article.review');
      if (!isEmployeeAuthorization(authorization)) {
        return authorization;
      }
    }

    const reauthResponse = await requireRecentAuthentication(authorization, request);
    if (reauthResponse) {
      return reauthResponse;
    }

    const { userClient } = authorization;
    const { id } = await context.params;

    if (!id || typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      return new Response(JSON.stringify({ error: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let targetStatus = 'published';
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && 'target_status' in body && typeof body.target_status === 'string') {
        if (['published', 'review', 'draft'].includes(body.target_status)) {
          targetStatus = body.target_status;
        }
      }
    } catch {
      // Body is optional
    }

    const { data, error } = await userClient.rpc('reactivate_article', {
      p_article_id: id,
      p_target_status: targetStatus,
    });

    if (error) {
      console.error('reactivate_article RPC failed:', error);

      if (error.code === '22P02') {
        return new Response(JSON.stringify({ error: 'Invalid article ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (error.code === 'P0001') {
        if (error.message === 'Article not found') {
          return new Response(JSON.stringify({ error: 'Article not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (
          error.message === 'Article publish or review permission required' ||
          error.message.includes('permission required')
        ) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (
          error.message === 'Only inactive/archived articles can be reactivated' ||
          error.message.includes('Archived articles can only transition')
        ) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ error: error.message || 'Unable to reactivate article' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('Error reactivating article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
