import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { sendNewsApprovalAlert } from '@/lib/newsroom/email-notifier';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.create');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const editorEmail =
      process.env.NEWSROOM_EDITOR_EMAIL?.trim() ||
      process.env.SMTP_USER?.trim() ||
      'hafezzargar987@gmail.com';

    const success = await sendNewsApprovalAlert({
      headline: 'KJIN AI Newsroom Alert: Verification System Active',
      summary: 'This is a test notification confirming your email dispatch system is operational. Whenever autonomous news intelligence or broadcast surveillance queues a new story, you will receive an immediate approval briefing here.',
      category: 'Local News',
      scope: 'State (Jammu & Kashmir)',
      division: 'Chenab Valley & Jammu Plains',
      district: 'doda',
      platform: 'Autonomous Intelligence Radar',
      sourceName: 'KJIN Automated Editorial Gatekeeper',
      sourceUrl: 'https://kjin.org',
    });

    if (!success) {
      return Response.json(
        {
          success: false,
          error: 'Email failed to send. Check server logs or verify your Google App Password (SMTP_PASS) in apps/admin/.env.local.',
          recipient: editorEmail,
        },
        { status: 502 }
      );
    }

    return Response.json({
      success: true,
      message: `Test alert successfully sent to ${editorEmail}!`,
      recipient: editorEmail,
    });
  } catch (error: any) {
    console.error('[TestEmailAPI] Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

