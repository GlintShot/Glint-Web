#!/usr/bin/env node
/**
 * Generates pixel-perfect preview strips using canvas with proper scaling.
 *
 * Output: public/templates/previews/{template-id}.png
 *
 * Renders each template slide at high resolution, then scales down intelligently
 * for crisp text, graphics, device bezels, and colors.
 *
 * Usage:
 *   npm run generate:previews
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createCanvas, loadImage } from 'canvas';
import {
  mergeTemplateFamily,
  TEMPLATE_FAMILY_PATHS,
} from '../src/utils/templateFamily.js';

const ROOT = resolve(import.meta.dirname, '..');
const TEMPLATES_DIR = join(ROOT, 'public', 'templates');
const PREVIEWS_DIR = join(TEMPLATES_DIR, 'previews');
const FRAMES_DIR = join(ROOT, 'public', 'frames');
const GRAPHICS_DIR = join(ROOT, 'public', 'graphics');

const RENDER_SCALE = 2;
const THUMB_WIDTH = 320;
const SLIDE_GAP = 8;

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;

/** CLI: `npm run generate:previews` or `… --only noir-orbit-ios,aurora-soft-play` */
const ONLY = new Set(
  (process.argv.find((a) => a.startsWith('--only=')) || '')
    .replace('--only=', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

if (!existsSync(PREVIEWS_DIR)) {
  mkdirSync(PREVIEWS_DIR, { recursive: true });
}

// Insets from frameMeta.js
const FRAME_INSETS = {
  pixel9: { ext: 'png', top: 142, right: 170, bottom: 138, left: 170, rx: 90, width: 1620, height: 3136 },
  'galaxy-s24': { ext: 'png', top: 200, right: 200, bottom: 200, left: 200, rx: 80, width: 1480, height: 2800 },
  'iphone16-pro': { ext: 'png', top: 100, right: 98, bottom: 100, left: 102, rx: 100, width: 1406, height: 2822 },
  'iphone16-pro-max': { ext: 'png', top: 100, right: 100, bottom: 100, left: 100, rx: 105, width: 1520, height: 3068 },
  'ipad-pro-13': { ext: 'png', top: 100, right: 100, bottom: 100, left: 100, rx: 55, width: 2264, height: 2952 },
  'ipad-pro': { ext: 'png', top: 100, right: 101, bottom: 100, left: 99, rx: 50, width: 1868, height: 2620 },
  'simple-dark': { ext: 'svg', top: 25, right: 25, bottom: 25, left: 25, rx: 62, width: 975, height: 1966 },
  'phone-3d': { ext: 'png', top: 100, right: 99, bottom: 100, left: 101, rx: 100, width: 1490, height: 2996 },
  'tablet-3d': { ext: 'png', top: 100, right: 100, bottom: 100, left: 100, rx: 55, width: 2264, height: 2952 },
  tv: { ext: 'svg', top: 40, right: 48, bottom: 176, left: 48, rx: 8, width: 1920, height: 1200 },
};

const DEFAULT_HEADLINES = [
  'Capture. Polish. Ship.',
  'Your app, store-ready',
  'Swap shots in seconds',
  'Five screens. One look.',
  'Built for Play & App Store',
];

const frameCache = new Map();
async function loadFrame(frameId) {
  if (!frameId || frameId === 'none') return null;
  if (frameCache.has(frameId)) return frameCache.get(frameId);

  const meta = FRAME_INSETS[frameId] || FRAME_INSETS.pixel9;
  const pngPath = join(FRAMES_DIR, `${frameId}.png`);
  const svgPath = join(FRAMES_DIR, `${frameId}.svg`);

  try {
    let img = null;
    if (existsSync(pngPath)) {
      img = await loadImage(pngPath);
    } else if (existsSync(svgPath)) {
      let xml = readFileSync(svgPath, 'utf-8');
      if (!xml.includes('width=') || !xml.includes('height=')) {
        xml = xml.replace(/<svg\b([^>]*)>/i, `<svg$1 width="${meta.width}" height="${meta.height}">`);
      }
      img = await loadImage(Buffer.from(xml));
    }
    if (img) {
      frameCache.set(frameId, { img, meta });
      return { img, meta };
    }
  } catch (err) {
    console.error(`  Warning: Failed to load frame ${frameId}: ${err.message}`);
  }
  return null;
}

const graphicCache = new Map();
async function loadTintedSvg(src, fills = {}) {
  const file = (src || '').replace(/^\/graphics\//, '');
  const key = `${file}_${fills.a || ''}_${fills.b || ''}_${fills.c || ''}`;
  if (graphicCache.has(key)) return graphicCache.get(key);

  const filePath = join(GRAPHICS_DIR, file);
  if (!existsSync(filePath)) return null;

  let xml = readFileSync(filePath, 'utf-8');
  const fa = fills.a || '#FF6B4A';
  const fb = fills.b || '#FFD166';
  const fc = fills.c || '#FFFFFF';

  xml = xml
    .replace(/(#A10000|#0000AA|#00A\b|#FF6B4A)/gi, fa)
    .replace(/(#B10000|#0000BB|#00B\b|#FFD166)/gi, fb)
    .replace(/(#C10000|#0000CC|#00C\b|#FFF7F2)/gi, fc);

  try {
    const img = await loadImage(Buffer.from(xml));
    graphicCache.set(key, img);
    return img;
  } catch {
    return null;
  }
}

function hexToRgb(hex) {
  const h = String(hex || '#1C1C1E').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(hex, toward, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

function isLight(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

function expandToFiveSlides(template) {
  const baseLayers = template.layers || [];
  const canvasH = template.canvas?.height ?? DEFAULT_HEIGHT;
  const canvasW = template.canvas?.width ?? DEFAULT_WIDTH;
  const landscape = canvasW > canvasH * 1.15;
  const square = Math.abs(canvasW - canvasH) / canvasW < 0.12;
  const bgLayer = baseLayers.find((l) => l.type === 'background');
  const accent = bgLayer?.color || template.preview?.bg || '#F5D06F';
  const deviceLayer = baseLayers.find((l) => l.type === 'device' || l.type === 'screenshot');
  const frame = deviceLayer?.frame || template.preview?.frame || 'pixel9';
  const graphics = baseLayers.filter((l) => l.type === 'graphic' || l.type === 'shape');
  const headlines =
    template.preview?.headlines?.length === 5
      ? template.preview.headlines
      : DEFAULT_HEADLINES.map((h, i) =>
          i === 0
            ? (baseLayers.find((l) => l.type === 'headline')?.placeholder || h)
            : h,
        );

  const layouts = landscape
    ? [
        { bg: '#0B0D10', textColor: '#F5D06F', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.08), phoneTop: Math.round(canvasH * 0.18), phoneScale: 0.78, showGraphics: false },
        { bg: '#151A21', textColor: '#E8E6DF', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.08), phoneTop: Math.round(canvasH * 0.18), phoneScale: 0.78, showGraphics: false },
        { bg: mix(accent, '#0B0D10', 0.35), textColor: '#FFFFFF', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.08), phoneTop: Math.round(canvasH * 0.18), phoneScale: 0.78, showGraphics: true },
        { bg: accent, textColor: '#412402', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.08), phoneTop: Math.round(canvasH * 0.18), phoneScale: 0.78, showGraphics: true },
        { bg: mix(accent, '#000000', 0.45), textColor: '#FFFFFF', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.08), phoneTop: Math.round(canvasH * 0.18), phoneScale: 0.78, showGraphics: false },
      ]
    : square
      ? [
          { bg: '#0B0D10', textColor: '#F5D06F', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.06), phoneTop: Math.round(canvasH * 0.16), phoneScale: 0.72, showGraphics: false },
          { bg: '#151A21', textColor: '#E8E6DF', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.06), phoneTop: Math.round(canvasH * 0.16), phoneScale: 0.72, showGraphics: false },
          { bg: mix(accent, '#FFFFFF', 0.15), textColor: '#0B0D10', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.06), phoneTop: Math.round(canvasH * 0.16), phoneScale: 0.72, showGraphics: true },
          { bg: accent, textColor: '#412402', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.06), phoneTop: Math.round(canvasH * 0.16), phoneScale: 0.72, showGraphics: true },
          { bg: '#1C222B', textColor: '#F5D06F', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.06), phoneTop: Math.round(canvasH * 0.16), phoneScale: 0.72, showGraphics: false },
        ]
      : [
          { bg: '#FFFFFF', textColor: '#FFFFFF', band: accent, headlineBottom: true, phoneTop: Math.round(canvasH * 0.06), phoneScale: 0.62, showGraphics: false },
          { bg: '#FFFFFF', textColor: isLight(accent) ? '#1A1A1A' : accent, band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.055), phoneTop: Math.round(canvasH * 0.18), phoneScale: 0.6, showGraphics: false },
          { bg: mix(accent, '#FFFFFF', 0.42), textColor: '#FFFFFF', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.055), phoneTop: Math.round(canvasH * 0.18), phoneScale: 0.6, showGraphics: true },
          { bg: accent, textColor: isLight(accent) ? '#1A1A1A' : '#FFFFFF', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.055), phoneTop: Math.round(canvasH * 0.18), phoneScale: 0.6, showGraphics: true },
          { bg: mix(accent, '#000000', 0.18), textColor: isLight(accent) ? '#1A1A1A' : '#FFFFFF', band: null, headlineBottom: false, headlineTop: Math.round(canvasH * 0.05), phoneTop: Math.round(canvasH * 0.16), phoneScale: 0.62, showGraphics: false },
        ];

  return layouts.map((layout, i) => {
    const layers = [{ type: 'background', color: layout.bg }];

    if (layout.showGraphics) {
      graphics.forEach((g) => {
        layers.push({
          ...g,
          left: 0,
          top: 0,
          width: canvasW,
        });
      });
    }

    if (layout.band) {
      layers.push({
        type: 'shape',
        shape: 'rect',
        fill: layout.band,
        left: -40,
        top: Math.round(canvasH * 0.78),
        width: canvasW + 80,
        height: Math.round(canvasH * 0.28),
        angle: -10,
        rx: 0,
      });
    }

    layers.push({
      type: 'headline',
      position: landscape || square ? 'left' : 'top',
      fontSize: landscape ? 44 : square ? 28 : layout.headlineBottom ? 46 : 54,
      fontWeight: '800',
      fontFamily: 'Inter',
      color: layout.textColor,
      placeholder: headlines[i],
      marginTop: layout.headlineBottom
        ? Math.round(canvasH * 0.84)
        : layout.headlineTop,
      ...(landscape || square ? { marginLeft: Math.round(canvasW * 0.05) } : {}),
    });

    layers.push({
      type: 'device',
      frame: frame || 'pixel9',
      slot: i % 5,
      scale: layout.phoneScale,
      position: 'center',
      marginTop: layout.phoneTop,
    });

    return {
      id: `${template.id}-frame-${i + 1}`,
      name: `Frame ${i + 1}`,
      layers,
    };
  });
}

function resolveSlides(template) {
  if (Array.isArray(template.slides) && template.slides.length > 0) {
    return template.slides;
  }
  return expandToFiveSlides(template);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function renderSlide(ctx, slide, canvasW, canvasH, fallbackBg, slideIndex) {
  const layers = slide?.layers || [];
  const bgLayer = layers.find((l) => l.type === 'background');
  const bgColor = bgLayer?.color || fallbackBg || '#1C1C1E';

  // Fill Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasW * RENDER_SCALE, canvasH * RENDER_SCALE);

  // Layer rendering
  for (const layer of layers) {
    switch (layer.type) {
      case 'background':
        break;

      case 'shape': {
        const shapeW = (layer.width || 400) * RENDER_SCALE;
        const shapeH = (layer.height || 200) * RENDER_SCALE;
        const x = (layer.left ?? 0) * RENDER_SCALE;
        const y = (layer.top ?? 0) * RENDER_SCALE;
        const rx = (layer.rx ?? (layer.shape === 'circle' ? shapeW / 2 : 0)) * RENDER_SCALE;

        ctx.save();
        ctx.globalAlpha = layer.opacity ?? 1;
        ctx.fillStyle = layer.fill || '#F5D06F';

        if (layer.angle) {
          ctx.translate(x + shapeW / 2, y + shapeH / 2);
          ctx.rotate((layer.angle * Math.PI) / 180);
          if (rx > 0) {
            roundRect(ctx, -shapeW / 2, -shapeH / 2, shapeW, shapeH, rx);
            ctx.fill();
          } else {
            ctx.fillRect(-shapeW / 2, -shapeH / 2, shapeW, shapeH);
          }
        } else {
          if (rx > 0) {
            roundRect(ctx, x, y, shapeW, shapeH, rx);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, shapeW, shapeH);
          }
        }
        ctx.restore();
        break;
      }

      case 'graphic': {
        const fills = {
          a: layer.fill || layer.fillA || '#FF6B4A',
          b: layer.fill2 || layer.fillB || '#FFD166',
          c: layer.fill3 || layer.fillC || '#FFFFFF',
        };
        const svgImg = await loadTintedSvg(layer.src, fills);
        if (!svgImg) break;

        const gw = (layer.width || canvasW) * RENDER_SCALE;
        const gh = (layer.height || (svgImg.height / (svgImg.width || 1)) * (layer.width || canvasW)) * RENDER_SCALE;
        const gx = (layer.left ?? 0) * RENDER_SCALE;
        const gy = (layer.top ?? 0) * RENDER_SCALE;

        ctx.save();
        ctx.globalAlpha = layer.opacity ?? 1;
        if (layer.angle) {
          ctx.translate(gx + gw / 2, gy + gh / 2);
          ctx.rotate((layer.angle * Math.PI) / 180);
          ctx.drawImage(svgImg, -gw / 2, -gh / 2, gw, gh);
        } else {
          ctx.drawImage(svgImg, gx, gy, gw, gh);
        }
        ctx.restore();
        break;
      }

      case 'device':
      case 'device-frame':
      case 'screenshot': {
        const frameId = layer.frame || 'pixel9';
        const frameData = await loadFrame(frameId);
        const meta = frameData?.meta || FRAME_INSETS[frameId] || FRAME_INSETS.pixel9;
        const live3d = layer.deviceMode === 'live3d';

        const coverage = Math.min(0.92, Math.max(0.4, layer.scale ?? layer.widthFraction ?? 0.6));
        const unitScale = Math.min((canvasW * coverage) / meta.width, (canvasH * coverage) / meta.height);
        const scale = unitScale * RENDER_SCALE;

        const frameW = meta.width * scale;
        const frameH = meta.height * scale;

        let left = (canvasW * RENDER_SCALE - frameW) / 2;
        if (layer.position === 'left') left = 40 * RENDER_SCALE;
        else if (layer.position === 'right') left = canvasW * RENDER_SCALE - frameW - 40 * RENDER_SCALE;
        if (layer.marginLeft != null) left = layer.marginLeft * RENDER_SCALE;

        let top = (layer.marginTop ?? 100) * RENDER_SCALE;
        if (layer.position === 'bottom') top = canvasH * RENDER_SCALE - frameH - (layer.marginBottom ?? 80) * RENDER_SCALE;

        // Live 3D gallery look: stronger yaw + slight foreshortening (no WebGL in Node).
        const angleDeg = live3d
          ? (layer.orbitYaw != null ? layer.orbitYaw * 0.45 : layer.angle ?? -22)
          : (layer.angle || 0);
        const foreshortenY = live3d ? 0.9 : 1;

        ctx.save();
        ctx.translate(left + frameW / 2, top + frameH / 2);
        if (angleDeg) ctx.rotate((angleDeg * Math.PI) / 180);
        if (live3d) {
          // Mild perspective skew so hero slides read as ¾ without loading Device3DScene.
          ctx.transform(1, 0, angleDeg > 0 ? 0.12 : -0.12, foreshortenY, 0, 0);
        }
        ctx.translate(-frameW / 2, -frameH / 2);

        // Draw Device Shadow
        ctx.save();
        ctx.shadowColor = live3d ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = (live3d ? 48 : 32) * RENDER_SCALE;
        ctx.shadowOffsetY = (live3d ? 24 : 16) * RENDER_SCALE;
        ctx.shadowOffsetX = live3d ? (angleDeg > 0 ? 12 : -12) * RENDER_SCALE : 0;

        const insetL = meta.left * scale;
        const insetT = meta.top * scale;
        const insetR = meta.right * scale;
        const insetB = meta.bottom * scale;
        const screenW = frameW - insetL - insetR;
        const screenH = frameH - insetT - insetB;
        const rx = (meta.rx || 60) * scale;

        // Draw Screen background (mock UI placeholder)
        roundRect(ctx, insetL, insetT, screenW, screenH, rx);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.restore();

        // Draw subtle screen mock UI (top bar + cards)
        ctx.save();
        roundRect(ctx, insetL, insetT, screenW, screenH, rx);
        ctx.clip();

        // Screen subtle gradient
        const screenGrad = ctx.createLinearGradient(0, insetT, 0, insetT + screenH);
        screenGrad.addColorStop(0, '#FAFAFA');
        screenGrad.addColorStop(1, '#F0F2F5');
        ctx.fillStyle = screenGrad;
        ctx.fillRect(insetL, insetT, screenW, screenH);

        // Top app bar mock
        ctx.fillStyle = '#E4E7EB';
        ctx.fillRect(insetL + 20 * RENDER_SCALE, insetT + 36 * RENDER_SCALE, screenW - 40 * RENDER_SCALE, 30 * RENDER_SCALE);

        // Hero card mock
        const cardH = screenH * 0.42;
        const cardGrad = ctx.createLinearGradient(0, insetT + 80 * RENDER_SCALE, 0, insetT + 80 * RENDER_SCALE + cardH);
        cardGrad.addColorStop(0, bgColor);
        cardGrad.addColorStop(1, mix(bgColor, '#000000', 0.2));
        ctx.fillStyle = cardGrad;
        roundRect(ctx, insetL + 20 * RENDER_SCALE, insetT + 80 * RENDER_SCALE, screenW - 40 * RENDER_SCALE, cardH, 16 * RENDER_SCALE);
        ctx.fill();

        // Secondary cards mock
        ctx.fillStyle = '#E8ECEF';
        roundRect(ctx, insetL + 20 * RENDER_SCALE, insetT + 95 * RENDER_SCALE + cardH, screenW - 40 * RENDER_SCALE, 45 * RENDER_SCALE, 12 * RENDER_SCALE);
        ctx.fill();
        roundRect(ctx, insetL + 20 * RENDER_SCALE, insetT + 150 * RENDER_SCALE + cardH, screenW - 40 * RENDER_SCALE, 45 * RENDER_SCALE, 12 * RENDER_SCALE);
        ctx.fill();

        ctx.restore();

        // Draw Bezel Frame Overlay
        if (frameData?.img) {
          ctx.drawImage(frameData.img, 0, 0, frameW, frameH);
        }

        ctx.restore();
        break;
      }

      case 'headline':
      case 'subheadline': {
        const text = layer.placeholder || layer.text || '';
        if (!text) break;

        const fontSize = (layer.fontSize || (layer.type === 'headline' ? 52 : 32)) * RENDER_SCALE;
        const fontWeight = layer.fontWeight || '700';
        ctx.font = `${fontWeight} ${fontSize}px "Inter", sans-serif`;
        ctx.fillStyle = layer.color || '#FFFFFF';

        const align = layer.position === 'left' ? 'left' : 'center';
        ctx.textAlign = align;
        ctx.textBaseline = 'top';

        const x = align === 'left'
          ? (layer.marginLeft ?? 60) * RENDER_SCALE
          : (canvasW * RENDER_SCALE) / 2;
        const y = (layer.marginTop ?? 120) * RENDER_SCALE;

        const lines = text.split('\n');
        const lineHeight = fontSize * (layer.lineHeight || 1.18);

        lines.forEach((line, i) => {
          ctx.fillText(line, x, y + i * lineHeight);
        });
        break;
      }

      case 'badge': {
        const text = layer.text || 'NEW';
        const fontSize = (layer.fontSize || 22) * RENDER_SCALE;
        ctx.font = `800 ${fontSize}px "Inter", sans-serif`;

        const padX = (layer.paddingX || 24) * RENDER_SCALE;
        const padY = (layer.paddingY || 12) * RENDER_SCALE;
        const metrics = ctx.measureText(text);
        const badgeW = metrics.width + padX * 2;
        const badgeH = fontSize + padY * 2;

        const bx = (layer.left ?? 60) * RENDER_SCALE;
        const by = (layer.top ?? 200) * RENDER_SCALE;

        ctx.save();
        ctx.fillStyle = layer.background || '#FFFFFF';
        roundRect(ctx, bx, by, badgeW, badgeH, badgeH / 2);
        ctx.fill();

        ctx.fillStyle = layer.color || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + badgeW / 2, by + badgeH / 2 + 1);
        ctx.restore();
        break;
      }
    }
  }
}

function resizeCanvas(sourceCanvas, targetW, targetH) {
  const target = createCanvas(targetW, targetH);
  const ctx = target.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, targetW, targetH);
  return target;
}

function stitchCanvases(canvases, gapWidth) {
  const h = canvases[0]?.height || 300;
  const totalW = canvases.reduce((sum, c) => sum + c.width, 0) + (canvases.length - 1) * gapWidth;

  const strip = createCanvas(totalW, h);
  const ctx = strip.getContext('2d');

  let x = 0;
  for (const canvas of canvases) {
    ctx.drawImage(canvas, x, 0);
    x += canvas.width + gapWidth;
  }

  return strip;
}

async function renderTemplate(template) {
  const canvasW = template.canvas?.width || DEFAULT_WIDTH;
  const canvasH = template.canvas?.height || DEFAULT_HEIGHT;
  const fallbackBg = template.preview?.bg || '#1C1C1E';
  const slides = resolveSlides(template);
  const slideCount = Math.max(1, Math.min(5, slides.length));

  const highResCanvases = [];
  for (let i = 0; i < slideCount; i++) {
    const renderW = canvasW * RENDER_SCALE;
    const renderH = canvasH * RENDER_SCALE;

    const canvas = createCanvas(renderW, renderH);
    const ctx = canvas.getContext('2d');

    await renderSlide(ctx, slides[i], canvasW, canvasH, fallbackBg, i);
    highResCanvases.push(canvas);
  }

  const thumbH = Math.round((THUMB_WIDTH / canvasW) * canvasH);
  const scaledCanvases = highResCanvases.map((c) =>
    resizeCanvas(c, THUMB_WIDTH, thumbH),
  );

  const strip = stitchCanvases(scaledCanvases, SLIDE_GAP);
  return strip.toBuffer('image/png');
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/** Flat JSON or family (common + platform) → engine template. */
function loadTemplateForPreview(templateId) {
  const fam = TEMPLATE_FAMILY_PATHS[templateId];
  if (fam) {
    const commonPath = join(TEMPLATES_DIR, fam.family, 'common.json');
    const platformPath = join(TEMPLATES_DIR, fam.family, `${fam.platform}.json`);
    if (!existsSync(commonPath) || !existsSync(platformPath)) {
      throw new Error(`family files missing for ${templateId}`);
    }
    return mergeTemplateFamily(loadJson(commonPath), loadJson(platformPath));
  }
  const flatPath = join(TEMPLATES_DIR, `${templateId}.json`);
  if (!existsSync(flatPath)) throw new Error(`missing ${templateId}.json`);
  return loadJson(flatPath);
}

function discoverTemplateIds() {
  const flat = readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'config.json')
    .map((f) => f.replace(/\.json$/, ''));
  const family = Object.keys(TEMPLATE_FAMILY_PATHS);
  const ids = [...new Set([...flat, ...family])].sort();
  if (ONLY.size) return ids.filter((id) => ONLY.has(id));
  return ids;
}

async function main() {
  console.log('Glint Template Preview Generator');
  console.log('================================\n');

  const templateIds = discoverTemplateIds();
  console.log(`Found ${templateIds.length} templates (flat + families)\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const templateId of templateIds) {
    const outputPath = join(PREVIEWS_DIR, `${templateId}.png`);

    try {
      const template = loadTemplateForPreview(templateId);
      if (!template.id) template.id = templateId;
      process.stdout.write(`  ${templateId.padEnd(24)} `);

      const buffer = await renderTemplate(template);
      writeFileSync(outputPath, buffer);

      generated++;
      console.log(`✓ (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      failed++;
      console.log(`✗ ${err.message}`);
    }
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${failed} failed`);
  console.log(`Output: ${PREVIEWS_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

