import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DEVELOPER_SUPPORT,
  sanitizeDeveloperSupportSettings,
  validateEmail,
  validatePhone,
  validateUrl,
  sanitizeUrl,
  sanitizeEmail,
  sanitizePhone,
  type DeveloperSupportSettings,
} from '../lib/developer-support';

test('P1: Developer & Technical Support — Defaults & Structure', () => {
  assert.equal(DEFAULT_DEVELOPER_SUPPORT.show_developer_section, true);
  assert.equal(DEFAULT_DEVELOPER_SUPPORT.developer_name, 'KJCPL Development Team');
  assert.equal(DEFAULT_DEVELOPER_SUPPORT.developer_website, 'https://kjcpl.site');
  assert.equal(DEFAULT_DEVELOPER_SUPPORT.support_email, 'h26412301@gmail.com');
  assert.equal(DEFAULT_DEVELOPER_SUPPORT.show_mail_us, true);
  assert.equal(DEFAULT_DEVELOPER_SUPPORT.show_call_us, true);
  assert.equal(DEFAULT_DEVELOPER_SUPPORT.footer_position, 'bottom');
  assert.equal(DEFAULT_DEVELOPER_SUPPORT.show_on_mobile, true);
});

test('P1: Developer & Technical Support — Field Validation Helpers', () => {
  // Email validation
  assert.equal(validateEmail('dev@kjcpl.site'), true);
  assert.equal(validateEmail('support@newsroom.org'), true);
  assert.equal(validateEmail(''), true, 'Empty email is valid (optional field)');
  assert.equal(validateEmail('not-an-email'), false);
  assert.equal(validateEmail('@missinguser.com'), false);

  // Phone validation
  assert.equal(validatePhone('+91 6005950197'), true);
  assert.equal(validatePhone('0194-2456789'), true);
  assert.equal(validatePhone(''), true, 'Empty phone is valid (optional field)');
  assert.equal(validatePhone('abc-phone'), false);
  assert.equal(validatePhone('12'), false, 'Too short');

  // URL validation
  assert.equal(validateUrl('https://kjcpl.site'), true);
  assert.equal(validateUrl('http://localhost:3000'), true);
  assert.equal(validateUrl(''), true, 'Empty url is valid (optional field)');
  assert.equal(validateUrl('not a url'), false);
  assert.equal(validateUrl('javascript:alert(1)'), false);
});

test('P1: Developer & Technical Support — Sanitization & URL Security', () => {
  // Malicious URLs stripped
  assert.equal(sanitizeUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeUrl('data:text/html,<script>'), '');
  assert.equal(sanitizeUrl('https://valid.site/team'), 'https://valid.site/team');
  assert.equal(sanitizeUrl('kjcpl.site'), 'https://kjcpl.site');

  // Sanitizing partial settings
  const partial: Partial<DeveloperSupportSettings> = {
    developer_name: '  Custom Engineering Guild  ',
    developer_website: 'https://dev.kjcpl.site',
    support_email: 'invalid-email',
    support_phone: '+91 9999999999',
    footer_position: 'subfooter',
  };

  const sanitized = sanitizeDeveloperSupportSettings(partial);
  assert.equal(sanitized.developer_name, 'Custom Engineering Guild');
  assert.equal(sanitized.developer_website, 'https://dev.kjcpl.site');
  assert.equal(sanitized.support_email, '', 'Invalid email sanitized to empty');
  assert.equal(sanitized.support_phone, '+91 9999999999');
  assert.equal(sanitized.footer_position, 'subfooter');
  assert.equal(sanitized.show_developer_section, true, 'Default preserved');
  assert.equal(sanitized.show_on_mobile, true, 'Default preserved');
});

test('P1: Developer & Technical Support — Footer Position Fallback', () => {
  const invalidPos = sanitizeDeveloperSupportSettings({
    footer_position: 'invalid-pos' as any,
  });
  assert.equal(invalidPos.footer_position, 'bottom', 'Falls back to default bottom');
});

test('P1: Developer & Technical Support — Toggle Deactivation', () => {
  const disabled = sanitizeDeveloperSupportSettings({
    show_developer_section: false,
    show_mail_us: false,
    show_call_us: false,
    show_on_mobile: false,
  });
  assert.equal(disabled.show_developer_section, false);
  assert.equal(disabled.show_mail_us, false);
  assert.equal(disabled.show_call_us, false);
  assert.equal(disabled.show_on_mobile, false);
});
