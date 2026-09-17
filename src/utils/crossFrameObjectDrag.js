import { isCrossFrameTransferable, copySelectionToFrame, moveSelectionToFrame } from './copyObjectToFrame.js';

function selectedTransferable(canvas) {
  const active = canvas?.getActiveObject?.();
  if (!active) return [];
  const list = active.type === 'activeSelection' ? active.getObjects() : [active];
  return list.filter(isCrossFrameTransferable);
}

function frameIndexUnderPoint(clientX, clientY) {
  // Ghost is pointer-events:none; still safe if other overlays sit on top.
  const el = document.elementFromPoint(clientX, clientY);
  const col = el?.closest?.('[data-frame-column]');
  if (!col) return null;
  const idx = Number(col.getAttribute('data-frame-index'));
  return Number.isFinite(idx) ? idx : null;
}

function scenePoint(canvas, e) {
  canvas.calcOffset?.();
  if (typeof canvas.getScenePoint === 'function') return canvas.getScenePoint(e);
  if (typeof canvas.getPointer === 'function') return canvas.getPointer(e);
  return { x: 0, y: 0 };
}

function canvasDisplayScale(canvas) {
  const el = canvas?.upperCanvasEl || canvas?.wrapperEl || canvas?.lowerCanvasEl;
  if (!el || !canvas?.getWidth) return { sx: 1, sy: 1, rect: null };
  const rect = el.getBoundingClientRect();
  const w = canvas.getWidth() || 1;
  const h = canvas.getHeight() || 1;
  return { sx: rect.width / w, sy: rect.height / h, rect };
}

function removeGhost(session) {
  if (!session?.ghostEl) return;
  session.ghostEl.remove();
  session.ghostEl = null;
}

function restoreOpacities(session) {
  if (!session?.opacities) return;
  for (const [obj, opacity] of session.opacities) {
    obj.set({ opacity });
    obj.setCoords?.();
  }
  session.opacities = null;
  session.sourceCanvas?.requestRenderAll?.();
}

function hideSources(session) {
  if (session.opacities) return;
  const objects = selectedTransferable(session.sourceCanvas);
  session.opacities = new Map(objects.map((o) => [o, o.opacity ?? 1]));
  for (const obj of objects) {
    obj.set({ opacity: 0 });
  }
  session.sourceCanvas?.requestRenderAll?.();
}

/**
 * Floating bitmap that follows the cursor once the drag leaves the source artboard
 * (Fabric clips to overflow:hidden frame columns).
 */
function ensureGhost(session, e) {
  if (session.ghostEl) return;
  const canvas = session.sourceCanvas;
  const active = canvas?.getActiveObject?.();
  if (!active || typeof active.toDataURL !== 'function') return;

  let url = '';
  try {
    url = active.toDataURL({ format: 'png', multiplier: 2, enableRetinaScaling: false });
  } catch {
    return;
  }
  if (!url) return;

  const br = typeof active.getBoundingRect === 'function'
    ? active.getBoundingRect()
    : { left: active.left || 0, top: active.top || 0, width: 40, height: 40 };
  const { sx, sy } = canvasDisplayScale(canvas);
  const pointer = scenePoint(canvas, e);

  const el = document.createElement('img');
  el.src = url;
  el.alt = '';
  el.draggable = false;
  el.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'margin:0',
    'padding:0',
    'pointer-events:none',
    'z-index:10000',
    `width:${Math.max(1, br.width * sx)}px`,
    `height:${Math.max(1, br.height * sy)}px`,
    'opacity:0.95',
    'filter:drop-shadow(0 8px 20px rgba(0,0,0,0.35))',
    'will-change:transform',
    'user-select:none',
  ].join(';');
  document.body.appendChild(el);

  session.ghostEl = el;
  session.grabClient = {
    x: (pointer.x - br.left) * sx,
    y: (pointer.y - br.top) * sy,
  };
  moveGhost(session, e.clientX, e.clientY);
}

function moveGhost(session, clientX, clientY) {
  if (!session?.ghostEl || !session.grabClient) return;
  const x = clientX - session.grabClient.x;
  const y = clientY - session.grabClient.y;
  session.ghostEl.style.transform = `translate(${x}px, ${y}px)`;
}

function endGhostUi(session) {
  removeGhost(session);
  restoreOpacities(session);
}

/**
 * While a transferable Fabric object is dragged, pointerup over another
 * [data-frame-column] moves it (Alt = copy). Device/screenshot roles are ignored.
 *
 * @returns {{ attachCanvas: (canvas: object, frameId: string) => void, dispose: () => void }}
 */
export function installCrossFrameObjectDrag({
  getFrames,
  getCanvasMap,
  setActiveIndex,
  onDropTargetChange,
  onTransfer,
} = {}) {
  let drag = null;
  const attached = new WeakSet();

  const clearHighlight = () => onDropTargetChange?.(null);

  const onPointerMove = (e) => {
    if (!drag?.moved) return;
    drag.altKey = e.altKey;
    const frames = getFrames?.() || [];
    const sourceIndex = frames.findIndex((f) => f.id === drag.sourceFrameId);
    const idx = frameIndexUnderPoint(e.clientX, e.clientY);
    const overSource = idx === sourceIndex;

    if (!overSource) {
      if (idx != null) onDropTargetChange?.(idx);
      else clearHighlight();

      ensureGhost(drag, e);
      if (e.altKey || drag.altKey) {
        // Alt-copy: park originals at start, ghost is the flying clone.
        for (const [obj, pos] of drag.originals) {
          obj.set({ left: pos.left, top: pos.top, opacity: pos.opacity ?? obj.opacity ?? 1 });
          obj.setCoords?.();
        }
        drag.sourceCanvas?.requestRenderAll?.();
        restoreOpacities(drag);
      } else {
        hideSources(drag);
      }
      moveGhost(drag, e.clientX, e.clientY);
      return;
    }

    clearHighlight();
    // Back on source: Fabric draws the object again.
    if (drag.ghostEl) {
      endGhostUi(drag);
    }
  };

  const onPointerUp = async (e) => {
    if (!drag) return;
    const session = drag;
    drag = null;
    clearHighlight();
    if (!session.moved) {
      endGhostUi(session);
      return;
    }

    const frames = getFrames?.() || [];
    const sourceIndex = frames.findIndex((f) => f.id === session.sourceFrameId);
    const targetIndex = frameIndexUnderPoint(e.clientX, e.clientY);

    if (targetIndex == null || targetIndex === sourceIndex || sourceIndex < 0) {
      endGhostUi(session);
      return;
    }

    const targetFrame = frames[targetIndex];
    const targetCanvas = getCanvasMap?.()?.[targetFrame?.id];
    const sourceCanvas = session.sourceCanvas;
    if (!targetCanvas || !sourceCanvas) {
      endGhostUi(session);
      return;
    }

    // Restore visibility before clone so toJSON sees real opacity.
    restoreOpacities(session);
    removeGhost(session);

    const objects = [...session.originals.keys()].filter(isCrossFrameTransferable);
    if (!objects.length) return;

    const copy = e.altKey || session.altKey;
    if (copy) {
      for (const [obj, pos] of session.originals) {
        obj.set({ left: pos.left, top: pos.top });
        obj.setCoords?.();
      }
      sourceCanvas.requestRenderAll();
    }

    const primary = objects[0];
    const pointer = scenePoint(targetCanvas, e);
    const offset = {
      x: pointer.x - (primary.left || 0),
      y: pointer.y - (primary.top || 0),
    };

    if (copy) {
      await copySelectionToFrame(sourceCanvas, targetCanvas, objects, offset);
    } else {
      await moveSelectionToFrame(sourceCanvas, targetCanvas, objects, offset);
    }

    setActiveIndex?.(targetIndex);
    onTransfer?.({ mode: copy ? 'copy' : 'move', targetIndex });
  };

  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('pointerup', onPointerUp, true);

  function attachCanvas(canvas, frameId) {
    if (!canvas || !frameId || attached.has(canvas)) return;
    attached.add(canvas);

    // Snapshot before Fabric shifts the object (needed for Alt-copy restore).
    const onMouseDown = () => {
      const objects = selectedTransferable(canvas);
      if (!objects.length) {
        if (drag) endGhostUi(drag);
        drag = null;
        return;
      }
      drag = {
        sourceFrameId: frameId,
        sourceCanvas: canvas,
        altKey: false,
        originals: new Map(
          objects.map((o) => [o, { left: o.left, top: o.top, opacity: o.opacity ?? 1 }]),
        ),
      };
    };

    const onMoving = () => {
      if (!drag || drag.sourceCanvas !== canvas) return;
      drag.moved = true;
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('object:moving', onMoving);
  }

  function dispose() {
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    if (drag) endGhostUi(drag);
    drag = null;
    clearHighlight();
  }

  return { attachCanvas, dispose };
}
