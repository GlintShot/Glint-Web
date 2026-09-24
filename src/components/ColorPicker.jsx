import { useMemo, useState } from 'react';
import { Pipette } from 'lucide-react';
import { openCanvasEyedropper } from '../utils/eyedropper';
import { brandKitAsPresets, loadBrandKit } from '../utils/brandKit';

/** Figma-like presets for fills, text, and strokes. */
export const COLOR_PRESETS = [
  '#FFFFFF', '#F5F5F7', '#E8E8ED', '#1C1C1E', '#0B0D10', '#000000',
  '#FF3B30', '#FF6B4A', '#FF9F0A', '#FFD60A', '#34C759', '#32ADE6',
  '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#8E8E93', '#636366',
];

function toHex(value) {
  if (!value || typeof value !== 'string') return '#FFFFFF';
  if (value.startsWith('#') && value.length === 7) return value.toUpperCase();
  if (value.startsWith('#') && value.length === 4) {
    const r = value[1], g = value[2], b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return '#FFFFFF';
}

/**
 * Figma-style color control: presets, hex, native picker, canvas eyedropper.
 * @param {() => any[]} [getCanvases] - live Fabric canvases to sample from
 */
export default function ColorPicker({ label, value, onChange, getCanvases }) {
  const hex = toHex(value);
  const [picking, setPicking] = useState(false);
  const inputId = `glint-color-${String(label || 'color').replace(/\s+/g, '-')}`;
  const brandPresets = useMemo(() => brandKitAsPresets(loadBrandKit()), [picking, value]);

  const pickColor = async () => {
    setPicking(true);
    try {
      // Prefer sampling the editor board (screenshots + frames) like Figma.
      if (typeof getCanvases === 'function') {
        const hexPick = await openCanvasEyedropper({ getCanvases });
        if (hexPick) onChange(hexPick);
        return;
      }
      if (typeof window !== 'undefined' && window.EyeDropper) {
        try {
          const result = await new window.EyeDropper().open();
          if (result?.sRGBHex) onChange(result.sRGBHex.toUpperCase());
        } catch {
          /* cancelled */
        }
        return;
      }
      document.getElementById(inputId)?.click();
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && <span className="text-[10px] text-glint-text-tertiary">{label}</span>}
      <div className="flex items-center gap-1.5">
        <input
          id={inputId}
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-8 h-8 rounded cursor-pointer border border-glint-border bg-transparent p-0 shrink-0"
          title="Color picker"
        />
        <input
          type="text"
          value={value || hex}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v.toUpperCase());
            else onChange(v);
          }}
          className="flex-1 px-2 py-1.5 border border-glint-border rounded-lg text-[11px] font-mono bg-glint-surface text-glint-text"
        />
        <button
          type="button"
          onClick={pickColor}
          disabled={picking}
          title="Eyedropper - move over the canvas and click a color"
          className={`p-1.5 rounded-lg border border-glint-border text-glint-text-secondary hover:text-glint-accent hover:border-glint-accent disabled:opacity-50 ${picking ? 'border-glint-accent text-glint-accent' : ''}`}
        >
          <Pipette size={14} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {brandPresets.map((b) => (
          <button
            key={b.id}
            type="button"
            title={`${b.label} ${b.color}`}
            onClick={() => onChange(b.color)}
            className={`w-4 h-4 rounded-full border ${hex.toUpperCase() === b.color ? 'border-glint-accent ring-1 ring-glint-accent' : 'border-black/20'}`}
            style={{ background: b.color }}
          />
        ))}
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            className={`w-4 h-4 rounded-sm border ${hex.toUpperCase() === c ? 'border-glint-accent ring-1 ring-glint-accent' : 'border-black/20'}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
