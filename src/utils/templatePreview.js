import { getTemplateSlides, renderTemplateFrame } from './templateEngine';
import { getPlaceholderScreenshots } from './placeholderScreenshots';
import { loadThemePresets } from './templateLoader';

/** In-memory strip cache: templateId -> data URLs (one per slide). */
const CACHE = new Map();

/**
 * Render each slide with the same Fabric pipeline as the editor board.
 * Uses white placeholders so previews match empty-device frames.
 * @returns {Promise<string[]>}
 */
export async function renderTemplateStrip(template, { multiplier = 0.22 } = {}) {
  if (!template?.id) return [];
  const cached = CACHE.get(template.id);
  if (cached?.length) return cached;

  const themes = await loadThemePresets();
  const slides = getTemplateSlides(template);
  const canvas = template.canvas || { width: 1080, height: 1920 };
  const placeholders = getPlaceholderScreenshots(Math.max(5, slides.length));
  const urls = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const slideTemplate = {
      ...template,
      canvas,
      layers: slide.layers || [],
      _slideMode: false,
    };
    const slots = Math.max(
      1,
      ...(slide.layers || [])
        .filter((l) => l.type === 'screenshot' || l.type === 'device')
        .map((l) => (l.slot ?? 0) + 1),
      0,
    );
    const chunk = [];
    for (let s = 0; s < slots; s++) {
      chunk.push(placeholders[(i + s) % placeholders.length]);
    }

    try {
      const dataUrl = await renderTemplateFrame(slideTemplate, chunk, {}, themes, {
        skipLive3d: true,
      });
      // Downscale for strip thumbnails (same composition, smaller bytes).
      urls.push(await downscaleDataUrl(dataUrl, multiplier));
    } catch {
      urls.push('');
    }
  }

  CACHE.set(template.id, urls);
  return urls;
}

function downscaleDataUrl(dataUrl, multiplier) {
  if (!dataUrl || multiplier >= 0.99) return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = Math.max(1, Math.round(img.width * multiplier));
      const h = Math.max(1, Math.round(img.height * multiplier));
      const el = document.createElement('canvas');
      el.width = w;
      el.height = h;
      const ctx = el.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(el.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function clearTemplatePreviewCache(templateId) {
  if (templateId) CACHE.delete(templateId);
  else CACHE.clear();
}
