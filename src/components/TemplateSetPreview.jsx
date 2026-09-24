import { useEffect, useRef, useState } from 'react';
import { getTemplateSlides } from '../utils/templateEngine';
import { getStaticPreviewUrl } from '../utils/templatePreviewSrc';
import TemplateArtPreview from './TemplateArtPreview';

/**
 * Template strip: static `/templates/previews/{id}.png` only (no Fabric / WebGL).
 * Missing PNG → lightweight CSS art stand-in (never live-renders 3D).
 */
export default function TemplateSetPreview({ template, compact = false }) {
  const slides = getTemplateSlides(template);
  const rootRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [frameH, setFrameH] = useState(compact ? 140 : 400);

  const canvasW = template?.canvas?.width || 1080;
  const canvasH = template?.canvas?.height || 1920;
  const aspect = canvasW / Math.max(1, canvasH);
  const count = Math.max(slides.length, 1);
  const gap = compact ? 4 : 8;
  const padX = compact ? 12 : 24;
  const accent = template?.preview?.bg || '#2A2A2E';
  const staticUrl = getStaticPreviewUrl(template?.id);

  useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
  }, [template?.id, staticUrl]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    const fit = () => {
      const avail = Math.max(80, el.clientWidth - padX);
      const gaps = gap * Math.max(0, count - 1);
      const hFromWidth = (avail - gaps) / (count * aspect);
      const maxHVal = compact ? 148 : Math.round(window.innerHeight * 0.5);
      setFrameH(Math.max(72, Math.min(maxHVal, Math.floor(hFromWidth))));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect, count, gap, padX, compact]);

  const stripH = frameH + (compact ? 16 : 24);

  if (imgFailed || !staticUrl) {
    return (
      <div
        ref={rootRef}
        className={`relative w-full overflow-hidden transition-all duration-300 ${compact ? 'px-1.5 py-2' : 'px-3 py-3'}`}
        style={{ background: accent, minHeight: stripH, height: stripH }}
      >
        <TemplateArtPreview template={template} />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`relative flex w-full items-center justify-center overflow-hidden transition-all duration-300 ${compact ? 'px-1.5 py-2' : 'px-3 py-3'}`}
      style={{ background: accent, minHeight: stripH }}
    >
      <img
        src={staticUrl}
        alt={template?.name || 'Template preview'}
        loading="lazy"
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgFailed(true)}
        className={`max-h-full w-auto max-w-full object-contain pointer-events-none transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ height: frameH }}
        draggable={false}
      />
      {!imgLoaded && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ minHeight: stripH }}
        >
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}
    </div>
  );
}
