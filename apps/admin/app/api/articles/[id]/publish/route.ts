import { authorizeEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { UUID_PATTERN } from '@/lib/article-validation';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeEmployeeRequest(request, 'article.publish');
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    const { userClient } = authorization;

    // 1. Enforce Recent Authentication for privileged operations! (15-minute window)
    const reauthResponse = await requireRecentAuthentication(authorization, request);
    if (reauthResponse) {
      return reauthResponse;
    }

    const { id } = await context.params;

    // 2. Validate article UUID format
    if (!id || typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      return new Response(JSON.stringify({ error: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Call the secured database RPC
    const { data, error } = await userClient.rpc('publish_article', {
      p_article_id: id,
    });

    if (error) {
      console.error('publish_article RPC failed:', error);

      // Validation error from Postgres type coercion
      if (error.code === '22P02') {
        return new Response(JSON.stringify({ error: 'Invalid article ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check against explicitly approved business messages from P0001
      if (error.code === 'P0001') {
        const msg = error.message;

        if (msg === 'Article not found') {
          return new Response(JSON.stringify({ error: 'Article not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (
          msg === 'Only articles in review can be published' ||
          msg === 'Article must be in review status before publishing' ||
          msg === 'Only articles in review or draft can be published'
        ) {
          return new Response(JSON.stringify({ error: msg }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (
          msg === 'Article publish permission required' ||
          msg === 'MFA (AAL2) is strictly required to publish articles'
        ) {
          return new Response(JSON.stringify({ error: msg }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (msg === 'Authenticated employee required') {
          return new Response(JSON.stringify({ error: msg }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Hide unexpected database details (unapproved P0001 raises, syntax errors, connection errors)
      return new Response(JSON.stringify({ error: 'Unable to publish article' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('Error publishing article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

