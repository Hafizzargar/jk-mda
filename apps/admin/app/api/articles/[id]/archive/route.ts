import { authorizeEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { UUID_PATTERN } from '@/lib/article-validation';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeEmployeeRequest(request, 'article.archive');
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    // Archiving is a destructive/high-impact lifecycle transition, so we mandate recent authentication
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

    const { data, error } = await userClient.rpc('archive_article', {
      p_article_id: id,
    });

    if (error) {
      console.error('archive_article RPC failed:', error);

      if (error.code === 'P0001') {
        if (error.message === 'Article not found') {
          return new Response(JSON.stringify({ error: 'Article not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (error.message === 'Article archive permission required') {
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

      return new Response(JSON.stringify({ error: 'Unable to archive article' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('Error archiving article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
