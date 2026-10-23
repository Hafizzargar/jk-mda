import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABLE_TEMPLATES,
  TEMPLATE_THEMES,
  getTemplateDefinition,
  getTemplateTheme,
  type TemplateId,
} from '../lib/templates';

test('P1: Template Definition & Themes Alignment', async (t) => {
  await t.test('has 10 distinct available templates registered', () => {
    assert.equal(AVAILABLE_TEMPLATES.length, 10);
    const expectedTemplates: TemplateId[] = [
      'classic-editorial',
      'modern-magazine',
      'minimal-focus',
      'breaking-wire',
      'bento-grid',
      'genz-neo-brutalist',
      'clean-nordic-white',
      'visual-stories-deck',
      'tech-terminal-wire',
      'hyperlocal-community',
    ];

    for (const expected of expectedTemplates) {
      assert.ok(
        AVAILABLE_TEMPLATES.some((t) => t.id === expected),
        `Template ${expected} should be in AVAILABLE_TEMPLATES`
      );
    }
  });

  await t.test('every template has a complete TEMPLATE_THEMES mapping with matching bg and text styles', () => {
    for (const tmpl of AVAILABLE_TEMPLATES) {
      const theme = TEMPLATE_THEMES[tmpl.id];
      assert.ok(theme, `Theme for ${tmpl.id} must exist`);
      assert.equal(theme.id, tmpl.id);
      assert.ok(theme.pageBgClass, `${tmpl.id} must define pageBgClass`);
      assert.ok(theme.pageBgHex.startsWith('#'), `${tmpl.id} pageBgHex must be a valid hex color`);
      assert.ok(theme.textPrimaryClass, `${tmpl.id} must define textPrimaryClass`);
      assert.ok(theme.cardBgClass, `${tmpl.id} must define cardBgClass`);
      assert.ok(theme.headerBgClass, `${tmpl.id} must define headerBgClass`);
      assert.ok(typeof theme.isDark === 'boolean', `${tmpl.id} must define isDark`);
    }
  });

  await t.test('dark and light templates have appropriate background and contrast classifications', () => {
    // Dark templates
    const darkTemplates: TemplateId[] = [
      'modern-magazine',
      'breaking-wire',
      'bento-grid',
      'visual-stories-deck',
      'tech-terminal-wire',
    ];
    for (const id of darkTemplates) {
      const theme = TEMPLATE_THEMES[id];
      assert.equal(theme.isDark, true, `${id} should be marked as dark`);
      assert.ok(
        theme.pageBgClass.includes('slate-950') ||
          theme.pageBgClass.includes('neutral-900') ||
          theme.pageBgClass.includes('slate-900') ||
          theme.pageBgClass.includes('#0c0a09') ||
          theme.pageBgClass.includes('#050805'),
        `${id} should have dark background class`
      );
    }

    // Light templates
    const lightTemplates: TemplateId[] = [
      'classic-editorial',
      'clean-nordic-white',
      'minimal-focus',
      'genz-neo-brutalist',
      'hyperlocal-community',
    ];
    for (const id of lightTemplates) {
      const theme = TEMPLATE_THEMES[id];
      assert.equal(theme.isDark, false, `${id} should be marked as light`);
    }
  });

  await t.test('getTemplateTheme falls back safely for invalid or missing template ids', () => {
    const fallbackNull = getTemplateTheme(null);
    assert.equal(fallbackNull.id, 'classic-editorial');

    const fallbackUndefined = getTemplateTheme(undefined);
    assert.equal(fallbackUndefined.id, 'classic-editorial');

    const fallbackInvalid = getTemplateTheme('non-existent-template' as any);
    assert.equal(fallbackInvalid.id, 'classic-editorial');

    const directValid = getTemplateTheme('modern-magazine');
    assert.equal(directValid.id, 'modern-magazine');
    assert.equal(directValid.pageBgHex, '#020617');
  });

  await t.test('getTemplateDefinition falls back safely for invalid or missing template ids', () => {
    const fallbackNull = getTemplateDefinition(null);
    assert.equal(fallbackNull.id, 'classic-editorial');

    const directValid = getTemplateDefinition('tech-terminal-wire');
    assert.equal(directValid.id, 'tech-terminal-wire');
  });
});
