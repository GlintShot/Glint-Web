/**
 * Canvas Agent API - shared board verbs for Manual UI and Copilot (Mode 3).
 * Device transforms always go through canvasEngine helpers (center-aware scale/angle).
 */
import {
  getDeviceDisplaySize,
  replaceDeviceScreenshot,
  setDeviceAngle,
  setDeviceUniformScale,
  setBackground,
  addTextOverlay,
} from './canvasEngine.js';
import { isUserScreenshot } from './assetLibrary.js';
import { normalizeHex, remapCanvasColors } from './templatePalette.js';
import { addGraphicLayer, addShapeLayer } from './graphicLayers.js';

export function findDeviceOnCanvas(canvas) {
  if (!canvas?.getObjects) return null;
  return (
    canvas.getObjects().find((o) => o.glintRole === 'framed-screenshot')
    || canvas.getObjects().find((o) => o.glintRole === 'screenshot')
    || null
  );
}

function resolveFrameIndex(ctx, frameIndex) {
  if (frameIndex == null || frameIndex < 0) return ctx.getActiveIndex?.() ?? 0;
  return frameIndex;
}

function canvasAt(ctx, frameIndex) {
  const frames = ctx.getFrames?.() || [];
  const i = resolveFrameIndex(ctx, frameIndex);
  const frame = frames[i];
  if (!frame) return { canvas: null, frame: null, index: i };
  const canvas = ctx.getCanvas?.(frame.id) || null;
  return { canvas, frame, index: i };
}

/** Snapshot agents must re-read after human edits (generation in session). */
export function getEditorState(ctx) {
  const frames = ctx.getFrames?.() || [];
  const activeIndex = ctx.getActiveIndex?.() ?? -1;
  const deviceFrame = ctx.getDeviceFrame?.() ?? null;

  return {
    activeIndex,
    deviceFrame,
    frameCount: frames.length,
    frames: frames.map((f, index) => {
      const canvas = ctx.getCanvas?.(f.id) || null;
      const device = findDeviceOnCanvas(canvas);
      const size = device ? getDeviceDisplaySize(device) : null;
      const active = canvas?.getActiveObject?.();
      const deviceSelected = !!(
        active
        && (active.glintRole === 'framed-screenshot' || active.glintRole === 'screenshot')
      );
      const texts = (canvas?.getObjects?.() || [])
        .filter((o) => o.glintRole === 'text')
        .map((t, textIndex) => ({
          textIndex,
          text: t.text || '',
          fill: t.fill || null,
          fontSize: t.fontSize || null,
        }));
      const lw = device?.glintLayoutW || device?.width || 0;
      const lh = device?.glintLayoutH || device?.height || 0;
      const sx = Math.abs(device?.scaleX || 1);
      const sy = Math.abs(device?.scaleY || 1);
      return {
        id: f.id,
        index,
        screenshotUrl: f.screenshotUrl || null,
        hasUserScreenshot: isUserScreenshot(f.screenshotUrl),
        texts,
        device: device
          ? {
            role: device.glintRole,
            bezelId: device.glintFrameId ?? null,
            scalePct: size?.scalePct ?? 100,
            angle: Math.round(device.angle || 0),
            width: size?.width ?? 0,
            height: size?.height ?? 0,
            left: Math.round(device.left || 0),
            top: Math.round(device.top || 0),
            centerX: Math.round((device.left || 0) + (lw * sx) / 2),
            centerY: Math.round((device.top || 0) + (lh * sy) / 2),
            selected: deviceSelected && index === activeIndex,
          }
          : null,
      };
    }),
  };
}

export function selectFrame(ctx, frameIndex) {
  const frames = ctx.getFrames?.() || [];
  const i = Math.max(0, Math.min(frames.length - 1, Math.round(frameIndex)));
  if (!frames[i]) return { ok: false, error: 'frame_not_found' };
  ctx.setActiveIndex?.(i);
  return { ok: true, frameIndex: i, frameId: frames[i].id };
}

export function selectDevice(ctx, frameIndex) {
  const sel = selectFrame(ctx, resolveFrameIndex(ctx, frameIndex));
  if (!sel.ok) return sel;
  const { canvas, index } = canvasAt(ctx, sel.frameIndex);
  const device = findDeviceOnCanvas(canvas);
  if (!canvas || !device) return { ok: false, error: 'device_not_found', frameIndex: index };
  canvas.setActiveObject(device);
  canvas.requestRenderAll?.();
  return {
    ok: true,
    frameIndex: index,
    bezelId: device.glintFrameId ?? null,
    scalePct: getDeviceDisplaySize(device).scalePct,
    angle: Math.round(device.angle || 0),
  };
}

export function setDeviceScalePct(ctx, pct, frameIndex) {
  const { canvas, index } = canvasAt(ctx, frameIndex);
  const device = findDeviceOnCanvas(canvas);
  if (!device || device.glintRole !== 'framed-screenshot') {
    return { ok: false, error: 'device_not_found', frameIndex: index };
  }
  const n = Number(pct);
  if (!Number.isFinite(n)) return { ok: false, error: 'invalid_scale' };
  setDeviceUniformScale(device, n / 100);
  if (canvas?.getActiveObject?.() !== device) {
    canvas.setActiveObject(device);
    canvas.requestRenderAll?.();
  }
  const size = getDeviceDisplaySize(device);
  return { ok: true, frameIndex: index, scalePct: size.scalePct, width: size.width, height: size.height };
}

export function setDeviceAngleDeg(ctx, degrees, frameIndex) {
  const { canvas, index } = canvasAt(ctx, frameIndex);
  const device = findDeviceOnCanvas(canvas);
  if (!device || device.glintRole !== 'framed-screenshot') {
    return { ok: false, error: 'device_not_found', frameIndex: index };
  }
  const n = Number(degrees);
  if (!Number.isFinite(n)) return { ok: false, error: 'invalid_angle' };
  setDeviceAngle(device, n);
  if (canvas?.getActiveObject?.() !== device) {
    canvas.setActiveObject(device);
    canvas.requestRenderAll?.();
  }
  return { ok: true, frameIndex: index, angle: Math.round(device.angle || 0) };
}

export async function setDeviceMode(ctx, mode, frameIndex) {
  const { canvas, index } = canvasAt(ctx, frameIndex);
  const device = findDeviceOnCanvas(canvas);
  if (!device || device.glintRole !== 'framed-screenshot') {
    return { ok: false, error: 'device_not_found', frameIndex: index };
  }
  const live = mode === 'live3d' || mode === 'live';
  const { setDeviceLiveMode, applyLive3DBakeToDevice } = await import('./device3d/bakeDevice3D.js');
  const { getOrbitPreset } = await import('./device3d/orbitPresets.js');
  if (live) {
    const preset = getOrbitPreset('front-34');
    setDeviceLiveMode(device, true, { yaw: preset.yaw, pitch: preset.pitch, roll: preset.roll });
    await applyLive3DBakeToDevice(device);
  } else {
    setDeviceLiveMode(device, false);
    setDeviceAngle(device, 0);
  }
  canvas?.requestRenderAll?.();
  return { ok: true, frameIndex: index, mode: live ? 'live3d' : 'flat' };
}

export async function setDeviceOrbit(ctx, orbit = {}, frameIndex) {
  const { canvas, index } = canvasAt(ctx, frameIndex);
  const device = findDeviceOnCanvas(canvas);
  if (!device || device.glintRole !== 'framed-screenshot') {
    return { ok: false, error: 'device_not_found', frameIndex: index };
  }
  const { getOrbitPreset } = await import('./device3d/orbitPresets.js');
  const { applyLive3DBakeToDevice, setDeviceLiveMode } = await import('./device3d/bakeDevice3D.js');
  let next = { ...(device.glintOrbit || { yaw: 0, pitch: 0, roll: 0 }) };
  if (orbit.presetId) {
    const p = getOrbitPreset(orbit.presetId);
    next = { yaw: p.yaw, pitch: p.pitch, roll: p.roll };
  }
  if (orbit.yaw != null) next.yaw = Number(orbit.yaw);
  if (orbit.pitch != null) next.pitch = Number(orbit.pitch);
  if (orbit.roll != null) next.roll = Number(orbit.roll);
  setDeviceLiveMode(device, true, next);
  await applyLive3DBakeToDevice(device);
  canvas?.requestRenderAll?.();
  return { ok: true, frameIndex: index, orbit: next };
}

/** Replace or clear screenshot. Pass null/empty to clear to white placeholder via ctx. */
export async function setScreenshot(ctx, url, frameIndex) {
  const { canvas, frame, index } = canvasAt(ctx, frameIndex);
  const device = findDeviceOnCanvas(canvas);
  if (!device || !frame) return { ok: false, error: 'device_not_found', frameIndex: index };
  const nextUrl = url || ctx.getWhiteScreenshot?.();
  if (!nextUrl) return { ok: false, error: 'no_screenshot_url' };
  const ok = await replaceDeviceScreenshot(device, nextUrl);
  if (!ok) return { ok: false, error: 'replace_failed', frameIndex: index };
  ctx.updateFrame?.(index, { screenshotUrl: nextUrl });
  return {
    ok: true,
    frameIndex: index,
    hasUserScreenshot: isUserScreenshot(nextUrl),
  };
}

/**
 * Copy device scale + angle from source frame onto targets (teach-from-edit).
 * Bezel is left alone unless copyBezel is true (async bezel swap is Editor-owned).
 */
export function matchDeviceTransform(ctx, sourceIndex, targetIndexes = null, { copyBezel = false } = {}) {
  const src = canvasAt(ctx, sourceIndex);
  const srcDevice = findDeviceOnCanvas(src.canvas);
  if (!srcDevice || srcDevice.glintRole !== 'framed-screenshot') {
    return { ok: false, error: 'source_device_not_found' };
  }
  const size = getDeviceDisplaySize(srcDevice);
  const angle = Math.round(srcDevice.angle || 0);
  const bezelId = srcDevice.glintFrameId ?? null;
  const frames = ctx.getFrames?.() || [];
  const targets = (targetIndexes == null
    ? frames.map((_, i) => i).filter((i) => i !== src.index)
    : targetIndexes
  ).map((i) => Math.round(i));

  const applied = [];
  for (const ti of targets) {
    if (ti === src.index || ti < 0 || ti >= frames.length) continue;
    const scaleRes = setDeviceScalePct(ctx, size.scalePct, ti);
    const angleRes = setDeviceAngleDeg(ctx, angle, ti);
    if (scaleRes.ok && angleRes.ok) {
      applied.push({ frameIndex: ti, scalePct: size.scalePct, angle, bezelId: copyBezel ? bezelId : undefined });
    }
  }
  return {
    ok: true,
    sourceIndex: src.index,
    scalePct: size.scalePct,
    angle,
    bezelId,
    applied,
    note: copyBezel
      ? 'Bezel id returned for callers; use Editor setDeviceBezel to apply.'
      : undefined,
  };
}

/**
 * Remap brand/theme hex colors across every frame (canvas + design via Editor hook).
 * pairs: [[fromHex, toHex], ...] or { from, to } for a single swap.
 */
export function remapColors(ctx, pairsOrFrom, toMaybe) {
  let pairs = [];
  if (Array.isArray(pairsOrFrom)) {
    pairs = pairsOrFrom;
  } else if (pairsOrFrom && toMaybe) {
    pairs = [[pairsOrFrom, toMaybe]];
  }
  pairs = pairs
    .map((p) => {
      if (Array.isArray(p)) return [normalizeHex(p[0]), normalizeHex(p[1])];
      if (p && typeof p === 'object') return [normalizeHex(p.from), normalizeHex(p.to)];
      return ['', ''];
    })
    .filter(([from, to]) => from && to && from !== to);
  if (!pairs.length) return { ok: false, error: 'no_pairs' };

  if (typeof ctx.remapPaletteColors === 'function') {
    ctx.remapPaletteColors(pairs);
    return { ok: true, remapped: pairs.length, pairs };
  }

  const frames = ctx.getFrames?.() || [];
  let canvases = 0;
  for (const frame of frames) {
    const canvas = ctx.getCanvas?.(frame.id);
    if (!canvas) continue;
    canvases += 1;
    for (const [from, to] of pairs) remapCanvasColors(canvas, from, to);
  }
  return { ok: true, remapped: pairs.length, pairs, canvases, note: 'canvas_only' };
}

/** Set solid/gradient background on one frame, or all when frameIndex omitted / 'all'. */
export function setFrameBackground(ctx, type, value, frameIndex = 'all') {
  if (!type || value == null) return { ok: false, error: 'bad_background' };
  const frames = ctx.getFrames?.() || [];
  const indexes =
    frameIndex === 'all' || frameIndex == null
      ? frames.map((_, i) => i)
      : [resolveFrameIndex(ctx, frameIndex)];

  const applied = [];
  for (const i of indexes) {
    const frame = frames[i];
    if (!frame) continue;
    const canvas = ctx.getCanvas?.(frame.id);
    if (!canvas) continue;
    setBackground(canvas, type, value);
    applied.push(i);
  }
  ctx.setBackgroundState?.({
    label: 'Custom',
    type,
    value,
  });
  return { ok: applied.length > 0, frames: applied, type };
}

function textObjects(canvas) {
  return (canvas?.getObjects?.() || []).filter((o) => o.glintRole === 'text');
}

/** Update headline / caption text on a frame. */
export function setTextContent(ctx, text, frameIndex, textIndex = 0) {
  const { canvas, index } = canvasAt(ctx, frameIndex);
  if (!canvas) return { ok: false, error: 'no_canvas', frameIndex: index };
  const list = textObjects(canvas);
  const target = list[textIndex];
  if (!target) return { ok: false, error: 'text_not_found', frameIndex: index, textCount: list.length };
  target.set({ text: String(text ?? '') });
  target.setCoords?.();
  canvas.requestRenderAll?.();
  return { ok: true, frameIndex: index, textIndex, text: target.text };
}

/** Add a text overlay on a frame (defaults to active). */
export function addText(ctx, text, frameIndex, opts = {}) {
  const { canvas, index } = canvasAt(ctx, frameIndex);
  if (!canvas) return { ok: false, error: 'no_canvas', frameIndex: index };
  const style = {};
  if (opts.fill != null) style.fill = opts.fill;
  if (opts.fontFamily != null) style.fontFamily = opts.fontFamily;
  if (opts.fontWeight != null) style.fontWeight = opts.fontWeight;
  if (opts.fontSize != null) style.fontSize = opts.fontSize;
  if (opts.left != null) style.left = opts.left;
  if (opts.top != null) style.top = opts.top;
  if (opts.textAlign != null) style.textAlign = opts.textAlign;
  if (opts.originX != null) style.originX = opts.originX;
  if (opts.originY != null) style.originY = opts.originY;
  const obj = addTextOverlay(canvas, text || 'Your headline', style);
  // Force horizontal center when caller did not pin left (undefined used to clobber default).
  if (opts.left == null && obj) {
    obj.set({ left: canvas.getWidth() / 2, originX: 'center', textAlign: 'center' });
    obj.setCoords?.();
    canvas.requestRenderAll?.();
  }
  return { ok: !!obj, frameIndex: index, text: obj?.text || text };
}

/** Place an SVG graphic from /public/graphics on a frame. */
export async function addGraphic(ctx, args = {}) {
  const { canvas, index } = canvasAt(ctx, args.frameIndex);
  if (!canvas) return { ok: false, error: 'no_canvas', frameIndex: index };
  if (!args.src) return { ok: false, error: 'no_src' };
  const obj = await addGraphicLayer(canvas, {
    src: args.src,
    left: args.left,
    top: args.top,
    width: args.width,
    height: args.height,
    scale: args.scale,
    fill: args.fill || args.fillA,
    fill2: args.fill2 || args.fillB,
    fill3: args.fill3 || args.fillC,
    opacity: args.opacity,
    angle: args.angle,
    sendToBack: !!args.sendToBack,
  });
  return { ok: !!obj, frameIndex: index, src: args.src };
}

/** Place a primitive shape (circle / rect / ellipse) on a frame. */
export function addShape(ctx, args = {}) {
  const { canvas, index } = canvasAt(ctx, args.frameIndex);
  if (!canvas) return { ok: false, error: 'no_canvas', frameIndex: index };
  const obj = addShapeLayer(canvas, {
    shape: args.shape || 'circle',
    left: args.left ?? 0,
    top: args.top ?? 0,
    radius: args.radius,
    width: args.width,
    height: args.height,
    rx: args.rx,
    ry: args.ry,
    fill: args.fill,
    opacity: args.opacity,
    angle: args.angle,
    sendToBack: !!args.sendToBack,
  });
  return { ok: !!obj, frameIndex: index, shape: args.shape || 'circle' };
}

/** Remove transferable overlays (text/graphics), keep device shells. */
export function clearDecorations(ctx, frameIndex = 'all') {
  const frames = ctx.getFrames?.() || [];
  const indexes =
    frameIndex === 'all' || frameIndex == null
      ? frames.map((_, i) => i)
      : [resolveFrameIndex(ctx, frameIndex)];
  let removed = 0;
  for (const i of indexes) {
    const frame = frames[i];
    const canvas = frame ? ctx.getCanvas?.(frame.id) : null;
    if (!canvas?.getObjects) continue;
    const doomed = canvas.getObjects().filter((o) => {
      const role = o.glintRole;
      return role === 'text' || role === 'graphic';
    });
    for (const obj of doomed) {
      canvas.remove(obj);
      removed += 1;
    }
    canvas.discardActiveObject?.();
    canvas.requestRenderAll?.();
  }
  return { ok: true, removed };
}

export async function extractTheme(ctx) {
  if (typeof ctx.extractTheme !== 'function') {
    return { ok: false, error: 'extract_unsupported' };
  }
  await ctx.extractTheme();
  return { ok: true };
}

/** Replace the board with N empty device frames (no template pack). */
export async function startBlank(ctx, args = {}) {
  if (typeof ctx.startBlank !== 'function') {
    return { ok: false, error: 'start_blank_unsupported' };
  }
  const count = args.count ?? 5;
  const store = args.store != null ? args.store : undefined;
  await ctx.startBlank(store != null ? { count, store } : { count });
  return { ok: true, count, store: store ?? null };
}

export const CANVAS_AGENT_OPS = [
  'getEditorState',
  'selectFrame',
  'selectDevice',
  'setDeviceScale',
  'setDeviceAngle',
  'setDeviceMode',
  'setDeviceOrbit',
  'setScreenshot',
  'matchDeviceTransform',
  'remapColors',
  'setBackground',
  'setDeviceBezel',
  'setScreenshotStyle',
  'setText',
  'addText',
  'addGraphic',
  'addShape',
  'clearDecorations',
  'extractTheme',
  'startBlank',
];

/** Run a named op against a live ctx (used by Copilot session). */
export async function runCanvasOp(ctx, op, args = {}) {
  switch (op) {
    case 'getEditorState':
      return { ok: true, state: getEditorState(ctx) };
    case 'selectFrame':
      return selectFrame(ctx, args.frameIndex ?? args.index ?? 0);
    case 'selectDevice':
      return selectDevice(ctx, args.frameIndex ?? args.index);
    case 'setDeviceScale':
      return setDeviceScalePct(ctx, args.pct ?? args.scalePct, args.frameIndex);
    case 'setDeviceAngle':
      return setDeviceAngleDeg(ctx, args.degrees ?? args.angle, args.frameIndex);
    case 'setDeviceMode':
      return setDeviceMode(ctx, args.mode ?? args.deviceMode, args.frameIndex);
    case 'setDeviceOrbit':
      return setDeviceOrbit(ctx, args, args.frameIndex);
    case 'setScreenshot':
      return setScreenshot(ctx, args.url, args.frameIndex);
    case 'matchDeviceTransform':
      return matchDeviceTransform(
        ctx,
        args.sourceIndex ?? 0,
        args.targetIndexes ?? null,
        { copyBezel: !!args.copyBezel },
      );
    case 'remapColors':
      return remapColors(ctx, args.pairs || args.from, args.to);
    case 'setBackground':
      return setFrameBackground(ctx, args.type || 'solid', args.value ?? args.color, args.frameIndex ?? 'all');
    case 'setDeviceBezel': {
      const bezelId = args.bezelId ?? args.frameId ?? args.id ?? null;
      const frameIndex = args.frameIndex;
      if (frameIndex != null && typeof ctx.setDeviceBezelOnFrame === 'function') {
        return ctx.setDeviceBezelOnFrame(bezelId, frameIndex);
      }
      if (typeof ctx.setDeviceBezel !== 'function') {
        return { ok: false, error: 'bezel_unsupported' };
      }
      await ctx.setDeviceBezel(bezelId);
      return { ok: true, bezelId };
    }
    case 'setScreenshotStyle': {
      const patch = { ...(args.patch || {}) };
      for (const key of [
        'statusBarEnabled',
        'statusBarTheme',
        'fitMode',
        'cornerRadius',
        'shadowEnabled',
        'shadowBlur',
        'shadowOffsetX',
        'shadowOffsetY',
        'shadowOpacity',
        'shadowColor',
        'strokeWidth',
        'strokeColor',
        'fitOffsetX',
        'fitOffsetY',
      ]) {
        if (args[key] !== undefined) patch[key] = args[key];
      }
      if (!Object.keys(patch).length) return { ok: false, error: 'no_style_patch' };
      if (args.frameIndex != null && typeof ctx.patchScreenshotStyleOnFrame === 'function') {
        return ctx.patchScreenshotStyleOnFrame(patch, args.frameIndex);
      }
      if (typeof ctx.patchScreenshotStyle !== 'function') {
        return { ok: false, error: 'style_unsupported' };
      }
      ctx.patchScreenshotStyle(patch);
      return { ok: true, patch };
    }
    case 'setText':
      return setTextContent(ctx, args.text, args.frameIndex, args.textIndex ?? 0);
    case 'addText':
      return addText(ctx, args.text, args.frameIndex, args);
    case 'addGraphic':
      return addGraphic(ctx, args);
    case 'addShape':
      return addShape(ctx, args);
    case 'clearDecorations':
      return clearDecorations(ctx, args.frameIndex ?? 'all');
    case 'extractTheme':
      return extractTheme(ctx);
    case 'startBlank':
      return startBlank(ctx, args);
    default:
      return { ok: false, error: 'unknown_op', op };
  }
}
