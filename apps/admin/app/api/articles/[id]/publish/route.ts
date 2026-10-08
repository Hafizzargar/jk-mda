import { authorizeEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';

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

    // 2. Call the secured database RPC
    const { data, error } = await userClient.rpc('publish_article', {
      p_article_id: id
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

