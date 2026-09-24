import { Device3DScene, phoneLayoutForFrame, webglAvailable, glbUrlForFrame } from './Device3DScene.js';
import { getOrbitPreset } from './orbitPresets.js';

/**
 * Bake a Live 3D device view to a PNG data URL for Fabric export / swap-in.
 * Uses FRAME_INSETS-accurate procedural mesh (same frameId as Flat PNG bezels).
 * @param {{ screenshotUrl: string, frameId?: string, yaw?: number, pitch?: number, roll?: number, presetId?: string, width?: number, height?: number }} opts
 * @returns {Promise<string|null>}
 */
export async function bakeDevice3D(opts = {}) {
  if (typeof document === 'undefined' || !webglAvailable()) return null;
  const preset = opts.presetId ? getOrbitPreset(opts.presetId) : null;
  const yaw = opts.yaw ?? preset?.yaw ?? 0;
  const pitch = opts.pitch ?? preset?.pitch ?? 0;
  const roll = opts.roll ?? preset?.roll ?? 0;
  const layout = phoneLayoutForFrame(opts.frameId || 'pixel9');
  // High-res bake; keep phone aspect so the composite isn't stretched.
  const baseH = Math.max(900, Math.round(opts.height || 1600));
  const height = baseH;
  const width = Math.max(480, Math.round(opts.width || baseH * (layout.W / layout.H) * 1.15));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let scene;
  try {
    // ponytail: GLB path reserved — drop files at public/frames/3d/{frameId}.glb when ready;
    // loader hooks via glbUrlForFrame(); procedural mesh is the production path today.
    void glbUrlForFrame(opts.frameId);
    scene = new Device3DScene(canvas, { frameId: opts.frameId || 'pixel9' });
    scene.setOrbit({ yaw, pitch, roll });
    if (opts.screenshotUrl) await scene.setScreenshot(opts.screenshotUrl);
    return scene.toDataURL('image/png');
  } catch (err) {
    console.warn('Glint: bakeDevice3D failed', err);
    return null;
  } finally {
    scene?.dispose?.();
  }
}

export async function bakeLiveDevicesOnCanvas(fabricCanvas) {
  if (!fabricCanvas?.getObjects) return { baked: 0 };
  const devices = fabricCanvas.getObjects().filter((o) => o.glintDeviceMode === 'live3d');
  let baked = 0;
  for (const device of devices) {
    const ok = await applyLive3DBakeToDevice(device);
    if (ok) baked += 1;
  }
  fabricCanvas.requestRenderAll?.();
  return { baked };
}

/** Bake and swap visuals on one framed-screenshot group. */
export async function applyLive3DBakeToDevice(device) {
  if (!device || device.glintRole !== 'framed-screenshot') return false;
  const { FabricImage } = await import('fabric');
  const orbit = device.glintOrbit || { yaw: 0, pitch: 0, roll: 0 };
  const layout = phoneLayoutForFrame(device.glintFrameId || 'pixel9');
  const layoutH = device.glintLayoutH || device.height || 800;
  const layoutW = device.glintLayoutW || device.width || 400;
  const bakeH = Math.max(1200, Math.round(layoutH * 2.5));
  const bakeW = Math.round(bakeH * (layout.W / layout.H) * 1.2);
  const url = await bakeDevice3D({
    screenshotUrl: device.glintScreenshotUrl,
    frameId: device.glintFrameId,
    yaw: orbit.yaw,
    pitch: orbit.pitch,
    roll: orbit.roll,
    width: bakeW,
    height: bakeH,
  });
  if (!url) return false;
  device.glintBakedUrl = url;
  try {
    const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
    const kids = typeof device.getObjects === 'function' ? device.getObjects() : device._objects || [];
    const first = kids[0];
    if (!first || !img) return false;
    const tw = first.getScaledWidth?.() || first.width || 1;
    const th = first.getScaledHeight?.() || first.height || 1;
    // Fit bake into prior device footprint (contain).
    const scale = Math.min(tw / Math.max(1, img.width), th / Math.max(1, img.height));
    const nw = img.width * scale;
    const nh = img.height * scale;
    img.set({
      left: (first.left || 0) + (tw - nw) / 2,
      top: (first.top || 0) + (th - nh) / 2,
      originX: first.originX || 'left',
      originY: first.originY || 'top',
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: false,
    });
    if (typeof device.remove === 'function') device.remove(first);
    if (typeof device.insertAt === 'function') device.insertAt(0, img);
    else if (typeof device.add === 'function') device.add(img);
    device.set({ angle: 0, glintDeviceMode: 'live3d', glintOrbit: { ...orbit } });
    device.setCoords?.();
    device.canvas?.requestRenderAll?.();
    return true;
  } catch (err) {
    console.warn('Glint: failed to apply bake to device', err);
    return false;
  }
}

export function setDeviceLiveMode(device, enabled, orbit = null) {
  if (!device) return false;
  if (enabled) {
    device.glintDeviceMode = 'live3d';
    device.glintOrbit = orbit || device.glintOrbit || { yaw: -42, pitch: -12, roll: 0 };
  } else {
    device.glintDeviceMode = 'flat';
    device.glintBakedUrl = null;
  }
  return true;
}
