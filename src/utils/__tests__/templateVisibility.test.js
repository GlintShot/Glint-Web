import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_ENABLED,
  isTemplateEnabled,
  visibleTemplateIds,
  filterVisibleTemplates,
} from '../templateLoader.js';

describe('template visibility', () => {
  it('enables twelve gallery packs', () => {
    const on = Object.entries(TEMPLATE_ENABLED)
      .filter(([, v]) => v)
      .map(([id]) => id)
      .sort();
    expect(on).toEqual([
      'aurora-soft-ios',
      'aurora-soft-play',
      'aurora-soft-tablet',
      'blink-ios',
      'blink-play',
      'blink-tablet',
      'glint-gold-ios',
      'glint-gold-ipad',
      'glint-gold-play',
      'noir-orbit-ios',
      'noir-orbit-play',
      'noir-orbit-tablet',
    ]);
    expect(visibleTemplateIds().sort()).toEqual(on);
  });

  it('defaults unknown ids to hidden', () => {
    expect(isTemplateEnabled('warm-glow-play')).toBe(false);
    expect(isTemplateEnabled('play-tv')).toBe(false);
    expect(isTemplateEnabled('glint-gold-play')).toBe(true);
  });

  it('lets JSON enabled override the map', () => {
    expect(isTemplateEnabled({ id: 'warm-glow-play', enabled: true })).toBe(true);
    expect(isTemplateEnabled({ id: 'glint-gold-play', enabled: false })).toBe(false);
  });

  it('hides disabled packs from browse lists', () => {
    const list = [
      { id: 'glint-gold-play', store: 'play/phone' },
      { id: 'warm-glow-play', store: 'play/phone' },
      { id: 'blink-ios', store: 'ios/iphone' },
    ];
    expect(filterVisibleTemplates(list, 'all').map((t) => t.id)).toEqual([
      'glint-gold-play',
      'blink-ios',
    ]);
    expect(filterVisibleTemplates(list, 'play').map((t) => t.id)).toEqual([
      'glint-gold-play',
    ]);
  });
});
