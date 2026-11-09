import nodemailer, { type Transporter } from 'nodemailer';

export interface NewsApprovalAlertParams {
  headline: string;
  summary: string;
  category: string;
  scope: string;
  division?: string;
  district?: string | null;
  platform?: string;
  sourceName: string;
  sourceUrl?: string | null;
  dashboardUrl?: string;
}

let cachedTransporter: Transporter | null = null;

function getEmailTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '').trim();

  if (!user || !pass) {
    console.warn('[EmailNotifier] Missing SMTP_USER or SMTP_PASS. Email alerts will be skipped.');
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return cachedTransporter;
}

/**
 * Sends a real-time editorial verification alert email to the editor
 * when a new AI news draft is generated and ready for review in the dashboard.
 */
export async function sendNewsApprovalAlert(params: NewsApprovalAlertParams): Promise<boolean> {
  const transporter = getEmailTransporter();
  if (!transporter) return false;

  const editorEmail =
    process.env.NEWSROOM_EDITOR_EMAIL?.trim() ||
    process.env.TEST_EMAIL_RECIPIENT?.trim() ||
    process.env.SMTP_USER?.trim() ||
    'hafezzargar987@gmail.com';

  let sender = process.env.SMTP_FROM?.trim();
  if (!sender || !sender.includes('@')) {
    sender = `"KJIN Editorial Intelligence" <${process.env.SMTP_USER || 'hafezzargar987@gmail.com'}>`;
  }
  const defaultDashboardUrl =
    process.env.ADMIN_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    'http://localhost:3001/newsroom/youtube';

  const actionUrl = params.dashboardUrl || defaultDashboardUrl;
  const now = new Date();
  const timeIST = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const divisionBadge = params.division || 'Jammu & Kashmir';
  const scopeBadge = params.scope || 'State';
  const platformName = params.platform || 'Broadcast Surveillance';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #020617 0%, #1e1b4b 100%); padding: 24px 28px; border-bottom: 1px solid #334155; }
    .badge { display: inline-block; padding: 4px 10px; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .title-h1 { font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.35; margin: 8px 0; }
    .content { padding: 28px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .tag { display: inline-block; padding: 3px 8px; background-color: #1e293b; color: #38bdf8; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; font-family: monospace; }
    .summary-box { background-color: #020617; border-left: 4px solid #38bdf8; border-radius: 4px 8px 8px 4px; padding: 16px; margin: 18px 0; font-size: 13.5px; line-height: 1.6; color: #cbd5e1; font-style: italic; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12.5px; }
    .details-table td { padding: 8px 0; border-bottom: 1px solid #1e293b; color: #94a3b8; }
    .details-table td.val { text-align: right; font-weight: 600; color: #f1f5f9; }
    .cta-wrap { text-align: center; margin: 28px 0 16px 0; }
    .cta-button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 700; letter-spacing: 0.025em; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4); }
    .cta-button:hover { background: #0284c7; }
    .footer { padding: 20px; background-color: #020617; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">● Action Required • Newsroom Verification</span>
      <div style="font-size: 12px; font-family: monospace; color: #94a3b8;">KJIN EDITORIAL INTELLIGENCE DESK</div>
      <h1 class="title-h1">${escapeHtml(params.headline)}</h1>
    </div>

    <div class="content">
      <div class="tags">
        <span class="tag">SCOPE: ${escapeHtml(scopeBadge)}</span>
        <span class="tag">REGION: ${escapeHtml(divisionBadge)}</span>
        <span class="tag">CATEGORY: ${escapeHtml(params.category)}</span>
      </div>

      <p style="font-size: 13px; color: #94a3b8; margin: 0 0 12px 0;">
        A new investigative news story was synthesized from <strong>${escapeHtml(platformName)}</strong> facts and rewritten from scratch into English (zero copyright). It is awaiting your verification before public broadcast:
      </p>

      <div class="summary-box">
        “${escapeHtml(params.summary)}”
      </div>

      <table class="details-table">
        <tr>
          <td>Intel Source</td>
          <td class="val">${escapeHtml(params.sourceName)}</td>
        </tr>
        <tr>
          <td>Platform</td>
          <td class="val">${escapeHtml(platformName)}</td>
        </tr>
        <tr>
          <td>Target Beat</td>
          <td class="val">${escapeHtml(params.category)}</td>
        </tr>
        <tr>
          <td>Territorial Quota</td>
          <td class="val">${escapeHtml(divisionBadge)} (80/10/10 Compliant)</td>
        </tr>
        <tr>
          <td>Timestamp</td>
          <td class="val">${timeIST} IST</td>
        </tr>
      </table>

      <div class="cta-wrap">
        <a href="${actionUrl}" class="cta-button" target="_blank">
          Open Dashboard to Verify &amp; Publish →
        </a>
      </div>

      <p style="text-align: center; font-size: 11px; color: #64748b; margin-top: 12px;">
        Clicking opens your secure Newsroom Review Modal to approve with one click.
      </p>
    </div>

    <div class="footer">
      Kashmir &amp; Jammu Investigative Newsroom (KJIN / KCPJLN)<br>
      Automated Editorial Gatekeeper • Powered by Google Gemini 2.5 Flash
    </div>
  </div>
</body>
</html>
  `;

  try {
    const info = await transporter.sendMail({
      from: sender,
      to: editorEmail,
      subject: `[Approval Required] ${params.headline}`,
      text: `KJIN Newsroom Verification Required\n\nHeadline: ${params.headline}\nScope: ${params.scope} | Beat: ${params.category} | Region: ${divisionBadge}\n\nSummary: ${params.summary}\n\nVerify and publish on your dashboard:\n${actionUrl}\n\nTime: ${timeIST} IST`,
      html: htmlContent,
    });

    console.log(`[EmailNotifier] Alert sent to ${editorEmail} (MessageId: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error('[EmailNotifier] Failed to send editorial alert email:', err);
    return false;
  }
}

function escapeHtml(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
