import { useEffect, useRef, useState } from 'react';
import { createCanvas, bindCanvasCursors } from '../utils/canvasEngine';
import { applyDesignToFrame, setFrameEditable } from '../utils/templateEngine';
import { unlockCanvasPointerEvents, setCanvasPaintVisibility } from '../utils/canvasPointerUnlock';

function applyCssDisplaySize(canvas, cssW, cssH) {
  if (typeof canvas.setDimensions === 'function') {
    canvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });
  }
  const els = [canvas.lowerCanvasEl, canvas.upperCanvasEl, canvas.wrapperEl, canvas.container].filter(Boolean);
  els.forEach((el) => {
    el.style.width = `${cssW}px`;
    el.style.height = `${cssH}px`;
    el.style.maxWidth = `${cssW}px`;
    el.style.maxHeight = `${cssH}px`;
  });
  canvas.calcOffset?.();
}

function applyDisplayScale(canvas, canvasWidth, canvasHeight, scale) {
  const cssW = Math.max(1, Math.round(canvasWidth * scale));
  const cssH = Math.max(1, Math.round(canvasHeight * scale));
  if (typeof canvas.setDimensions === 'function') {
    canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
    canvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });
  }
  applyCssDisplaySize(canvas, cssW, cssH);
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.requestRenderAll?.();
  return { cssW, cssH };
}

function findDeviceTarget(target) {
  let t = target;
  while (t) {
    if (t.glintRole === 'framed-screenshot') return t;
    t = t.group || t.parent;
  }
  return null;
}

/**
 * One Fabric canvas for a single Frame artboard.
 * Backing store = full store size; CSS display scaled for the board.
 */
export default function FrameCanvas({
  frameId,
  design,
  screenshotUrl,
  fabricJson = null,
  canvasWidth = 1080,
  canvasHeight = 1920,
  displayScale = 0.16,
  themes = {},
  editable = true,
  onCanvasReady,
  /** Fires after design/fabric paint lands (objects exist for bezel sync). */
  onPainted,
  onDeviceContextMenu,
  paintKey,
}) {
  const elRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const themesRef = useRef(themes);
  const editableRef = useRef(editable);
  const menuRef = useRef(onDeviceContextMenu);
  const onPaintedRef = useRef(onPainted);
  onPaintedRef.current = onPainted;
  const screenshotRef = useRef(screenshotUrl);
  const designRef = useRef(design);
  const scaleRef = useRef(Math.max(0.05, displayScale));
  const scale = Math.max(0.05, displayScale);
  scaleRef.current = scale;
  themesRef.current = themes;
  editableRef.current = editable;
  menuRef.current = onDeviceContextMenu;
  screenshotRef.current = screenshotUrl;
  designRef.current = design;

  const cssW = Math.max(1, Math.round(canvasWidth * scale));
  const cssH = Math.max(1, Math.round(canvasHeight * scale));

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!elRef.current) return;
    // Synchronously hide - loaded may still be true from previous paint cycle,
    // and setLoaded(false) is batched by React so the new blank canvas would flash.
    // Opacity only - never pointer-events on the canvas node (Fabric copies that
    // onto the upper hit layer and selection stays dead forever).
    elRef.current.style.opacity = '0';
    setLoaded(false);
    const c = createCanvas(elRef.current, canvasWidth, canvasHeight);
    unlockCanvasPointerEvents(c);
    setCanvasPaintVisibility(c, false);
    applyDisplayScale(c, canvasWidth, canvasHeight, scaleRef.current);
    setFrameEditable(c, editableRef.current);
    canvasRef.current = c;
    onCanvasReady?.(frameId, c);

    const openDeviceMenu = (opt, device) => {
      opt.e.preventDefault();
      opt.e.stopPropagation();
      c.setActiveObject(device);
      c.requestRenderAll();
      menuRef.current?.({
        frameId,
        device,
        canvas: c,
        clientX: opt.e.clientX,
        clientY: opt.e.clientY,
      });
    };

    /** @type {{ x: number, y: number, target: unknown } | null} */
    let pendingDeviceClick = null;

    const onMouseDown = (opt) => {
      if (opt.e?.button !== 0 || !editableRef.current) return;
      const target = opt.target;
      const device = findDeviceTarget(target);
      // Only force device selection when clicking the device group itself or
      // one of its internal children (bezel bitmap, border rect).
      // User-added objects (text, graphics, shapes) are top-level canvas objects
      // that may overlap the device - let Fabric select them normally.
      const isDeviceChild = device && target !== device
        && (target.group === device || target.parent === device);
      if (device && (target === device || isDeviceChild)) {
        pendingDeviceClick = { x: opt.e.clientX, y: opt.e.clientY, target: opt.target };
        c.setActiveObject(device);
        c.requestRenderAll();
      }
    };

    const onMouseUp = (opt) => {
      if (opt.e?.button !== 0 || !pendingDeviceClick) return;
      const start = pendingDeviceClick;
      pendingDeviceClick = null;
      const device = findDeviceTarget(opt.target) || findDeviceTarget(start.target);
      if (!device || !editableRef.current) return;
      const dx = opt.e.clientX - start.x;
      const dy = opt.e.clientY - start.y;
      if (dx * dx + dy * dy > 36) return;
      openDeviceMenu(opt, device);
    };

    c.on('mouse:down', onMouseDown);
    c.on('mouse:up', onMouseUp);

    const unbindCursors = bindCanvasCursors(c, {
      getEditable: () => editableRef.current,
      wrapEl: wrapRef.current,
    });

    const onDblClick = (opt) => {
      if (!editableRef.current) return;
      const t = opt.target;
      if (!t) return;
      const isText =
        t.glintRole === 'text' ||
        typeof t.enterEditing === 'function' ||
        t.type === 'i-text' ||
        t.type === 'textbox';
      if (!isText) return;
      requestAnimationFrame(() => {
        try {
          if (typeof t.enterEditing === 'function' && !t.isEditing) t.enterEditing();
          if (typeof t.selectAll === 'function') t.selectAll();
          c.requestRenderAll();
        } catch {
          /* ignore */
        }
      });
    };
    c.on('mouse:dblclick', onDblClick);

    return () => {
      unbindCursors();
      c.off('mouse:down', onMouseDown);
      c.off('mouse:up', onMouseUp);
      c.off('mouse:dblclick', onDblClick);
      onCanvasReady?.(frameId, null);
      c.dispose();
      canvasRef.current = null;
    };
  }, [canvasWidth, canvasHeight, frameId]);

  // Zoom: CSS size only - never reset the Fabric backstore.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    applyCssDisplaySize(canvas, cssW, cssH);
  }, [cssW, cssH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setFrameEditable(canvas, editable);
    // Frame focus only - do not auto-select the device; user clicks the layer they want.
    if (!editable) return;
    canvas.discardActiveObject?.();
    canvas.requestRenderAll?.();
  }, [editable]);

  const syncDisplaySize = (canvas) => {
    const s = scaleRef.current;
    applyCssDisplaySize(
      canvas,
      Math.max(1, Math.round(canvasWidth * s)),
      Math.max(1, Math.round(canvasHeight * s)),
    );
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ac = new AbortController();
    // Hide via opacity only - shimmer overlay covers interaction while loading.
    setCanvasPaintVisibility(canvas, false);
    setLoaded(false);
    (async () => {
      const paintOpts = {
        canvasWidth,
        canvasHeight,
        themes: themesRef.current,
        editable: editableRef.current,
        signal: ac.signal,
        displayCssWidth: Math.max(1, Math.round(canvasWidth * scaleRef.current)),
        displayCssHeight: Math.max(1, Math.round(canvasHeight * scaleRef.current)),
      };
      try {
        if (fabricJson) {
          try {
            if (typeof canvas.loadFromJSON === 'function') {
              await canvas.loadFromJSON(fabricJson);
            } else if (typeof canvas.loadFromObject === 'function') {
              await canvas.loadFromObject(fabricJson);
            }
          } catch (err) {
            console.warn('Glint pack fabric restore failed, falling back to design', err);
            await applyDesignToFrame(canvas, designRef.current, screenshotRef.current, paintOpts);
          }
        } else {
          await applyDesignToFrame(canvas, designRef.current, screenshotRef.current, paintOpts);
        }
      } catch (err) {
        console.error('Glint: paint failed', err);
      }
      if (ac.signal.aborted) return;
      syncDisplaySize(canvas);
      setFrameEditable(canvas, editableRef.current);
      // Keep artboard clear after paint - selecting a frame ≠ selecting the device.
      canvas.discardActiveObject?.();
      // Wait for the actual pixel paint to land before revealing the canvas.
      // requestRenderAll() queues a render for the next animation frame;
      // without this wait the canvas shows one blank frame before the template.
      requestAnimationFrame(() => {
        canvas.calcOffset?.();
        canvas.requestRenderAll?.();
        requestAnimationFrame(() => {
          if (ac.signal.aborted) return;
          setCanvasPaintVisibility(canvas, true);
          setLoaded(true);
          onPaintedRef.current?.(frameId, canvas);
        });
      });
    })();
    return () => ac.abort();
  }, [fabricJson, canvasWidth, canvasHeight, paintKey, screenshotUrl, frameId]);

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-sm bg-glint-surface-2"
      style={{ width: cssW, height: cssH }}
    >
      {/* No pointer-events-none here - Fabric clones this class onto the upper canvas. */}
      <canvas ref={elRef} className={`block ${loaded ? 'opacity-100' : 'opacity-0'}`} />
      {!loaded && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent" />
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.08]" />
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_0.4s_infinite] bg-gradient-to-r from-transparent via-black/[0.04] to-transparent dark:via-white/[0.05]" />
        </div>
      )}
    </div>
  );
}
