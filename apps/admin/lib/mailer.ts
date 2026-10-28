import nodemailer from 'nodemailer';
import crypto from 'node:crypto';

export interface SendInviteEmailParams {
  to: string;
  displayName: string;
  roleKey: string;
  temporaryPassword: string;
  loginUrl?: string;
  reason?: string;
}

export interface MailerResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Generates a cryptographically strong temporary password.
 * Guaranteed to have uppercase, lowercase, numbers, and special characters.
 */
export function generateSecurePassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*_-+=';
  const all = upper + lower + digits + special;

  const bytes = crypto.randomBytes(length);
  const result: string[] = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    special[bytes[3] % special.length],
  ];

  for (let i = 4; i < length; i++) {
    result.push(all[bytes[i] % all.length]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = result.length - 1; i > 0; i--) {
    const j = bytes[i % bytes.length] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join('');
}

/**
 * Creates a nodemailer SMTP transporter using environment variables.
 */
export function getMailTransporter() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '').trim();

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends an invitation email with login credentials to an invited employee.
 */
export async function sendEmployeeInviteEmail(params: SendInviteEmailParams): Promise<MailerResult> {
  const transporter = getMailTransporter();

  if (!transporter) {
    console.warn('[Mailer] SMTP credentials not configured (SMTP_USER or SMTP_PASS missing). Email sending skipped.');
    return {
      success: false,
      skipped: true,
      error: 'SMTP credentials not configured in environment variables.',
    };
  }

  const defaultAdminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001';
  const loginUrl = params.loginUrl || `${defaultAdminUrl}/login`;
  const fromAddress = process.env.SMTP_FROM?.trim() || `"KJIN Newsroom" <${process.env.SMTP_USER}>`;
  const mfaRequired = ['owner', 'superadmin', 'admin'].includes(params.roleKey.toLowerCase());

  const subject = `Welcome to KJIN Newsroom — Your Account Credentials (${params.roleKey.toUpperCase()})`;

  const textContent = `
Hello ${params.displayName},

You have been invited to join the KJIN Newsroom team as an employee.

Here are your account credentials to access the administrative portal:

Portal URL: ${loginUrl}
Email: ${params.to}
Temporary Password: ${params.temporaryPassword}
Assigned Role: ${params.roleKey}
${params.reason ? `Reason: ${params.reason}\n` : ''}
Next Steps:
1. Navigate to ${loginUrl}
2. Sign in using your email and temporary password.
3. Update your password upon initial sign in.${mfaRequired ? '\n4. Set up Multi-Factor Authentication (MFA/TOTP) with an authenticator app (Google Authenticator, Authy, or 1Password).' : ''}

Best regards,
KJIN Newsroom Administration
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(34, 211, 238, 0.1); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    h1 { font-size: 24px; font-weight: 700; color: #ffffff; margin: 16px 0 8px 0; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 16px 0; }
    .credentials-box { background-color: #020617; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .credential-row { margin-bottom: 12px; }
    .credential-row:last-child { margin-bottom: 0; }
    .label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; display: block; margin-bottom: 4px; }
    .value { font-size: 16px; font-weight: 600; color: #ffffff; }
    .password-badge { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #1e293b; padding: 6px 12px; border-radius: 6px; color: #38bdf8; letter-spacing: 0.05em; display: inline-block; border: 1px solid #38bdf8; font-size: 15px; }
    .btn { display: inline-block; background-color: #06b6d4; color: #020617; font-weight: 700; font-size: 15px; padding: 12px 28px; border-radius: 9999px; text-decoration: none; margin: 8px 0 24px 0; }
    .btn:hover { background-color: #22d3ee; }
    .notice { font-size: 13px; color: #94a3b8; border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 24px; line-height: 1.5; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">KJIN Newsroom</span>
    <h1>Welcome, ${params.displayName}</h1>
    <p>You have been invited to join the <strong>KJIN Newsroom</strong> administrative portal as an <strong>${params.roleKey}</strong>.</p>
    
    <div class="credentials-box">
      <div class="credential-row">
        <span class="label">Portal URL</span>
        <span class="value"><a href="${loginUrl}" style="color: #38bdf8; text-decoration: none;">${loginUrl}</a></span>
      </div>
      <div class="credential-row">
        <span class="label">Login Email</span>
        <span class="value">${params.to}</span>
      </div>
      <div class="credential-row">
        <span class="label">Initial Password</span>
        <div class="password-badge">${params.temporaryPassword}</div>
      </div>
      <div class="credential-row">
        <span class="label">Assigned Role</span>
        <span class="value" style="text-transform: capitalize;">${params.roleKey}</span>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${loginUrl}" class="btn">Sign In to Dashboard</a>
    </div>

    <div class="notice">
      <strong>Important Security Instructions:</strong>
      <ul>
        <li>Sign in using your temporary password and update it immediately.</li>
        ${mfaRequired ? '<li><strong>Two-Factor Authentication (MFA):</strong> Your role requires Multi-Factor Authentication. Have an authenticator app ready (Google Authenticator, Authy, or 1Password) upon login.</li>' : ''}
        <li>Never share your credentials with anyone.</li>
      </ul>
    </div>
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} KJIN Newsroom. All rights reserved.
  </div>
</body>
</html>
`.trim();

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: params.to,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.info(`[Mailer] Invitation email sent to ${params.to} (MessageId: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown mailer error';
    console.error(`[Mailer] Failed to send invitation email to ${params.to}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
