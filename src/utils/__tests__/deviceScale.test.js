import { describe, expect, it } from 'vitest';
import {
  DEVICE_SCALE_MAX,
  DEVICE_SCALE_MIN,
  floodSilhouette,
  getDeviceDisplaySize,
  pinnedTopLeft,
  setDeviceAngle,
} from '../canvasEngine.js';

describe('device scale helpers', () => {
  it('reads layout size from framed device props', () => {
    const group = {
      glintRole: 'framed-screenshot',
      glintLayoutW: 400,
      glintLayoutH: 800,
      scaleX: 0.5,
      scaleY: 0.5,
      left: 100,
      top: 200,
    };
    const size = getDeviceDisplaySize(group);
    expect(size.width).toBe(200);
    expect(size.height).toBe(400);
    expect(size.scalePct).toBe(50);
  });

  it('exports sane scale bounds', () => {
    expect(DEVICE_SCALE_MIN).toBeLessThan(DEVICE_SCALE_MAX);
  });

  it('pins top-left from geometric center without drifting to the corner', () => {
    const pose = pinnedTopLeft(540, 960, 400, 800, 1, 1);
    expect(pose.left).toBe(340);
    expect(pose.top).toBe(560);
    const scaled = pinnedTopLeft(540, 960, 400, 800, 0.5, 0.5);
    expect(scaled.left).toBe(440);
    expect(scaled.top).toBe(760);
  });

  it('rotates around geometric center, not left/top', () => {
    const group = {
      glintRole: 'framed-screenshot',
      glintLayoutW: 400,
      glintLayoutH: 800,
      scaleX: 1,
      scaleY: 1,
      left: 100,
      top: 200,
      angle: 0,
      set(props) {
        Object.assign(this, props);
      },
      setCoords() {},
    };
    const beforeCx = group.left + 200;
    const beforeCy = group.top + 400;
    expect(setDeviceAngle(group, 90)).toBe(true);
    expect(group.angle).toBe(90);
    const rad = (90 * Math.PI) / 180;
    const lx = 200;
    const ly = 400;
    const cx = group.left + lx * Math.cos(rad) - ly * Math.sin(rad);
    const cy = group.top + lx * Math.sin(rad) + ly * Math.cos(rad);
    expect(cx).toBeCloseTo(beforeCx, 5);
    expect(cy).toBeCloseTo(beforeCy, 5);
  });

  it('floodSilhouette fills bezel + enclosed hole, leaves outside clear', () => {
    // 5x5: ring of opaque bezel at x/y 1..3, hole at (2,2), outside border transparent.
    const W = 5, H = 5;
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) {
      if (x !== 2 || y !== 2) rgba[(y * W + x) * 4 + 3] = 255;
    }
    const a = (out, x, y) => out[(y * W + x) * 4 + 3];
    const out = floodSilhouette(rgba, W, H, 2, 2);
    expect(a(out, 2, 2)).toBe(255);
    expect(a(out, 1, 1)).toBe(255);
    expect(a(out, 0, 0)).toBe(0);
    expect(a(out, 4, 2)).toBe(0);
  });
});
