import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Languages, Plus, Search, Sparkles, Upload, X, Check } from 'lucide-react';
import {
  BASE_LOCALE,
  STORE_LOCALES,
  captionFor,
  getLocale,
  isRtl,
  parseSheet,
  resolveLocaleId,
  setLocaleText,
  textObjects,
  toCsv,
} from '../utils/locales';

const THUMB_W = 132;

function thumbOf(canvas) {
  const vpt = canvas.viewportTransform?.slice?.() || [1, 0, 0, 1, 0, 0];
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  try {
    return canvas.toDataURL({ format: 'png', multiplier: THUMB_W / (canvas.getWidth() || 1080) });
  } finally {
    canvas.setViewportTransform(vpt);
    canvas.requestRenderAll();
  }
}

function aiPrompt(pairCode, targets) {
  return [
    `Use the Glint MCP tools on board ${pairCode}.`,
    '1. Call glint_editor_state and read every frames[].texts[] caption (English is en-US).',
    `2. Translate each caption into: ${targets.join(', ')}. Keep them short, punchy app-store captions; keep line breaks, emoji and brand names.`,
    '3. Call glint_editor_dispatch with op "setLocaleText" and args { items: [{ locale, frameIndex, textIndex, text }, ...] } (one call per language is fine).',
    '4. Skip cells that already have a translation unless asked to redo them.',
  ].join('\n');
}

/** One sheet cell: saves on every keystroke (frames update live), follows outside edits when not focused. */
function Cell({ value, loc, placeholder, label, onCommit }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  return (
    <textarea
      value={draft}
      dir={isRtl(loc) ? 'rtl' : 'ltr'}
      lang={loc}
      rows={Math.min(4, Math.max(2, draft.split('\n').length))}
      placeholder={placeholder}
      aria-label={label}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setDraft(value); }}
      onChange={(e) => { setDraft(e.target.value); onCommit(e.target.value); }}
      className={`w-full resize-none rounded-md px-2 py-1.5 text-[13px] leading-snug bg-transparent text-glint-text border outline-none transition-colors placeholder:text-glint-text-tertiary/60 focus:bg-glint-bg focus:border-glint-accent focus:ring-2 focus:ring-glint-accent/20 ${
        !draft && loc !== BASE_LOCALE ? 'border-dashed border-amber-400/50 bg-amber-400/5' : 'border-transparent hover:border-glint-border'
      }`}
    />
  );
}

/**
 * Captions × languages sheet: add languages, type or import translations, hand off to AI, preview.
 */
export default function TranslationsModal({
  open,
  onClose,
  frames,
  getCanvas,
  locales,
  activeLocale,
  onAddLocales,
  onRemoveLocale,
  onPreview,
  onEdited,
  copilot,
  refreshKey,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [thumbs, setThumbs] = useState([]);
  const fileRef = useRef(null);

  const rows = frames.flatMap((f, frameIndex) => {
    const canvas = getCanvas(f.id);
    return textObjects(canvas).map((obj, textIndex) => ({ canvas, obj, frameIndex, textIndex }));
  });
  const others = locales.filter((l) => l !== BASE_LOCALE);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (pickerOpen) setPickerOpen(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pickerOpen, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => {
      setThumbs(frames.map((f) => {
        const c = getCanvas(f.id);
        return c ? thumbOf(c) : null;
      }));
    });
    return () => cancelAnimationFrame(id);
  }, [open, activeLocale, refreshKey, frames, getCanvas]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STORE_LOCALES;
    return STORE_LOCALES.filter((l) =>
      [l.id, l.label, l.native, l.ios, l.play].some((s) => s.toLowerCase().includes(q)));
  }, [query]);

  if (!open) return null;

  const filled = (loc) => rows.filter((r) => captionFor(r.obj, loc).trim()).length;

  const commit = (row, loc, text) => {
    if (text === captionFor(row.obj, loc)) return;
    setLocaleText(row.canvas, row.obj, loc, text);
    onEdited();
  };

  const toggleLocale = (id) => {
    if (id === BASE_LOCALE) return;
    if (!locales.includes(id)) return onAddLocales([id]);
    if (filled(id) && !window.confirm(`Remove ${getLocale(id)?.label || id} and its ${filled(id)} translation(s)?`)) return;
    onRemoveLocale(id);
  };

  const downloadSheet = () => {
    const sheet = [
      ['frame', 'layer', ...locales],
      ...rows.map((r) => [r.frameIndex + 1, r.textIndex + 1, ...locales.map((l) => captionFor(r.obj, l))]),
    ];
    const url = URL.createObjectURL(new Blob([toCsv(sheet)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'glint-translations.csv' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importSheet = async (file) => {
    if (!file) return;
    const [header = [], ...body] = parseSheet(await file.text());
    const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name);
    const fCol = col('frame');
    const lCol = col('layer');
    const langCols = header
      .map((h, i) => ({ i, loc: i === fCol || i === lCol ? null : resolveLocaleId(h) }))
      .filter((c) => c.loc);
    if (!langCols.length) {
      setNotice('No language columns found. Use headers like en-US, de-DE, ja.');
      return;
    }
    let cells = 0;
    body.forEach((line, n) => {
      const row = fCol >= 0 && lCol >= 0
        ? rows.find((r) => r.frameIndex + 1 === Number(line[fCol]) && r.textIndex + 1 === Number(line[lCol]))
        : rows[n];
      if (!row) return;
      for (const { i, loc } of langCols) {
        const text = (line[i] || '').trim();
        if (!text) continue;
        setLocaleText(row.canvas, row.obj, loc, text);
        cells++;
      }
    });
    onAddLocales(langCols.map((c) => c.loc));
    onEdited();
    setNotice(`Imported ${cells} caption(s) across ${new Set(langCols.map((c) => c.loc)).size} language(s).`);
  };

  const askAi = async () => {
    const targets = others;
    if (!targets.length) {
      setPickerOpen(true);
      setNotice('Add at least one language first, then ask AI to translate.');
      return;
    }
    if (!copilot?.enabled) copilot?.enable?.();
    else if (copilot.paused) copilot.resume?.();
    const code = copilot?.session?.pairCode;
    if (!code) {
      setNotice('Could not start the agent session. Turn on "Allow agent" in the Copilot bar, then try again.');
      return;
    }
    try {
      await navigator.clipboard.writeText(aiPrompt(code, targets));
      setNotice(`Prompt copied for board ${code}. Paste it into your AI agent (Cursor, Claude…) with Glint MCP; captions fill in here live.`);
    } catch {
      setNotice(`Board ${code}: ask your agent to translate captions into ${targets.join(', ')} with setLocaleText.`);
    }
  };

  const localeHeader = (loc) => {
    const meta = getLocale(loc);
    const done = filled(loc);
    const complete = rows.length > 0 && done === rows.length;
    return (
      <th key={loc} scope="col" className="sticky top-0 z-10 bg-glint-surface-2 border-b border-glint-border px-3 py-2 text-left align-top min-w-[220px]">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-glint-text truncate">{meta?.label || loc}</span>
          {loc === BASE_LOCALE && (
            <span className="px-1.5 py-0.5 rounded bg-glint-accent/15 text-glint-accent text-[9px] font-bold uppercase">Base</span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onPreview(loc)}
              title={`Preview frames in ${meta?.label || loc}`}
              aria-pressed={activeLocale === loc}
              className={`p-1 rounded-md ${activeLocale === loc ? 'bg-glint-accent text-glint-text-on-accent' : 'text-glint-text-tertiary hover:text-glint-text hover:bg-glint-surface'}`}
            >
              <Eye size={13} />
            </button>
            {loc !== BASE_LOCALE && (
              <button
                type="button"
                onClick={() => toggleLocale(loc)}
                title="Remove language"
                aria-label={`Remove ${meta?.label || loc}`}
                className="p-1 rounded-md text-glint-text-tertiary hover:text-glint-danger hover:bg-glint-surface"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] font-mono text-glint-text-tertiary">{loc}</span>
          <div className="flex-1 h-1 rounded-full bg-glint-border overflow-hidden">
            <div
              className={`h-full ${complete ? 'bg-glint-success' : 'bg-glint-accent'}`}
              style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-glint-text-tertiary">{done}/{rows.length}</span>
        </div>
      </th>
    );
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="glint-i18n-title"
        className="relative w-full max-w-6xl h-[88vh] flex flex-col rounded-2xl border border-glint-border bg-glint-surface shadow-2xl overflow-hidden"
      >
        <header className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-b border-glint-border">
          <Languages size={18} className="text-glint-accent" />
          <div className="mr-auto">
            <h2 id="glint-i18n-title" className="text-base font-semibold text-glint-text">Translations</h2>
            <p className="text-[11px] text-glint-text-tertiary">
              {rows.length} caption(s) · {locales.length} language(s) · write English first, then fill each language
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              aria-expanded={pickerOpen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold glint-btn-primary"
            >
              <Plus size={14} /> Add languages
            </button>
            {pickerOpen && (
              <div className="absolute right-0 top-full mt-2 z-30 w-80 rounded-xl border border-glint-border bg-glint-surface shadow-2xl">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-glint-border">
                  <Search size={14} className="text-glint-text-tertiary" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search: German, 日本語, pt-BR…"
                    aria-label="Search languages"
                    className="flex-1 bg-transparent text-sm text-glint-text outline-none placeholder:text-glint-text-tertiary"
                  />
                </div>
                <ul className="max-h-80 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
                  {matches.map((l) => {
                    const on = locales.includes(l.id);
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={on}
                          disabled={l.id === BASE_LOCALE}
                          onClick={() => toggleLocale(l.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-glint-surface-2 disabled:opacity-60"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-glint-accent border-glint-accent text-glint-text-on-accent' : 'border-glint-border-strong'}`}>
                            {on && <Check size={11} strokeWidth={3} />}
                          </span>
                          <span className="text-sm text-glint-text">{l.label}</span>
                          <span className="text-xs text-glint-text-tertiary truncate">{l.native}</span>
                          <span className="ml-auto text-[10px] font-mono text-glint-text-tertiary">{l.id}</span>
                        </button>
                      </li>
                    );
                  })}
                  {!matches.length && <li className="px-3 py-3 text-xs text-glint-text-tertiary">No match</li>}
                </ul>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Import a CSV / TSV sheet (headers: frame, layer, en-US, de-DE, …)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-glint-border-strong text-glint-text hover:bg-glint-surface-2"
          >
            <Upload size={14} /> Import sheet
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            className="hidden"
            onChange={(e) => { importSheet(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={downloadSheet}
            title="Download as CSV (opens in Excel / Google Sheets)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-glint-border-strong text-glint-text hover:bg-glint-surface-2"
          >
            <Download size={14} /> Download sheet
          </button>
          <button
            type="button"
            onClick={askAi}
            title="Copy a prompt for your AI agent (Glint MCP) to translate every caption"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-glint-accent/50 text-glint-accent hover:bg-glint-accent/10"
          >
            <Sparkles size={14} /> Translate with AI
          </button>
          <button type="button" onClick={onClose} aria-label="Close translations" className="p-1.5 rounded-md text-glint-text-secondary hover:bg-glint-surface-2">
            <X size={16} />
          </button>
        </header>

        {notice && (
          <div role="status" className="flex items-center gap-2 px-5 py-2 text-xs bg-glint-accent/10 text-glint-text border-b border-glint-border">
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss" className="text-glint-text-tertiary hover:text-glint-text"><X size={12} /></button>
          </div>
        )}

        <div className="px-5 py-3 border-b border-glint-border bg-glint-bg/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-glint-text-tertiary">Preview</span>
            <div className="flex flex-wrap gap-1">
              {locales.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onPreview(l)}
                  aria-pressed={activeLocale === l}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${activeLocale === l ? 'bg-glint-accent border-glint-accent text-glint-text-on-accent' : 'border-glint-border text-glint-text-secondary hover:bg-glint-surface-2'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {thumbs.map((src, i) => (src ? (
              <img
                key={i}
                src={src}
                alt={`Frame ${i + 1} in ${activeLocale}`}
                style={{ width: THUMB_W * 0.75 }}
                className="shrink-0 rounded-md border border-glint-border shadow-sm"
              />
            ) : null))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-8">
              <Languages size={28} className="text-glint-text-tertiary" />
              <p className="text-sm text-glint-text">No captions yet</p>
              <p className="text-xs text-glint-text-tertiary max-w-sm">Add text to your frames in English first; each text layer becomes a row here.</p>
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky top-0 left-0 z-20 bg-glint-surface-2 border-b border-r border-glint-border px-3 py-2 text-left text-[10px] uppercase tracking-wider text-glint-text-tertiary w-28">
                    Caption
                  </th>
                  {locales.map(localeHeader)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, n) => {
                  const base = captionFor(row.obj, BASE_LOCALE);
                  return (
                    <tr key={`${row.frameIndex}:${row.textIndex}`} className={n % 2 ? 'bg-glint-bg/30' : ''}>
                      <th scope="row" className="sticky left-0 z-10 bg-glint-surface border-b border-r border-glint-border px-3 py-2 text-left align-top">
                        <div className="text-xs font-semibold text-glint-text">Frame {row.frameIndex + 1}</div>
                        <div className="text-[10px] text-glint-text-tertiary">Text {row.textIndex + 1}</div>
                      </th>
                      {locales.map((loc) => {
                        const value = captionFor(row.obj, loc);
                        const long = loc !== BASE_LOCALE && value && base && value.length > base.length * 1.5;
                        return (
                          <td key={loc} className="border-b border-glint-border p-1 align-top">
                            <Cell
                              value={value}
                              loc={loc}
                              placeholder={loc === BASE_LOCALE ? 'English caption' : base}
                              label={`Frame ${row.frameIndex + 1} text ${row.textIndex + 1}, ${getLocale(loc)?.label || loc}`}
                              onCommit={(text) => commit(row, loc, text)}
                            />
                            {long && (
                              <p className="px-2 text-[10px] text-amber-500">Much longer than English; it will auto-shrink to fit.</p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="px-5 py-2 border-t border-glint-border text-[10px] text-glint-text-tertiary flex flex-wrap gap-x-4">
          <span>Empty cells fall back to English.</span>
          <span>Edits save as you type.</span>
          <span>Export → pick languages → PNG or Fastlane ZIP.</span>
        </footer>
      </div>
    </div>
  );
}
