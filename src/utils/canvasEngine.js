import { Canvas, FabricImage, Gradient, IText, Rect, Group, Shadow, LayoutManager, FixedLayout, loadSVGFromString, util } from 'fabric';
import {
  getFrameMeta,
  computeFrameLayout,
  resolveDeviceScale,
  MIN_DEVICE_COVERAGE,
  DEFAULT_SCREENSHOT_STYLE,
} from './frameMeta';
import { GLINT_CLONE_PROPS } from './glintCloneProps';
import { isProtectedLayer } from './layerGuards';
import {
  paintStatusBar,
  statusBarChromeChanged,
  screenshotFitChanged,
  screenContentRect,
  coverFitRect,
  containFitRect,
} from './statusBar';

export { GLINT_CLONE_PROPS } from './glintCloneProps';
export { isProtectedLayer } from './layerGuards';

/** Figma-style canvas selection - blue border visible on light and dark backgrounds. */
export const GLINT_SELECTION = {
  fill: 'rgba(24, 160, 251, 0.14)',
  border: '#18A0FB',
  corner: '#FFFFFF',
  cornerStroke: '#18A0FB',
  lineWidth: 2.5,
  borderScaleFactor: 3,
  padding: 6,
};

export function createCanvas(container, width = 1080, height = 1920) {
  return new Canvas(container, {
    width,
    height,
    backgroundColor: '#ffffff',
    preserveObjectStacking: true,
    selection: true,
    uniformScaling: true,
    selectionColor: GLINT_SELECTION.fill,
    selectionBorderColor: GLINT_SELECTION.border,
    selectionLineWidth: GLINT_SELECTION.lineWidth,
    defaultCursor: 'default',
    hoverCursor: 'default',
    moveCursor: 'grabbing',
  });
}

/** Accent selection chrome so selected canvas layers are obvious. */
export function applySelectionStyle(obj) {
  if (!obj) return obj;
  const role = obj.glintRole;
  let hoverCursor = 'grab';
  if (role === 'text' || obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
    hoverCursor = 'text';
  } else if (role === 'framed-screenshot' || role === 'screenshot') {
    hoverCursor = 'pointer';
  }
  obj.set({
    borderColor: GLINT_SELECTION.border,
    cornerColor: GLINT_SELECTION.corner,
    cornerStrokeColor: GLINT_SELECTION.cornerStroke,
    cornerStyle: 'rect',
    cornerSize: 8,
    transparentCorners: false,
    borderScaleFactor: GLINT_SELECTION.borderScaleFactor,
    padding: GLINT_SELECTION.padding,
    borderOpacityWhenMoving: 1,
    cornerOpacityWhenMoving: 1,
    hoverCursor,
    moveCursor: 'grabbing',
  });
  return obj;
}

/** Cursor for a Fabric target - Figma-like affordances. */
export function cursorForTarget(target, { editable = true, selected = false } = {}) {
  if (!editable) return 'pointer'; // click artboard to focus frame
  if (!target) return 'default';
  const role = target.glintRole;
  if (role === 'framed-screenshot' || role === 'screenshot') {
    return selected ? 'grab' : 'pointer';
  }
  if (role === 'text' || target.type === 'i-text' || target.type === 'textbox' || target.type === 'text') {
    return 'text';
  }
  if (target.hoverCursor) return target.hoverCursor;
  if (target.selectable && target.evented !== false) return selected ? 'grab' : 'grab';
  return 'default';
}

/** Per-target hover cursor on the frame canvas. */
export function bindCanvasCursors(canvas, { getEditable = () => true, wrapEl = null } = {}) {
  if (!canvas) return () => {};

  const setCursor = (cursor) => {
    const cur = cursor || 'default';
    canvas.defaultCursor = cur;
    if (canvas.upperCanvasEl) canvas.upperCanvasEl.style.cursor = cur;
    if (wrapEl) wrapEl.style.cursor = cur;
  };

  const resolve = (opt) => {
    if (!getEditable()) return setCursor('pointer');
    // Let Fabric keep resize/rotate corner cursors.
    if (opt?.target?.__corner || canvas._currentTransform?.corner) return;
    if (canvas._currentTransform) return setCursor('grabbing');
    const target = opt?.target || null;
    const active = canvas.getActiveObject?.();
    const selected = !!(target && active && (target === active || active === target.group));
    setCursor(cursorForTarget(target, { editable: true, selected }));
  };

  const onMove = (opt) => resolve(opt);
  const onOver = (opt) => resolve(opt);
  const onOut = () => setCursor(getEditable() ? 'default' : 'pointer');
  const onDown = (opt) => {
    if (!getEditable()) return setCursor('pointer');
    if (opt?.target?.__corner) return;
    if (opt?.target) setCursor('grabbing');
  };
  const onUp = (opt) => resolve(opt);
  const onSel = () => {
    const active = canvas.getActiveObject?.();
    if (active) {
      // Selected device uses grab; keep role hover cursors on the object itself.
      if (active.glintRole === 'framed-screenshot' || active.glintRole === 'screenshot') {
        active.set({ hoverCursor: 'grab' });
      }
    }
    canvas.getObjects?.().forEach((obj) => {
      if (obj === active) return;
      if (obj.glintRole === 'framed-screenshot' || obj.glintRole === 'screenshot') {
        obj.set({ hoverCursor: 'pointer' });
      }
    });
  };

  canvas.on('mouse:move', onMove);
  canvas.on('mouse:over', onOver);
  canvas.on('mouse:out', onOut);
  canvas.on('mouse:down', onDown);
  canvas.on('mouse:up', onUp);
  canvas.on('selection:created', onSel);
  canvas.on('selection:updated', onSel);
  canvas.on('selection:cleared', onSel);
  setCursor(getEditable() ? 'default' : 'pointer');

  return () => {
    canvas.off('mouse:move', onMove);
    canvas.off('mouse:over', onOver);
    canvas.off('mouse:out', onOut);
    canvas.off('mouse:down', onDown);
    canvas.off('mouse:up', onUp);
    canvas.off('selection:created', onSel);
    canvas.off('selection:updated', onSel);
    canvas.off('selection:cleared', onSel);
    setCursor('default');
  };
}

/** Build a Fabric Shadow from screenshot chrome style (or null when off). */
export function buildChromeShadow(style = {}) {
  const s = { ...DEFAULT_SCREENSHOT_STYLE, ...style };
  if (!s.shadowEnabled || !(s.shadowBlur > 0)) return null;
  const opacity = Math.min(1, Math.max(0, s.shadowOpacity ?? 0.4));
  const hex = (s.shadowColor || '#000000').replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return new Shadow({
    color: `rgba(${r},${g},${b},${opacity})`,
    blur: s.shadowBlur,
    offsetX: s.shadowOffsetX ?? 0,
    offsetY: s.shadowOffsetY ?? 0,
  });
}

export function applyChromeShadow(obj, style = {}) {
  if (!obj) return obj;
  const merged = { ...DEFAULT_SCREENSHOT_STYLE, ...(obj.glintChrome || {}), ...style };
  obj.set('shadow', buildChromeShadow(merged));
  obj.set({ glintChrome: merged });
  obj.canvas?.requestRenderAll?.();
  return obj;
}

/** Copy Glint metadata after Fabric clone (clone alone drops custom fields). */
export function copyGlintProps(from, to) {
  if (!from || !to) return to;
  for (const key of GLINT_CLONE_PROPS) {
    if (from[key] !== undefined) to[key] = from[key];
  }
  return to;
}

export function setBackground(canvas, type, value) {
  const w = canvas.getWidth();
  const h = canvas.getHeight();
  if (type === 'gradient') {
    canvas.backgroundColor = new Gradient({
      type: 'linear',
      coords: { x1: 0, y1: 0, x2: 0, y2: h },
      colorStops: value,
    });
  } else {
    canvas.backgroundColor = value;
  }
  canvas.requestRenderAll();
}

export function setSolidBackground(canvas, color) {
  canvas.backgroundColor = color;
  canvas.requestRenderAll();
}

function pathRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rr);
  } else {
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

/**
 * Outer chrome border: stroke sits fully outside the content box on all four sides.
 * Content stays at (pad, pad); ring expands as strokeWidth grows.
 */
function outerBorderPad(strokeW) {
  return Math.max(0, strokeW || 0);
}

function makeOuterBorderRect(contentW, contentH, contentRx, strokeW, strokeColor) {
  const s = outerBorderPad(strokeW);
  const pad = s;
  return new Rect({
    left: pad / 2,
    top: pad / 2,
    width: contentW + s,
    height: contentH + s,
    rx: Math.min((contentRx || 0) + s / 2, (contentW + s) / 2, (contentH + s) / 2),
    ry: Math.min((contentRx || 0) + s / 2, (contentW + s) / 2, (contentH + s) / 2),
    fill: 'transparent',
    stroke: s > 0 ? (strokeColor || '#FFFFFF') : 'rgba(0,0,0,0)',
    strokeWidth: s,
    strokeUniform: true,
    paintFirst: 'stroke',
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
    objectCaching: false,
    glintRole: 'chrome-border',
  });
}

function findChromeBorder(group) {
  const kids = group.getObjects?.() || [];
  return kids.find((o) => o.glintRole === 'chrome-border') || kids.find((o) => o.type === 'rect') || null;
}

function findChromeContent(group) {
  const kids = group.getObjects?.() || [];
  return kids.find((o) => o.glintRole !== 'chrome-border' && o.type !== 'rect') || kids[0] || null;
}

/** Sync outward border + content inset; keeps content pixel size, grows ring outside. */
function applyOuterBorderStroke(group, chrome = {}) {
  if (!group) return false;
  const strokeW = Math.max(0, chrome.strokeWidth ?? 0);
  const strokeColor = chrome.strokeColor || '#FFFFFF';
  const pad = outerBorderPad(strokeW);

  let contentW;
  let contentH;
  let contentRx;
  if (group.glintRole === 'screenshot') {
    contentW = group.glintTargetW || group.width || 0;
    contentH = group.glintTargetH || group.height || 0;
    contentRx = Math.max(0, Math.min(chrome.cornerRadius ?? 0, contentW / 2, contentH / 2));
  } else if (group.glintRole === 'framed-screenshot') {
    const content = findChromeContent(group);
    contentW = (content?.width || group.width || 0) * (content?.scaleX || 1);
    contentH = (content?.height || group.height || 0) * (content?.scaleY || 1);
    contentRx = Math.min(contentW, contentH) * 0.08;
  } else {
    return false;
  }

  const content = findChromeContent(group);
  let border = findChromeBorder(group);
  const prevPad = Math.max(0, content?.left || 0);
  const dPad = pad - prevPad;

  if (content) {
    content.set({ left: pad, top: pad, dirty: true });
    content.setCoords?.();
  }

  const borderProps = {
    left: pad / 2,
    top: pad / 2,
    width: contentW + strokeW,
    height: contentH + strokeW,
    rx: Math.min(contentRx + strokeW / 2, (contentW + strokeW) / 2, (contentH + strokeW) / 2),
    ry: Math.min(contentRx + strokeW / 2, (contentW + strokeW) / 2, (contentH + strokeW) / 2),
    strokeWidth: strokeW,
    stroke: strokeW > 0 ? strokeColor : 'rgba(0,0,0,0)',
    dirty: true,
  };

  if (border && typeof border.set === 'function') {
    border.set(borderProps);
    border.setCoords?.();
  } else if (strokeW > 0) {
    border = makeOuterBorderRect(contentW, contentH, contentRx, strokeW, strokeColor);
    group.add?.(border);
  }

  // Grow/shrink around the content so the shot stays put in canvas space.
  group.set({
    left: (group.left || 0) - dPad,
    top: (group.top || 0) - dPad,
    dirty: true,
    glintChrome: { ...(group.glintChrome || {}), ...chrome },
    width: contentW + pad * 2,
    height: contentH + pad * 2,
  });
  border?.setCoords?.();
  return true;
}

/**
 * Cover-fit a screenshot into an exact screen-sized bitmap (white fill + clipped image).
 * Disabled status bar → shot fills the full hole. Enabled → opaque status strip on top,
 * shot cover-fills only the remaining content rect. Status bar chrome matches the device family.
 * chrome.fitMode: 'contain' (default, full shot inside hole) | 'cover' (crops to fill) | 'custom'
 * chrome.fitOffsetX/Y: offset for 'custom' mode (-1 to 1, 0 = centered)
 */
async function buildScreenBitmap(screenshotUrl, screenW, screenH, rx, chrome = {}, frameId = null) {
  const w = Math.max(1, Math.round(screenW));
  const h = Math.max(1, Math.round(screenH));
  const r = Math.max(0, Math.min(rx || 0, w / 2, h / 2));
  const content = screenContentRect(w, h, chrome, frameId);
  const fitMode = chrome.fitMode || 'contain';

  const src = await FabricImage.fromURL(screenshotUrl, { crossOrigin: 'anonymous' });
  const el = src.getElement?.() || src._element;
  const iw = Math.max(1, el?.naturalWidth || el?.width || src.width || 1);
  const ih = Math.max(1, el?.naturalHeight || el?.height || src.height || 1);

  let fit;
  if (fitMode === 'contain') {
    fit = containFitRect(iw, ih, content.w, content.h, content.x, content.y);
  } else if (fitMode === 'custom') {
    const cover = Math.max(content.w / iw, content.h / ih);
    const dw = iw * cover;
    const dh = ih * cover;
    const offX = (chrome.fitOffsetX ?? 0) * (dw - content.w) * 0.5;
    const offY = (chrome.fitOffsetY ?? 0) * (dh - content.h) * 0.5;
    fit = {
      dx: content.x + (content.w - dw) / 2 + offX,
      dy: content.y + (content.h - dh) / 2 + offY,
      dw,
      dh,
    };
  } else {
    fit = coverFitRect(iw, ih, content.w, content.h, content.x, content.y);
  }

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Default device fill - white everywhere the shot doesn't cover.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  pathRoundRect(ctx, 0, 0, w, h, r);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  // Clip to content rect so cover-crop never paints into the status-bar band.
  ctx.beginPath();
  ctx.rect(content.x, content.y, content.w, content.h);
  ctx.clip();
  if (el) ctx.drawImage(el, fit.dx, fit.dy, fit.dw, fit.dh);
  ctx.restore();

  if (chrome.statusBarEnabled) {
    ctx.save();
    pathRoundRect(ctx, 0, 0, w, h, r);
    ctx.clip();
    await paintStatusBar(ctx, w, chrome.statusBarTheme || 'dark', frameId, h);
    ctx.restore();
  }

  // Soft outer mask so corners stay transparent outside the round rect (for bare frames).
  if (r > 0) {
    ctx.globalCompositeOperation = 'destination-in';
    pathRoundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  const fitted = await FabricImage.fromURL(off.toDataURL('image/png'));
  fitted.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: 1,
    scaleY: 1,
    selectable: false,
    evented: false,
  });
  src.dispose?.();
  return fitted;
}

/** Default phone aspect for bare (no-bezel) screenshot frames. */
const BARE_SCREEN_ASPECT = 9 / 19.5;

/**
 * Bare screenshot: white-filled rounded frame + cover-fit shot + optional outer border.
 * Uses the same bitmap pipeline as device screens so imports always fill correctly.
 */
export async function addStyledScreenshot(canvas, screenshotUrl, opts = {}) {
  const style = { ...DEFAULT_SCREENSHOT_STYLE, ...opts };
  const canvasW = canvas.getWidth();
  const canvasH = canvas.getHeight();
  const aspect = opts.aspect ?? BARE_SCREEN_ASPECT;

  let targetW = opts.targetW;
  let targetH = opts.targetH;
  if (!(targetW > 0) || !(targetH > 0)) {
    targetH = canvasH * (style.scale ?? 0.58);
    targetW = targetH * aspect;
    if (targetW > canvasW * 0.92) {
      targetW = canvasW * 0.92;
      targetH = targetW / aspect;
    }
  }

  const left = opts.left ?? (canvasW - targetW) / 2;
  const top = opts.top ?? canvasH * 0.14;
  const rx = Math.max(0, Math.min(style.cornerRadius ?? 0, targetW / 2, targetH / 2));
  const strokeW = Math.max(0, style.strokeWidth ?? 0);
  const pad = outerBorderPad(strokeW);

  // White fill + cover-fit screenshot (exact frame size). Bare → android-family bar.
  const screenImg = await buildScreenBitmap(
    screenshotUrl,
    targetW,
    targetH,
    rx,
    style,
    opts.frameId || null,
  );
  screenImg.set({ left: pad, top: pad, originX: 'left', originY: 'top' });

  const border = makeOuterBorderRect(
    targetW,
    targetH,
    rx,
    strokeW,
    style.strokeColor || '#FFFFFF',
  );

  const group = new Group([screenImg, border], {
    left: left - pad,
    top: top - pad,
    originX: 'left',
    originY: 'top',
    selectable: opts.selectable !== false,
    evented: opts.selectable !== false,
    subTargetCheck: false,
    objectCaching: false,
    layoutManager: new LayoutManager(new FixedLayout()),
    glintRole: 'screenshot',
    glintScreenshotUrl: screenshotUrl,
    glintChrome: style,
    glintTargetW: targetW,
    glintTargetH: targetH,
    glintLayoutW: targetW + pad * 2,
    glintLayoutH: targetH + pad * 2,
    width: targetW + pad * 2,
    height: targetH + pad * 2,
  });

  applyDeviceTransformLocks(group);

  canvas.add(group);
  // Apply shadow AFTER canvas.add - same reason as addFramedScreenshot.
  applyChromeShadow(group, style);
  canvas.requestRenderAll();
  return group;
}

/**
 * Strip a device bezel → styled screenshot at the same center (keeps shot + chrome).
 * Target size matches the previous screen hole so the shot still fills the frame.
 */
export async function stripDeviceFrame(group, style = {}) {
  if (!group || group.glintRole !== 'framed-screenshot') return false;
  const canvas = group.canvas;
  const screenshotUrl = group.glintScreenshotUrl;
  if (!canvas || !screenshotUrl) return false;

  const chrome = { ...DEFAULT_SCREENSHOT_STYLE, ...(group.glintChrome || {}), ...style };
  const { x: cx, y: cy } = getGroupGeoCenter(group);
  const angle = group.angle || 0;
  const slot = group.glintSlot;
  const slide = group.glintSlide;
  const selectable = group.selectable !== false;
  const uniform = Math.max(Math.abs(group.scaleX || 1), Math.abs(group.scaleY || 1));

  const frameId = group.glintFrameId || 'pixel9';
  const baseScale = group.glintBaseScale ?? 0.55;
  const { screenW, screenH } = computeFrameLayout(frameId, baseScale);
  const targetW = screenW * uniform;
  const targetH = screenH * uniform;
  const left = cx - targetW / 2;
  const top = cy - targetH / 2;

  const next = await addStyledScreenshot(canvas, screenshotUrl, {
    ...chrome,
    targetW,
    targetH,
    aspect: targetW / targetH,
    left,
    top,
    selectable,
  });
  if (!next) return false;

  next.set({
    angle,
    glintSlot: slot,
    glintSlide: slide,
    glintScreenshotUrl: screenshotUrl,
  });
  applyDeviceTransformLocks(next);

  // Record old z-position before removing - canvas.add() inside addStyledScreenshot
  // appends next to the top, breaking layer order when user objects overlap.
  const objects = canvas.getObjects();
  const oldIndex = objects.indexOf(group);
  canvas.remove(group);
  group.dispose?.();
  // next was already canvas.add()'d at the end - move it to the old device's position.
  canvas.remove(next);
  if (oldIndex >= 0) {
    canvas.insertAt(Math.min(oldIndex, canvas.getObjects().length), next);
  } else {
    canvas.add(next);
  }
  canvas.requestRenderAll();
  return true;
}

/**
 * Apply screenshot chrome. Cheap path for shadow/stroke; rebuild when radius or
 * status-bar chrome (or forceRebuild) requires a new cover-fill bitmap.
 */
function applyBareBorderStroke(group, chrome) {
  return applyOuterBorderStroke(group, chrome);
}

/**
 * Apply screenshot chrome. Cheap path for shadow/stroke; rebuild when radius or
 * status-bar chrome (or forceRebuild) requires a new cover-fill bitmap.
 */
export async function restyleScreenshot(group, style = {}, opts = {}) {
  if (!group) return false;

  if (group.glintRole === 'framed-screenshot') {
    const prev = group.glintChrome || {};
    const chrome = { ...DEFAULT_SCREENSHOT_STYLE, ...prev, ...style };
    const needsRebuild = opts.forceRebuild || chromeBitmapChanged(prev, chrome);
    if (!needsRebuild) {
      applyChromeShadow(group, chrome);
      applyOuterBorderStroke(group, chrome);
      group.set({ glintChrome: chrome });
      group.canvas?.requestRenderAll?.();
      return true;
    }
    return replaceDeviceFrame(
      group,
      group.glintFrameId,
      opts.screenshotUrl || group.glintScreenshotUrl,
      chrome,
    );
  }
  if (group.glintRole !== 'screenshot') return false;

  const prev = group.glintChrome || {};
  const chrome = { ...DEFAULT_SCREENSHOT_STYLE, ...prev, ...style };
  const radiusChanged =
    (chrome.cornerRadius ?? 0) !== (prev.cornerRadius ?? DEFAULT_SCREENSHOT_STYLE.cornerRadius);
  const needsBitmapRebuild =
    opts.forceRebuild || radiusChanged || chromeBitmapChanged(prev, chrome);

  if (!needsBitmapRebuild) {
    applyBareBorderStroke(group, chrome);
    applyChromeShadow(group, chrome);
    group.canvas?.requestRenderAll?.();
    return true;
  }

  const canvas = group.canvas;
  const screenshotUrl = opts.screenshotUrl || group.glintScreenshotUrl;
  if (!canvas || !screenshotUrl) {
    applyBareBorderStroke(group, chrome);
    applyChromeShadow(group, chrome);
    return false;
  }

  const center = getGroupGeoCenter(group);
  const angle = group.angle || 0;
  const slot = group.glintSlot;
  const slide = group.glintSlide;
  const selectable = group.selectable !== false;
  const uniform = Math.max(Math.abs(group.scaleX || 1), Math.abs(group.scaleY || 1));
  const pad = outerBorderPad(Math.max(0, chrome.strokeWidth ?? 0));
  const layoutW = group.glintLayoutW ?? group.width ?? 1;
  const layoutH = group.glintLayoutH ?? group.height ?? 1;
  const contentW = (group.glintTargetW ?? Math.max(1, layoutW - pad * 2)) * uniform;
  const contentH = (group.glintTargetH ?? Math.max(1, layoutH - pad * 2)) * uniform;
  const left = center.x - contentW / 2;
  const top = center.y - contentH / 2;

  const next = await addStyledScreenshot(canvas, screenshotUrl, {
    ...chrome,
    targetW: contentW,
    targetH: contentH,
    aspect: contentW / Math.max(1, contentH),
    left,
    top,
    selectable,
  });
  if (!next) return false;

  next.set({
    angle,
    glintSlot: slot,
    glintSlide: slide,
    glintScreenshotUrl: screenshotUrl,
  });
  applyDeviceTransformLocks(next);

  canvas.remove(group);
  group.dispose?.();
  canvas.requestRenderAll();
  return true;
}

/** Load a curated bezel as a Fabric object (PNG image or SVG group). */
export async function loadFrameBezel(frameId) {
  const meta = getFrameMeta(frameId);
  const ext = meta.ext || 'png';
  const src = `/frames/${frameId}.${ext}`;

  if (ext === 'svg') {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Frame not found: ${frameId}`);
    const svg = await res.text();
    const { objects, options } = await loadSVGFromString(svg);
    return util.groupSVGElements(objects, options);
  }

  return FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
}

/**
 * Composite screenshot + bezel into one native-resolution bitmap, then scale.
 * Avoids Fabric Group layout drift that misaligns the shot inside the hole.
 * Shot is clipped to the rounded screen rect so pixels never bleed past the bezel.
 */
async function buildFramedDeviceBitmap(screenshotUrl, frameId, chrome = {}) {
  const meta = getFrameMeta(frameId);
  const W = meta.width;
  const H = meta.height;
  const screenW = W - meta.left - meta.right;
  const screenH = H - meta.top - meta.bottom;
  const rx = meta.rx || 0;

  // Sharp fill - clipped to the hole; bezel PNG/SVG masks remaining chrome.
  const screen = await buildScreenBitmap(screenshotUrl, screenW, screenH, rx, chrome, frameId);
  const screenEl = screen.getElement?.() || screen._element;

  const bezel = await loadFrameBezel(frameId);
  let bezelEl = null;
  if (bezel.getElement) {
    bezelEl = bezel.getElement();
  } else if (bezel._element) {
    bezelEl = bezel._element;
  } else if (typeof bezel.toCanvasElement === 'function') {
    bezelEl = bezel.toCanvasElement(1);
  }

  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const ctx = off.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const sx = meta.left;
  const sy = meta.top;

  // White pad in the hole first (default empty device look).
  ctx.save();
  pathRoundRect(ctx, sx, sy, screenW, screenH, rx);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx, sy, screenW, screenH);
  if (screenEl) {
    ctx.drawImage(screenEl, sx, sy, screenW, screenH);
  }
  ctx.restore();

  if (bezelEl) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bezelEl, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
  }

  // Silhouette from real frame alpha (flood-fill hole) so corners never bleed.
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const mctx = mask.getContext('2d');
  if (bezelEl) mctx.drawImage(bezelEl, 0, 0, W, H);
  const src = mctx.getImageData(0, 0, W, H);
  const d = src.data;
  const out = mctx.createImageData(W, H);
  const o = out.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0) {
      o[i] = o[i + 1] = o[i + 2] = 255;
      o[i + 3] = 255;
    }
  }
  const seedX = Math.round(sx + screenW / 2);
  const seedY = Math.round(sy + screenH / 2);
  const stack = [[seedX, seedY]];
  const seen = new Uint8Array(W * H);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const idx = y * W + x;
    if (seen[idx]) continue;
    seen[idx] = 1;
    const p = idx * 4;
    if (d[p + 3] > 0) continue;
    o[p] = o[p + 1] = o[p + 2] = 255;
    o[p + 3] = 255;
    stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  mctx.putImageData(out, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  const fitted = await FabricImage.fromURL(off.toDataURL('image/png'));
  fitted.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: 1,
    scaleY: 1,
    selectable: false,
    evented: false,
  });
  screen.dispose?.();
  bezel.dispose?.();
  return fitted;
}

/** @deprecated Prefer loadFrameBezel - kept for callers that need raw SVG text. */
export async function loadFrameSvg(frameId) {
  const res = await fetch(`/frames/${frameId}.svg`);
  if (!res.ok) throw new Error(`Frame not found: ${frameId}`);
  return res.text();
}

export const DEVICE_SCALE_MIN = 0.25;
export const DEVICE_SCALE_MAX = 1.8;

/**
 * Lock device transforms: uniform scale via corner/edge handles + free move.
 */
export function applyDeviceTransformLocks(group) {
  if (!group) return group;
  applySelectionStyle(group);
  group.set({
    lockSkewingX: true,
    lockSkewingY: true,
    lockScalingFlip: true,
    lockRotation: true,
    lockMovementX: false,
    lockMovementY: false,
    hasControls: true,
    hasBorders: true,
    cornerSize: 10,
    hoverCursor: 'pointer',
    moveCursor: 'grabbing',
  });
  group.setControlsVisibility?.({
    tl: true,
    tr: true,
    bl: true,
    br: true,
    mt: true,
    mb: true,
    ml: true,
    mr: true,
    mtr: false,
  });
  if (!group.__glintUniformScaleBound) {
    group.__glintUniformScaleBound = true;
    const enforceUniform = function enforceUniform() {
      const sx = Math.abs(this.scaleX || 1);
      const sy = Math.abs(this.scaleY || 1);
      const s = Math.max(sx, sy) || 1;
      const clamped = Math.min(DEVICE_SCALE_MAX, Math.max(DEVICE_SCALE_MIN, s));
      if (Math.abs(sx - clamped) > 1e-4 || Math.abs(sy - clamped) > 1e-4) {
        const center = getGroupGeoCenter(this);
        this.set({ scaleX: clamped, scaleY: clamped });
        placeGroupAtCenter(this, center.x, center.y);
        this.setCoords?.();
      }
    };
    group.on('scaling', enforceUniform);
    group.on('modified', enforceUniform);
  }
  return group;
}

/**
 * Geometric layout size - ignores shadow blur that inflates Fabric bounds.
 */
function groupLayoutSize(group) {
  const sx = Math.abs(group.scaleX || 1);
  const sy = Math.abs(group.scaleY || 1);
  const baseW = group.glintLayoutW ?? group.glintTargetW ?? group.width ?? 0;
  const baseH = group.glintLayoutH ?? group.glintTargetH ?? group.height ?? 0;
  return { w: baseW * sx, h: baseH * sy, sx, sy };
}

/**
 * Geometric center from left/top/size + angle - ignores shadow blur that can skew getCenterPoint.
 * Devices use origin left/top, so the visual center rotates around that corner with `angle`.
 */
function getGroupGeoCenter(group) {
  const { w, h, sx, sy } = groupLayoutSize(group);
  const left = group.left || 0;
  const top = group.top || 0;
  const rad = ((group.angle || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = w / 2;
  const ly = h / 2;
  return {
    x: left + lx * cos - ly * sin,
    y: top + lx * sin + ly * cos,
    sx,
    sy,
    w,
    h,
  };
}

/**
 * Place group so its geometric center sits on (cx, cy).
 * Always forces left/top origin so scale/rotation don't drift the visual into the corner.
 */
function placeGroupAtCenter(group, cx, cy) {
  if (!group) return;
  const { w, h } = groupLayoutSize(group);
  const rad = ((group.angle || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = w / 2;
  const ly = h / 2;
  group.set({
    left: cx - (lx * cos - ly * sin),
    top: cy - (lx * sin + ly * cos),
    originX: 'left',
    originY: 'top',
  });
  group.setCoords?.();
}

/** Pure helper - left/top so layout box center sits on (cx, cy). */
export function pinnedTopLeft(cx, cy, layoutW, layoutH, scaleX = 1, scaleY = 1) {
  const w = (layoutW || 0) * Math.abs(scaleX || 1);
  const h = (layoutH || 0) * Math.abs(scaleY || 1);
  return { left: cx - w / 2, top: cy - h / 2 };
}

/** Display size + uniform scale for a framed device group. */
export function getDeviceDisplaySize(group) {
  if (!group || group.glintRole !== 'framed-screenshot') {
    return { width: 0, height: 0, scale: 1, scalePct: 100 };
  }
  const { w, h, sx } = groupLayoutSize(group);
  const scale = Math.min(DEVICE_SCALE_MAX, Math.max(DEVICE_SCALE_MIN, sx));
  return {
    width: Math.round(w),
    height: Math.round(h),
    scale,
    scalePct: Math.round(scale * 100),
  };
}

/** Set uniform device scale; keeps geometric center fixed. */
export function setDeviceUniformScale(group, scale) {
  if (!group || group.glintRole !== 'framed-screenshot') return false;
  const clamped = Math.min(DEVICE_SCALE_MAX, Math.max(DEVICE_SCALE_MIN, scale));
  const center = getGroupGeoCenter(group);
  group.set({ scaleX: clamped, scaleY: clamped });
  placeGroupAtCenter(group, center.x, center.y);
  group.setCoords?.();
  group.canvas?.requestRenderAll?.();
  return true;
}

/** Set device rotation in degrees; pivots around geometric center (not left/top). */
export function setDeviceAngle(group, angle) {
  if (!group || group.glintRole !== 'framed-screenshot') return false;
  const clamped = Math.max(-180, Math.min(180, Math.round(angle)));
  const center = getGroupGeoCenter(group);
  group.set({ angle: clamped });
  placeGroupAtCenter(group, center.x, center.y);
  group.setCoords?.();
  group.canvas?.requestRenderAll?.();
  return true;
}

function chromeBitmapChanged(prev = {}, next = {}, prevFrameId = null, nextFrameId = null) {
  return statusBarChromeChanged(prev, next, prevFrameId, nextFrameId) || screenshotFitChanged(prev, next);
}

/**
 * Move `obj` to `index` in the canvas stack.
 * Must mutate `_objects` - Fabric's getObjects() returns a copy.
 */
function moveObjectToIndex(canvas, obj, index) {
  if (!canvas || !obj || index < 0) return;
  const stack = canvas._objects;
  if (!Array.isArray(stack)) return;
  const cur = stack.indexOf(obj);
  if (cur < 0 || cur === index) return;
  stack.splice(cur, 1);
  stack.splice(Math.min(index, stack.length), 0, obj);
  canvas._onStackOrderChanged?.(obj);
}

/**
 * Swap the screenshot inside a framed device without resetting position/rotation/size.
 * Rebuilds the whole device group - Fabric 7 layout breaks if we surgically swap children.
 */
export async function replaceDeviceScreenshot(group, screenshotUrl) {
  if (!group || group.glintRole !== 'framed-screenshot' || !screenshotUrl) return false;
  const frameId = group.glintFrameId || 'pixel9';
  const canvas = group.canvas;
  if (!canvas) return false;

  const { x: cx, y: cy, sx, sy } = getGroupGeoCenter(group);
  const uniform = Math.max(sx, sy);
  const angle = group.angle || 0;
  const selectable = group.selectable !== false;
  const slot = group.glintSlot;
  const slide = group.glintSlide;
  const coverage = group.glintCoverage || MIN_DEVICE_COVERAGE;
  const oldIndex = canvas.getObjects().indexOf(group);
  const baseScale = group.glintBaseScale
    ?? resolveDeviceScale(frameId, canvas.getWidth?.() || 1080, canvas.getHeight?.() || 1920, coverage);
  const chrome = group.glintChrome || DEFAULT_SCREENSHOT_STYLE;

  const next = await addFramedScreenshot(canvas, screenshotUrl, frameId, {
    scale: baseScale,
    left: 0,
    top: 0,
    selectable,
    coverage,
    chrome,
    deferShadow: true,
  });
  if (!next) return false;

  next.set({
    shadow: null,
    originX: 'left',
    originY: 'top',
    angle,
    scaleX: uniform,
    scaleY: uniform,
    glintSlot: slot,
    glintSlide: slide,
    glintCoverage: coverage,
    glintScreenshotUrl: screenshotUrl,
  });
  placeGroupAtCenter(next, cx, cy);
  next.setCoords?.();
  applyChromeShadow(next, chrome);
  applyDeviceTransformLocks(next);

  canvas.remove(group);
  group.dispose?.();
  moveObjectToIndex(canvas, next, oldIndex);
  canvas.requestRenderAll();
  return true;
}

/**
 * Swap the device bezel while keeping the screenshot (cover-filled into the new hole).
 * Also accepts a bare `screenshot` group and wraps it in a bezel.
 */
export async function replaceDeviceFrame(group, nextFrameId, screenshotUrlOverride, styleOverride) {
  if (!group || !nextFrameId) return false;
  const role = group.glintRole;
  if (role !== 'framed-screenshot' && role !== 'screenshot') return false;

  const screenshotUrl = screenshotUrlOverride || group.glintScreenshotUrl;
  if (!screenshotUrl) return false;

  // Same bezel + same shot + no status-bar chrome change → skip rebuild.
  if (
    role === 'framed-screenshot'
    && group.glintFrameId === nextFrameId
    && screenshotUrl === group.glintScreenshotUrl
  ) {
    const prev = group.glintChrome || {};
    const chrome = {
      ...DEFAULT_SCREENSHOT_STYLE,
      ...prev,
      ...(styleOverride || {}),
    };
    if (!chromeBitmapChanged(prev, chrome)) {
      applyChromeShadow(group, chrome);
      applyOuterBorderStroke(group, chrome);
      group.set({ glintChrome: chrome });
      return true;
    }
  }

  const canvas = group.canvas;
  if (!canvas) return false;

  const chrome = {
    ...DEFAULT_SCREENSHOT_STYLE,
    ...(group.glintChrome || {}),
    ...(styleOverride || {}),
  };

  const canvasW = canvas.getWidth?.() || 1080;
  const canvasH = canvas.getHeight?.() || 1920;
  const selectable = group.selectable !== false;
  const slot = group.glintSlot;
  const slide = group.glintSlide;
  const angle = group.angle || 0;
  const { x: cx, y: cy, sx, sy, w: prevW, h: prevH } = getGroupGeoCenter(group);
  const objects = canvas.getObjects();
  const oldIndex = objects.indexOf(group);

  const coverage = Math.max(
    MIN_DEVICE_COVERAGE,
    group.glintCoverage || MIN_DEVICE_COVERAGE,
  );

  const swapIn = (next, scaleX, scaleY) => {
    if (!next) return false;
    const sxOut = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
    const syOut = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : sxOut;
    // Drop shadow while posing - blur/offset inflate Fabric bounds and used to
    // shove the bezel toward the bottom-right on fit-mode rebuilds.
    next.set({ shadow: null });
    next.set({
      originX: 'left',
      originY: 'top',
      angle,
      scaleX: sxOut,
      scaleY: syOut,
      glintSlot: slot,
      glintSlide: slide,
      glintCoverage: coverage,
      glintScreenshotUrl: screenshotUrl,
      glintFrameId: nextFrameId,
      glintChrome: chrome,
    });
    // Always re-center from the pre-swap geometric center. Pinning raw left/top
    // drifts when layout pad/aspect changes (status bar, bezel swap, stroke).
    placeGroupAtCenter(next, cx, cy);
    next.setCoords?.();
    applyChromeShadow(next, chrome);
    applyDeviceTransformLocks(next);

    canvas.remove(group);
    group.dispose?.();
    moveObjectToIndex(canvas, next, oldIndex);
    canvas.requestRenderAll();
    return true;
  };

  // Rebuild pixels (same or new bezel). Keep display-box size + geometric center.
  const baseScale = group.glintBaseScale
    ?? resolveDeviceScale(nextFrameId, canvasW, canvasH, coverage);
  const next = await addFramedScreenshot(canvas, screenshotUrl, nextFrameId, {
    scale: baseScale,
    left: 0,
    top: 0,
    selectable,
    coverage,
    chrome,
    deferShadow: true,
  });
  if (!next) return false;

  const layoutW = next.glintLayoutW || next.width || 1;
  const layoutH = next.glintLayoutH || next.height || 1;
  const fit = Math.min(prevW / Math.max(1, layoutW), prevH / Math.max(1, layoutH));
  const scaleOut = Number.isFinite(fit) && fit > 0 ? fit : Math.max(sx, sy) || 1;
  return swapIn(next, scaleOut, scaleOut);
}

/**
 * Composite screenshot inside device frame.
 * Screen + bezel are baked into one bitmap at native size, then scaled as a unit
 * so the shot contain-fits inside the hole (full shot borders; optional cover via chrome.fitMode).
 */
export async function addFramedScreenshot(canvas, screenshotUrl, frameId, opts = {}) {
  const targetScale = opts.scale ?? 0.55;
  const { frameW, frameH } = computeFrameLayout(frameId, targetScale);
  const meta = getFrameMeta(frameId);
  const chrome = { ...DEFAULT_SCREENSHOT_STYLE, ...(opts.chrome || {}) };
  const strokeW = Math.max(0, chrome.strokeWidth ?? 0);
  const pad = outerBorderPad(strokeW);

  const deviceImg = await buildFramedDeviceBitmap(screenshotUrl, frameId, chrome);
  deviceImg.set({
    scaleX: frameW / meta.width,
    scaleY: frameH / meta.height,
    left: pad,
    top: pad,
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
  });

  const border = makeOuterBorderRect(
    frameW,
    frameH,
    Math.min(frameW, frameH) * 0.08,
    strokeW,
    chrome.strokeColor || '#FFFFFF',
  );

  const group = new Group([deviceImg, border], {
    left: (opts.left ?? 0) - pad,
    top: (opts.top ?? 0) - pad,
    originX: 'left',
    originY: 'top',
    selectable: opts.selectable !== false,
    evented: opts.selectable !== false,
    subTargetCheck: false,
    objectCaching: false,
    layoutManager: new LayoutManager(new FixedLayout()),
    glintRole: 'framed-screenshot',
    glintFrameId: frameId,
    glintBaseScale: targetScale,
    glintCoverage: opts.coverage ?? MIN_DEVICE_COVERAGE,
    glintScreenshotUrl: screenshotUrl,
    glintChrome: chrome,
    glintLayoutW: frameW + pad * 2,
    glintLayoutH: frameH + pad * 2,
    width: frameW + pad * 2,
    height: frameH + pad * 2,
  });

  applyDeviceTransformLocks(group);

  canvas.add(group);
  // Shadow after add - and callers that immediately re-pose (fit / bezel swap)
  // should pass deferShadow so blur doesn't skew intermediate setCoords.
  if (!opts.deferShadow) {
    applyChromeShadow(group, chrome);
  }
  canvas.requestRenderAll();
  return group;
}

export function addTextOverlay(canvas, text, opts = {}) {
  const fb = new IText(text || 'Double-click to edit', {
    left: opts.left ?? canvas.getWidth() / 2,
    top: opts.top ?? 120,
    fontSize: opts.fontSize ?? 48,
    fontFamily: `${opts.fontFamily || 'Space Grotesk'}, sans-serif`,
    fontWeight: opts.fontWeight ?? '700',
    fill: opts.fill ?? '#ffffff',
    textAlign: opts.textAlign ?? 'center',
    originX: opts.originX ?? 'center',
    selectable: true,
    evented: true,
    editable: true,
    glintRole: 'text',
    ...opts,
  });
  applySelectionStyle(fb);
  canvas.add(fb);
  canvas.setActiveObject(fb);
  canvas.requestRenderAll();
  return fb;
}

export function deleteActiveObjects(canvas) {
  const active = canvas.getActiveObjects();
  if (!active.length) return;
  const removable = active.filter((obj) => !isProtectedLayer(obj));
  if (!removable.length) return;
  removable.forEach((obj) => canvas.remove(obj));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

export function findDeviceLayer(canvas) {
  const objs = canvas?.getObjects?.() || [];
  return (
    objs.find((o) => o.glintRole === 'framed-screenshot') ||
    objs.find((o) => o.glintRole === 'screenshot') ||
    null
  );
}

/** Select the device/screenshot group on a frame (explicit - never auto on frame focus). */
export function selectDeviceLayer(canvas) {
  if (!canvas) return null;
  const device = findDeviceLayer(canvas);
  if (!device) return null;
  canvas.setActiveObject(device);
  canvas.requestRenderAll();
  return device;
}

export function exportAsPNG(canvas) {
  return canvas.toDataURL({ format: 'png', multiplier: 1 });
}

export function clearCanvas(canvas) {
  canvas.clear();
  canvas.backgroundColor = '#ffffff';
  canvas.requestRenderAll();
}

/** Compute centered frame placement for store canvas (coverage = fraction of frame). */
export function computeCenteredFramePlacement(frameId, canvasW, canvasH, coverage = MIN_DEVICE_COVERAGE) {
  const scale = resolveDeviceScale(frameId, canvasW, canvasH, coverage);
  const { frameW, frameH } = computeFrameLayout(frameId, scale);
  return {
    scale,
    left: (canvasW - frameW) / 2,
    top: canvasH * 0.18,
  };
}

/**
 * Render a single scratch frame for batch export.
 */
export async function renderScratchFrame({
  screenshotUrl,
  background,
  frameId,
  screenshotStyle,
  text,
  width = 1080,
  height = 1920,
}) {
  const el = document.createElement('canvas');
  const canvas = createCanvas(el, width, height);
  try {
    if (background) setBackground(canvas, background.type, background.value);
    else setSolidBackground(canvas, '#1C1C1E');

    if (screenshotUrl && frameId) {
      const { scale, left, top } = computeCenteredFramePlacement(frameId, width, height);
      await addFramedScreenshot(canvas, screenshotUrl, frameId, { scale, left, top, selectable: false });
    } else if (screenshotUrl) {
      await addStyledScreenshot(canvas, screenshotUrl, {
        ...screenshotStyle,
        left: (width - width * (screenshotStyle?.scale ?? 0.58)) / 2,
        top: height * 0.18,
        selectable: false,
      });
    }

    if (text) {
      addTextOverlay(canvas, text, { top: 100, left: width / 2, selectable: false });
    }

    canvas.requestRenderAll();
    return canvas.toDataURL({ format: 'png', multiplier: 1 });
  } finally {
    canvas.dispose();
  }
}
