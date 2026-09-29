/**
 * Per-locale captions on Fabric text objects + Fastlane export paths.
 *
 * Each text object keeps `glintI18n = { 'en-US': '…', 'de-DE': '…' }` and `glintLocale`
 * (the locale currently shown). Switching locale snapshots the visible text first, so
 * edits made on the canvas are never lost.
 */
import { getStoreTarget } from './storeCatalog.js';

export const BASE_LOCALE = 'en-US';

/** Top store locales. `ios` / `play` are the folder codes fastlane deliver / supply expect. */
export const STORE_LOCALES = [
  { id: 'en-US', label: 'English (US)', ios: 'en-US', play: 'en-US' },
  { id: 'es-ES', label: 'Spanish', ios: 'es-ES', play: 'es-ES' },
  { id: 'fr-FR', label: 'French', ios: 'fr-FR', play: 'fr-FR' },
  { id: 'de-DE', label: 'German', ios: 'de-DE', play: 'de-DE' },
  { id: 'ja-JP', label: 'Japanese', ios: 'ja', play: 'ja-JP' },
  { id: 'ko-KR', label: 'Korean', ios: 'ko', play: 'ko-KR' },
  { id: 'zh-Hans', label: 'Chinese (Simplified)', ios: 'zh-Hans', play: 'zh-CN' },
  { id: 'pt-BR', label: 'Portuguese (Brazil)', ios: 'pt-BR', play: 'pt-BR' },
  { id: 'ar', label: 'Arabic', ios: 'ar-SA', play: 'ar', rtl: true },
  { id: 'hi-IN', label: 'Hindi', ios: 'hi', play: 'hi-IN' },
];

export function getLocale(id) {
  return STORE_LOCALES.find((l) => l.id === id) || null;
}

export function isRtl(id) {
  return !!getLocale(id)?.rtl || /^(ar|he|fa|ur)(-|$)/.test(String(id || ''));
}

function textObjects(canvas) {
  return (canvas?.getObjects?.() || []).filter((o) => o.glintRole === 'text');
}

/** Save the visible text under the locale it was shown in. */
function snapshot(obj) {
  const cur = obj.glintLocale || BASE_LOCALE;
  const map = obj.glintI18n || {};
  // Untouched base-text fallback is not a translation.
  const isFallback = cur !== BASE_LOCALE && !(cur in map) && obj.text === map[BASE_LOCALE];
  if (!isFallback) obj.glintI18n = { ...map, [cur]: obj.text ?? '' };
  // Base locale font size is authoritative; other locales may be auto-shrunk.
  if (cur === BASE_LOCALE || obj.glintBaseFontSize == null) obj.glintBaseFontSize = obj.fontSize;
}

/** Shrink font until the widest line fits `maxW` (long German / Hindi captions). */
export function fitTextWidth(obj, maxW) {
  obj.initDimensions?.();
  const w = (obj.width || 0) * Math.abs(obj.scaleX || 1);
  if (!(w > maxW) || !maxW) return false;
  obj.set({ fontSize: Math.max(12, Math.floor((obj.fontSize * maxW) / w)) });
  obj.initDimensions?.();
  return true;
}

function showLocale(obj, locale, maxW) {
  const map = obj.glintI18n || {};
  obj.set({
    text: map[locale] ?? map[BASE_LOCALE] ?? obj.text ?? '',
    fontSize: obj.glintBaseFontSize ?? obj.fontSize,
    direction: isRtl(locale) ? 'rtl' : 'ltr',
  });
  obj.glintLocale = locale;
  if (locale !== BASE_LOCALE) fitTextWidth(obj, maxW);
  obj.setCoords?.();
}

/** Show `locale` on every text layer of a canvas. Missing translations fall back to base. */
export function applyLocaleToCanvas(canvas, locale = BASE_LOCALE) {
  if (!canvas) return 0;
  const maxW = (canvas.getWidth?.() || canvas.width || 0) * 0.9;
  const list = textObjects(canvas);
  for (const obj of list) {
    snapshot(obj);
    showLocale(obj, locale, maxW);
  }
  canvas.requestRenderAll?.();
  return list.length;
}

/** Write one translation; updates the canvas immediately if that locale is showing. */
export function setLocaleText(canvas, obj, locale, text) {
  if (!obj) return false;
  snapshot(obj);
  obj.glintI18n[locale] = String(text ?? '');
  if ((obj.glintLocale || BASE_LOCALE) === locale) {
    const maxW = (canvas?.getWidth?.() || canvas?.width || 0) * 0.9;
    showLocale(obj, locale, maxW);
    canvas?.requestRenderAll?.();
  }
  return true;
}

/** Every locale with at least one caption on these canvases (base always first). */
export function localesOnCanvases(canvases = []) {
  const set = new Set([BASE_LOCALE]);
  for (const c of canvases) {
    for (const obj of textObjects(c)) {
      Object.keys(obj.glintI18n || {}).forEach((k) => set.add(k));
      if (obj.glintLocale) set.add(obj.glintLocale);
    }
  }
  return [...set];
}

/**
 * ZIP path fastlane picks up directly:
 *   iOS  → fastlane/screenshots/{ios}/{n}_{filename}.png   (deliver)
 *   Play → fastlane/metadata/android/{play}/images/{folder}/{n}.png   (supply)
 */
export function fastlaneScreenshotPath(store, locale, index) {
  const target = getStoreTarget(store);
  const loc = getLocale(locale);
  const n = index + 1;
  if (target.platform === 'ios') {
    return `fastlane/screenshots/${loc?.ios || locale}/${n}_${target.filename}.png`;
  }
  return `fastlane/metadata/android/${loc?.play || locale}/images/${target.fastlaneFolder}/${n}.png`;
}
