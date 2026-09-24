/** Tiny WebGL probe — keep out of Device3DScene so UI can check without loading the renderer. */
export function webglAvailable() {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}
