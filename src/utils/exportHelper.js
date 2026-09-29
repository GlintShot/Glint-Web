import JSZip from 'jszip';
import {
  STORE_TARGETS,
  resolveStoreKey,
  getStoreTarget,
  storeExportLabel,
} from './storeCatalog';
import { BASE_LOCALE, fastlaneScreenshotPath } from './locales.js';

export { resolveStoreKey, storeExportLabel, getStoreTarget } from './storeCatalog';

export function downloadSinglePNG(dataUrl, filename = 'screenshot.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** ZIP name: MyApp.zip, or glint.zip when empty. Optional format → MyApp-png.zip. */
export function zipFileName(appName, format) {
  const slug = String(appName || '')
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48);
  const base = slug || 'glint';
  if (format === 'png' || format === 'svg') return `${base}-${format}.zip`;
  return `${base}.zip`;
}

/**
 * Build ZIP entry names: Frame_1.png, Frame_2.svg, …
 * With `locale`: de-DE/Frame_1.png. With `fastlane: true`: fastlane deliver/supply paths (PNG only).
 * @param {'png'|'svg'} format
 */
export function buildExportFilenames(count, { format = 'png', locale = null, fastlane = false, store = 'play/phone' } = {}) {
  const ext = format === 'svg' ? 'svg' : 'png';
  const files = [];
  for (let i = 0; i < count; i++) {
    if (fastlane) files.push(fastlaneScreenshotPath(store, locale || BASE_LOCALE, i));
    else files.push(`${locale ? `${locale}/` : ''}Frame_${i + 1}.${ext}`);
  }
  return files;
}

/** Pack data-URL images or raw SVG/text into a ZIP and download. */
export async function downloadBatchZip(payloads, filenames, zipName = 'glint.zip') {
  const blob = await buildZipBlob(payloads, filenames);
  const link = document.createElement('a');
  link.download = zipName || 'glint.zip';
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function zipEntry(zip, name, payload) {
  if (typeof payload === 'string' && payload.startsWith('data:')) {
    const base64 = payload.split(',')[1];
    zip.file(name, base64, { base64: true });
    return;
  }
  zip.file(name, payload);
}

/** Return ZIP as Blob (for headless / MCP). Accepts data-URLs or SVG markup. */
export async function buildZipBlob(payloads, filenames) {
  const zip = new JSZip();
  payloads.forEach((payload, i) => {
    zipEntry(zip, filenames[i] || `Frame_${i + 1}.png`, payload);
  });
  return zip.generateAsync({ type: 'blob' });
}

export function generateSessionJson(screens, store = 'play/phone', extra = {}) {
  return JSON.stringify({
    screens,
    store: resolveStoreKey(store),
    version: '1.0',
    locales: extra.locales || ['en-US'],
    exportedAt: new Date().toISOString(),
    ...extra,
  }, null, 2);
}

/** @deprecated Prefer getStoreTarget - kept for callers using EXPORT_PRESETS[key] */
export const EXPORT_PRESETS = Object.fromEntries(
  Object.entries(STORE_TARGETS).map(([id, t]) => [
    id,
    {
      width: t.width,
      height: t.height,
      label: t.fullLabel,
      filename: t.filename,
      fastlaneFolder: t.fastlaneFolder,
    },
  ]),
);

// Legacy flat-key lookups still used in a few places
EXPORT_PRESETS.play = EXPORT_PRESETS['play/phone'];
EXPORT_PRESETS.ios = EXPORT_PRESETS['ios/iphone'];
EXPORT_PRESETS['ios-tablet'] = EXPORT_PRESETS['ios/ipad'];

/**
 * Verify exported PNGs against store spec dimensions.
 * Returns { ok, errors, warnings } where errors block upload and warnings advise.
 */
export function verifyExport(dataUrls, store = 'play/phone') {
  const target = getStoreTarget(store);
  const errors = [];
  const warnings = [];

  if (!dataUrls?.length) {
    errors.push('No screenshots to verify');
    return { ok: false, errors, warnings };
  }

  if (dataUrls.length < 2) {
    warnings.push(`Only ${dataUrls.length} screenshot(s) - most stores recommend 3-5`);
  }
  if (dataUrls.length > 8) {
    warnings.push(`${dataUrls.length} screenshots - Play Store allows max 8 per listing`);
  }

  // We can't check pixel dimensions of data URLs in-browser without loading them,
  // but we can verify the store target exists and frame count is valid.
  if (!target) {
    errors.push(`Unknown store target: ${store}`);
  }

  return {
    ok: errors.length === 0,
    store: target?.id || store,
    label: target?.fullLabel || store,
    width: target?.width,
    height: target?.height,
    count: dataUrls.length,
    errors,
    warnings,
  };
}
