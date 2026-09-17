import { describe, expect, it } from 'vitest';
import {
  PLATFORMS,
  STORE_TARGET_IDS,
  STORE_TARGETS,
  browseFilterId,
  devicesForPlatform,
  filterTemplatesByStore,
  getStoreTarget,
  resolveStoreKey,
  storeExportLabel,
} from '../storeCatalog.js';

describe('storeCatalog', () => {
  it('lists Play and App Store platforms', () => {
    expect(PLATFORMS.map((p) => p.id)).toEqual(['play', 'ios']);
  });

  it('exposes every canonical store target', () => {
    expect(STORE_TARGET_IDS).toContain('play/phone');
    expect(STORE_TARGET_IDS).toContain('play/tv');
    expect(STORE_TARGET_IDS).toContain('ios/iphone');
    expect(STORE_TARGET_IDS).toContain('ios/ipad');
    expect(STORE_TARGET_IDS).toHaveLength(8);
  });

  it('resolves legacy flat keys to canonical ids', () => {
    expect(resolveStoreKey('play')).toBe('play/phone');
    expect(resolveStoreKey('android')).toBe('play/phone');
    expect(resolveStoreKey('ios')).toBe('ios/iphone');
    expect(resolveStoreKey('ios-tablet')).toBe('ios/ipad');
    expect(resolveStoreKey('ipad')).toBe('ios/ipad');
    expect(resolveStoreKey(null)).toBe('play/phone');
    expect(resolveStoreKey('unknown-store')).toBe('play/phone');
  });

  it('maps browse device chips to blank-board stores', async () => {
    const { deviceFilterToStore } = await import('../../components/StoreBrowseFilters.jsx');
    expect(deviceFilterToStore('android-phone')).toBe('play/phone');
    expect(deviceFilterToStore('iphone')).toBe('ios/iphone');
    expect(deviceFilterToStore('ipad')).toBe('ios/ipad');
  });

  it('keeps already-canonical ids', () => {
    expect(resolveStoreKey('play/wear')).toBe('play/wear');
    expect(resolveStoreKey('ios/ipad')).toBe('ios/ipad');
  });

  it('returns catalog metadata for targets', () => {
    const phone = getStoreTarget('play');
    expect(phone.width).toBe(1080);
    expect(phone.height).toBe(1920);
    expect(phone.fastlaneFolder).toBe('phoneScreenshots');

    const tv = getStoreTarget('play/tv');
    expect(tv.landscape).toBe(true);
    expect(tv.width).toBe(1920);
  });

  it('lists devices for a platform', () => {
    const play = devicesForPlatform('play');
    expect(play.every((d) => d.platform === 'play')).toBe(true);
    expect(play).toHaveLength(6);

    const ios = devicesForPlatform('ios');
    expect(ios.map((d) => d.id)).toEqual(['ios/iphone', 'ios/ipad']);
  });

  it('limits browse devices to phone / iPhone / iPad', () => {
    expect(devicesForPlatform('play', { browse: true }).map((d) => d.id)).toEqual([
      'play/phone',
    ]);
    expect(devicesForPlatform('ios', { browse: true }).map((d) => d.id)).toEqual([
      'ios/iphone',
      'ios/ipad',
    ]);
  });

  it('builds export labels with canvas override size', () => {
    expect(storeExportLabel('play/phone')).toContain('1080×1920');
    expect(storeExportLabel('ios/ipad', { width: 100, height: 200 })).toBe(
      'App Store · iPad · 100×200',
    );
  });

  it('filters templates by platform or device', () => {
    const templates = [
      { id: 'a', store: 'play' },
      { id: 'b', store: 'play/tv' },
      { id: 'c', store: 'ios' },
      { id: 'd', store: 'ios/ipad' },
    ];
    expect(filterTemplatesByStore(templates, 'all')).toHaveLength(4);
    expect(filterTemplatesByStore(templates, 'play').map((t) => t.id)).toEqual(['a', 'b']);
    expect(filterTemplatesByStore(templates, 'ios').map((t) => t.id)).toEqual(['c', 'd']);
    expect(filterTemplatesByStore(templates, 'ios/ipad').map((t) => t.id)).toEqual(['d']);
    expect(filterTemplatesByStore(templates, 'ios-tablet').map((t) => t.id)).toEqual(['d']);
  });

  it('builds browse filter ids', () => {
    expect(browseFilterId('all', 'all')).toBe('all');
    expect(browseFilterId('play', 'all')).toBe('play');
    expect(browseFilterId('play', 'play/tv')).toBe('play/tv');
  });

  it('keeps STORE_TARGETS ids self-consistent', () => {
    for (const [id, target] of Object.entries(STORE_TARGETS)) {
      expect(target.id).toBe(id);
      expect(id.startsWith(`${target.platform}/`)).toBe(true);
    }
  });
});
