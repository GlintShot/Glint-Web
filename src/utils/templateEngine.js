import { FabricImage, Rect, IText, Shadow } from 'fabric';
import { createCanvas, setBackground, addFramedScreenshot, applyDeviceTransformLocks, applySelectionStyle, copyGlintProps, GLINT_CLONE_PROPS, loadFrameBezel } from './canvasEngine';
import { addGraphicLayer, addShapeLayer } from './graphicLayers';
import { getTheme } from './templateLoader';
import { getFrameMeta, resolveDeviceScale, MIN_DEVICE_COVERAGE } from './frameMeta';
import { ensureSlideHasDevice, resolveTemplateFrame, bindSlideToFrameShot } from './templateDevices';
import { ensureFontReady } from './fontLibrary';

export { ensureSlideHasDevice, resolveTemplateFrame } from './templateDevices';

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;
export const SLIDE_GAP = 48;

const DEFAULT_HEADLINES = [
  'Capture. Polish. Ship.',
  'Your app, store-ready',
  'Swap shots in seconds',
  'Five screens. One look.',
  'Built for Play & App Store',
];

function resolvePosition(position, canvasW, canvasH, objW, objH, layer = {}) {
  const marginTop = layer.marginTop ?? 0;
  const marginLeft = layer.marginLeft;

  // Explicit x/y from Figma (Blink/BoxLock pixel layouts).
  if (marginLeft != null && (position == null || position === 'absolute')) {
    return { left: marginLeft, top: marginTop };
  }

  switch (position) {
    case 'top':
      return { left: (canvasW - objW) / 2, top: marginTop };
    case 'left':
      return { left: marginLeft ?? 40, top: marginTop };
    case 'right':
      return { left: canvasW - objW - 40, top: marginTop + 200 };
    case 'center':
      return { left: (canvasW - objW) / 2, top: marginTop || (canvasH - objH) / 2 };
    case 'bottom-center':
      return { left: (canvasW - objW) / 2, top: canvasH - objH - 80 };
    case 'bottom':
      return { left: (canvasW - objW) / 2, top: canvasH - objH - (layer.marginBottom ?? 80) };
    default:
      return {
        left: marginLeft ?? (canvasW - objW) / 2,
        top: marginTop || 100,
      };
  }
}

function shiftLayer(layer, originX) {
  if (!originX) return layer;
  return {
    ...layer,
    left: (layer.left ?? 0) + originX,
    marginLeft: layer.marginLeft != null ? layer.marginLeft + originX : undefined,
  };
}

async function addScreenshotLayer(canvas, screenshotUrl, layer, canvasW, canvasH, editable, originX = 0) {
  const img = await FabricImage.fromURL(screenshotUrl, { crossOrigin: 'anonymous' });
  const iw = img.width || 1;
  const ih = img.height || 1;

  // Absolute box (tablet / wear / chromebook packs author left/top/width/height).
  const hasBox =
    layer.width != null &&
    layer.height != null &&
    (layer.left != null || layer.top != null);

  let imgScale;
  let left;
  let top;
  let objW;
  let objH;

  if (hasBox) {
    const boxW = layer.width;
    const boxH = layer.height;
    imgScale = Math.min(boxW / iw, boxH / ih);
    objW = iw * imgScale;
    objH = ih * imgScale;
    left = (layer.left ?? 0) + originX + (boxW - objW) / 2;
    top = (layer.top ?? 0) + (boxH - objH) / 2;
  } else {
    const scale = layer.scale ?? 0.7;
    const maxW = canvasW * scale;
    const maxH = canvasH * scale;
    imgScale = Math.min(maxW / iw, maxH / ih, 1);
    objW = iw * imgScale;
    objH = ih * imgScale;
    const pos = resolvePosition(layer.position ?? 'center', canvasW, canvasH, objW, objH, layer);
    left = pos.left + originX;
    top = pos.top;
  }

  img.set({
    scaleX: imgScale,
    scaleY: imgScale,
    left,
    top,
    evented: editable,
    selectable: editable,
    glintRole: 'screenshot',
    glintSlot: layer.slot ?? 0,
  });

  const radius = layer.rx ?? layer.rounded;
  if (radius) {
    img.set({
      clipPath: new Rect({
        width: objW,
        height: objH,
        rx: radius,
        ry: radius,
        originX: 'center',
        originY: 'center',
      }),
    });
  }

  canvas.add(img);
  return img;
}

async function addFrameLayer(canvas, frameId, layer, canvasW, canvasH, editable, originX = 0) {
  if (!frameId) return null;
  try {
    const frame = await loadFrameBezel(frameId);
    const meta = getFrameMeta(frameId);
    const scale = layer.scale ?? 0.75;
    const frameW = meta.width * scale;
    const frameH = meta.height * scale;
    const fw = frame.width || meta.width;
    const fh = frame.height || meta.height;

    frame.set({
      scaleX: frameW / fw,
      scaleY: frameH / fh,
      evented: editable,
      selectable: editable,
    });

    const pos = resolvePosition(layer.position ?? 'center', canvasW, canvasH, frameW, frameH, layer);
    frame.set({ left: pos.left + originX, top: pos.top });
    canvas.add(frame);
    return frame;
  } catch {
    return null;
  }
}

async function addDeviceLayer(
  canvas,
  screenshotUrl,
  layer,
  canvasW,
  canvasH,
  editable,
  originX = 0,
  { skipLive3d = false } = {},
) {
  if (!layer.frame || !screenshotUrl) return null;
  const meta = getFrameMeta(layer.frame);
  const minCoverage = layer.minCoverage ?? MIN_DEVICE_COVERAGE;
  let scale;
  let coverage;
  // widthFraction: size by canvas width (keeps Android/iOS/iPad side margins consistent).
  // layer.scale alone = coverage of the tighter canvas axis (legacy).
  if (layer.widthFraction != null && layer.widthFraction > 0) {
    const frac = Math.min(1, Math.max(0.2, layer.widthFraction));
    scale = (canvasW * frac) / meta.width;
    coverage = Math.max(minCoverage, (meta.width * scale) / canvasW, (meta.height * scale) / canvasH);
  } else {
    coverage = Math.max(minCoverage, layer.scale ?? minCoverage);
    scale = resolveDeviceScale(layer.frame, canvasW, canvasH, coverage, { minCoverage });
  }
  const frameW = meta.width * scale;
  const frameH = meta.height * scale;
  const pos = resolvePosition(layer.position, canvasW, canvasH, frameW, frameH, layer);

  const group = await addFramedScreenshot(canvas, screenshotUrl, layer.frame, {
    scale,
    left: pos.left + originX,
    top: pos.top,
    selectable: editable,
    coverage,
  });
  if (group) {
    group.set({
      glintSlot: layer.slot ?? 0,
      glintSlide: layer.slideIndex ?? 0,
      glintCoverage: coverage,
      glintScreenshotUrl: screenshotUrl,
      ...(layer.angle != null ? { angle: layer.angle } : {}),
      ...(layer.deviceMode ? { glintDeviceMode: layer.deviceMode } : {}),
    });
    if (layer.deviceMode === 'live3d' && !skipLive3d) {
      const { getOrbitPreset } = await import('./device3d/orbitPresets.js');
      const preset =
        getOrbitPreset(layer.orbitPreset || 'front-34') || getOrbitPreset('front');
      // Flat angle ≈ yaw hint when template only sets angle
      const yaw = layer.orbitYaw ?? (layer.angle != null ? layer.angle * 2 : preset.yaw);
      group.glintOrbit = {
        yaw,
        pitch: layer.orbitPitch ?? preset.pitch,
        roll: layer.orbitRoll ?? preset.roll,
      };
      try {
        const { applyLive3DBakeToDevice } = await import('./device3d/bakeDevice3D.js');
        await applyLive3DBakeToDevice(group);
      } catch {
        /* WebGL missing — keep flat angle */
      }
    } else if (layer.deviceMode === 'live3d' && skipLive3d && layer.angle != null) {
      // Gallery/static preview path: keep angled flat device, no WebGL.
      group.set({ angle: layer.angle });
    }
  }
  return group;
}

async function addTextLayer(canvas, layer, metadata, canvasW, canvasH, editable, originX = 0) {
  const useGlobal =
    layer.type === 'subheadline'
      ? metadata.subheadline || metadata.tagline
      : metadata.headline;
  const text = (useGlobal || layer.placeholder || '') || '';
  if (!text) return null;

  const alignLeft = layer.position === 'left';
  const fontFamily = layer.fontFamily || 'Space Grotesk';
  const fontWeight = layer.fontWeight ?? 'normal';
  await ensureFontReady(fontFamily, fontWeight);

  const fb = new IText(text, {
    fontSize: layer.fontSize ?? 36,
    fontFamily: `${fontFamily}, sans-serif`,
    fontWeight,
    fill: layer.color ?? '#ffffff',
    textAlign: alignLeft ? 'left' : 'center',
    originX: alignLeft ? 'left' : 'center',
    charSpacing: layer.charSpacing ?? 0,
    lineHeight: layer.lineHeight ?? 1.16,
    evented: editable,
    selectable: editable,
    editable: editable,
    glintRole: 'text',
  });

  if (layer.shadow) {
    const s = layer.shadow;
    fb.set(
      'shadow',
      new Shadow({
        color: s.color || 'rgba(0,0,0,0.25)',
        blur: s.blur ?? 5,
        offsetX: s.offsetX ?? 0,
        offsetY: s.offsetY ?? 0,
      }),
    );
  }

  const pos = resolvePosition(layer.position ?? 'top', canvasW, canvasH, fb.width, fb.height, layer);
  fb.set({ left: (alignLeft ? pos.left : canvasW / 2) + originX, top: pos.top });
  applySelectionStyle(fb);
  canvas.add(fb);
  return fb;
}

function addBadgeLayer(canvas, layer, canvasW, editable, originX = 0) {
  const text = layer.text ?? 'NEW';
  const paddingX = layer.paddingX ?? 20;
  const paddingY = layer.paddingY ?? 12;
  const fb = new IText(text, {
    fontSize: layer.fontSize ?? 20,
    fontFamily: `${layer.fontFamily || 'Space Grotesk'}, sans-serif`,
    fontWeight: layer.fontWeight ?? 'bold',
    fill: layer.color ?? '#ffffff',
    evented: editable,
    selectable: editable,
    editable: editable,
    glintRole: 'text',
  });

  const bg = new Rect({
    width: fb.width + paddingX * 2,
    height: fb.height + paddingY * 2,
    fill: layer.background ?? '#ff4757',
    rx: layer.rx ?? 999,
    ry: layer.rx ?? 999,
    evented: editable,
    selectable: editable,
    glintRole: 'graphic',
    glintShape: 'rect',
  });

  const left =
    layer.left != null
      ? layer.left + originX
      : canvasW - bg.width - (layer.marginRight ?? 60) + originX;
  const top = layer.top ?? layer.marginTop ?? 60;
  bg.set({ left, top });
  fb.set({ left: left + paddingX, top: top + paddingY });
  applySelectionStyle(bg);
  applySelectionStyle(fb);
  canvas.add(bg, fb);
}

function addBulletsLayer(canvas, layer, editable, originX = 0) {
  const items = layer.items ?? [];
  items.forEach((item, i) => {
    const fb = new IText(`• ${item}`, {
      left: (layer.marginLeft ?? 80) + originX,
      top: (layer.marginTop ?? 200) + i * 48,
      fontSize: layer.fontSize ?? 28,
      fontFamily: 'Space Grotesk, sans-serif',
      fill: layer.color ?? '#ffffff',
      evented: editable,
      selectable: editable,
      editable: editable,
      glintRole: 'text',
    });
    applySelectionStyle(fb);
    canvas.add(fb);
  });
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

/**
 * Expand a single-canvas template into 5 Blink-style store slides.
 * Uses template.slides when present; otherwise derives layout variants.
 * Every returned slide is guaranteed to include a device bezel layer.
 */
export function getTemplateSlides(template) {
  if (!template) return [];
  const frameId = resolveTemplateFrame(template);
  const canvas = template.canvas || {};
  const raw =
    Array.isArray(template.slides) && template.slides.length
      ? template.slides.map((slide, i) => ({
          id: slide.id || `${template.id}-frame-${i + 1}`,
          name: slide.name || `Frame ${i + 1}`,
          layers: slide.layers || [],
          preview: slide.preview || null,
        }))
      : expandToFiveSlides(template);
  return raw.map((slide) => ensureSlideHasDevice(slide, frameId, canvas));
}

/**
 * Simple overflow slide - used for frame 6+ and “device frames only” reset.
 * Authored as template.extraSlide; otherwise generated from palette + device defaults.
 */
export function resolveExtraFrameDesign(template) {
  if (!template) return null;
  const frameId = resolveTemplateFrame(template);
  const canvas = template.canvas || {};
  const device = template.device || {};

  const spec = template.extraSlide?.layers?.length
    ? template.extraSlide
    : {
        name: 'Extra',
        layers: [
          { type: 'background', color: pickExtraBackground(template) },
          { type: 'device', slot: 0 },
        ],
      };

  const layers = (spec.layers || []).map((layer) => {
    if (layer.type !== 'device') return { ...layer };
    return {
      ...layer,
      frame: layer.frame || device.frame || frameId,
      ...(device.widthFraction != null && layer.widthFraction == null
        ? { widthFraction: device.widthFraction }
        : {}),
      ...(device.scale != null && layer.scale == null && layer.widthFraction == null
        ? { scale: device.scale }
        : {}),
      ...(device.minCoverage != null && layer.minCoverage == null
        ? { minCoverage: device.minCoverage }
        : {}),
      ...(device.position && !layer.position ? { position: device.position } : {}),
    };
  });

  const slide = ensureSlideHasDevice(
    {
      id: spec.id || `${template.id || 'pack'}-extra`,
      name: spec.name || 'Extra',
      layers,
    },
    frameId,
    canvas,
  );
  return bindSlideToFrameShot(slide);
}

function pickExtraBackground(template) {
  const slot = template.palette?.find((p) => p.id === 'background');
  if (slot?.color) return slot.color;
  const rootBg = template.layers?.find((l) => l.type === 'background');
  if (rootBg?.color) return rootBg.color;
  const slideBg = template.slides?.[0]?.layers?.find((l) => l.type === 'background');
  return slideBg?.color || '#FFFFFF';
}

/**
 * Slide design for board frame `index`. Frames past the pack use extraSlide only.
 */
export function resolveFrameDesign(template, index) {
  if (!template || index == null || index < 0) return null;
  const slides = getTemplateSlides(template);
  if (!slides.length) return null;
  if (index < slides.length) {
    return bindSlideToFrameShot(slides[index]);
  }
  return resolveExtraFrameDesign(template);
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

  // Aspect-aware Blink-inspired layouts.
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
      fontFamily: 'Space Grotesk',
      color: layout.textColor,
      placeholder: headlines[i],
      marginTop: layout.headlineBottom
        ? Math.round(canvasH * 0.84)
        : layout.headlineTop,
      ...(landscape || square ? { marginLeft: Math.round(canvasW * 0.05) } : {}),
    });

    const absShot =
      deviceLayer?.type === 'screenshot' &&
      deviceLayer.width != null &&
      deviceLayer.height != null;

    // Always use a bezeled device when a frame id is known (store templates).
    if (frame && frame !== 'none') {
      layers.push({
        type: 'device',
        frame,
        slot: i % 5,
        scale: layout.phoneScale,
        position: 'center',
        marginTop: layout.phoneTop,
      });
    } else if (absShot) {
      layers.push({
        type: 'screenshot',
        slot: i % 5,
        left: deviceLayer.left,
        top: deviceLayer.top,
        width: deviceLayer.width,
        height: deviceLayer.height,
        rx: deviceLayer.rx ?? deviceLayer.rounded ?? 32,
      });
    } else if (deviceLayer?.type === 'screenshot') {
      layers.push({
        type: 'screenshot',
        slot: i % 5,
        scale: layout.phoneScale,
        position: 'center',
        marginTop: layout.phoneTop,
        rounded: deviceLayer.rounded ?? 48,
      });
    } else {
      layers.push({
        type: 'device',
        frame: frame || 'pixel9',
        slot: i % 5,
        scale: layout.phoneScale,
        position: 'center',
        marginTop: layout.phoneTop,
      });
    }

    return {
      id: `${template.id}-frame-${i + 1}`,
      name: `Frame ${i + 1}`,
      layers,
      preview: {
        bg: layout.bg,
        textColor: layout.textColor,
        band: layout.band,
        headline: headlines[i],
        headlineBottom: layout.headlineBottom,
      },
    };
  });
}

/** Slots needed across the full 5-slide template set. */
export function getScreenshotSlotCount(template) {
  const slides = getTemplateSlides(template);
  if (!slides.length) {
    const slots = (template?.layers ?? [])
      .filter((l) => l.type === 'screenshot' || l.type === 'device')
      .map((l) => (l.slot ?? 0) + 1);
    return Math.max(1, ...slots, 1);
  }
  return slides.reduce((sum, slide) => {
    const slots = (slide.layers ?? [])
      .filter((l) => l.type === 'screenshot' || l.type === 'device')
      .map((l) => (l.slot ?? 0) + 1);
    return sum + Math.max(1, ...slots, 1);
  }, 0);
}

/** Canvas size when all slides are laid out horizontally. */
export function getTemplateCanvasSize(template) {
  const slideW = template?.canvas?.width ?? DEFAULT_WIDTH;
  const slideH = template?.canvas?.height ?? DEFAULT_HEIGHT;
  const slides = getTemplateSlides(template);
  const n = Math.max(1, slides.length);
  const labelH = 56;
  return {
    width: n * slideW + (n - 1) * SLIDE_GAP,
    height: slideH + labelH,
    slideWidth: slideW,
    slideHeight: slideH,
    slideCount: n,
    labelHeight: labelH,
  };
}

async function paintLayers(
  canvas,
  template,
  screenshotUrls,
  metadata,
  themes,
  editable,
  originX = 0,
  { skipLive3d = false } = {},
) {
  const layers = template?.layers ?? [];
  const canvasW = template.canvas?.width ?? DEFAULT_WIDTH;
  const canvasH = template.canvas?.height ?? DEFAULT_HEIGHT;

  const shotUrl = (slotIndex) => {
    if (!screenshotUrls) return null;
    if (!Array.isArray(screenshotUrls)) return screenshotUrls;
    // Per-frame paint passes a single URL; template JSON still uses pack-wide slots (0..4).
    return screenshotUrls[slotIndex] ?? screenshotUrls[0] ?? null;
  };

  for (const layer of layers) {
    switch (layer.type) {
      case 'background': {
        const color = layer.color || layer.value || '#1C1C1E';
        if (layer.color && !layer.theme) {
          setBackground(canvas, 'solid', layer.color);
        } else {
          const theme = getTheme(layer.theme, themes) || {
            type: 'solid',
            value: color,
          };
          setBackground(canvas, theme.type, theme.value);
        }
        break;
      }
      case 'graphic':
        await addGraphicLayer(canvas, shiftLayer(layer, originX), { selectable: editable });
        break;
      case 'shape':
        addShapeLayer(canvas, shiftLayer(layer, originX), { selectable: editable });
        break;
      case 'headline':
      case 'subheadline':
        await addTextLayer(canvas, layer, metadata, canvasW, canvasH, editable, originX);
        break;
      case 'screenshot': {
        const url = shotUrl(layer.slot ?? 0);
        if (url) await addScreenshotLayer(canvas, url, layer, canvasW, canvasH, editable, originX);
        break;
      }
      case 'device': {
        const url = shotUrl(layer.slot ?? 0);
        if (url) {
          await addDeviceLayer(
            canvas,
            url,
            { ...layer },
            canvasW,
            canvasH,
            editable,
            originX,
            { skipLive3d },
          );
        }
        break;
      }
      case 'device-frame':
        await addFrameLayer(canvas, layer.frame, layer, canvasW, canvasH, editable, originX);
        break;
      case 'badge':
        addBadgeLayer(canvas, layer, canvasW, editable, originX);
        break;
      case 'bullets':
        addBulletsLayer(canvas, layer, editable, originX);
        break;
    }
  }
  canvas.requestRenderAll();
}

async function paintDesignContents(
  canvas,
  design,
  screenshotUrl,
  { canvasWidth, canvasHeight, themes, metadata, editable },
) {
  canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
  {
    const cssW = canvas.lowerCanvasEl?.clientWidth || parseFloat(canvas.lowerCanvasEl?.style?.width) || 0;
    const cssH = canvas.lowerCanvasEl?.clientHeight || parseFloat(canvas.lowerCanvasEl?.style?.height) || 0;
    if (cssW > 0 && cssH > 0) {
      canvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });
    }
  }

  if (!design?.layers?.length) {
    // Scratch board only - not a gallery template. Neutral white + store default bezel.
    setBackground(canvas, 'solid', '#FFFFFF');
    if (screenshotUrl) {
      const frame = metadata?.deviceFrame || metadata?.defaultFrame || 'pixel9';
      await addDeviceLayer(
        canvas,
        screenshotUrl,
        { frame, scale: MIN_DEVICE_COVERAGE, position: 'center', marginTop: Math.round(canvasHeight * 0.18), slot: 0 },
        canvasWidth,
        canvasHeight,
        editable,
        0,
      );
    }
    canvas.requestRenderAll();
    return;
  }

  const slideTemplate = {
    canvas: { width: canvasWidth, height: canvasHeight },
    layers: design.layers,
  };
  const urls = [screenshotUrl].filter(Boolean);
  const slideMeta = { ...metadata, headline: undefined, tagline: undefined };
  await paintLayers(canvas, slideTemplate, urls, slideMeta, themes, editable, 0);
}

/**
 * Paint one design slide into a single Frame canvas (clipped by canvas bounds).
 * Builds offscreen first, then swaps onto the live canvas in one frame to avoid blank flashes.
 * @param {object} design - slide with layers (from getTemplateSlides)
 * @param {string|null} screenshotUrl - raw app screenshot for device/screenshot slots
 */
export async function applyDesignToFrame(
  canvas,
  design,
  screenshotUrl,
  {
    canvasWidth = DEFAULT_WIDTH,
    canvasHeight = DEFAULT_HEIGHT,
    themes = {},
    metadata = {},
    editable = true,
    signal,
    displayCssWidth = 0,
    displayCssHeight = 0,
    deviceFrame = null,
  } = {},
) {
  if (!canvas) return;

  const opts = {
    canvasWidth,
    canvasHeight,
    themes,
    metadata: {
      ...metadata,
      deviceFrame: deviceFrame || metadata.deviceFrame || metadata.defaultFrame || null,
    },
    editable,
  };
  const draftEl = document.createElement('canvas');
  const draft = createCanvas(draftEl, canvasWidth, canvasHeight);

  try {
    await paintDesignContents(draft, design, screenshotUrl, opts);
    if (signal?.aborted) return;

    const clones = [];
    const draftObjects = draft.getObjects();
    for (let i = 0; i < draftObjects.length; i++) {
      if (signal?.aborted) return;
      const src = draftObjects[i];
      const cloned = await src.clone(GLINT_CLONE_PROPS);
      copyGlintProps(src, cloned);
      clones.push(cloned);
    }
    if (signal?.aborted) return;

    const prevRender = canvas.renderOnAddRemove;
    canvas.renderOnAddRemove = false;
    canvas.clear();
    // Preserve CSS display size - setDimensions alone resets to full pixel size
    // and makes frames unequal until the next board re-fit.
    {
      const cssW =
        displayCssWidth
        || canvas.lowerCanvasEl?.clientWidth
        || parseFloat(canvas.lowerCanvasEl?.style?.width)
        || 0;
      const cssH =
        displayCssHeight
        || canvas.lowerCanvasEl?.clientHeight
        || parseFloat(canvas.lowerCanvasEl?.style?.height)
        || 0;
      canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
      if (cssW > 0 && cssH > 0) {
        canvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });
        [canvas.lowerCanvasEl, canvas.upperCanvasEl, canvas.wrapperEl, canvas.container]
          .filter(Boolean)
          .forEach((el) => {
            el.style.width = `${cssW}px`;
            el.style.height = `${cssH}px`;
          });
        canvas.calcOffset?.();
      }
    }
    canvas.backgroundColor = draft.backgroundColor;
    for (const cloned of clones) {
      canvas.add(cloned);
      cloned.setCoords?.();
    }
    canvas.renderOnAddRemove = prevRender;
    canvas.requestRenderAll();
  } finally {
    draft.dispose();
  }
}

/** Toggle selectability without rebuilding the design. */
export function setFrameEditable(canvas, editable) {
  if (!canvas) return;
  canvas.selection = editable;
  canvas.uniformScaling = true;
  canvas.forEachObject((obj) => {
    if (obj.glintRole === 'framed-screenshot') {
      // Always evented so right-click import works; only selectable when frame is active.
      obj.set({
        selectable: editable,
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockMovementX: false,
        lockMovementY: false,
        hoverCursor: 'pointer',
        moveCursor: 'grabbing',
      });
      applyDeviceTransformLocks(obj);
    } else {
      const isText = obj.glintRole === 'text' || typeof obj.enterEditing === 'function';
      const patch = {
        selectable: editable,
        evented: editable,
        hasControls: true,
        hasBorders: true,
        lockMovementX: false,
        lockMovementY: false,
        hoverCursor: isText ? 'text' : 'grab',
        moveCursor: 'grabbing',
      };
      if (isText) patch.editable = editable;
      obj.set(patch);
      applySelectionStyle(obj);
    }
  });
  if (!editable) canvas.discardActiveObject?.();
  canvas.requestRenderAll();
}

/**
 * Render a single slide offscreen (for export).
 */
export async function renderTemplateFrame(
  template,
  screenshotUrls,
  metadata = {},
  themes = {},
  { skipLive3d = false } = {},
) {
  const canvasW = template.canvas?.width ?? DEFAULT_WIDTH;
  const canvasH = template.canvas?.height ?? DEFAULT_HEIGHT;
  const container = document.createElement('canvas');
  const canvas = createCanvas(container, canvasW, canvasH);

  try {
    await paintLayers(canvas, template, screenshotUrls, metadata, themes, false, 0, {
      skipLive3d,
    });
    return canvas.toDataURL({ format: 'png', multiplier: 1 });
  } finally {
    canvas.dispose();
  }
}

/**
 * Export each of the 5 template slides as its own PNG.
 * Falls back to legacy per-screenshot rendering when slides expand from one layout.
 */
export async function renderBatch(screenshots, template, metadata = {}, themes = {}, exportSize = null) {
  const slides = getTemplateSlides(template);
  const baseCanvas = exportSize
    ? { width: exportSize.width, height: exportSize.height }
    : (template.canvas || { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

  const results = [];
  let urlCursor = 0;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const slideTemplate = {
      ...template,
      canvas: baseCanvas,
      layers: slide.layers,
      _slideMode: false,
    };
    const slots = Math.max(
      1,
      ...(slide.layers || [])
        .filter((l) => l.type === 'screenshot' || l.type === 'device')
        .map((l) => (l.slot ?? 0) + 1),
    );
    const chunk = [];
    for (let s = 0; s < slots; s++) {
      chunk.push(screenshots[urlCursor + s] || screenshots[s % Math.max(1, screenshots.length)]);
    }
    urlCursor += slots;

    try {
      const dataUrl = await renderTemplateFrame(
        slideTemplate,
        chunk,
        { ...metadata, slot: i },
        themes,
      );
      results.push(dataUrl);
    } catch {
      // Skip failed frames
    }
  }

  return results;
}

/**
 * @deprecated Prefer applyDesignToFrame per Frame. Kept for offscreen batch helpers.
 */
export async function applyTemplate(canvas, template, screenshotUrls, metadata = {}, themes = {}) {
  const slides = getTemplateSlides(template);
  const slide = slides[0];
  const w = template?.canvas?.width ?? DEFAULT_WIDTH;
  const h = template?.canvas?.height ?? DEFAULT_HEIGHT;
  await applyDesignToFrame(canvas, slide, screenshotUrls?.[0], {
    canvasWidth: w,
    canvasHeight: h,
    themes,
    metadata,
    editable: true,
  });
}
