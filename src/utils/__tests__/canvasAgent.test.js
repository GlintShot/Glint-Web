import { describe, expect, it, vi } from 'vitest';
import {
  getEditorState,
  matchDeviceTransform,
  runCanvasOp,
  selectFrame,
  setDeviceAngleDeg,
  setDeviceScalePct,
} from '../canvasAgent.js';
import { createCopilotSession } from '../copilotSession.js';

function makeDevice({ angle = 0, scale = 1, bezel = 'pixel9' } = {}) {
  return {
    glintRole: 'framed-screenshot',
    glintFrameId: bezel,
    glintLayoutW: 400,
    glintLayoutH: 800,
    scaleX: scale,
    scaleY: scale,
    left: 100,
    top: 200,
    angle,
    set(props) {
      Object.assign(this, props);
    },
    setCoords() {},
  };
}

function makeCtx(devicesByIndex) {
  const frames = devicesByIndex.map((_, i) => ({ id: `f${i}`, screenshotUrl: null }));
  let activeIndex = 0;
  const canvases = devicesByIndex.map((device) => ({
    getObjects: () => (device ? [device] : []),
    getActiveObject: () => device,
    setActiveObject() {},
    requestRenderAll() {},
  }));
  return {
    getFrames: () => frames,
    getCanvas: (id) => {
      const i = frames.findIndex((f) => f.id === id);
      return canvases[i] || null;
    },
    getActiveIndex: () => activeIndex,
    setActiveIndex: (i) => {
      activeIndex = i;
    },
    getDeviceFrame: () => 'pixel9',
    getWhiteScreenshot: () => 'data:white',
    updateFrame: vi.fn(),
  };
}

describe('canvasAgent', () => {
  it('reads editor state from framed devices', () => {
    const d0 = makeDevice({ scale: 0.5, angle: 10 });
    const ctx = makeCtx([d0]);
    const state = getEditorState(ctx);
    expect(state.frameCount).toBe(1);
    expect(state.frames[0].device.scalePct).toBe(50);
    expect(state.frames[0].device.angle).toBe(10);
  });

  it('selects frames and sets center-aware angle/scale', () => {
    const d0 = makeDevice();
    const d1 = makeDevice({ scale: 1, angle: 0 });
    const ctx = makeCtx([d0, d1]);
    expect(selectFrame(ctx, 1).ok).toBe(true);
    expect(ctx.getActiveIndex()).toBe(1);
    expect(setDeviceScalePct(ctx, 80, 1).ok).toBe(true);
    expect(d1.scaleX).toBeCloseTo(0.8, 5);
    const beforeLeft = d1.left;
    expect(setDeviceAngleDeg(ctx, 90, 1).ok).toBe(true);
    expect(d1.angle).toBe(90);
    // Center preserved → left/top change when rotating around center
    expect(d1.left).not.toBe(beforeLeft);
  });

  it('matches device transform from source to other frames', () => {
    const src = makeDevice({ scale: 0.9, angle: -6 });
    const a = makeDevice({ scale: 1, angle: 0 });
    const b = makeDevice({ scale: 1, angle: 0 });
    const ctx = makeCtx([src, a, b]);
    const res = matchDeviceTransform(ctx, 0);
    expect(res.ok).toBe(true);
    expect(res.applied).toHaveLength(2);
    expect(a.scaleX).toBeCloseTo(0.9, 5);
    expect(b.angle).toBe(-6);
  });

  it('runCanvasOp rejects unknown ops', async () => {
    const res = await runCanvasOp(makeCtx([makeDevice()]), 'nope', {});
    expect(res.ok).toBe(false);
    expect(res.error).toBe('unknown_op');
  });

  it('remapColors uses Editor hook when provided', async () => {
    const remapPaletteColors = vi.fn();
    const ctx = { ...makeCtx([makeDevice()]), remapPaletteColors };
    const res = await runCanvasOp(ctx, 'remapColors', {
      pairs: [['#611AB4', '#E85D04'], ['#8030DD', '#F48C06']],
    });
    expect(res.ok).toBe(true);
    expect(remapPaletteColors).toHaveBeenCalledOnce();
    expect(remapPaletteColors.mock.calls[0][0]).toEqual([
      ['#611AB4', '#E85D04'],
      ['#8030DD', '#F48C06'],
    ]);
  });
});

describe('copilotSession', () => {
  it('blocks dispatch when disabled or paused', async () => {
    const ctx = makeCtx([makeDevice()]);
    const session = createCopilotSession({ getCtx: () => ctx });
    expect((await session.dispatch('selectFrame', { frameIndex: 0 })).error).toBe('session_disabled');
    session.enable();
    session.pause();
    expect((await session.dispatch('selectFrame', { frameIndex: 0 })).error).toBe('paused');
  });

  it('rejects stale generation and advances on mutate', async () => {
    const ctx = makeCtx([makeDevice()]);
    const session = createCopilotSession({ getCtx: () => ctx });
    session.enable();
    const g = session.generation;
    const bad = await session.dispatch(
      'setDeviceAngle',
      { frameIndex: 0, degrees: 5 },
      { present: false, expectedGeneration: g - 1 },
    );
    expect(bad.error).toBe('stale_generation');
    const ok = await session.dispatch(
      'setDeviceAngle',
      { frameIndex: 0, degrees: 5 },
      { present: false, expectedGeneration: g },
    );
    expect(ok.ok).toBe(true);
    expect(session.generation).toBe(g + 1);
  });

  it('human bump invalidates prior expectedGeneration', async () => {
    const ctx = makeCtx([makeDevice()]);
    const session = createCopilotSession({ getCtx: () => ctx });
    session.enable();
    const g = session.generation;
    session.bump('human');
    const res = await session.dispatch(
      'setDeviceScale',
      { frameIndex: 0, pct: 90 },
      { present: false, expectedGeneration: g },
    );
    expect(res.error).toBe('stale_generation');
  });
});
