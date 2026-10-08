import { authorizeEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';

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

    const { data, error } = await userClient.rpc('archive_article', {
      p_article_id: id
    });

    if (error) {
      console.error('archive_article RPC failed:', error);
      return new Response(JSON.stringify({ error: 'Unable to archive article' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    console.error('Error archiving article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
