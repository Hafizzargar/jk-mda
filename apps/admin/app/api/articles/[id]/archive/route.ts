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

    let reason: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && 'reason' in body && typeof body.reason === 'string') {
        reason = body.reason.trim() || null;
      }
    } catch {
      // Body is optional
    }

    const { data, error } = await userClient.rpc('archive_article', {
      p_article_id: id,
      p_reason: reason,
    });

    if (error) {
      console.error('archive_article RPC failed:', error);

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
          error.message === 'Article archive permission required' ||
          error.message === 'MFA (AAL2) is strictly required to archive articles'
        ) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (error.message === 'Only published or in-review articles can be archived') {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 409,
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
        status: 500,
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
