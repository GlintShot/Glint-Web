/**
 * Device-matched status bars - official SVG strips per frame (`public/frames/status-bars/`).
 * Screenshot content cover-fits into `screenContentRect` below the bar.
 */

import { getStatusBarMeta, statusBarHeightForFrame } from './frameMeta';

const imageCache = new Map();

function loadStatusBarImage(profile, theme) {
  const key = `${profile}-${theme}`;
  if (imageCache.has(key)) return imageCache.get(key);
  const src = `/frames/status-bars/${profile}-${theme}.svg?v=3`;
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Status bar not found: ${src}`));
    img.src = src;
  });
  imageCache.set(key, p);
  return p;
}

/** Clear cached SVG bitmaps (e.g. after regenerating assets in dev). */
export function clearStatusBarCache() {
  imageCache.clear();
}

export function statusBarKindForFrame(frameId) {
  const profile = getStatusBarMeta(frameId)?.profile || '';
  if (profile.startsWith('ios-island') || profile.startsWith('ios-notch')) return 'ios';
  if (profile === 'ipados') return 'ipados';
  return 'android';
}

export function statusBarHasIsland(frameId) {
  return getStatusBarMeta(frameId)?.profile === 'ios-island';
}

/** @deprecated use statusBarHeightForFrame - kept for tests */
export function statusBarHeight(screenW, kindOrFrameId = 'android') {
  if (typeof kindOrFrameId === 'string' && getStatusBarMeta(kindOrFrameId)) {
    return statusBarHeightForFrame(screenW, kindOrFrameId);
  }
  const ratios = { ios: 59 / 393, ipados: 24 / 1024, android: 36 / 412 };
  const r = ratios[kindOrFrameId] || ratios.android;
  return Math.max(1, Math.round(screenW * r));
}

export function resolveStatusBarKind(chrome = {}, frameId = null) {
  if (chrome.statusBarKind) return chrome.statusBarKind;
  return statusBarKindForFrame(frameId || chrome.frameId);
}

/** Content area below an optional status bar (full hole when disabled). */
export function screenContentRect(screenW, screenH, chrome = {}, frameId = null) {
  const w = Math.max(1, Math.round(screenW));
  const h = Math.max(1, Math.round(screenH));
  const kind = resolveStatusBarKind(chrome, frameId);
  const barH = chrome.statusBarEnabled ? statusBarHeightForFrame(w, frameId, h) : 0;
  return {
    x: 0,
    y: barH,
    w,
    h: Math.max(1, h - barH),
    barH,
    kind,
    profile: getStatusBarMeta(frameId)?.profile || null,
  };
}

/** object-fit: cover into a destination rect (dx may be negative when cropping). */
export function coverFitRect(srcW, srcH, destW, destH, destX = 0, destY = 0) {
  const iw = Math.max(1, srcW);
  const ih = Math.max(1, srcH);
  const dw0 = Math.max(1, destW);
  const dh0 = Math.max(1, destH);
  const cover = Math.max(dw0 / iw, dh0 / ih);
  const dw = iw * cover;
  const dh = ih * cover;
  return {
    dx: destX + (dw0 - dw) / 2,
    dy: destY + (dh0 - dh) / 2,
    dw,
    dh,
  };
}

/** object-fit: contain - fit inside dest without cropping, centered. */
export function containFitRect(srcW, srcH, destW, destH, destX = 0, destY = 0) {
  const iw = Math.max(1, srcW);
  const ih = Math.max(1, srcH);
  const dw0 = Math.max(1, destW);
  const dh0 = Math.max(1, destH);
  const contain = Math.min(dw0 / iw, dh0 / ih);
  const dw = iw * contain;
  const dh = ih * contain;
  return {
    dx: destX + (dw0 - dw) / 2,
    dy: destY + (dh0 - dh) / 2,
    dw,
    dh,
  };
}

/** Paint the device SVG status strip scaled to the screen hole. */
export async function paintStatusBar(ctx, screenW, theme = 'dark', frameId = null, screenH = 0) {
  if (!ctx || !(screenW > 0)) return;
  const sb = getStatusBarMeta(frameId);
  if (!sb?.profile) return;
  const barH = statusBarHeightForFrame(screenW, frameId, screenH);
  const variant = theme === 'light' ? 'light' : 'dark';
  try {
    const img = await loadStatusBarImage(sb.profile, variant);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, screenW, barH);
  } catch {
    /* ponytail: missing asset - skip overlay rather than break export */
  }
}

/** Legacy no-op - use paintStatusBar. */
export function drawStatusBar() {}

/** True when status-bar chrome fields changed enough to rebake the screen bitmap. */
export function statusBarChromeChanged(prev = {}, next = {}, prevFrameId = null, nextFrameId = null) {
  const prevProfile = getStatusBarMeta(prevFrameId)?.profile;
  const nextProfile = getStatusBarMeta(nextFrameId)?.profile;
  return (
    !!prev.statusBarEnabled !== !!next.statusBarEnabled
    || (next.statusBarEnabled
      && (prev.statusBarTheme || 'dark') !== (next.statusBarTheme || 'dark'))
    || (next.statusBarEnabled && prevProfile !== nextProfile)
  );
}

/** True when screenshot fit mode / crop offset changed enough to rebake the screen bitmap. */
export function screenshotFitChanged(prev = {}, next = {}) {
  return (
    (prev.fitMode || 'contain') !== (next.fitMode || 'contain')
    || (prev.fitOffsetX ?? 0) !== (next.fitOffsetX ?? 0)
    || (prev.fitOffsetY ?? 0) !== (next.fitOffsetY ?? 0)
  );
}
