import { useState } from 'react';
import FrameExport from './FrameExport';
import QRExporter from './QRExporter';
import ExportManager from './ExportManager';
import { storeExportLabel } from '../utils/exportHelper';
import { buildGlintBlob, downloadGlint } from '../utils/projectPack';

/**
 * Export panel - store size is locked to the selected template.
 */
export default function ExportPanel({
  frames,
  getLiveCanvases,
  exportPreset,
  setExportPreset,
  themes,
  canvasWidth,
  canvasHeight,
  session,
  template,
  activeCanvas,
  screenshotList,
  background,
  deviceFrame,
  screenshotStyle,
  textOverlay,
  fontFamily,
  activeLocale,
  locales,
}) {
  const [exportedUrls, setExportedUrls] = useState([]);
  const [packing, setPacking] = useState(false);
  const sizeLabel = storeExportLabel(
    template?.store || exportPreset,
    template?.canvas || { width: canvasWidth, height: canvasHeight },
  );

  const handleDownloadGlint = async () => {
    setPacking(true);
    try {
      const live = getLiveCanvases?.() || [];
      const blob = await buildGlintBlob({
        frames,
        liveCanvases: live,
        template,
        store: exportPreset,
        background,
        deviceFrame,
        screenshotStyle,
        fontFamily,
        previewDataUrls: exportedUrls,
      });
      await downloadGlint(blob);
    } catch (err) {
      console.error(err);
      alert(`Export failed: ${err.message || err}`);
    } finally {
      setPacking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h3 className="font-semibold text-glint-text-secondary text-[10px] uppercase tracking-wider">
          Export
        </h3>
        <p className="text-[11px] text-glint-text-secondary px-0.5">{sizeLabel}</p>
      </div>

      <button
        type="button"
        disabled={packing || !frames?.length}
        onClick={handleDownloadGlint}
        className="w-full px-3 py-2 glint-btn-primary rounded-lg text-xs disabled:opacity-50"
      >
        {packing ? 'Building…' : 'Download .glint'}
      </button>

      <FrameExport
        frames={frames}
        getLiveCanvases={getLiveCanvases}
        exportPreset={exportPreset}
        themes={themes}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        activeLocale={activeLocale}
        locales={locales}
        onPreviewsReady={setExportedUrls}
      />

      {!template && activeCanvas && (
        <ExportManager
          canvas={activeCanvas}
          screenshots={screenshotList}
          background={background}
          frame={deviceFrame}
          screenshotStyle={screenshotStyle}
          textOverlay={textOverlay}
          exportPreset={exportPreset}
        />
      )}

      <QRExporter
        session={{
          ...(session ?? {}),
          store: exportPreset,
        }}
        exportedUrls={exportedUrls}
      />
    </div>
  );
}
