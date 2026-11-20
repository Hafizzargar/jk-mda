import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSecurePassword, getMailTransporter, sendEmployeeInviteEmail, parseUserAgent } from '../lib/mailer.ts';

test('mailer: generateSecurePassword produces 16-char strong random passwords', () => {
  const pwd1 = generateSecurePassword();
  const pwd2 = generateSecurePassword();

  assert.equal(pwd1.length, 16);
  assert.equal(pwd2.length, 16);
  assert.notEqual(pwd1, pwd2, 'passwords must be unique');

  // Must contain uppercase, lowercase, digits, and special characters
  assert.ok(/[A-Z]/.test(pwd1), 'must contain uppercase');
  assert.ok(/[a-z]/.test(pwd1), 'must contain lowercase');
  assert.ok(/[0-9]/.test(pwd1), 'must contain digits');
  assert.ok(/[!@#$%^&*_\-+=]/.test(pwd1), 'must contain special characters');
});

test('mailer: getMailTransporter returns null when credentials are unset', () => {
  const originalUser = process.env.SMTP_USER;
  const originalPass = process.env.SMTP_PASS;

  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  const transporter = getMailTransporter();
  assert.equal(transporter, null);

  if (originalUser) process.env.SMTP_USER = originalUser;
  if (originalPass) process.env.SMTP_PASS = originalPass;
});

test('mailer: sendEmployeeInviteEmail safely skips when SMTP is not configured', async () => {
  const originalUser = process.env.SMTP_USER;
  const originalPass = process.env.SMTP_PASS;

  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  const result = await sendEmployeeInviteEmail({
    to: 'invited@kjin.local',
    displayName: 'Invited Employee',
    roleKey: 'author',
    temporaryPassword: 'TempPassword123!',
    reason: 'Onboarding test',
  });

  assert.equal(result.success, false);
  assert.equal(result.skipped, true);
  assert.ok(result.error?.includes('SMTP credentials not configured'));

  if (originalUser) process.env.SMTP_USER = originalUser;
  if (originalPass) process.env.SMTP_PASS = originalPass;
});

test('mailer: parseUserAgent accurately recognizes Android phones and Chrome Mobile', () => {
  // Real Android User Agent from user login alert screenshot
  const androidUa = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36';
  const parsed = parseUserAgent(androidUa);

  assert.equal(parsed.deviceType, 'mobile');
  assert.equal(parsed.deviceName, 'Android Phone');
  assert.equal(parsed.osName, 'Android 10');
  assert.equal(parsed.browserName, 'Google Chrome Mobile');
  assert.equal(parsed.deviceIcon, '📱');
  assert.ok(parsed.friendlySummary.includes('Android Phone'));
  assert.ok(parsed.friendlySummary.includes('Google Chrome Mobile'));
});

test('mailer: parseUserAgent accurately recognizes Windows Laptop / PC and browsers', () => {
  const windowsChromeUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const parsedChrome = parseUserAgent(windowsChromeUa);

  assert.equal(parsedChrome.deviceType, 'desktop');
  assert.equal(parsedChrome.deviceName, 'Windows PC / Laptop');
  assert.equal(parsedChrome.osName, 'Windows 11 / 10');
  assert.equal(parsedChrome.browserName, 'Google Chrome');
  assert.equal(parsedChrome.deviceIcon, '💻');

  const windowsEdgeUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
  const parsedEdge = parseUserAgent(windowsEdgeUa);
  assert.equal(parsedEdge.browserName, 'Microsoft Edge');
});

test('mailer: parseUserAgent accurately recognizes iPhone, iPad, and Mac devices', () => {
  const iphoneUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';
  const parsedIphone = parseUserAgent(iphoneUa);
  assert.equal(parsedIphone.deviceType, 'mobile');
  assert.equal(parsedIphone.deviceName, 'Apple iPhone');
  assert.equal(parsedIphone.osName, 'iOS 17.4.1');
  assert.equal(parsedIphone.browserName, 'Apple Safari Mobile');

  const macUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
  const parsedMac = parseUserAgent(macUa);
  assert.equal(parsedMac.deviceType, 'desktop');
  assert.equal(parsedMac.deviceName, 'MacBook / Apple Mac');
  assert.equal(parsedMac.osName, 'macOS 10.15.7');
  assert.equal(parsedMac.browserName, 'Apple Safari');
});

test('mailer: parseUserAgent provides safe fallbacks when UA is missing or empty', () => {
  const emptyParsed = parseUserAgent('');
  assert.equal(emptyParsed.deviceType, 'unknown');
  assert.equal(emptyParsed.deviceName, 'Web Browser / Unknown Device');
  assert.equal(emptyParsed.browserName, 'Web Browser');

  const hintParsed = parseUserAgent(undefined, { platform: 'Android', isMobile: true });
  assert.equal(hintParsed.deviceName, 'Android Phone');
  assert.equal(hintParsed.browserName, 'Google Chrome Mobile');
});

