import { useState } from 'react';
import { getTemplateSlides } from '../utils/templateEngine';
import { getStaticPreviewUrl } from '../utils/templatePreviewSrc';
import TemplateArtPreview from './TemplateArtPreview';

// Must match scripts/gen-template-previews.mjs (THUMB_WIDTH, SLIDE_GAP, max 5 slides).
const THUMB_W = 320;
const SLIDE_GAP = 8;

/**
 * Template strip: static `/templates/previews/{id}.png` only (no Fabric / WebGL).
 * The box is sized from the template before the PNG arrives, so switching
 * platforms never reflows or stretches. Missing PNG → CSS art stand-in.
 */
export default function TemplateSetPreview({ template, compact = false }) {
  const [loadedSrc, setLoadedSrc] = useState(null);
  const [failedSrc, setFailedSrc] = useState(null);

  const canvasW = template?.canvas?.width || 1080;
  const canvasH = template?.canvas?.height || 1920;
  const count = Math.max(1, Math.min(5, getTemplateSlides(template).length));
  const stripW = count * THUMB_W + (count - 1) * SLIDE_GAP;
  const stripH = Math.round((THUMB_W / canvasW) * canvasH);
  const accent = template?.preview?.bg || '#2A2A2E';
  const staticUrl = getStaticPreviewUrl(template?.id);
  const failed = !staticUrl || failedSrc === staticUrl;
  const loaded = loadedSrc === staticUrl;

  return (
    <div
      className={`flex w-full items-center justify-center ${compact ? 'px-1.5 py-2' : 'px-3 py-3'}`}
      style={{ background: accent }}
    >
      <div
        className={`relative w-full overflow-hidden rounded-[3px] ${loaded || failed ? '' : 'glint-shimmer'}`}
        style={{ aspectRatio: `${stripW} / ${stripH}`, maxHeight: compact ? 148 : '50vh' }}
      >
        {failed ? (
          <TemplateArtPreview template={template} />
        ) : (
          <img
            src={staticUrl}
            alt={template?.name || 'Template preview'}
            width={stripW}
            height={stripH}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoadedSrc(staticUrl)}
            onError={() => setFailedSrc(staticUrl)}
            className={`absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}
