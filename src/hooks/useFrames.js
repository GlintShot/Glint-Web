import { useCallback, useState } from 'react';
import { getTemplateSlides, resolveFrameDesign, resolveExtraFrameDesign } from '../utils/templateEngine';
import { getPlaceholderScreenshots, getWhiteScreenshot } from '../utils/placeholderScreenshots';

export const MIN_FRAMES = 1;
export const MAX_FRAMES = 10;
export const DEFAULT_FRAME_COUNT = 5;
export const DEFAULT_SCRATCH_STORE = 'play/phone';

let _id = 0;
export function newFrameId() {
  _id += 1;
  return `frame-${Date.now()}-${_id}`;
}

export function createEmptyFrame(screenshotUrl = null) {
  return {
    id: newFrameId(),
    design: null,
    screenshotUrl,
  };
}

/** Build frames from a template pack + optional user screenshots. */
export function framesFromTemplate(template, userScreenshots = []) {
  const slides = getTemplateSlides(template);
  const slideCount = slides.length || DEFAULT_FRAME_COUNT;
  const count = Math.min(
    MAX_FRAMES,
    Math.max(MIN_FRAMES, slideCount, userScreenshots.length),
  );
  const placeholders = getPlaceholderScreenshots(count);
  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push({
      id: newFrameId(),
      design: resolveFrameDesign(template, i),
      screenshotUrl: userScreenshots[i] || placeholders[i] || null,
    });
  }
  return frames;
}

/** Build frames from screenshots only (no design). */
export function framesFromScreenshots(urls = []) {
  const count = Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, urls.length || DEFAULT_FRAME_COUNT));
  const placeholders = getPlaceholderScreenshots(count);
  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push(createEmptyFrame(urls[i] || placeholders[i] || null));
  }
  return frames;
}

/**
 * Blank board: N artboards with no template pack — white screens + Pixel9 via paintDesignContents.
 * @param {{ count?: number, store?: string }} [opts]
 */
export function framesFromScratch({ count = DEFAULT_FRAME_COUNT, store = DEFAULT_SCRATCH_STORE } = {}) {
  const n = Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, count));
  const white = getWhiteScreenshot();
  const stamp = Date.now();
  const frames = [];
  for (let i = 0; i < n; i++) {
    frames.push({
      id: newFrameId(),
      design: null,
      screenshotUrl: white,
      fabricJson: null,
      fabricRestoreKey: `scratch-${stamp}-${i}`,
      store,
    });
  }
  return frames;
}

/** Reset every frame to extraSlide styling + blank device screens. */
export function stripFramesToDevices(frames, template, whiteUrl, stamp = Date.now()) {
  const design = template ? resolveExtraFrameDesign(template) : null;
  const designCopy = design ? JSON.parse(JSON.stringify(design)) : null;
  return frames.map((f, i) => ({
    ...f,
    design: designCopy,
    screenshotUrl: whiteUrl,
    fabricJson: null,
    fabricRestoreKey: `devices-${stamp}-${i}`,
  }));
}

/** Map uploaded screenshots 1:1 onto frames (extend/shrink within limits). */
export function mapScreenshotUrls(frames, urls, template = null) {
  const count = Math.min(
    MAX_FRAMES,
    Math.max(frames.length, Math.min(urls.length || frames.length, MAX_FRAMES)),
  );
  const placeholders = getPlaceholderScreenshots(count);
  const stamp = Date.now();
  const next = [];
  for (let i = 0; i < count; i++) {
    const keptDesign = frames[i]?.design;
    const fromImport = urls[i] != null ? urls[i] : null;
    const screenshotUrl = fromImport ?? frames[i]?.screenshotUrl ?? placeholders[i] ?? null;
    const urlChanged = fromImport != null && fromImport !== frames[i]?.screenshotUrl;
    next.push({
      id: frames[i]?.id || newFrameId(),
      design: keptDesign || (template ? resolveFrameDesign(template, i) : null),
      screenshotUrl,
      fabricJson: urlChanged ? null : frames[i]?.fabricJson ?? null,
      fabricRestoreKey: urlChanged ? `import-${stamp}-${i}` : frames[i]?.fabricRestoreKey ?? null,
    });
  }
  return next;
}

export function useFrames(initialFrames) {
  const [frames, setFrames] = useState(
    () => (initialFrames?.length ? initialFrames : framesFromScreenshots([])),
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const activeFrame = activeIndex >= 0 ? (frames[activeIndex] ?? null) : null;

  const addFrame = useCallback((afterIndex, template = null) => {
    setFrames((prev) => {
      if (prev.length >= MAX_FRAMES) return prev;
      const idx = afterIndex == null ? prev.length - 1 : afterIndex;
      const placeholders = getPlaceholderScreenshots(1);
      const insertAt = idx + 1;
      const next = [...prev];
      next.splice(insertAt, 0, {
        id: newFrameId(),
        design: template ? resolveFrameDesign(template, insertAt) : null,
        screenshotUrl: placeholders[0],
      });
      return next;
    });
    setActiveIndex((i) => {
      const at = afterIndex == null ? frames.length - 1 : afterIndex;
      return Math.min(at + 1, MAX_FRAMES - 1);
    });
  }, [frames.length]);

  const duplicateFrame = useCallback((index) => {
    setFrames((prev) => {
      if (prev.length >= MAX_FRAMES || !prev[index]) return prev;
      const src = prev[index];
      const copy = {
        id: newFrameId(),
        design: src.design ? JSON.parse(JSON.stringify(src.design)) : null,
        screenshotUrl: src.screenshotUrl,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setActiveIndex(index + 1);
  }, []);

  const deleteFrame = useCallback((index) => {
    setFrames((prev) => {
      if (prev.length <= MIN_FRAMES) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setActiveIndex((i) => {
      if (index < i) return i - 1;
      if (index === i) return Math.max(0, i - 1);
      return i;
    });
  }, []);

  const moveFrame = useCallback((index, dir) => {
    setFrames((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(j, 0, item);
      return next;
    });
    setActiveIndex((i) => {
      if (i === index) return index + dir;
      if (dir < 0 && i === index - 1) return index;
      if (dir > 0 && i === index + 1) return index;
      return i;
    });
  }, []);

  const updateFrame = useCallback((index, patch) => {
    setFrames((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }, []);

  /** Apply template pack into frames; keep existing screenshots when possible. */
  const applyTemplatePack = useCallback((template, { resizeToPack = true } = {}) => {
    const slides = getTemplateSlides(template);
    setFrames((prev) => {
      const keepUrls = prev.map((f) => f.screenshotUrl);
      const slideCount = slides.length || DEFAULT_FRAME_COUNT;
      const targetCount = resizeToPack
        ? Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, slideCount, prev.length))
        : prev.length;
      const placeholders = getPlaceholderScreenshots(targetCount);
      const next = [];
      for (let i = 0; i < targetCount; i++) {
        next.push({
          id: prev[i]?.id || newFrameId(),
          design: resolveFrameDesign(template, i),
          screenshotUrl: keepUrls[i] || placeholders[i] || null,
          fabricJson: null,
          fabricRestoreKey: null,
        });
      }
      return next;
    });
    setActiveIndex(0);
  }, []);

  /** Clear designs but keep frames + screenshots. */
  const clearDesigns = useCallback(() => {
    setFrames((prev) => prev.map((f) => ({ ...f, design: null })));
  }, []);

  /** Map uploaded screenshots 1:1 onto frames (extend/shrink within limits). */
  const mapScreenshots = useCallback((urls, template = null) => {
    setFrames((prev) => mapScreenshotUrls(prev, urls, template));
  }, []);

  return {
    frames,
    setFrames,
    activeIndex,
    setActiveIndex,
    activeFrame,
    addFrame,
    duplicateFrame,
    deleteFrame,
    moveFrame,
    updateFrame,
    applyTemplatePack,
    clearDesigns,
    mapScreenshots,
  };
}
