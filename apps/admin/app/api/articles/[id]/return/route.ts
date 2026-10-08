import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    const { userClient } = authorization;
    const { id } = await context.params;

    const { data, error } = await userClient.rpc('return_article_to_draft', {
      p_article_id: id
    });

    if (error) {
      console.error('return_article_to_draft RPC failed:', error);
      return new Response(JSON.stringify({ error: 'Unable to return article to draft' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Error returning article to draft:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
