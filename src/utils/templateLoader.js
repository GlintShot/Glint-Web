import { filterTemplatesByStore } from './storeCatalog';
import {
  mergeTemplateFamily,
  templateJsonUrl,
  templateCommonUrl,
  TEMPLATE_FAMILY_PATHS,
} from './templateFamily';

const THEME_CACHE = {};
const TEMPLATE_CACHE = {};

export async function loadThemePresets() {
  if (Object.keys(THEME_CACHE).length > 0) return THEME_CACHE;
  try {
    const res = await fetch('/templates/config.json');
    if (!res.ok) return THEME_CACHE;
    const config = await res.json();
    if (config.themes) Object.assign(THEME_CACHE, config.themes);
  } catch {
    // Return empty cache on network error
  }
  return THEME_CACHE;
}

export async function loadExportPresets() {
  const res = await fetch('/templates/config.json');
  const config = await res.json();
  return config.exportPresets;
}

export function getTheme(themeId, themes) {
  return themes[themeId] || { type: 'solid', value: '#1C1C1E' };
}

export {
  PLATFORMS,
  STORE_TARGETS,
  STORE_TARGET_IDS,
  filterTemplatesByStore,
  browseFilterId,
  resolveStoreKey,
  getStoreTarget,
  devicesForPlatform,
} from './storeCatalog';

/** Curated store templates - phone / tablet packs + form-factor sets. */
export const TEMPLATE_IDS = [
  // Flagship Glint brand
  'glint-gold-play',
  'glint-gold-ios',
  'glint-gold-ipad',
  // Pixel-matched Figma packs
  'blink-play',
  'blink-ios',
  'blink-tablet',
  // Premium angled packs
  'aurora-soft-play',
  'aurora-soft-ios',
  'aurora-soft-tablet',
  'noir-orbit-play',
  'noir-orbit-ios',
  'noir-orbit-tablet',
  // Families (play phone / ios iphone / ios ipad)
  'warm-glow-play',
  'warm-glow-ios',
  'warm-glow-tablet',
  'mint-tags-play',
  'mint-tags-ios',
  'mint-tags-tablet',
  // Legacy curated packs - Play phone
  'play-hero',
  'play-pop',
  'play-dual',
  'play-minimal',
  // App Store iPhone
  'ios-clean',
  'ios-wave',
  'ios-dark',
  // App Store iPad
  'tablet-showcase',
  // Play form-factor 5-slide sets
  'play-tablet-7',
  'play-tablet-10',
  'play-tv',
  'play-wear',
  'play-chromebook',
];

/**
 * Gallery visibility. Flip to true to show a pack again.
 * JSON `"enabled": true|false` on a template overrides this map.
 * Currently: Gold + Blink + Aurora Soft + Noir Orbit (play / ios / tablet).
 */
export const TEMPLATE_ENABLED = {
  'glint-gold-play': true,
  'blink-play': true,
  'glint-gold-ios': true,
  'blink-ios': true,
  'glint-gold-ipad': true,
  'blink-tablet': true,
  'aurora-soft-play': true,
  'aurora-soft-ios': true,
  'aurora-soft-tablet': true,
  'noir-orbit-play': true,
  'noir-orbit-ios': true,
  'noir-orbit-tablet': true,
};

/** @param {string|{id?: string, enabled?: boolean}} templateOrId */
export function isTemplateEnabled(templateOrId) {
  if (templateOrId && typeof templateOrId === 'object') {
    if (typeof templateOrId.enabled === 'boolean') return templateOrId.enabled;
    return TEMPLATE_ENABLED[templateOrId.id] === true;
  }
  return TEMPLATE_ENABLED[templateOrId] === true;
}

/** IDs that appear in Home / gallery (respects TEMPLATE_ENABLED + JSON override after load). */
export function visibleTemplateIds() {
  return TEMPLATE_IDS.filter((id) => isTemplateEnabled(id));
}

/**
 * Drop disabled packs, then apply store browse filter.
 * Use this anywhere templates are listed (Home, TemplateGallery).
 */
export function filterVisibleTemplates(templates, filter) {
  return filterTemplatesByStore(
    (templates || []).filter(isTemplateEnabled),
    filter,
  );
}

export async function loadTemplate(templateId) {
  if (TEMPLATE_CACHE[templateId]) return TEMPLATE_CACHE[templateId];

  const res = await fetch(templateJsonUrl(templateId));
  if (!res.ok) throw new Error(`Template not found: ${templateId}`);
  const platform = await res.json();

  let template = platform;
  const commonUrl = templateCommonUrl(templateId);
  if (commonUrl && (platform.extends || TEMPLATE_FAMILY_PATHS[templateId])) {
    const commonRes = await fetch(commonUrl);
    if (!commonRes.ok) throw new Error(`Template common not found: ${commonUrl}`);
    const common = await commonRes.json();
    template = mergeTemplateFamily(common, platform);
  }

  // Drop merge bookkeeping so canvas engine only sees slide layers.
  delete template.extends;
  delete template.layout;
  delete template.style;
  delete template.device;

  TEMPLATE_CACHE[templateId] = template;
  return template;
}

/**
 * @param {{ enabledOnly?: boolean }} [opts] - gallery/home default hides disabled packs
 */
export async function loadAllTemplates({ enabledOnly = true } = {}) {
  const ids = enabledOnly ? visibleTemplateIds() : TEMPLATE_IDS;
  const templates = await Promise.all(
    ids.map(async (id) => {
      try {
        return await loadTemplate(id);
      } catch {
        return null;
      }
    }),
  );
  const loaded = templates.filter(Boolean);
  // Second pass: JSON `"enabled": false` can still hide a map-enabled id.
  return enabledOnly ? loaded.filter(isTemplateEnabled) : loaded;
}
