import { Circle, Ellipse, Rect, loadSVGFromString, util } from 'fabric';
import { applySelectionStyle } from './canvasEngine';

function walk(obj, fn) {
  if (!obj) return;
  fn(obj);
  const kids = obj._objects || (typeof obj.getObjects === 'function' ? obj.getObjects() : []);
  kids.forEach((child) => walk(child, fn));
}

/** Recolor slots — file colors match canvas defaults so the sidebar preview looks real. */
export const DEFAULT_GRAPHIC_FILLS = { a: '#FF6B4A', b: '#FFD166', c: '#FFFFFF' };

function slotFromColor(value) {
  if (typeof value !== 'string') return '';
  const v = value.trim().toUpperCase();
  // a: coral (legacy #A10000 + preview default)
  if (v === '#A10000' || v === '#00A' || v === '#0000AA' || v === '#FF6B4A') return 'a';
  // b: gold
  if (v === '#B10000' || v === '#00B' || v === '#0000BB' || v === '#FFD166') return 'b';
  // c: near-white text slot (not pure #FFF — keeps Humaaans whites fixed)
  if (v === '#C10000' || v === '#00C' || v === '#0000CC' || v === '#FFF7F2') return 'c';
  return '';
}

export function tagAndTintGraphic(obj, fills = {}) {
  walk(obj, (node) => {
    const fillSlot = slotFromColor(node.fill);
    const strokeSlot = slotFromColor(node.stroke);
    if (!node.glintSlot) node.glintSlot = fillSlot || strokeSlot;
    const color = fills[node.glintSlot];
    if (!color) return;
    if (node.fill && node.fill !== 'none' && typeof node.fill === 'string') node.set('fill', color);
    if (node.stroke && node.stroke !== 'none' && typeof node.stroke === 'string') node.set('stroke', color);
  });
}

export function recolorGraphic(obj, patch = {}) {
  if (!obj) return;
  if (obj.glintShape || obj.type === 'circle' || obj.type === 'rect' || obj.type === 'ellipse') {
    if (patch.a || patch.fill) obj.set('fill', patch.a || patch.fill);
    if (patch.opacity != null) obj.set('opacity', patch.opacity);
    return;
  }
  const fills = { ...(obj.glintFills || {}), ...patch };
  obj.glintFills = fills;
  tagAndTintGraphic(obj, fills);
  if (patch.opacity != null) obj.set('opacity', patch.opacity);
}

export function graphicScale(layer = {}, nativeW = 1080, nativeH = nativeW) {
  const scaleX = layer.width != null ? layer.width / nativeW : (layer.scale ?? 1);
  const scaleY = layer.height != null ? layer.height / nativeH : scaleX;
  return { scaleX, scaleY };
}

export async function addGraphicLayer(canvas, layer = {}, opts = {}) {
  const file = layer.src || 'blob-cluster.svg';
  const src = file.startsWith('/') ? file : `/graphics/${file}`;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Graphic not found: ${src}`);
  const svg = await res.text();
  const { objects, options } = await loadSVGFromString(svg);
  const group = util.groupSVGElements(objects, options);

  const fills = {
    a: layer.fill || layer.fillA || DEFAULT_GRAPHIC_FILLS.a,
    b: layer.fill2 || layer.fillB || DEFAULT_GRAPHIC_FILLS.b,
    c: layer.fill3 || layer.fillC || DEFAULT_GRAPHIC_FILLS.c,
  };
  tagAndTintGraphic(group, fills);

  const nativeW = group.width || 1080;
  const nativeH = group.height || nativeW;
  const { scaleX, scaleY } = graphicScale(layer, nativeW, nativeH);

  group.set({
    left: layer.left ?? 0,
    top: layer.top ?? 0,
    originX: 'left',
    originY: 'top',
    scaleX,
    scaleY,
    opacity: layer.opacity ?? 1,
    angle: layer.angle ?? 0,
    selectable: opts.selectable !== false,
    evented: opts.selectable !== false,
    hasControls: true,
    hasBorders: true,
    lockMovementX: false,
    lockMovementY: false,
    objectCaching: true,
    glintRole: 'graphic',
    glintGraphic: file,
    glintFills: fills,
  });
  applySelectionStyle(group);

  canvas.add(group);
  if (layer.sendToBack) {
    if (typeof canvas.sendObjectToBack === 'function') canvas.sendObjectToBack(group);
    else group.sendToBack?.();
  }
  canvas.requestRenderAll?.();
  return group;
}

export function addShapeLayer(canvas, layer = {}, opts = {}) {
  const common = {
    fill: layer.fill ?? '#FF6B4A',
    opacity: layer.opacity ?? 1,
    angle: layer.angle ?? 0,
    selectable: opts.selectable !== false,
    evented: opts.selectable !== false,
    hasControls: true,
    hasBorders: true,
    lockMovementX: false,
    lockMovementY: false,
    glintRole: 'graphic',
    glintShape: layer.shape || 'rect',
    glintFills: { a: layer.fill ?? '#FF6B4A' },
  };

  let obj;
  if (layer.shape === 'circle') {
    obj = new Circle({
      radius: layer.radius ?? 140,
      left: layer.left ?? 0,
      top: layer.top ?? 0,
      originX: 'center',
      originY: 'center',
      ...common,
    });
  } else if (layer.shape === 'ellipse') {
    obj = new Ellipse({
      rx: layer.rx ?? 220,
      ry: layer.ry ?? 140,
      left: layer.left ?? 0,
      top: layer.top ?? 0,
      originX: 'center',
      originY: 'center',
      ...common,
    });
  } else {
    obj = new Rect({
      width: layer.width ?? 400,
      height: layer.height ?? 200,
      rx: layer.rx ?? 0,
      ry: layer.ry ?? layer.rx ?? 0,
      left: layer.left ?? 0,
      top: layer.top ?? 0,
      originX: 'left',
      originY: 'top',
      ...common,
    });
  }

  canvas.add(obj);
  if (layer.sendToBack) {
    if (typeof canvas.sendObjectToBack === 'function') canvas.sendObjectToBack(obj);
    else obj.sendToBack?.();
  }
  canvas.requestRenderAll?.();
  return obj;
}
