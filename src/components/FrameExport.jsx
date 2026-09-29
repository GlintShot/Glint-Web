import { useState } from 'react';
import { applyDesignToFrame } from '../utils/templateEngine';
import { createCanvas } from '../utils/canvasEngine';
import {
  downloadBatchZip,
  EXPORT_PRESETS,
  buildExportFilenames,
  verifyExport,
} from '../utils/exportHelper';
import {
  BASE_LOCALE,
  applyLocaleToCanvas,
  getLocale,
  localesOnCanvases,
} from '../utils/locales';

/**
 * Preview frames, then export as PNG / SVG / Fastlane ZIP.
 * One locale → Frame_1.png …; several → de-DE/Frame_1.png …; Fastlane → deliver/supply folders.
 */
export default function FrameExport({
  frames,
  getLiveCanvases,
  exportPreset = 'play/phone',
  themes = {},
  canvasWidth = 1080,
  canvasHeight = 1920,
  activeLocale = BASE_LOCALE,
  onPreviewsReady,
}) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [previews, setPreviews] = useState([]);
  const [excluded, setExcluded] = useState(() => new Set());

  const preset = EXPORT_PRESETS[exportPreset] ?? EXPORT_PRESETS['play/phone'];
  const available = localesOnCanvases(getLiveCanvases?.() || []);
  const exportLocales = available.filter((l) => !excluded.has(l));

  const toggleLocale = (id) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const withIdentityViewport = (canvas, fn) => {
    const vpt = canvas.viewportTransform?.slice?.() || [1, 0, 0, 1, 0, 0];
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    try {
      return fn();
    } finally {
      canvas.setViewportTransform(vpt);
      canvas.requestRenderAll();
    }
  };

  // ponytail: offscreen fallback renders the template design, so it only has base-locale captions.
  const renderOffscreen = async (frame, format) => {
    const el = document.createElement('canvas');
    const canvas = createCanvas(el, canvasWidth, canvasHeight);
    try {
      await applyDesignToFrame(canvas, frame.design, frame.screenshotUrl, {
        canvasWidth,
        canvasHeight,
        themes,
        editable: false,
      });
      const { bakeLiveDevicesOnCanvas } = await import('../utils/device3d/bakeDevice3D');
      await bakeLiveDevicesOnCanvas(canvas);
      if (format === 'svg') return canvas.toSVG();
      return canvas.toDataURL({ format: 'png', multiplier: 1 });
    } finally {
      canvas.dispose();
    }
  };

  const renderFrames = async (format = 'png') => {
    const { bakeLiveDevicesOnCanvas } = await import('../utils/device3d/bakeDevice3D');
    const results = [];
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const live = getLiveCanvases?.()?.[i];
      if (live) {
        try {
          await bakeLiveDevicesOnCanvas(live);
          const payload = withIdentityViewport(live, () =>
            format === 'svg'
              ? live.toSVG()
              : live.toDataURL({ format: 'png', multiplier: 1 }),
          );
          results.push(payload);
          continue;
        } catch {
          // fall through to offscreen
        }
      }
      results.push(await renderOffscreen(frame, format));
    }
    return results;
  };

  /** Render every selected locale; always restores the editor's active locale. */
  const renderLocales = async (format, { fastlane = false } = {}) => {
    const locales = exportLocales.length ? exportLocales : [activeLocale];
    const tagFolders = fastlane || locales.length > 1;
    const live = getLiveCanvases?.() || [];
    const payloads = [];
    const names = [];
    let firstSet = [];
    try {
      for (const loc of locales) {
        setProgress(`Rendering ${loc}…`);
        if (loc !== activeLocale || locales.length > 1) live.forEach((c) => applyLocaleToCanvas(c, loc));
        const results = await renderFrames(format);
        if (!firstSet.length) firstSet = results;
        payloads.push(...results);
        names.push(...buildExportFilenames(results.length, {
          format,
          locale: tagFolders ? loc : null,
          fastlane,
          store: exportPreset,
        }));
      }
    } finally {
      if (locales.some((l) => l !== activeLocale)) live.forEach((c) => applyLocaleToCanvas(c, activeLocale));
    }
    return { payloads, names, firstSet, locales };
  };

  const publishPreviews = (results) => {
    setPreviews(results);
    onPreviewsReady?.(results);
  };

  const handlePreview = async () => {
    if (!frames.length) return;
    setProcessing(true);
    setProgress('Rendering preview...');
    try {
      const results = await renderFrames('png');
      publishPreviews(results);
      setProgress(`Preview ready · ${results.length} frame(s)`);
    } catch (err) {
      setProgress(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async (format, { fastlane = false } = {}) => {
    if (!frames.length) return;
    setProcessing(true);
    try {
      const { payloads, names, firstSet, locales } = await renderLocales(format, { fastlane });

      if (format === 'png') {
        const verification = verifyExport(firstSet, exportPreset);
        publishPreviews(firstSet);
        if (!verification.ok) {
          setProgress(`Export blocked: ${verification.errors.join('; ')}`);
          return;
        }
        if (verification.warnings.length) {
          setProgress(`Warning: ${verification.warnings[0]}`);
        }
      }

      const zipName = fastlane ? 'Glint-fastlane.zip' : 'Glint-ss.zip';
      await downloadBatchZip(payloads, names, zipName);
      setProgress(
        `Exported ${payloads.length} file(s) · ${locales.length} locale(s) · ${fastlane ? 'Fastlane layout' : preset.label}`,
      );
    } catch (err) {
      setProgress(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-glint-text-secondary text-[10px] uppercase tracking-wider">
        Export
      </h3>
      <p className="text-[11px] text-glint-text-secondary">
        {frames.length} frame(s) · {preset.label}
      </p>

      {available.length > 1 && (
        <fieldset className="space-y-1">
          <legend className="text-[10px] text-glint-text-tertiary mb-1">Locales to export</legend>
          <div className="flex flex-wrap gap-1.5">
            {available.map((id) => (
              <label
                key={id}
                className="flex items-center gap-1 text-[11px] text-glint-text-secondary cursor-pointer"
                title={getLocale(id)?.label || id}
              >
                <input
                  type="checkbox"
                  checked={!excluded.has(id)}
                  onChange={() => toggleLocale(id)}
                  className="accent-glint-accent"
                />
                {id}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="button"
        onClick={handlePreview}
        disabled={!frames.length || processing}
        className="w-full px-4 py-2.5 border border-glint-border-strong bg-glint-surface text-glint-text rounded-xl hover:bg-glint-surface-2 disabled:opacity-50 text-sm font-semibold"
      >
        {processing ? 'Processing...' : 'Preview'}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleExport('png')}
          disabled={!frames.length || processing}
          className="px-3 py-2.5 glint-btn-primary rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          PNG
        </button>
        <button
          type="button"
          onClick={() => handleExport('svg')}
          disabled={!frames.length || processing}
          className="px-3 py-2.5 bg-glint-success text-white rounded-xl hover:opacity-90 disabled:opacity-50 text-sm font-semibold"
        >
          SVG
        </button>
      </div>
      <button
        type="button"
        onClick={() => handleExport('png', { fastlane: true })}
        disabled={!frames.length || processing}
        title="ZIP laid out for fastlane deliver (iOS) / supply (Play)"
        className="w-full px-3 py-2 border border-glint-border-strong bg-glint-surface text-glint-text rounded-xl hover:bg-glint-surface-2 disabled:opacity-50 text-xs font-semibold"
      >
        Fastlane ZIP
      </button>
      {progress && <p className="text-xs text-glint-text-secondary">{progress}</p>}
      {previews.length > 0 && (
        <div className="grid grid-cols-5 gap-1">
          {previews.map((url, i) => (
            <img key={i} src={url} alt={`Frame ${i + 1}`} className="rounded border border-glint-border" />
          ))}
        </div>
      )}
    </div>
  );
}
