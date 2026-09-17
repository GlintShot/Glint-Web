import { util, ActiveSelection } from 'fabric';
import { GLINT_CLONE_PROPS } from './glintCloneProps.js';
import { isCrossFrameTransferable } from './copyObjectToFrame.js';

/** In-memory editor clipboard (not the OS clipboard). */
let clip = null;

const PASTE_NUDGE = 24;

function selectedTransferable(canvas) {
  const active = canvas?.getActiveObject?.();
  if (!active) return [];
  const list = active.type === 'activeSelection' ? active.getObjects() : [active];
  return list.filter(isCrossFrameTransferable);
}

function serializeObjects(objects) {
  return objects.map((obj) => obj.toJSON(GLINT_CLONE_PROPS));
}

/** @returns {{ ok: boolean, count?: number, error?: string }} */
export function copySelectionToClipboard(canvas) {
  const objects = selectedTransferable(canvas);
  if (!objects.length) return { ok: false, error: 'nothing_to_copy' };
  clip = {
    json: serializeObjects(objects),
    pasteCount: 0,
  };
  return { ok: true, count: objects.length };
}

/** Copy then remove (protected layers stay). */
export function cutSelectionToClipboard(canvas) {
  const objects = selectedTransferable(canvas);
  if (!objects.length) return { ok: false, error: 'nothing_to_cut' };
  clip = {
    json: serializeObjects(objects),
    pasteCount: 0,
  };
  canvas.discardActiveObject();
  for (const obj of objects) canvas.remove(obj);
  canvas.requestRenderAll();
  return { ok: true, count: objects.length };
}

/**
 * Paste clipboard onto canvas, selecting the new objects.
 * @returns {Promise<{ ok: boolean, count?: number, error?: string }>}
 */
export async function pasteClipboardToCanvas(canvas) {
  if (!canvas) return { ok: false, error: 'no_canvas' };
  if (!clip?.json?.length) return { ok: false, error: 'clipboard_empty' };

  clip.pasteCount = (clip.pasteCount || 0) + 1;
  const nudge = PASTE_NUDGE * clip.pasteCount;

  const cloned = await util.enlivenObjects(clip.json);
  if (!cloned?.length) return { ok: false, error: 'enliven_failed' };

  const added = [];
  for (const clone of cloned) {
    clone.set({
      left: (clone.left || 0) + nudge,
      top: (clone.top || 0) + nudge,
      selectable: true,
      evented: true,
    });
    canvas.add(clone);
    clone.bringToFront?.();
    added.push(clone);
  }

  if (added.length === 1) {
    canvas.setActiveObject(added[0]);
  } else if (added.length > 1) {
    const sel = new ActiveSelection(added, { canvas });
    canvas.setActiveObject(sel);
  }

  canvas.requestRenderAll();
  return { ok: true, count: added.length };
}

export function hasClipboard() {
  return !!clip?.json?.length;
}

/** Test helper. */
export function __resetClipboard() {
  clip = null;
}
