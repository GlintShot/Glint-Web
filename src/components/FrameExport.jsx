import { useState } from 'react';
import { applyDesignToFrame } from '../utils/templateEngine';
import { createCanvas } from '../utils/canvasEngine';
import {
  downloadBatchZip,
  EXPORT_PRESETS,
  zipFileName,
  buildExportFilenames,
  verifyExport,
} from '../utils/exportHelper';

/**
 * Preview frames, then export as PNG or SVG - each export downloads a ZIP of every frame
 * as Frame_1.png / Frame_2.svg / …
 */
export default function FrameExport({
  frames,
  getLiveCanvases,
  exportPreset = 'play/phone',
  themes = {},
  canvasWidth = 1080,
  canvasHeight = 1920,
  onPreviewsReady,
}) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [previews, setPreviews] = useState([]);

  const preset = EXPORT_PRESETS[exportPreset] ?? EXPORT_PRESETS['play/phone'];

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

  const handleExport = async (format) => {
    if (!frames.length) return;
    setProcessing(true);
    try {
      setProgress(`Rendering ${format.toUpperCase()}...`);
      const results = await renderFrames(format);

      // Verify against store specs before downloading
      if (format === 'png') {
        const verification = verifyExport(results, exportPreset);
        publishPreviews(results);
        if (!verification.ok) {
          setProgress(`Export blocked: ${verification.errors.join('; ')}`);
          return;
        }
        if (verification.warnings.length) {
          setProgress(`Warning: ${verification.warnings[0]} · Exporting ${results.length} frame(s)`);
        }
      }

      const filenames = buildExportFilenames(results.length, { format });
      await downloadBatchZip(results, filenames, `Glint-ss.zip`);
      setProgress(
        `Exported ${results.length} ${format.toUpperCase()} file(s) as ZIP (${preset.label})`,
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
