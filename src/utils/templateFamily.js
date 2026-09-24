/**
 * Template families: shared common.json + platform packs (play/ios/tablet).
 *
 * Platform file shape:
 *   { "id", "extends": "common", "store", "canvas", "device", "preview?", "layout" }
 * Common file holds palette, copy, colors, fonts, slide structure (layers with `role`).
 * Layout patches merge onto layers by matching `role` within each slide `name`.
 */

function deepMerge(base, over) {
  if (over == null) return base;
  if (Array.isArray(over)) return over.slice();
  if (typeof over !== 'object' || over === null) return over;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return { ...over };
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = Array.isArray(v) ? v.slice() : v;
    }
  }
  return out;
}

function resolveShadow(value, style) {
  if (!value) return undefined;
  if (value === true || value === 'soft') return style?.shadow ? { ...style.shadow } : undefined;
  if (value === 'heavy') return style?.shadowHeavy ? { ...style.shadowHeavy } : undefined;
  if (typeof value === 'object') {
    const base = style?.shadow || {};
    return { ...base, ...value, color: value.color || base.color || 'rgba(0,0,0,0.25)' };
  }
  return undefined;
}

function applyStyleDefaults(layer, style) {
  if (!style || !layer) return layer;
  const out = { ...layer };
  if ((out.type === 'headline' || out.type === 'subheadline' || out.type === 'text') && !out.fontFamily && style.fontFamily) {
    out.fontFamily = style.fontFamily;
  }
  if ((out.type === 'headline' || out.type === 'subheadline') && out.fontWeight == null && style.fontWeight) {
    out.fontWeight = style.fontWeight;
  }
  if (out.type === 'subheadline' && out.lineHeight == null && style.lineHeight != null) {
    out.lineHeight = style.lineHeight;
  }
  if (out.shadow === true || out.shadow === 'soft' || out.shadow === 'heavy') {
    out.shadow = resolveShadow(out.shadow, style);
  }
  return out;
}

function mergeLayer(baseLayer, patch, style, device) {
  let layer = applyStyleDefaults({ ...baseLayer }, style);
  if (patch) {
    const { shadow, ...rest } = patch;
    layer = { ...layer, ...rest };
    if (shadow !== undefined) layer.shadow = resolveShadow(shadow, style);
  }
  if (layer.type === 'device' && device) {
    if (device.frame && !layer.frame) layer.frame = device.frame;
    if (device.widthFraction != null && layer.widthFraction == null) layer.widthFraction = device.widthFraction;
    if (device.scale != null && layer.scale == null && layer.widthFraction == null) layer.scale = device.scale;
    if (device.minCoverage != null && layer.minCoverage == null) layer.minCoverage = device.minCoverage;
    if (device.position && !layer.position) layer.position = device.position;
  }
  return layer;
}

/**
 * Merge a family common pack with a platform variant into a flat engine template.
 * @param {object} common
 * @param {object} platform
 */
export function mergeTemplateFamily(common, platform) {
  if (!platform) return common;
  if (!common) return platform;

  const style = deepMerge(common.style || {}, platform.style || {});
  const device = deepMerge(common.device || {}, platform.device || {});
  const preview = deepMerge(common.preview || {}, platform.preview || {});
  if (device.frame && !preview.frame) preview.frame = device.frame;

  const layout = platform.layout || {};
  const commonSlides = common.slides || [];

  const slides = commonSlides.map((slide, i) => {
    const slideLayout = layout[slide.name] || layout[slide.id] || {};
    const layers = (slide.layers || []).map((layer) => {
      const role = layer.role || layer.type;
      const patch = slideLayout[role];
      return mergeLayer(layer, patch, style, device);
    });

    // Platform may add extra layers via layout.__extra (rare); skip for now.
    const id = platform.id ? `${platform.id}-f${i + 1}` : slide.id || `slide-${i + 1}`;
    return {
      ...slide,
      id,
      layers,
    };
  });

  return {
    ...common,
    ...platform,
    familyId: platform.familyId || common.familyId,
    name: platform.name || common.name,
    palette: platform.palette || common.palette,
    style,
    device,
    preview,
    layers: platform.layers || common.layers || [{ type: 'background', color: '#FFFFFF' }],
    slides,
    extraSlide: platform.extraSlide || common.extraSlide,
    // Internal keys not needed at runtime
    extends: undefined,
    layout: undefined,
  };
}

/** Map gallery ids → family folder + platform file. */
export const TEMPLATE_FAMILY_PATHS = {
  'blink-play': { family: 'blink', platform: 'play' },
  'blink-ios': { family: 'blink', platform: 'ios' },
  'blink-tablet': { family: 'blink', platform: 'tablet' },
  'glint-gold-play': { family: 'glint-gold', platform: 'play' },
  'glint-gold-ios': { family: 'glint-gold', platform: 'ios' },
  'glint-gold-ipad': { family: 'glint-gold', platform: 'ipad' },
  'aurora-soft-play': { family: 'aurora-soft', platform: 'play' },
  'aurora-soft-ios': { family: 'aurora-soft', platform: 'ios' },
  'aurora-soft-tablet': { family: 'aurora-soft', platform: 'tablet' },
  'noir-orbit-play': { family: 'noir-orbit', platform: 'play' },
  'noir-orbit-ios': { family: 'noir-orbit', platform: 'ios' },
  'noir-orbit-tablet': { family: 'noir-orbit', platform: 'tablet' },
  'warm-glow-play': { family: 'warm-glow', platform: 'play' },
  'warm-glow-ios': { family: 'warm-glow', platform: 'ios' },
  'warm-glow-tablet': { family: 'warm-glow', platform: 'tablet' },
  'mint-tags-play': { family: 'mint-tags', platform: 'play' },
  'mint-tags-ios': { family: 'mint-tags', platform: 'ios' },
  'mint-tags-tablet': { family: 'mint-tags', platform: 'tablet' },
};

export function templateJsonUrl(templateId) {
  const fam = TEMPLATE_FAMILY_PATHS[templateId];
  if (fam) return `/templates/${fam.family}/${fam.platform}.json`;
  return `/templates/${templateId}.json`;
}

export function templateCommonUrl(templateId) {
  const fam = TEMPLATE_FAMILY_PATHS[templateId];
  if (!fam) return null;
  return `/templates/${fam.family}/common.json`;
}
