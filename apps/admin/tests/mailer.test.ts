import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSecurePassword, getMailTransporter, sendEmployeeInviteEmail } from '../lib/mailer.ts';

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
