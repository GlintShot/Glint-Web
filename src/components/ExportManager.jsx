import { useState } from 'react';
import { exportAsPNG, exportAsPNGWithLive3D, renderScratchFrame } from '../utils/canvasEngine';
import {
  downloadSinglePNG,
  downloadBatchZip,
  EXPORT_PRESETS,
  zipFileName,
  buildExportFilenames,
} from '../utils/exportHelper';

/** Scratch-mode export when no template is loaded. */
export default function ExportManager({
  canvas,
  screenshots,
  background,
  frame,
  screenshotStyle,
  textOverlay,
  exportPreset = 'play/phone',
}) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const preset = EXPORT_PRESETS[exportPreset] ?? EXPORT_PRESETS['play/phone'];

  const handleExportSingle = async () => {
    if (!canvas) return;
    const dataUrl = (await exportAsPNGWithLive3D(canvas)) || exportAsPNG(canvas);
    downloadSinglePNG(dataUrl, 'glint-frame.png');
  };

  const handleExportAll = async (format) => {
    if (!screenshots.length) return;
    setExporting(true);
    setProgress(`Rendering ${format.toUpperCase()}...`);
    try {
      const payloads = [];
      for (let i = 0; i < screenshots.length; i++) {
        setProgress(`Rendering ${i + 1}/${screenshots.length}...`);
        const dataUrl = await renderScratchFrame({
          screenshotUrl: screenshots[i],
          background,
          frameId: frame,
          screenshotStyle,
          text: textOverlay?.text,
          width: preset.width,
          height: preset.height,
        });
        if (format === 'svg') {
          // Scratch path is PNG-only today; embed as image in a minimal SVG wrapper.
          payloads.push(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${preset.width}" height="${preset.height}"><image href="${dataUrl}" width="${preset.width}" height="${preset.height}"/></svg>`,
          );
        } else {
          payloads.push(dataUrl);
        }
      }
      const filenames = buildExportFilenames(payloads.length, { format });
      await downloadBatchZip(payloads, filenames, `Glint-ss.zip`);
      setProgress(`Exported ${payloads.length} ${format.toUpperCase()} file(s) as ZIP`);
    } catch (err) {
      setProgress(`Error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-glint-text-secondary text-[10px] uppercase tracking-wider">Export</h3>
      <p className="text-[11px] text-glint-text-secondary">
        {screenshots.length} screen(s) · {preset.label} ({preset.width}×{preset.height})
      </p>
      <button
        type="button"
        onClick={handleExportSingle}
        disabled={!canvas}
        className="w-full px-4 py-2 border border-glint-border-strong bg-glint-surface text-glint-text rounded-lg text-sm disabled:opacity-50"
      >
        Export Current Frame
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleExportAll('png')}
          disabled={!screenshots.length || exporting}
          className="px-3 py-2 glint-btn-primary rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {exporting ? '…' : 'Export as PNG'}
        </button>
        <button
          type="button"
          onClick={() => handleExportAll('svg')}
          disabled={!screenshots.length || exporting}
          className="px-3 py-2 bg-glint-success text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-semibold"
        >
          {exporting ? '…' : 'Export as SVG'}
        </button>
      </div>
      {progress && <p className="text-xs text-glint-text-secondary">{progress}</p>}
    </div>
  );
}
