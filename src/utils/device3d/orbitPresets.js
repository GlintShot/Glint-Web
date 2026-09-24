/**
 * Shared orbit / angle presets for Flat Fabric rotate and Live 3D yaw/pitch/roll.
 * Flat mode uses `flatAngle` (Z rotation degrees). Live 3D uses yaw/pitch/roll.
 */

export const ORBIT_PRESETS = [
  { id: 'front', label: 'Front', flatAngle: 0, yaw: 0, pitch: 0, roll: 0 },
  { id: 'slight-left', label: 'Slight Left', flatAngle: -8, yaw: -18, pitch: -6, roll: 0 },
  { id: 'slight-right', label: 'Slight Right', flatAngle: 8, yaw: 18, pitch: -6, roll: 0 },
  { id: 'front-34', label: 'Front ¾', flatAngle: -18, yaw: -42, pitch: -12, roll: 0 },
  { id: 'hero-right', label: 'Hero Right', flatAngle: 16, yaw: 48, pitch: -10, roll: 2 },
  { id: 'lean-left', label: 'Lean Left', flatAngle: -12, yaw: -28, pitch: -18, roll: -4 },
  { id: 'lean-right', label: 'Lean Right', flatAngle: 12, yaw: 28, pitch: -18, roll: 4 },
  { id: 'tilt-up', label: 'Tilt Up', flatAngle: 0, yaw: 8, pitch: -28, roll: 0 },
];

export function getOrbitPreset(id) {
  return ORBIT_PRESETS.find((p) => p.id === id) || ORBIT_PRESETS[0];
}
