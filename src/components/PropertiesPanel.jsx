import { useEffect, useRef, useState } from 'react';
import { Type, Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Copy } from 'lucide-react';
import { Shadow } from 'fabric';
import ColorPicker from './ColorPicker';
import FontPicker from './FontPicker';
import ThemeSelector from './ThemeSelector';
import FrameSelector from './FrameSelector';
import GraphicPicker from './GraphicPicker';
import { DEFAULT_SCREENSHOT_STYLE } from '../utils/frameMeta';
import { addGraphicLayer, addShapeLayer, recolorGraphic } from '../utils/graphicLayers';
import { getGraphicBySrc } from '../utils/graphicsCatalog';
import {
  DEVICE_SCALE_MAX,
  DEVICE_SCALE_MIN,
  getDeviceDisplaySize,
  setDeviceAngle as applyDeviceAngle,
  setDeviceUniformScale,
} from '../utils/canvasEngine';

const FONT_SIZES = [20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 120, 140, 160, 180, 200, 220];
const WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra' },
];

const RIGHT_TABS = [
  { id: 'device', label: 'Device' },
  { id: 'graphics', label: 'Graphics' },
  { id: 'colors', label: 'Colors' },
  { id: 'design', label: 'Design' },
];

function Section({ title, children }) {
  return (
    <section className="space-y-2.5">
      {title ? (
        <h3 className="text-[10px] font-semibold text-glint-text-secondary uppercase tracking-wider">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}

function ColorField({ label, value, onChange, getCanvases }) {
  return <ColorPicker label={label} value={value} onChange={onChange} getCanvases={getCanvases} />;
}

/** Slider + numeric input that stay in sync (suffix e.g. `%` or `°`). */
function RangeRow({ label, value, min, max, suffix = '', onChange, onAdjustStart }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? String(value);

  const commit = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(Math.max(min, Math.min(max, Math.round(n))));
  };

  return (
    <label className="space-y-1 block">
      <span className="text-[10px] text-glint-text-tertiary">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : min}
          onPointerDown={() => onAdjustStart?.()}
          onChange={(e) => {
            setDraft(null);
            onChange(Number(e.target.value));
          }}
          className="flex-1 min-w-0 accent-glint-accent"
        />
        <span className="flex items-center gap-0.5 shrink-0">
          <input
            type="number"
            min={min}
            max={max}
            step={1}
            value={shown}
            onFocus={() => {
              onAdjustStart?.();
              setDraft(String(value));
            }}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft(raw);
              if (raw === '' || raw === '-' || raw === '+') return;
              commit(raw);
            }}
            onBlur={() => {
              if (draft != null && draft !== '' && draft !== '-' && draft !== '+') commit(draft);
              setDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="w-14 rounded-md border border-glint-border bg-glint-surface-2 px-1.5 py-1 text-[11px] tabular-nums text-right text-glint-text outline-none focus:border-glint-accent"
          />
          <span className="text-[11px] text-glint-text-secondary min-w-[0.75rem]">{suffix}</span>
        </span>
      </div>
    </label>
  );
}

/**
 * Right sidebar - tabbed Design tools (Device / Graphics / Colors / Design).
 */
export default function PropertiesPanel({
  canvas,
  getCanvases,
  background,
  onBackgroundChange,
  frame,
  onFrameChange,
  onFrameHighlight,
  screenshotStyle,
  onScreenshotStyleChange,
  fontFamily,
  onFontFamilyChange,
  onAddText,
  onDelete,
  store,
  templatePalette = [],
  onPaletteColorChange,
  onExtractThemeNow,
  canExtractTheme = false,
  onDeviceTransform,
  onDeviceScaleAdjustStart,
  onCopyToFrame,
  hasSelection = false,
  theme = 'dark',
}) {
  const [rightTab, setRightTab] = useState('device');
  const [selection, setSelection] = useState(null);
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;
  const [textProps, setTextProps] = useState({
    text: '',
    fontSize: 48,
    fill: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Space Grotesk',
    textAlign: 'center',
    shadowEnabled: false,
    shadowBlur: 8,
    shadowOffsetX: 4,
    shadowOffsetY: 4,
    shadowColor: '#000000',
  });
  const [shapeFill, setShapeFill] = useState('#FFFFFF');
  const [deviceScalePct, setDeviceScalePct] = useState(100);
  const [deviceAngleDeg, setDeviceAngleDeg] = useState(0);
  const [deviceSize, setDeviceSize] = useState({ width: 0, height: 0 });

  const syncDeviceSize = (obj) => {
    if (!obj || obj.glintRole !== 'framed-screenshot') return;
    const d = getDeviceDisplaySize(obj);
    setDeviceScalePct(d.scalePct);
    setDeviceSize({ width: d.width, height: d.height });
    setDeviceAngleDeg(Math.round(obj.angle || 0));
  };

  const handleDeviceScale = (pct) => {
    const obj = selection?.obj;
    if (!obj || !canvas) return;
    setDeviceScalePct(pct);
    setDeviceUniformScale(obj, pct / 100);
    syncDeviceSize(obj);
    onDeviceTransform?.();
  };

  const handleDeviceRotation = (deg) => {
    const obj = selection?.obj;
    if (!obj || !canvas) return;
    applyDeviceAngle(obj, deg);
    syncDeviceSize(obj);
    onDeviceTransform?.();
  };

  useEffect(() => {
    if (!canvas) return;

    const sync = () => {
      const obj = canvas.getActiveObject();
      if (!obj) {
        setSelection(null);
        return;
      }
      const role = obj.glintRole;
      const isText = role === 'text' || obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
      setSelection({ type: isText ? 'text' : role || obj.type, obj });

      if (role === 'framed-screenshot') {
        // Keep sidebar bezel picker in lockstep with the selected canvas device.
        onFrameHighlight?.(obj.glintFrameId ?? null);
        setRightTab('device');
        syncDeviceSize(obj);
      } else if (role === 'screenshot') {
        setRightTab('design');
      } else if (role === 'graphic') {
        setRightTab('graphics');
      } else if (isText) {
        setRightTab('design');
      } else if (typeof obj.fill === 'string') {
        setRightTab('design');
      }

      if (isText) {
        const sh = obj.shadow;
        setTextProps({
          text: obj.text || '',
          fontSize: Math.round(obj.fontSize || 48),
          fill: typeof obj.fill === 'string' ? obj.fill : '#FFFFFF',
          fontWeight: String(obj.fontWeight || '400'),
          fontFamily: (obj.fontFamily || 'Space Grotesk').replace(/,.*/, '').replace(/"/g, '').trim() || 'Space Grotesk',
          textAlign: obj.textAlign || 'center',
          shadowEnabled: !!(sh && (sh.blur > 0 || sh.offsetX || sh.offsetY)),
          shadowBlur: sh?.blur ?? 8,
          shadowOffsetX: sh?.offsetX ?? 4,
          shadowOffsetY: sh?.offsetY ?? 4,
          shadowColor: typeof sh?.color === 'string' ? sh.color : '#000000',
        });
      } else if (typeof obj.fill === 'string') {
        setShapeFill(obj.fill);
      }
    };

    canvas.on('selection:created', sync);
    canvas.on('selection:updated', sync);
    canvas.on('selection:cleared', () => setSelection(null));
    canvas.on('object:modified', (e) => {
      sync();
      if (e?.target?.glintRole === 'framed-screenshot') onDeviceTransform?.();
    });
    canvas.on('object:scaling', sync);
    canvas.on('text:changed', sync);

    return () => {
      canvas.off('selection:created', sync);
      canvas.off('selection:updated', sync);
      canvas.off('selection:cleared');
      canvas.off('object:modified');
      canvas.off('object:scaling', sync);
      canvas.off('text:changed', sync);
    };
  }, [canvas, onFrameHighlight, onDeviceTransform]);

  const applyToSelection = (patch) => {
    if (!canvas || !selection?.obj) return;
    const obj = selection.obj;
    const next = { ...textProps, ...patch };
    const {
      shadowEnabled,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
      shadowColor,
      ...fabricPatch
    } = patch;

    if (Object.keys(fabricPatch).length) {
      obj.set(fabricPatch);
      if (fabricPatch.fontFamily) obj.set('fontFamily', `${fabricPatch.fontFamily}, sans-serif`);
      if (fabricPatch.fill != null) setShapeFill(fabricPatch.fill);
    }

    if (
      shadowEnabled !== undefined
      || shadowBlur !== undefined
      || shadowOffsetX !== undefined
      || shadowOffsetY !== undefined
      || shadowColor !== undefined
    ) {
      if (next.shadowEnabled) {
        obj.set(
          'shadow',
          new Shadow({
            color: next.shadowColor || '#000000',
            blur: next.shadowBlur ?? 8,
            offsetX: next.shadowOffsetX ?? 0,
            offsetY: next.shadowOffsetY ?? 0,
          }),
        );
      } else {
        obj.set('shadow', null);
      }
    }

    obj.setCoords();
    canvas.requestRenderAll();
    setTextProps((p) => ({ ...p, ...patch }));
  };

  const isText = selection?.type === 'text';
  const isGraphic = selection?.obj?.glintRole === 'graphic' || selection?.type === 'graphic';
  const hasShapeFill =
    selection?.obj &&
    !isText &&
    !isGraphic &&
    typeof selection.obj.fill === 'string';
  const graphicFills = selection?.obj?.glintFills || { a: '#FF6B4A', b: '#FFD166', c: '#FFFFFF' };
  const style = { ...DEFAULT_SCREENSHOT_STYLE, ...screenshotStyle };

  const handleInsertGraphic = async (src) => {
    const c = canvasRef.current;
    if (!c) {
      console.warn('Glint: no active canvas to insert graphic');
      return;
    }
    const canvasW = c.getWidth?.() || 1080;
    const canvasH = c.getHeight?.() || 1920;
    const sx = canvasW / 1080;
    const sy = canvasH / 1920;
    const meta = getGraphicBySrc(src);
    const place = meta?.defaultPlacement || { left: 0, top: 0, width: 1080 };
    const fillColor = theme === 'dark' ? '#E8E6DF' : '#2A2A3A';
    try {
      const obj = await addGraphicLayer(c, {
        src,
        fill: fillColor,
        fill2: '#FFD166',
        fill3: '#FFFFFF',
        left: Math.round((place.left ?? 0) * sx),
        top: Math.round((place.top ?? 0) * sy),
        width: Math.round((place.width ?? 1080) * sx),
      }, { selectable: true });
      obj.set({ selectable: true, evented: true, hasControls: true, hasBorders: true });
      c.setActiveObject(obj);
      c.requestRenderAll();
    } catch (err) {
      console.error('Glint: failed to insert graphic', err);
    }
  };

  const handleGraphicFill = (slot, color) => {
    if (!canvas || !selection?.obj) return;
    recolorGraphic(selection.obj, { [slot]: color });
    canvas.requestRenderAll();
  };

  const handleInsertShape = (shape) => {
    const c = canvasRef.current;
    if (!c) return;
    const fillColor = theme === 'dark' ? '#E8E6DF' : '#2A2A3A';
    const obj = addShapeLayer(c, {
      shape: shape.shape,
      fill: fillColor,
      width: shape.width ?? 400,
      height: shape.height ?? 200,
      rx: shape.rx ?? 0,
      ry: shape.ry ?? shape.rx ?? 0,
      radius: 140,
      left: 340,
      top: 860,
    }, { selectable: true });
    obj.set({ selectable: true, evented: true, hasControls: true, hasBorders: true });
    c.setActiveObject(obj);
    c.requestRenderAll();
  };

  const patchStyle = (patch) => onScreenshotStyleChange?.(patch);

  const CField = ({ label, value, onChange }) => (
    <ColorField label={label} value={value} onChange={onChange} getCanvases={getCanvases} />
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-glint-border shrink-0">
        {RIGHT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRightTab(tab.id)}
            data-glint-agent={`tab-${tab.id}`}
            className={`flex-1 px-1 py-2.5 text-[11px] font-medium transition-colors ${
              rightTab === tab.id
                ? 'text-glint-accent border-b-2 border-glint-accent'
                : 'text-glint-text-secondary hover:text-glint-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={
          rightTab === 'graphics'
            ? 'flex-1 min-h-0 flex flex-col overflow-hidden p-3 gap-4'
            : 'flex-1 min-h-0 overflow-y-auto p-3 space-y-4 glint-scrollbar'
        }
      >
        {rightTab === 'device' && (
          <>
            <FrameSelector selected={frame} onChange={onFrameChange} store={store} />

            {selection?.type === 'framed-screenshot' ? (
              <Section title="Device size">
                <p className="text-[10px] text-glint-text-tertiary">
                  Drag corner or edge handles on the canvas. Width and height stay locked together.
                </p>
                <RangeRow
                  label="Scale"
                  value={deviceScalePct}
                  min={Math.round(DEVICE_SCALE_MIN * 100)}
                  max={Math.round(DEVICE_SCALE_MAX * 100)}
                  suffix="%"
                  onChange={handleDeviceScale}
                  onAdjustStart={onDeviceScaleAdjustStart}
                />
                <p className="text-[10px] text-glint-text-secondary tabular-nums">
                  {deviceSize.width} × {deviceSize.height} px
                </p>
                <RangeRow
                  label="Rotation"
                  value={deviceAngleDeg}
                  min={-180}
                  max={180}
                  suffix="°"
                  onChange={handleDeviceRotation}
                  onAdjustStart={onDeviceScaleAdjustStart}
                />
              </Section>
            ) : null}

            <Section>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-glint-text-secondary">Status bar</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!style.statusBarEnabled}
                  data-glint-agent="status-bar-toggle"
                  onClick={() => patchStyle({ statusBarEnabled: !style.statusBarEnabled })}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                    style.statusBarEnabled ? 'bg-glint-accent' : 'bg-glint-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      style.statusBarEnabled ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
              </div>
              {style.statusBarEnabled ? (
                <div className="flex gap-1.5">
                  {[
                    { id: 'light', label: 'Light' },
                    { id: 'dark', label: 'Dark' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      data-glint-agent={`status-bar-theme:${opt.id}`}
                      onClick={() => patchStyle({ statusBarTheme: opt.id })}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                        (style.statusBarTheme || 'dark') === opt.id
                          ? 'bg-glint-accent text-glint-text-on-accent'
                          : 'bg-glint-surface-2 text-glint-text-secondary hover:text-glint-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </Section>

            <Section title="Screenshot fit">
              <p className="text-[10px] text-glint-text-tertiary -mt-1">
                Control how the screenshot fills the device screen.
              </p>
              <div className="flex gap-1.5">
                {[
                  { id: 'cover', label: 'Cover' },
                  { id: 'contain', label: 'Contain' },
                  { id: 'custom', label: 'Custom' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchStyle({ fitMode: opt.id })}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                      (style.fitMode || 'contain') === opt.id
                        ? 'bg-glint-accent text-glint-text-on-accent'
                        : 'bg-glint-surface-2 text-glint-text-secondary hover:text-glint-text'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {style.fitMode === 'custom' && (
                <>
                  <RangeRow
                    label="Offset X"
                    value={style.fitOffsetX ?? 0}
                    min={-100}
                    max={100}
                    onChange={(v) => patchStyle({ fitOffsetX: v / 100 })}
                  />
                  <RangeRow
                    label="Offset Y"
                    value={style.fitOffsetY ?? 0}
                    min={-100}
                    max={100}
                    onChange={(v) => patchStyle({ fitOffsetY: v / 100 })}
                  />
                </>
              )}
              <p className="text-[9px] text-glint-text-tertiary">
                {style.fitMode === 'cover' && 'Crops to fill screen - no white bars'}
                {(style.fitMode || 'contain') === 'contain' && 'Shows full screenshot inside frame - no border crop'}
                {style.fitMode === 'custom' && 'Drag to choose which part is visible'}
              </p>
            </Section>
          </>
        )}

        {rightTab === 'graphics' && (
          <>
            <GraphicPicker onInsert={handleInsertGraphic} />
            {isGraphic && (
              <div className="shrink-0">
              <Section title="Selected graphic colors">
                <CField label="Fill A" value={graphicFills.a || '#FF6B4A'} onChange={(v) => handleGraphicFill('a', v)} />
                <CField label="Fill B" value={graphicFills.b || '#FFD166'} onChange={(v) => handleGraphicFill('b', v)} />
                <CField label="Fill C" value={graphicFills.c || '#FFFFFF'} onChange={(v) => handleGraphicFill('c', v)} />
                <label className="space-y-1 block">
                  <span className="text-[10px] text-glint-text-tertiary">Opacity</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((selection.obj.opacity ?? 1) * 100)}
                    onChange={(e) => {
                      selection.obj.set('opacity', Number(e.target.value) / 100);
                      canvas.requestRenderAll();
                    }}
                    className="w-full accent-glint-accent"
                  />
                </label>
              </Section>
              </div>
            )}
          </>
        )}

        {rightTab === 'colors' && (
          <div className="space-y-4">
            {templatePalette?.length > 0 ? (
              <Section title="From screenshots">
                <p className="text-[10px] text-glint-text-tertiary">
                  Finds the brand accent in your screenshots (not the biggest grey/white area),
                  then builds a matching palette for this template.
                </p>
                <button
                  type="button"
                  disabled={!canExtractTheme}
                  onClick={onExtractThemeNow}
                  className="w-full py-2 rounded-lg text-[11px] font-medium border border-glint-border text-glint-text-secondary hover:bg-glint-surface-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Extract theme
                </button>
              </Section>
            ) : null}
            {templatePalette?.length > 0 ? (
              <Section title="Template colors">
                <p className="text-[10px] text-glint-text-tertiary">
                  Brand colors for this pack. Background is the artboard behind the device.
                </p>
                <div className="space-y-2.5">
                  {templatePalette.map((slot) => (
                    <CField
                      key={slot.id}
                      label={slot.label}
                      value={slot.color}
                      onChange={(v) => onPaletteColorChange?.(slot.color, v)}
                    />
                  ))}
                </div>
              </Section>
            ) : (
              <Section title="Background">
                <ThemeSelector selected={background} onChange={onBackgroundChange} />
              </Section>
            )}
          </div>
        )}

        {rightTab === 'design' && (
          <>
            <Section title="Font">
              <FontPicker
                selected={isText ? textProps.fontFamily : fontFamily}
                onChange={(name) => {
                  onFontFamilyChange?.(name);
                  if (isText) applyToSelection({ fontFamily: name });
                }}
                label={null}
              />
            </Section>

            <Section title="Screenshot chrome">
              {selection?.type !== 'framed-screenshot' && (
                <>
                  <RangeRow
                    label="Corner radius"
                    value={style.cornerRadius ?? 0}
                    min={0}
                    max={80}
                    onChange={(v) => patchStyle({ cornerRadius: v })}
                  />
                  <RangeRow
                    label="Border width"
                    value={style.strokeWidth ?? 0}
                    min={0}
                    max={24}
                    suffix="px"
                    onChange={(v) => patchStyle({ strokeWidth: v })}
                  />
                  {(style.strokeWidth ?? 0) > 0 && (
                    <CField
                      label="Border color"
                      value={style.strokeColor}
                      onChange={(v) => patchStyle({ strokeColor: v })}
                    />
                  )}
                </>
              )}

              <label className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[10px] text-glint-text-tertiary">Drop shadow</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!style.shadowEnabled}
                  onClick={() => patchStyle({ shadowEnabled: !style.shadowEnabled })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    style.shadowEnabled ? 'bg-glint-accent' : 'bg-glint-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      style.shadowEnabled ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
              </label>

              {style.shadowEnabled && (
                <>
                  <RangeRow
                    label="Blur"
                    value={style.shadowBlur ?? 0}
                    min={0}
                    max={80}
                    onChange={(v) => patchStyle({ shadowBlur: v })}
                  />
                  <RangeRow
                    label="Offset Y"
                    value={style.shadowOffsetY ?? 0}
                    min={0}
                    max={60}
                    onChange={(v) => patchStyle({ shadowOffsetY: v })}
                  />
                  <RangeRow
                    label="Offset X"
                    value={style.shadowOffsetX ?? 0}
                    min={-40}
                    max={40}
                    onChange={(v) => patchStyle({ shadowOffsetX: v })}
                  />
                  <RangeRow
                    label="Opacity"
                    value={Math.round((style.shadowOpacity ?? 0.4) * 100)}
                    min={5}
                    max={90}
                    suffix="%"
                    onChange={(v) => patchStyle({ shadowOpacity: v / 100 })}
                  />
                  <CField
                    label="Shadow color"
                    value={style.shadowColor || '#000000'}
                    onChange={(v) => patchStyle({ shadowColor: v })}
                  />
                </>
              )}
            </Section>

            {(hasShapeFill || isGraphic) && (
              <Section title="Selected fill">
                {hasShapeFill && (
                  <CField
                    label="Fill"
                    value={shapeFill}
                    onChange={(v) => applyToSelection({ fill: v })}
                  />
                )}
                {isGraphic && (
                  <>
                    <CField label="Fill A" value={graphicFills.a || '#FF6B4A'} onChange={(v) => handleGraphicFill('a', v)} />
                    <CField label="Fill B" value={graphicFills.b || '#FFD166'} onChange={(v) => handleGraphicFill('b', v)} />
                    <CField label="Fill C" value={graphicFills.c || '#FFFFFF'} onChange={(v) => handleGraphicFill('c', v)} />
                  </>
                )}
              </Section>
            )}

            <Section title="Insert">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={onAddText}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-glint-accent text-glint-text-on-accent text-xs font-semibold hover:bg-glint-accent-hover"
                >
                  <Type size={14} /> Text
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={!selection}
                  className="px-2.5 py-2 rounded-lg border border-glint-border text-glint-text-secondary hover:text-glint-danger hover:bg-glint-surface-2 disabled:opacity-40"
                  title="Delete selected (Del)"
                >
                  <Trash2 size={14} />
                </button>
                {hasSelection && (
                  <button
                    type="button"
                    onClick={onCopyToFrame}
                    className="px-2.5 py-2 rounded-lg border border-glint-border text-glint-text-secondary hover:text-glint-accent hover:bg-glint-surface-2"
                    title="Copy or move to another frame"
                  >
                    <Copy size={14} />
                  </button>
                )}
              </div>
            </Section>

            {isText && (
              <Section title="Typography">
                <textarea
                  value={textProps.text}
                  onChange={(e) => applyToSelection({ text: e.target.value })}
                  rows={3}
                  placeholder="Headline or caption"
                  className="w-full px-2.5 py-2 border border-glint-border rounded-lg text-xs bg-glint-surface text-glint-text resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] text-glint-text-tertiary">Size</span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={8}
                        max={320}
                        value={textProps.fontSize}
                        onChange={(e) => applyToSelection({ fontSize: Number(e.target.value) || 8 })}
                        className="w-16 px-1.5 py-1.5 border border-glint-border rounded-lg text-xs bg-glint-surface text-glint-text tabular-nums"
                      />
                      <select
                        value={FONT_SIZES.includes(textProps.fontSize) ? textProps.fontSize : ''}
                        onChange={(e) => applyToSelection({ fontSize: Number(e.target.value) })}
                        className="flex-1 min-w-0 px-1.5 py-1.5 border border-glint-border rounded-lg text-xs bg-glint-surface text-glint-text"
                      >
                        {!FONT_SIZES.includes(textProps.fontSize) && (
                          <option value="">Custom</option>
                        )}
                        {FONT_SIZES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-glint-text-tertiary">Weight</span>
                    <select
                      value={textProps.fontWeight}
                      onChange={(e) => applyToSelection({ fontWeight: e.target.value })}
                      className="w-full px-2 py-1.5 border border-glint-border rounded-lg text-xs bg-glint-surface text-glint-text"
                    >
                      {WEIGHTS.map((w) => (
                        <option key={w.value} value={w.value}>{w.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <CField
                  label="Fill"
                  value={textProps.fill}
                  onChange={(v) => applyToSelection({ fill: v })}
                />
                <div className="flex gap-1">
                  {[
                    { id: 'left', Icon: AlignLeft },
                    { id: 'center', Icon: AlignCenter },
                    { id: 'right', Icon: AlignRight },
                  ].map(({ id, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyToSelection({
                        textAlign: id,
                        originX: id === 'left' ? 'left' : id === 'right' ? 'right' : 'center',
                      })}
                      className={`flex-1 flex justify-center py-1.5 rounded-lg border transition-colors ${
                        textProps.textAlign === id
                          ? 'border-glint-accent bg-glint-accent-muted text-glint-accent'
                          : 'border-glint-border text-glint-text-secondary hover:bg-glint-surface-2'
                      }`}
                    >
                      <Icon size={14} />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => applyToSelection({
                      fontWeight: textProps.fontWeight === '700' || textProps.fontWeight === 'bold' ? '400' : '700',
                    })}
                    className={`flex-1 flex justify-center py-1.5 rounded-lg border transition-colors ${
                      textProps.fontWeight === '700' || textProps.fontWeight === 'bold'
                        ? 'border-glint-accent bg-glint-accent-muted text-glint-accent'
                        : 'border-glint-border text-glint-text-secondary hover:bg-glint-surface-2'
                    }`}
                  >
                    <Bold size={14} />
                  </button>
                </div>
                <label className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-[10px] text-glint-text-tertiary">Text shadow</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!textProps.shadowEnabled}
                    onClick={() => applyToSelection({ shadowEnabled: !textProps.shadowEnabled })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      textProps.shadowEnabled ? 'bg-glint-accent' : 'bg-glint-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        textProps.shadowEnabled ? 'translate-x-4' : ''
                      }`}
                    />
                  </button>
                </label>
                {textProps.shadowEnabled && (
                  <>
                    <RangeRow
                      label="Blur"
                      value={textProps.shadowBlur ?? 0}
                      min={0}
                      max={40}
                      onChange={(v) => applyToSelection({ shadowBlur: v })}
                    />
                    <RangeRow
                      label="Offset X"
                      value={textProps.shadowOffsetX ?? 0}
                      min={-30}
                      max={30}
                      onChange={(v) => applyToSelection({ shadowOffsetX: v })}
                    />
                    <RangeRow
                      label="Offset Y"
                      value={textProps.shadowOffsetY ?? 0}
                      min={-30}
                      max={30}
                      onChange={(v) => applyToSelection({ shadowOffsetY: v })}
                    />
                    <CField
                      label="Shadow color"
                      value={textProps.shadowColor || '#000000'}
                      onChange={(v) => applyToSelection({ shadowColor: v })}
                    />
                  </>
                )}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
