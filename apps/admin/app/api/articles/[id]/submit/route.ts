import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeEmployeeRequest(request, 'article.submit_review');
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    const { userClient } = authorization;
    const { id } = await context.params;

    const { data, error } = await userClient.rpc('submit_article_for_review', {
      p_article_id: id
    });

    if (error) {
      console.error('submit_article_for_review RPC failed:', error);
      return new Response(JSON.stringify({ error: 'Unable to submit article for review' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    console.error('Error submitting article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
