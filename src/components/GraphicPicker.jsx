import { useState } from 'react';
import { ICONS, BRANDS, SHAPES_SVG } from '../utils/graphicsCatalog';

const TABS = [
  { id: 'icons', label: 'Icons' },
  { id: 'brands', label: 'Brands' },
  { id: 'shapes', label: 'Shapes' },
];

function GraphicTile({ item, onInsert }) {
  return (
    <button
      type="button"
      title={item.label}
      onClick={() => onInsert?.(item.src)}
      className="graphic-tile group relative rounded-lg border border-glint-border bg-glint-surface-2 overflow-hidden hover:border-glint-accent hover:ring-1 hover:ring-glint-accent/30 transition-all aspect-square"
    >
      <img
        src={`/graphics/${item.src}`}
        alt={item.label}
        className="absolute inset-0 w-full h-full object-contain p-2 pointer-events-none opacity-95 group-hover:opacity-100"
        style={{ color: '#000' }}
        draggable={false}
      />
    </button>
  );
}

export default function GraphicPicker({ onInsert }) {
  const [tab, setTab] = useState('icons');
  const [query, setQuery] = useState('');

  const q = query.toLowerCase();

  const filteredIcons = ICONS.filter((g) => g.label.toLowerCase().includes(q));
  const filteredBrands = BRANDS.filter((g) => g.label.toLowerCase().includes(q));
  const filteredShapes = SHAPES_SVG.filter((g) => g.label.toLowerCase().includes(q));

  return (
    <div className="flex flex-col h-full">
      <div className="mb-2">
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded border border-glint-border px-2 py-1 text-sm bg-glint-surface-2 text-glint-text focus:outline-none focus:ring-2 focus:ring-glint-accent/30"
        />
      </div>

      <div className="flex border-b border-glint-border mb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 text-[10px] font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-glint-accent text-glint-accent'
                : 'border-transparent text-glint-text-secondary hover:text-glint-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-hidden">
        {tab === 'icons' && (
          <div className="grid grid-cols-4 gap-1.5">
            {filteredIcons.map((g) => (
              <GraphicTile key={g.id} item={g} onInsert={onInsert} />
            ))}
          </div>
        )}

        {tab === 'brands' && (
          <div className="grid grid-cols-4 gap-1.5">
            {filteredBrands.map((g) => (
              <GraphicTile key={g.id} item={g} onInsert={onInsert} />
            ))}
          </div>
        )}

        {tab === 'shapes' && (
          <div className="grid grid-cols-4 gap-1.5">
            {filteredShapes.map((g) => (
              <GraphicTile key={g.id} item={g} onInsert={onInsert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
