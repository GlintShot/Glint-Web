import { describe, it, expect } from 'vitest';
import {
  applyLocaleToCanvas,
  captionFor,
  fastlaneScreenshotPath,
  localesOnCanvases,
  parseSheet,
  resolveLocaleId,
  setLocaleText,
  toCsv,
} from '../locales.js';

function fakeText(text) {
  return {
    glintRole: 'text',
    text,
    fontSize: 80,
    width: text.length * 40,
    scaleX: 1,
    set(patch) {
      Object.assign(this, patch);
      if ('text' in patch || 'fontSize' in patch) this.width = this.text.length * this.fontSize * 0.5;
    },
  };
}

function fakeCanvas(objs) {
  return { getObjects: () => objs, getWidth: () => 1080, requestRenderAll() {} };
}

describe('locales', () => {
  it('builds fastlane deliver / supply paths with store folder codes', () => {
    expect(fastlaneScreenshotPath('play/phone', 'zh-Hans', 0))
      .toBe('fastlane/metadata/android/zh-CN/images/phoneScreenshots/1.png');
    expect(fastlaneScreenshotPath('ios/iphone', 'ja-JP', 2)).toMatch(/^fastlane\/screenshots\/ja\/3_.+\.png$/);
  });

  it('keeps canvas edits when switching locale and falls back to base', () => {
    const t = fakeText('Track habits');
    const c = fakeCanvas([t]);
    setLocaleText(c, t, 'de-DE', 'Gewohnheiten verfolgen und endlich durchhalten');
    t.set({ text: 'Track habits daily' });

    applyLocaleToCanvas(c, 'de-DE');
    expect(t.text).toMatch(/^Gewohnheiten/);
    expect(t.width).toBeLessThanOrEqual(1080 * 0.9 + 1);

    applyLocaleToCanvas(c, 'ar');
    expect(t.text).toBe('Track habits daily');
    expect(t.direction).toBe('rtl');
    expect(captionFor(t, 'ar')).toBe('');

    applyLocaleToCanvas(c, 'en-US');
    expect(t.fontSize).toBe(80);
    expect(t.glintI18n.ar).toBeUndefined();
    expect(localesOnCanvases([c])).toEqual(['en-US', 'de-DE']);

    setLocaleText(c, t, 'fr-FR', '');
    applyLocaleToCanvas(c, 'fr-FR');
    expect(t.text).toBe('Track habits daily');
  });

  it('round-trips sheets and matches store codes', () => {
    const rows = [['frame', 'layer', 'en-US', 'de-DE'], ['1', '1', 'Hi, "you"\nthere', 'Hallo']];
    expect(parseSheet(toCsv(rows))).toEqual(rows);
    expect(parseSheet('frame\tlayer\tja\n1\t1\tこんにちは')).toEqual([['frame', 'layer', 'ja'], ['1', '1', 'こんにちは']]);
    expect(resolveLocaleId('ja')).toBe('ja-JP');
    expect(resolveLocaleId('zh-CN')).toBe('zh-Hans');
    expect(resolveLocaleId('iw-IL')).toBe('he');
    expect(resolveLocaleId('frame')).toBe(null);
  });
});
