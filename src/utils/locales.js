/**
 * Per-locale captions on Fabric text objects + Fastlane export paths.
 *
 * Each text object keeps `glintI18n = { 'en-US': '…', 'de-DE': '…' }` and `glintLocale`
 * (the locale currently shown). Switching locale snapshots the visible text first, so
 * edits made on the canvas are never lost.
 */
import { getStoreTarget } from './storeCatalog.js';

export const BASE_LOCALE = 'en-US';

/**
 * App Store Connect + Play Console locales. `ios` / `play` are the folder codes
 * fastlane deliver / supply expect; `native` helps search ("Deutsch", "日本語").
 */
export const STORE_LOCALES = [
  { id: 'en-US', label: 'English (US)', native: 'English', ios: 'en-US', play: 'en-US' },
  { id: 'en-GB', label: 'English (UK)', native: 'English', ios: 'en-GB', play: 'en-GB' },
  { id: 'en-AU', label: 'English (Australia)', native: 'English', ios: 'en-AU', play: 'en-AU' },
  { id: 'en-CA', label: 'English (Canada)', native: 'English', ios: 'en-CA', play: 'en-CA' },
  { id: 'es-ES', label: 'Spanish (Spain)', native: 'Español', ios: 'es-ES', play: 'es-ES' },
  { id: 'es-MX', label: 'Spanish (Latin America)', native: 'Español', ios: 'es-MX', play: 'es-419' },
  { id: 'fr-FR', label: 'French', native: 'Français', ios: 'fr-FR', play: 'fr-FR' },
  { id: 'fr-CA', label: 'French (Canada)', native: 'Français', ios: 'fr-CA', play: 'fr-CA' },
  { id: 'de-DE', label: 'German', native: 'Deutsch', ios: 'de-DE', play: 'de-DE' },
  { id: 'it', label: 'Italian', native: 'Italiano', ios: 'it', play: 'it-IT' },
  { id: 'pt-BR', label: 'Portuguese (Brazil)', native: 'Português', ios: 'pt-BR', play: 'pt-BR' },
  { id: 'pt-PT', label: 'Portuguese (Portugal)', native: 'Português', ios: 'pt-PT', play: 'pt-PT' },
  { id: 'nl-NL', label: 'Dutch', native: 'Nederlands', ios: 'nl-NL', play: 'nl-NL' },
  { id: 'ja-JP', label: 'Japanese', native: '日本語', ios: 'ja', play: 'ja-JP' },
  { id: 'ko-KR', label: 'Korean', native: '한국어', ios: 'ko', play: 'ko-KR' },
  { id: 'zh-Hans', label: 'Chinese (Simplified)', native: '简体中文', ios: 'zh-Hans', play: 'zh-CN' },
  { id: 'zh-Hant', label: 'Chinese (Traditional)', native: '繁體中文', ios: 'zh-Hant', play: 'zh-TW' },
  { id: 'ar', label: 'Arabic', native: 'العربية', ios: 'ar-SA', play: 'ar', rtl: true },
  { id: 'he', label: 'Hebrew', native: 'עברית', ios: 'he', play: 'iw-IL', rtl: true },
  { id: 'hi-IN', label: 'Hindi', native: 'हिन्दी', ios: 'hi', play: 'hi-IN' },
  { id: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', ios: 'id', play: 'id' },
  { id: 'ms', label: 'Malay', native: 'Bahasa Melayu', ios: 'ms', play: 'ms' },
  { id: 'th', label: 'Thai', native: 'ไทย', ios: 'th', play: 'th' },
  { id: 'vi', label: 'Vietnamese', native: 'Tiếng Việt', ios: 'vi', play: 'vi' },
  { id: 'tr', label: 'Turkish', native: 'Türkçe', ios: 'tr', play: 'tr-TR' },
  { id: 'ru', label: 'Russian', native: 'Русский', ios: 'ru', play: 'ru-RU' },
  { id: 'uk', label: 'Ukrainian', native: 'Українська', ios: 'uk', play: 'uk' },
  { id: 'pl', label: 'Polish', native: 'Polski', ios: 'pl', play: 'pl-PL' },
  { id: 'cs', label: 'Czech', native: 'Čeština', ios: 'cs', play: 'cs-CZ' },
  { id: 'sk', label: 'Slovak', native: 'Slovenčina', ios: 'sk', play: 'sk' },
  { id: 'hu', label: 'Hungarian', native: 'Magyar', ios: 'hu', play: 'hu-HU' },
  { id: 'ro', label: 'Romanian', native: 'Română', ios: 'ro', play: 'ro' },
  { id: 'hr', label: 'Croatian', native: 'Hrvatski', ios: 'hr', play: 'hr' },
  { id: 'el', label: 'Greek', native: 'Ελληνικά', ios: 'el', play: 'el-GR' },
  { id: 'sv', label: 'Swedish', native: 'Svenska', ios: 'sv', play: 'sv-SE' },
  { id: 'da', label: 'Danish', native: 'Dansk', ios: 'da', play: 'da-DK' },
  { id: 'no', label: 'Norwegian', native: 'Norsk', ios: 'no', play: 'no-NO' },
  { id: 'fi', label: 'Finnish', native: 'Suomi', ios: 'fi', play: 'fi-FI' },
  { id: 'ca', label: 'Catalan', native: 'Català', ios: 'ca', play: 'ca' },
];

/** Match a sheet header / user code ("de", "ja", "zh-CN", "iw-IL") to a catalog id. */
export function resolveLocaleId(code) {
  const c = String(code || '').trim().toLowerCase();
  if (!c) return null;
  const hit = STORE_LOCALES.find((l) => [l.id, l.ios, l.play].some((x) => x.toLowerCase() === c));
  return hit?.id || STORE_LOCALES.find((l) => l.id.toLowerCase().split('-')[0] === c)?.id || null;
}

export function getLocale(id) {
  return STORE_LOCALES.find((l) => l.id === id) || null;
}

export function isRtl(id) {
  return !!getLocale(id)?.rtl || /^(ar|he|fa|ur)(-|$)/.test(String(id || ''));
}

/** Text layers of one canvas (one sheet row each). */
export function textObjects(canvas) {
  return (canvas?.getObjects?.() || []).filter((o) => o.glintRole === 'text');
}

/** Untranslated locale showing the untouched base text — not a translation. */
function showingFallback(obj) {
  const cur = obj.glintLocale || BASE_LOCALE;
  const map = obj.glintI18n || {};
  return cur !== BASE_LOCALE && !map[cur] && obj.text === map[BASE_LOCALE];
}

/** Save the visible text under the locale it was shown in. */
function snapshot(obj) {
  const cur = obj.glintLocale || BASE_LOCALE;
  if (!showingFallback(obj)) obj.glintI18n = { ...(obj.glintI18n || {}), [cur]: obj.text ?? '' };
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
    text: (locale === BASE_LOCALE ? map[BASE_LOCALE] : map[locale] || map[BASE_LOCALE]) ?? obj.text ?? '',
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
      Object.entries(obj.glintI18n || {}).forEach(([k, v]) => v && set.add(k));
      if (obj.glintLocale) set.add(obj.glintLocale);
    }
  }
  return [...set];
}

/** Drop every translation for `locale` (the base locale is never removed). */
export function removeLocaleFromCanvases(canvases, locale) {
  if (locale === BASE_LOCALE) return;
  for (const c of canvases) {
    for (const obj of textObjects(c)) {
      if (obj.glintI18n) delete obj.glintI18n[locale];
    }
  }
}

/** Current caption for a layer in `locale`, including unsaved on-canvas edits. */
export function captionFor(obj, locale) {
  if ((obj.glintLocale || BASE_LOCALE) === locale) return showingFallback(obj) ? '' : obj.text ?? '';
  return obj.glintI18n?.[locale] ?? '';
}

const csvCell = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** rows: string[][] → CSV text (Excel / Google Sheets friendly, with BOM for UTF-8). */
export function toCsv(rows) {
  return `\uFEFF${rows.map((r) => r.map((v) => csvCell(String(v ?? ''))).join(',')).join('\r\n')}`;
}

/** CSV / TSV / semicolon sheet → string[][] (quoted cells, embedded newlines). */
export function parseSheet(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const head = src.split(/\r?\n/, 1)[0];
  const delim = ['\t', ';', ','].reduce((a, d) => (head.split(d).length > head.split(a).length ? d : a), ',');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
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
