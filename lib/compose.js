/**
 * compose.js - Pure geometry. No DOM, no rendering, no side effects.
 *
 * Takes template JSON + screenshots + design overrides →
 * returns [{type, x, y, w, h, rotate, ...}] per slide.
 *
 * Both the Fabric editor and the CLI renderer consume this same output.
 * Agent writes design.json → compose() → renderer draws pixels.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

// ─── Store targets ──────────────────────────────────────────────────────────
export const STORES = {
  'play/phone':     { w: 1080, h: 1920 },
  'play/tablet-7':  { w: 1200, h: 1920 },
  'play/tablet-10': { w: 1600, h: 2560 },
  'play/tv':        { w: 1920, h: 1080 },
  'ios/iphone':     { w: 1290, h: 2796 },
  'ios/ipad':       { w: 2048, h: 2732 },
};

// ─── Device frame insets (native frame pixels) ──────────────────────────────
export const FRAMES = {
  // rx must match the frame PNG corner curve or shot corners bleed past the bezel.
  pixel9:           { w: 1620, h: 3136, inset: { t: 142, r: 170, b: 138, l: 170 }, rx: 200, ext: 'png' },
  'galaxy-s24':     { w: 1480, h: 2800, inset: { t: 200, r: 200, b: 200, l: 200 }, rx: 160, ext: 'png' },
  'iphone16-pro':   { w: 1406, h: 2822, inset: { t: 100, r: 98,  b: 100, l: 102 }, rx: 140, ext: 'png' },
  'iphone16-pro-max': { w: 1520, h: 3068, inset: { t: 100, r: 100, b: 100, l: 100 }, rx: 145, ext: 'png' },
  'iphone13-pro':   { w: 1570, h: 2932, inset: { t: 155, r: 160, b: 155, l: 160 }, rx: 140, ext: 'png' },
  'iphone13-pro-max': { w: 1684, h: 3178, inset: { t: 155, r: 160, b: 160, l: 160 }, rx: 145, ext: 'png' },
  'ipad-pro-13':    { w: 2448, h: 3132, inset: { t: 115, r: 115, b: 115, l: 115 }, rx: 70, ext: 'png' },
  'ipad-pro':       { w: 2068, h: 2788, inset: { t: 116, r: 116, b: 116, l: 116 }, rx: 65, ext: 'png' },
  'ipad-air-2020':  { w: 1940, h: 2660, inset: { t: 55,  r: 55,  b: 55,  l: 55  }, rx: 55, ext: 'png' },
};

// ─── Graphics catalog (SVG filenames + default placements) ───────────────────
export const GRAPHICS = [
  { id: 'soft-blob',     src: 'soft-blob.svg',     w: 520 },
  { id: 'glow-ring',     src: 'glow-ring.svg',     w: 520 },
  { id: 'spark-mini',    src: 'spark-mini.svg',    w: 200 },
  { id: 'wave-cap',      src: 'wave-cap.svg',      w: 1080 },
  { id: 'curve-sweep',   src: 'curve-sweep.svg',   w: 720 },
  { id: 'blob-cluster',  src: 'blob-cluster.svg',  w: 1080 },
  { id: 'wave-layers',   src: 'wave-layers.svg',   w: 1080 },
  { id: 'rings',         src: 'rings.svg',         w: 1080 },
  { id: 'orb-cluster',   src: 'orb-cluster.svg',   w: 1080 },
  { id: 'sparkles',      src: 'sparkles.svg',      w: 1080 },
  { id: 'confetti',      src: 'confetti.svg',      w: 1080 },
  { id: 'arch',          src: 'arch.svg',          w: 1080 },
  { id: 'dots-grid',     src: 'dots-grid.svg',     w: 1080 },
  { id: 'leaf-flourish', src: 'leaf-flourish.svg', w: 1080 },
  { id: 'diagonal-bars', src: 'diagonal-bars.svg', w: 1080 },
  { id: 'gradient-orb',  src: 'gradient-orb.svg',  w: 680 },
  { id: 'abstract-wave', src: 'abstract-wave.svg', w: 1080 },
  { id: 'corner-accents', src: 'corner-accents.svg', w: 1080 },
  { id: 'soft-glow',     src: 'soft-glow.svg',     w: 1080 },
  { id: 'diamond-stack', src: 'diamond-stack.svg', w: 400 },
];

export const ICONS = [
  { id: 'icon-check',      src: 'icons/check-circle.svg', w: 120 },
  { id: 'icon-star',       src: 'icons/star.svg',         w: 120 },
  { id: 'icon-heart',      src: 'icons/heart.svg',        w: 120 },
  { id: 'icon-arrow-right', src: 'icons/arrow-right.svg', w: 140 },
  { id: 'icon-arrow-up',   src: 'icons/arrow-up.svg',     w: 120 },
  { id: 'icon-download',   src: 'icons/download.svg',     w: 120 },
  { id: 'icon-play',       src: 'icons/play.svg',         w: 200 },
  { id: 'icon-bolt',       src: 'icons/bolt.svg',         w: 120 },
  { id: 'icon-shield',     src: 'icons/shield.svg',       w: 120 },
  { id: 'icon-gift',       src: 'icons/gift.svg',         w: 120 },
  { id: 'icon-bell',       src: 'icons/bell.svg',         w: 120 },
  { id: 'icon-share',      src: 'icons/share.svg',        w: 120 },
  { id: 'icon-lock',       src: 'icons/lock.svg',         w: 120 },
  { id: 'icon-globe',      src: 'icons/globe.svg',        w: 120 },
  { id: 'icon-rocket',     src: 'icons/rocket.svg',       w: 120 },
];

// ─── Template loading ───────────────────────────────────────────────────────

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Load a template by id, resolving extends (common.json → variant). */
export function loadTemplate(templateId) {
  // Try family variant first: "blink-play" → blink/play.json
  const parts = templateId.split('-');
  for (let splitAt = 1; splitAt < parts.length; splitAt++) {
    const family = parts.slice(0, splitAt).join('-');
    const variant = parts.slice(splitAt).join('-');
    const familyDir = join(PUBLIC, 'templates', family);
    if (existsSync(familyDir)) {
      const commonPath = join(familyDir, 'common.json');
      const variantPath = join(familyDir, `${variant}.json`);
      if (existsSync(commonPath) && existsSync(variantPath)) {
        const common = readJson(commonPath);
        const variantJson = readJson(variantPath);
        return mergeFamily(common, variantJson);
      }
    }
  }

  // Try flat file: "play-pop" → play-pop.json
  const flatPath = join(PUBLIC, 'templates', `${templateId}.json`);
  if (existsSync(flatPath)) return readJson(flatPath);

  // Try family dir with default: "warm-glow" → warm-glow/common.json
  const familyDir = join(PUBLIC, 'templates', templateId);
  if (existsSync(familyDir)) {
    const commonPath = join(familyDir, 'common.json');
    if (existsSync(commonPath)) return readJson(commonPath);
  }

  throw new Error(`Template not found: ${templateId}`);
}

function mergeFamily(common, variant) {
  return {
    ...common,
    ...variant,
    // Merge palette (variant overrides common)
    palette: variant.palette || common.palette,
    // Merge device (variant overrides common)
    device: { ...(common.device || {}), ...(variant.device || {}) },
    // Merge style (variant overrides common)
    style: { ...(common.style || {}), ...(variant.style || {}) },
    // Merge preview
    preview: { ...(common.preview || {}), ...(variant.preview || {}) },
    // Merge layout (variant overrides common per slide)
    layout: { ...(common.layout || {}), ...(variant.layout || {}) },
    // Use variant slides if present, else common
    slides: variant.slides || common.slides,
    // Layers from common if no slides
    layers: variant.layers || common.layers,
  };
}

// ─── Geometry helpers ───────────────────────────────────────────────────────

function resolvePosition(pos, canvasW, canvasH, elementH = 0, marginTop = 0) {
  switch (pos) {
    case 'top':    return marginTop || Math.round(canvasH * 0.06);
    case 'center': return Math.round((canvasH - elementH) / 2);
    case 'bottom': return canvasH - elementH - (marginTop || Math.round(canvasH * 0.06));
    default:       return marginTop || 0;
  }
}

function resolveDeviceGeometry(frameId, canvasW, canvasH, scale, position, marginTop) {
  const meta = FRAMES[frameId] || FRAMES.pixel9;
  let s = scale;
  let frameW = meta.w * s;
  let frameH = meta.h * s;
  // Template layout JSON uses marginTop as absolute Y (not center offset).
  const absoluteY = marginTop != null && Number.isFinite(Number(marginTop));
  let y = absoluteY
    ? Math.round(Number(marginTop))
    : resolvePosition(position, canvasW, canvasH, frameH, 0);
  // Fit on canvas when layout scale+y would overflow (common in family templates).
  const bottomPad = 48;
  if (y + frameH > canvasH - bottomPad) {
    const fit = (canvasH - bottomPad - Math.max(0, y)) / meta.h;
    if (fit > 0.2 && fit < s) {
      s = fit;
      frameW = meta.w * s;
      frameH = meta.h * s;
    }
  }
  const x = Math.round((canvasW - frameW) / 2);
  return { x, y, w: Math.round(frameW), h: Math.round(frameH), scale: s, frameId };
}

// ─── Core compose function ──────────────────────────────────────────────────

/**
 * Compose slides from template + screenshots + overrides.
 *
 * @param {object} opts
 * @param {string} opts.templateId - Template id (e.g. "blink-play")
 * @param {string[]} [opts.screenshots] - Screenshot file paths or data URLs, one per slide
 * @param {object} [opts.overrides] - Design overrides per slide
 * @param {string} [opts.store] - Store target (e.g. "play/phone"), overrides template
 * @returns {{ canvas: {w,h}, slides: Array<{composables: [], background: string}> }}
 */
export function compose({ templateId, screenshots = [], overrides = {}, store } = {}) {
  const tpl = loadTemplate(templateId);
  const storeKey = store || tpl.store || 'play/phone';
  const storeMeta = STORES[storeKey] || STORES['play/phone'];
  const canvasW = tpl.canvas?.width || storeMeta.w;
  const canvasH = tpl.canvas?.height || storeMeta.h;

  const slideOverrides = overrides.slides || {};
  const result = { canvas: { w: canvasW, h: canvasH }, slides: [] };

  // ── Family template (has slides array) ──────────────────────────────────
  if (tpl.slides && Array.isArray(tpl.slides)) {
    const layout = tpl.layout || {};
    const palette = buildPalette(tpl.palette);
    const deviceDefault = tpl.device || {};

    for (let i = 0; i < tpl.slides.length; i++) {
      const slide = tpl.slides[i];
      const slideLayout = layout[slide.name] || {};
      const over = slideOverrides[i] || slideOverrides[slide.name] || {};
      const composables = [];
      let bgColor = '#FFFFFF';

      for (const layer of slide.layers) {
        const override = slideLayout[layer.role] || {};
        const o = { ...layer, ...override, ...(over[layer.role] || {}) };

        if (o.type === 'background') {
          bgColor = over.bg || over.background || over.color || o.color || '#FFFFFF';
          composables.push({ type: 'background', color: bgColor });
        } else if (o.type === 'headline') {
          const text = over.text || over.headline || o.placeholder || '';
          const position = over.position || o.position || 'top';
          const marginTop = over.marginTop ?? o.marginTop;
          composables.push({
            type: 'text',
            role: 'headline',
            text,
            // x = horizontal center of the text block when align is center
            x: o.left ?? Math.round(canvasW / 2),
            y: resolvePosition(position, canvasW, canvasH, 0, marginTop),
            w: o.widthRatio ? Math.round(canvasW * o.widthRatio) : canvasW - 120,
            fontSize: over.fontSize || o.fontSize || 56,
            fontWeight: o.fontWeight || '800',
            color: resolveColor(over.color || o.color, palette),
            align: o.align || 'center',
            fontFamily: tpl.style?.fontFamily || 'system-ui, sans-serif',
            lineHeight: tpl.style?.lineHeight || 1.14,
            charSpacing: o.charSpacing || 0,
            shadow: o.shadow ? (tpl.style?.shadow || null) : null,
          });
        } else if (o.type === 'subheadline') {
          const text = over.text || over.subheadline || o.placeholder || '';
          const position = over.position || o.position || 'top';
          const marginTop = over.marginTop ?? o.marginTop;
          composables.push({
            type: 'text',
            role: 'subheadline',
            text,
            x: o.left ?? Math.round(canvasW / 2),
            y: resolvePosition(position, canvasW, canvasH, 0, marginTop),
            w: o.widthRatio ? Math.round(canvasW * o.widthRatio) : canvasW - 160,
            fontSize: over.fontSize || o.fontSize || 36,
            fontWeight: o.fontWeight || '400',
            color: resolveColor(over.color || o.color, palette),
            align: o.align || 'center',
            fontFamily: tpl.style?.fontFamily || 'system-ui, sans-serif',
            lineHeight: tpl.style?.lineHeight || 1.3,
          });
        } else if (o.type === 'device') {
          const prevFrameId = o.frame || deviceDefault.frame || 'pixel9';
          const frameId = over.frame || over.device?.frame || prevFrameId;
          // Device geometry must NOT inherit slide headline marginTop/scale.
          const deviceOver = over.device || {};
          let scale = over.deviceScale ?? deviceOver.scale ?? o.scale ?? 0.58;
          // Frame swap without explicit scale → keep previous display box (agent parity with editor).
          if (over.frame && over.frame !== prevFrameId && over.deviceScale == null && deviceOver.scale == null) {
            const prevMeta = FRAMES[prevFrameId] || FRAMES.pixel9;
            const nextMeta = FRAMES[frameId] || FRAMES.pixel9;
            const prevScale = o.scale ?? 0.58;
            const prevW = prevMeta.w * prevScale;
            const prevH = prevMeta.h * prevScale;
            scale = Math.min(prevW / nextMeta.w, prevH / nextMeta.h);
          }
          const coverage = over.widthFraction || deviceOver.widthFraction || deviceDefault.widthFraction;
          const actualScale = coverage && over.frame == null && over.deviceScale == null && deviceOver.scale == null
            ? Math.min((canvasW * coverage) / (FRAMES[frameId]?.w || 1620), 1)
            : scale;
          const deviceMargin = over.deviceMarginTop ?? deviceOver.marginTop ?? o.marginTop;
          composables.push({
            type: 'device',
            ...resolveDeviceGeometry(
              frameId,
              canvasW,
              canvasH,
              actualScale,
              o.position || deviceDefault.position || 'center',
              deviceMargin,
            ),
            frameId,
            screenshotIndex: o.slot ?? i,
            fitMode: over.fitMode || deviceOver.fitMode || 'contain',
          });
        } else if (o.type === 'graphic') {
          composables.push({
            type: 'graphic',
            src: o.src,
            x: o.left ?? 0,
            y: o.top ?? 0,
            w: o.width || canvasW,
            h: o.height || canvasH,
            fill: resolveColor(o.fill, palette),
            fill2: resolveColor(o.fill2, palette),
            fill3: resolveColor(o.fill3, palette),
            angle: o.angle || 0,
          });
        }
      }

      result.slides.push({
        name: slide.name,
        background: bgColor,
        composables,
        screenshot: screenshots[i] || null,
      });
    }
    return result;
  }

  // ── Simple template (flat layers array) ─────────────────────────────────
  if (tpl.layers && Array.isArray(tpl.layers)) {
    const over = slideOverrides[0] || slideOverrides;
    const composables = [];
    let bgColor = '#FFFFFF';
    let slideIdx = 0;

    for (const layer of tpl.layers) {
      const o = { ...layer, ...(over.layers?.[0] || {}) };

      if (o.type === 'background') {
        bgColor = over.bg || over.background || over.color || o.color || '#FFFFFF';
        composables.push({ type: 'background', color: bgColor });
      } else if (o.type === 'headline') {
        composables.push({
          type: 'text',
          text: over.headline || over.text || o.placeholder || '',
          x: o.left ?? Math.round(canvasW / 2),
          y: resolvePosition(o.position, canvasW, canvasH, 0, o.marginTop),
          w: o.widthRatio ? Math.round(canvasW * o.widthRatio) : canvasW - 120,
          fontSize: o.fontSize || 56,
          fontWeight: o.fontWeight || '800',
          color: o.color || '#FFFFFF',
          align: 'center',
          fontFamily: tpl.style?.fontFamily || 'system-ui, sans-serif',
          lineHeight: tpl.style?.lineHeight || 1.14,
          charSpacing: o.charSpacing || 0,
        });
      } else if (o.type === 'device') {
        const prevFrameId = o.frame || 'pixel9';
        const frameId = over.frame || prevFrameId;
        let scale = over.scale ?? o.scale ?? 0.58;
        if (over.frame && over.frame !== prevFrameId && over.scale == null) {
          const prevMeta = FRAMES[prevFrameId] || FRAMES.pixel9;
          const nextMeta = FRAMES[frameId] || FRAMES.pixel9;
          const prevScale = o.scale ?? 0.58;
          scale = Math.min(
            (prevMeta.w * prevScale) / nextMeta.w,
            (prevMeta.h * prevScale) / nextMeta.h,
          );
        }
        composables.push({
          type: 'device',
          ...resolveDeviceGeometry(frameId, canvasW, canvasH, scale, o.position || 'center', o.marginTop),
          frameId,
          screenshotIndex: o.slot ?? slideIdx++,
        });
      } else if (o.type === 'graphic') {
        composables.push({
          type: 'graphic',
          src: o.src,
          x: o.left ?? 0,
          y: o.top ?? 0,
          w: o.width || canvasW,
          h: o.height || canvasH,
          fill: o.fill,
          fill2: o.fill2,
          fill3: o.fill3,
          angle: o.angle || 0,
        });
      }
    }

    result.slides.push({
      name: 'Screen',
      background: bgColor,
      composables,
      screenshot: screenshots[0] || null,
    });
  }

  return result;
}

// ─── Palette + color helpers ────────────────────────────────────────────────

function buildPalette(paletteArr) {
  if (!paletteArr) return {};
  const map = {};
  for (const p of paletteArr) map[p.id] = p.color;
  return map;
}

function resolveColor(color, palette) {
  if (!color) return null;
  // Palette reference: "primary", "c0", "background"
  if (palette[color]) return palette[color];
  // Already hex
  if (color.startsWith('#')) return color;
  return color;
}

// ─── File path helpers for renderer ─────────────────────────────────────────

export function framePngPath(frameId) {
  const meta = FRAMES[frameId] || FRAMES.pixel9;
  return join(PUBLIC, 'frames', `${frameId}.${meta.ext || 'png'}`);
}

export function graphicSvgPath(src) {
  return join(PUBLIC, 'graphics', src);
}

export function iconSvgPath(src) {
  return join(PUBLIC, 'graphics', src);
}
