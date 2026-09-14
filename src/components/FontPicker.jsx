import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronDown, Loader2, Plus, Search } from 'lucide-react';
import {
  POPULAR_FONTS,
  ensureFontReady,
  addCustomFont,
  listCustomFonts,
  isCustomFont,
  isGoogleFontLoaded,
  fetchGoogleFontCatalog,
  searchGoogleFonts,
} from '../utils/fontLibrary';

function FontRow({ name, selected, onPick, preview = false, loading = false }) {
  const [ready, setReady] = useState(() => isCustomFont(name) || isGoogleFontLoaded(name));

  useEffect(() => {
    if (!preview || isCustomFont(name)) return;
    let cancelled = false;
    ensureFontReady(name, '400').then(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [name, preview]);

  const showFace = preview && ready && !loading;

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => onPick(name)}
      className={`w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg text-[13px] transition-colors truncate disabled:opacity-60 ${
        selected === name
          ? 'bg-glint-accent-muted text-glint-accent font-medium'
          : 'text-glint-text hover:bg-glint-surface-2'
      }`}
    >
      {loading && <Loader2 size={12} className="shrink-0 animate-spin" />}
      {showFace && (
        <span
          className="shrink-0 text-lg leading-none text-glint-text-secondary select-none"
          style={{ fontFamily: `"${name}", sans-serif` }}
        >
          Aa
        </span>
      )}
      <span className="truncate">{name}</span>
    </button>
  );
}

function mergeFontLists(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const f of list) {
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      out.push(f);
    }
  }
  return out;
}

export default function FontPicker({ selected, onChange, label = 'Font' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customFonts, setCustomFonts] = useState([]);
  const [googleCatalog, setGoogleCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [applying, setApplying] = useState(null);
  const [uploading, setUploading] = useState(false);
  const rootRef = useRef(null);
  const fileRef = useRef(null);
  const searchRef = useRef(null);

  const refreshCustom = useCallback(async () => {
    setCustomFonts(await listCustomFonts());
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(false);
    try {
      const list = await fetchGoogleFontCatalog();
      setGoogleCatalog(list);
      return list;
    } catch {
      setCatalogError(true);
      return null;
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCustom();
    loadCatalog();
  }, [refreshCustom, loadCatalog]);

  useEffect(() => {
    if (selected) ensureFontReady(selected, '400');
  }, [selected]);

  useEffect(() => {
    if (open) loadCatalog();
  }, [open, loadCatalog]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      clearTimeout(t);
    };
  }, [open]);

  const q = search.trim();
  const qLower = q.toLowerCase();
  const filteredCustom = customFonts.filter((f) => f.name.toLowerCase().includes(qLower));
  const isSearching = q.length > 0;

  const listFonts = useMemo(() => {
    if (isSearching) {
      if (!googleCatalog) return filteredCustom;
      return mergeFontLists(filteredCustom, searchGoogleFonts(googleCatalog, q));
    }
    return mergeFontLists(filteredCustom, POPULAR_FONTS);
  }, [isSearching, q, filteredCustom, googleCatalog]);

  const pick = async (name) => {
    setApplying(name);
    try {
      await ensureFontReady(name, '400');
      onChange(name);
      setOpen(false);
      setSearch('');
    } finally {
      setApplying(null);
    }
  };

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { name } = await addCustomFont(file);
        await refreshCustom();
        await pick(name);
      }
    } finally {
      setUploading(false);
    }
  };

  const current = selected || 'Space Grotesk';
  const showCatalogLoading = isSearching && catalogLoading && !googleCatalog;
  const showEmpty = !showCatalogLoading && listFonts.length === 0;

  return (
    <div className="space-y-1.5" ref={rootRef}>
      {label && (
        <span className="text-[10px] text-glint-text-tertiary">{label}</span>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-glint-surface text-sm text-glint-text transition-colors ${
            open ? 'border-glint-accent ring-1 ring-glint-accent/30' : 'border-glint-border hover:border-glint-border-strong'
          }`}
        >
          <span
            className="shrink-0 text-lg leading-none text-glint-text-secondary select-none"
            style={{ fontFamily: `"${current}", sans-serif` }}
          >
            Aa
          </span>
          <span className="flex-1 text-left truncate" style={{ fontFamily: `"${current}", sans-serif` }}>
            {current}
          </span>
          {applying && <Loader2 size={14} className="shrink-0 animate-spin text-glint-text-tertiary" />}
          <ChevronDown
            size={14}
            className={`shrink-0 text-glint-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 rounded-xl border border-glint-border bg-glint-surface shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-glint-border bg-glint-surface-2/50">
              <Search size={14} className="shrink-0 text-glint-text-tertiary" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search fonts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-xs text-glint-text placeholder:text-glint-text-tertiary outline-none"
              />
              {catalogLoading && (
                <Loader2 size={14} className="shrink-0 animate-spin text-glint-text-tertiary" />
              )}
            </div>

            <div className="max-h-56 overflow-y-auto p-1.5 glint-scrollbar">
              {showCatalogLoading ? (
                <div className="flex items-center justify-center gap-2 px-2 py-8 text-xs text-glint-text-tertiary">
                  <Loader2 size={14} className="animate-spin" />
                  Loading fonts…
                </div>
              ) : listFonts.length > 0 ? (
                listFonts.map((f) => (
                  <FontRow
                    key={f.name}
                    name={f.name}
                    selected={current}
                    onPick={pick}
                    preview
                    loading={applying === f.name}
                  />
                ))
              ) : showEmpty ? (
                <p className="px-2 py-4 text-center text-xs text-glint-text-tertiary">
                  {catalogError ? 'Could not load font list' : 'No fonts found'}
                </p>
              ) : null}
            </div>

            <div className="border-t border-glint-border p-1.5">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium text-glint-accent hover:bg-glint-accent-muted disabled:opacity-50 transition-colors"
              >
                <Plus size={14} />
                {uploading ? 'Adding…' : 'Add font'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2,.ttc"
                multiple
                onChange={onUpload}
                className="hidden"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
