import { useMemo, useState } from 'react';
import { BACKGROUND_THEMES, COLOR_PALETTES } from '../utils/backgroundPresets';
import { brandKitAsPresets, loadBrandKit, saveBrandKit } from '../utils/brandKit';

function getSwatchStyle(theme) {
  if (theme.type === 'gradient') {
    const stops = theme.value.map((s) => `${s.color} ${s.offset * 100}%`).join(', ');
    return { background: `linear-gradient(180deg, ${stops})` };
  }
  return { background: theme.value };
}

function isSelected(selected, theme) {
  if (!selected) return false;
  if (selected.label && theme.label) return selected.label === theme.label;
  if (selected.type === 'solid' && theme.type === 'solid') return selected.value === theme.value;
  return false;
}

/**
 * @param {(theme: object) => void} onChange - background theme
 * @param {(colors: string[]) => void} [onPaletteApply] - optional remap Primary/Secondary/Accent
 */
export default function ThemeSelector({ selected, onChange, onPaletteApply }) {
  const [mode, setMode] = useState('bg'); // bg | palettes | brand
  const [brand, setBrand] = useState(() => loadBrandKit());

  const customColor =
    selected?.type === 'solid' &&
    !BACKGROUND_THEMES.some((t) => t.type === 'solid' && t.value === selected.value)
      ? selected.value
      : brand.primary;

  const brandSwatches = useMemo(() => brandKitAsPresets(brand), [brand]);

  const patchBrand = (key, color) => {
    const next = saveBrandKit({ ...brand, [key]: color });
    setBrand(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 border-b border-glint-border pb-1">
        {[
          { id: 'bg', label: 'Background' },
          { id: 'palettes', label: 'Palettes' },
          { id: 'brand', label: 'Brand' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`px-2 py-1 text-[10px] font-medium rounded ${
              mode === t.id
                ? 'bg-glint-accent/15 text-glint-accent'
                : 'text-glint-text-secondary hover:text-glint-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'bg' && (
        <>
          <p className="text-[10px] text-glint-text-tertiary">
            Background for the active store frame.
          </p>
          <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto glint-scrollbar pr-0.5">
            {BACKGROUND_THEMES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => onChange(t)}
                title={t.label}
                className={`group relative rounded-lg overflow-hidden border-2 transition-all aspect-square ${
                  isSelected(selected, t)
                    ? 'border-glint-accent ring-2 ring-glint-accent/30'
                    : 'border-glint-border hover:border-glint-border-strong'
                }`}
              >
                <div className="w-full h-full" style={getSwatchStyle(t)} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <label className="text-[10px] text-glint-text-secondary shrink-0">Custom</label>
            <input
              type="color"
              value={selected?.type === 'solid' ? selected.value : customColor}
              onChange={(e) => onChange({ label: 'Custom', type: 'solid', value: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border border-glint-border bg-transparent p-0"
            />
            <input
              type="text"
              value={selected?.type === 'solid' ? selected.value : ''}
              placeholder="#1C1C1E"
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                  onChange({ label: 'Custom', type: 'solid', value: v });
                }
              }}
              className="flex-1 px-2 py-1.5 border border-glint-border rounded-lg text-[11px] font-mono bg-glint-surface text-glint-text"
            />
          </div>
        </>
      )}

      {mode === 'palettes' && (
        <>
          <p className="text-[10px] text-glint-text-tertiary">
            Apply a curated set as brand Primary / Secondary / Accent.
          </p>
          <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto glint-scrollbar">
            {COLOR_PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                onClick={() => {
                  const next = saveBrandKit({
                    primary: p.colors[0],
                    secondary: p.colors[1],
                    accent: p.colors[2],
                  });
                  setBrand(next);
                  onPaletteApply?.(p.colors);
                }}
                className="flex items-center gap-2 rounded-lg border border-glint-border px-2 py-1.5 hover:border-glint-accent text-left"
              >
                <div className="flex -space-x-1 shrink-0">
                  {p.colors.map((c) => (
                    <span
                      key={c}
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-glint-text truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {mode === 'brand' && (
        <>
          <p className="text-[10px] text-glint-text-tertiary">
            Saved on this device. Color pickers show these first.
          </p>
          {brandSwatches.map((slot) => (
            <div key={slot.id} className="flex items-center gap-2">
              <span className="text-[10px] text-glint-text-secondary w-16 shrink-0">{slot.label}</span>
              <input
                type="color"
                value={slot.color}
                onChange={(e) => patchBrand(slot.id, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-glint-border bg-transparent p-0"
              />
              <input
                type="text"
                value={slot.color}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(v)) patchBrand(slot.id, v);
                }}
                className="flex-1 px-2 py-1 border border-glint-border rounded text-[11px] font-mono bg-glint-surface text-glint-text"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ label: 'Primary', type: 'solid', value: brand.primary })}
            className="w-full mt-1 py-1.5 text-[10px] rounded-lg border border-glint-border text-glint-text-secondary hover:border-glint-accent hover:text-glint-accent"
          >
            Use Primary as frame background
          </button>
        </>
      )}
    </div>
  );
}
