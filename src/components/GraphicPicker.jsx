import { useMemo, useState } from 'react';
import {
  ICONS,
  BRANDS,
  SHAPES_SVG,
  BLOBS,
  BADGES,
  STICKERS,
  HANDS,
  CHARTS,
  COLOR_ICONS,
  GRAPHIC_CREDITS,
  creditLabel,
  illustrationsByCollection,
} from '../utils/graphicsCatalog';

/** Tab id → credit key (or null for Lucide/mono packs). */
const TAB_CREDIT = {
  icons: null,
  color: 'colorIcons',
  stickers: 'stickers',
  hands: 'hands',
  charts: 'charts',
  badges: 'glint',
  people: 'humaaans',
  blobs: 'glint',
  shapes: null,
  brands: null,
};

const TABS = [
  { id: 'icons', label: 'Icons' },
  { id: 'color', label: 'Color' },
  { id: 'stickers', label: 'Stickers' },
  { id: 'hands', label: 'Hands' },
  { id: 'charts', label: 'Charts' },
  { id: 'badges', label: 'Badges' },
  { id: 'people', label: 'People' },
  { id: 'blobs', label: 'Blobs' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'brands', label: 'Brands' },
];

function tabTitle(tabId, label) {
  const key = TAB_CREDIT[tabId];
  const credit = key ? GRAPHIC_CREDITS[key] : null;
  if (!credit) return label;
  return `${label} — ${creditLabel(credit)}`;
}

function GraphicTile({ item, onInsert }) {
  const credit = item.credit;
  const tip = credit ? `${item.label} — ${creditLabel(credit)}` : item.label;
  const isMono = item.mono === true;

  return (
    <button
      type="button"
      title={tip}
      onClick={() => onInsert?.(item.src)}
      className={`graphic-tile group relative w-full aspect-square rounded-lg border border-glint-border overflow-hidden hover:border-glint-accent hover:ring-1 hover:ring-glint-accent/30 transition-all ${
        isMono ? 'graphic-tile--mono bg-white' : 'graphic-tile--color bg-glint-surface-2'
      }`}
    >
      <img
        src={`/graphics/${item.src}`}
        alt={item.label}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-contain p-2 pointer-events-none"
        draggable={false}
      />
    </button>
  );
}

function EmptySearch({ query }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 px-3 text-center">
      <p className="text-sm font-medium text-glint-text">No matches</p>
      <p className="text-[11px] text-glint-text-tertiary">
        Nothing for “{query}” in this tab
      </p>
    </div>
  );
}

function matchesQuery(g, q) {
  if (!q) return true;
  return (
    g.label.toLowerCase().includes(q) ||
    g.credit?.collection?.toLowerCase().includes(q) ||
    g.credit?.author?.toLowerCase().includes(q)
  );
}

export default function GraphicPicker({ onInsert }) {
  const [tab, setTab] = useState('icons');
  const [query, setQuery] = useState('');

  const q = query.toLowerCase();

  const lists = useMemo(
    () => ({
      icons: ICONS.filter((g) => matchesQuery(g, q)),
      color: COLOR_ICONS.filter((g) => matchesQuery(g, q)),
      brands: BRANDS.filter((g) => matchesQuery(g, q)),
      shapes: SHAPES_SVG.filter((g) => matchesQuery(g, q)),
      blobs: BLOBS.filter((g) => matchesQuery(g, q)),
      badges: BADGES.filter((g) => matchesQuery(g, q)),
      stickers: STICKERS.filter((g) => matchesQuery(g, q)),
      hands: HANDS.filter((g) => matchesQuery(g, q)),
      charts: CHARTS.filter((g) => matchesQuery(g, q)),
      people: illustrationsByCollection('Humaaans').filter((g) => matchesQuery(g, q)),
    }),
    [q],
  );
  const items = lists[tab] || [];

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full min-w-0">
      <div className="mb-2 shrink-0">
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded border border-glint-border px-2 py-1 text-sm bg-glint-surface-2 text-glint-text focus:outline-none focus:ring-2 focus:ring-glint-accent/30"
        />
      </div>

      <div className="flex flex-wrap border-b border-glint-border mb-2 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={tabTitle(t.id, t.label)}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t.id
                ? 'border-glint-accent text-glint-accent'
                : 'border-transparent text-glint-text-secondary hover:text-glint-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto glint-scrollbar pr-0.5">
        {items.length === 0 ? (
          <EmptySearch query={query} />
        ) : (
          <div className="grid grid-cols-4 gap-1.5 pb-2">
            {items.map((g) => (
              <div key={g.id} className="min-w-0">
                <GraphicTile item={g} onInsert={onInsert} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
