import nodemailer from 'nodemailer';

async function testEmail() {
  console.log('--- Nodemailer Verification & Test ---');
  
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '').trim();
  const from = process.env.SMTP_FROM?.trim() || `"KJIN Newsroom" <${user}>`;
  const recipient = process.env.TEST_EMAIL_RECIPIENT || user || 'hafizzargar6@gmail.com';

  console.log(`Configured Host: ${host}`);
  console.log(`Configured Port: ${port}`);
  console.log(`Configured Secure: ${secure}`);
  console.log(`Configured User: ${user}`);
  console.log(`Password Configured: ${pass ? 'Yes (hidden)' : 'No'}`);
  console.log(`Sender: ${from}`);
  console.log(`Recipient: ${recipient}`);

  if (!user || !pass) {
    console.error('ERROR: Missing SMTP_USER or SMTP_PASS in environment variables.');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  console.log('\nStep 1: Verifying SMTP Connection & Credentials...');
  try {
    const verified = await transporter.verify();
    console.log('✓ SMTP Connection Verification Succeeded:', verified);
  } catch (verifyErr) {
    console.error('✗ SMTP Connection Verification Failed:', verifyErr);
    process.exit(1);
  }

  console.log(`\nStep 2: Sending Test Email to ${recipient}...`);
  try {
    const now = new Date();
    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject: `KJIN Newsroom — Nodemailer Verification Test (${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})`,
      text: `Hello Hafez,

This is a confirmation test email from your KJIN Newsroom portal.

Nodemailer is configured and operating successfully!

Details:
- Timestamp: ${now.toISOString()} (${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST)
- SMTP Host: ${host}:${port} (SSL: ${secure})
- Sender: ${from}
- Recipient: ${recipient}
- Status: Transporter verified & active

Best regards,
KJIN Newsroom System`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin: 16px 0 8px 0; }
    p { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 0 0 16px 0; }
    .info-box { background-color: #020617; border: 1px solid #334155; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1e293b; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .label { color: #94a3b8; font-weight: 500; }
    .value { color: #38bdf8; font-weight: 600; font-family: ui-monospace, monospace; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">✓ SMTP Verified</span>
    <h1>Nodemailer Test Email</h1>
    <p>Hello <strong>Hafez</strong>,</p>
    <p>Your Nodemailer configuration in the <strong>KJIN Newsroom</strong> system is working smoothly. The SMTP handshake and authentication succeeded.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="label">Status</span>
        <span class="value" style="color: #34d399;">200 OK / Active</span>
      </div>
      <div class="info-row">
        <span class="label">SMTP Host</span>
        <span class="value">${host}:${port}</span>
      </div>
      <div class="info-row">
        <span class="label">SSL / TLS</span>
        <span class="value">${secure ? 'Yes (Port 465 SSL)' : 'STARTTLS'}</span>
      </div>
      <div class="info-row">
        <span class="label">Sender</span>
        <span class="value">${user}</span>
      </div>
      <div class="info-row">
        <span class="label">Recipient</span>
        <span class="value">${recipient}</span>
      </div>
      <div class="info-row">
        <span class="label">Timestamp (IST)</span>
        <span class="value">${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #94a3b8;">
      Employee invitation emails, role updates, and system alerts are ready to be dispatched through this pipeline.
    </p>
  </div>
  <div class="footer">
    &copy; ${now.getFullYear()} KJIN Newsroom &bull; Automated System Verification
  </div>
</body>
</html>
`.trim(),
    });

    console.log('✓ Email Sent Successfully!');
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Response: ${info.response}`);
    console.log(`Accepted: ${JSON.stringify(info.accepted)}`);
  } catch (sendErr) {
    console.error('✗ Failed to send email:', sendErr);
    process.exit(1);
  }
}

testEmail();
