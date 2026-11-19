import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DEVELOPER_SUPPORT,
  sanitizeDeveloperSupportSettings,
  validateEmail,
  validatePhone,
  validateUrl,
  type DeveloperSupportSettings,
} from '../lib/developer-support';

test('Admin: Developer & Technical Support — Schema Validation', () => {
  assert.equal(typeof DEFAULT_DEVELOPER_SUPPORT.developer_name, 'string');
  assert.equal(typeof DEFAULT_DEVELOPER_SUPPORT.developer_description, 'string');
  assert.equal(typeof DEFAULT_DEVELOPER_SUPPORT.support_email, 'string');
  assert.equal(typeof DEFAULT_DEVELOPER_SUPPORT.support_phone, 'string');
  assert.equal(typeof DEFAULT_DEVELOPER_SUPPORT.show_mail_us, 'boolean');
  assert.equal(typeof DEFAULT_DEVELOPER_SUPPORT.show_call_us, 'boolean');
  assert.equal(typeof DEFAULT_DEVELOPER_SUPPORT.show_developer_section, 'boolean');
  assert.equal(typeof DEFAULT_DEVELOPER_SUPPORT.show_on_mobile, 'boolean');
  assert.ok(['bottom', 'column', 'subfooter'].includes(DEFAULT_DEVELOPER_SUPPORT.footer_position));
});

test('Admin: Developer & Technical Support — Form Sanitization Clamping', () => {
  const longName = 'A'.repeat(200);
  const sanitized = sanitizeDeveloperSupportSettings({
    developer_name: longName,
  });
  assert.ok(sanitized.developer_name.length <= 150, 'Clamps name to max 150 chars');
});

test('Admin: Developer & Technical Support — Email and Phone Format Validation', () => {
  assert.equal(validateEmail('admin-dev@kjcpl.site'), true);
  assert.equal(validateEmail('bad@'), false);

  assert.equal(validatePhone('+91 9876543210'), true);
  assert.equal(validatePhone('invalid phone'), false);

  assert.equal(validateUrl('https://kjcpl.site'), true);
  assert.equal(validateUrl('ftp://insecure'), false);
});
