import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  isCrossFrameTransferable,
  moveSelectionToFrame,
  copySelectionToFrame,
} from '../copyObjectToFrame.js';
import { runCanvasOp } from '../canvasAgent.js';

describe('framesFromScratch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('builds 5 null-design Play phone frames', async () => {
    vi.doMock('../placeholderScreenshots.js', () => ({
      getWhiteScreenshot: () => 'data:image/png;white',
      getPlaceholderScreenshots: (n = 5) => Array.from({ length: n }, () => 'data:image/png;white'),
    }));
    const {
      framesFromScratch,
      DEFAULT_SCRATCH_STORE,
      DEFAULT_FRAME_COUNT,
    } = await import('../../hooks/useFrames.js');
    const frames = framesFromScratch();
    expect(frames).toHaveLength(DEFAULT_FRAME_COUNT);
    expect(frames.every((f) => f.design === null)).toBe(true);
    expect(frames.every((f) => f.store === DEFAULT_SCRATCH_STORE)).toBe(true);
    expect(frames.every((f) => f.screenshotUrl === 'data:image/png;white')).toBe(true);
    expect(new Set(frames.map((f) => f.id)).size).toBe(frames.length);
  });

  it('keeps store on each frame for ios sizes', async () => {
    vi.doMock('../placeholderScreenshots.js', () => ({
      getWhiteScreenshot: () => 'data:image/png;white',
      getPlaceholderScreenshots: (n = 5) => Array.from({ length: n }, () => 'data:image/png;white'),
    }));
    const { framesFromScratch } = await import('../../hooks/useFrames.js');
    expect(framesFromScratch({ store: 'ios/iphone' }).every((f) => f.store === 'ios/iphone')).toBe(true);
    expect(framesFromScratch({ store: 'ios/ipad' }).every((f) => f.store === 'ios/ipad')).toBe(true);
  });
});

describe('cross-frame transfer guards', () => {
  it('refuses device and screenshot roles', () => {
    expect(isCrossFrameTransferable({ glintRole: 'framed-screenshot' })).toBe(false);
    expect(isCrossFrameTransferable({ glintRole: 'screenshot' })).toBe(false);
    expect(isCrossFrameTransferable({ glintRole: 'graphic' })).toBe(true);
    expect(isCrossFrameTransferable({ glintRole: 'text' })).toBe(true);
  });

  it('moveSelectionToFrame skips protected layers', async () => {
    const device = { glintRole: 'framed-screenshot', left: 0, top: 0, toJSON: () => ({}) };
    const source = {
      discardActiveObject: vi.fn(),
      remove: vi.fn(),
      requestRenderAll: vi.fn(),
    };
    const target = {
      add: vi.fn(),
      setActiveObject: vi.fn(),
      requestRenderAll: vi.fn(),
    };
    const results = await moveSelectionToFrame(source, target, [device], { x: 0, y: 0 });
    expect(results).toEqual([]);
    expect(source.remove).not.toHaveBeenCalled();
  });

  it('copySelectionToFrame skips protected layers without cloning', async () => {
    const device = { glintRole: 'screenshot', left: 0, top: 0, toJSON: () => ({}) };
    const results = await copySelectionToFrame({}, {}, [device]);
    expect(results).toEqual([]);
  });
});

describe('startBlank agent op', () => {
  it('calls ctx.startBlank and is listed for dispatch', async () => {
    const startBlank = vi.fn(async () => {});
    const res = await runCanvasOp({ startBlank }, 'startBlank', { count: 5, store: 'ios/iphone' });
    expect(res.ok).toBe(true);
    expect(startBlank).toHaveBeenCalledWith({ count: 5, store: 'ios/iphone' });
  });

  it('omits store when not provided so editor keeps current preset', async () => {
    const startBlank = vi.fn(async () => {});
    await runCanvasOp({ startBlank }, 'startBlank', { count: 5 });
    expect(startBlank).toHaveBeenCalledWith({ count: 5 });
  });
});
