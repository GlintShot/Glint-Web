import { describe, expect, it } from 'vitest';
import { BACKGROUND_THEMES, COLOR_PALETTES } from '../backgroundPresets.js';
import { loadBrandKit, saveBrandKit, brandKitAsPresets } from '../brandKit.js';
import { ORBIT_PRESETS, getOrbitPreset } from '../device3d/orbitPresets.js';

describe('mood system', () => {
  it('ships dense gradient/solid themes', () => {
    expect(BACKGROUND_THEMES.length).toBeGreaterThanOrEqual(20);
    expect(BACKGROUND_THEMES.some((t) => t.type === 'gradient' && t.label === 'Aurora')).toBe(true);
  });

  it('ships curated palettes', () => {
    expect(COLOR_PALETTES.length).toBeGreaterThanOrEqual(12);
    expect(COLOR_PALETTES.every((p) => p.colors.length === 3)).toBe(true);
  });

  it('brand kit round-trips', () => {
    const next = saveBrandKit({ primary: '#112233', secondary: '#445566', accent: '#778899' });
    expect(next.primary).toBe('#112233');
    expect(loadBrandKit().accent).toBe('#778899');
    expect(brandKitAsPresets().map((s) => s.id)).toEqual(['primary', 'secondary', 'accent']);
  });

  it('orbit presets share flat + 3d angles', () => {
    expect(ORBIT_PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(getOrbitPreset('front-34').yaw).toBeLessThan(0);
    expect(getOrbitPreset('front').flatAngle).toBe(0);
  });
});
