import { describe, expect, it } from 'vitest';
import { phoneDimsForFrame, phoneLayoutForFrame, glbUrlForFrame } from '../device3d/Device3DScene.js';
import { bakeDevice3D } from '../device3d/bakeDevice3D.js';
import { getOrbitPreset } from '../device3d/orbitPresets.js';
import { FRAME_INSETS } from '../frameMeta.js';

describe('device3d company-grade', () => {
  it('matches FRAME_INSETS aspect for each phone frame', () => {
    for (const id of ['pixel9', 'iphone16-pro', 'iphone16-pro-max', 'galaxy-s24']) {
      const meta = FRAME_INSETS[id];
      const L = phoneLayoutForFrame(id);
      const expected = meta.width / meta.height;
      expect(L.W / L.H).toBeCloseTo(expected, 3);
      expect(L.screenW).toBeLessThan(L.W);
      expect(L.screenH).toBeLessThan(L.H);
    }
  });

  it('maps family finishes', () => {
    expect(phoneLayoutForFrame('iphone16-pro').family).toBe('iphone');
    expect(phoneLayoutForFrame('pixel9').family).toBe('android');
    expect(phoneLayoutForFrame('ipad-pro-13').family).toBe('tablet');
  });

  it('reserves glb urls per frame id', () => {
    expect(glbUrlForFrame('pixel9')).toBe('/frames/3d/pixel9.glb');
  });

  it('legacy phoneDims still works', () => {
    expect(phoneDimsForFrame('iphone16-pro').h).toBeGreaterThan(phoneDimsForFrame('iphone16-pro').w);
  });

  it('front-34 preset is a strong yaw', () => {
    expect(Math.abs(getOrbitPreset('front-34').yaw)).toBeGreaterThan(20);
  });

  it('bake returns null without DOM WebGL (node/jsdom)', async () => {
    const url = await bakeDevice3D({
      screenshotUrl: '',
      frameId: 'pixel9',
      presetId: 'front-34',
      width: 200,
      height: 400,
    });
    expect(url === null || (typeof url === 'string' && url.startsWith('data:image'))).toBe(true);
  });
});
