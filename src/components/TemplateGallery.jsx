import { useEffect, useRef, useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { loadAllTemplates, filterVisibleTemplates } from '../utils/templateLoader';
import TemplateSetPreview from './TemplateSetPreview';
import DeviceBrowseFilters, {
  filterByDevice,
  storeToDeviceFilter,
  deviceFilterToStore,
} from './StoreBrowseFilters';
import { getStoreTarget } from '../utils/storeCatalog';

/**
 * Left sidebar - pick a store template pack (preview only).
 * Device chips filter the list; selection persists after applying a template.
 */
export default function TemplateGallery({ onChange, activeStore, onStartBlank }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState(() => storeToDeviceFilter(activeStore));
  const userPickedFilter = useRef(false);

  useEffect(() => {
    loadAllTemplates({ enabledOnly: true }).then(setTemplates).finally(() => setLoading(false));
  }, []);

  // Sync from export preset only until the user picks a device chip themselves.
  useEffect(() => {
    if (userPickedFilter.current || !activeStore) return;
    setDeviceFilter(storeToDeviceFilter(activeStore));
  }, [activeStore]);

  const filtered = filterByDevice(filterVisibleTemplates(templates, null), deviceFilter);
  const blankStore = deviceFilterToStore(deviceFilter);
  const blankTarget = getStoreTarget(blankStore);

  const handleDeviceChange = (id) => {
    userPickedFilter.current = true;
    setDeviceFilter(id);
  };

  const handlePickTemplate = (t) => {
    onChange(t);
    // Avoid a lingering focus ring that looks like the template stayed selected.
    requestAnimationFrame(() => document.activeElement?.blur?.());
  };

  if (loading) {
    return <p className="text-sm text-glint-text-tertiary">Loading templates…</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-glint-text-tertiary leading-relaxed">
        Pick a platform, then choose a template. Export uses that canvas size.
      </p>
      <DeviceBrowseFilters
        device={deviceFilter}
        onDeviceChange={handleDeviceChange}
        size="sm"
      />
      {typeof onStartBlank === 'function' && (
        <button
          type="button"
          onClick={() => onStartBlank(blankStore)}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-glint-border hover:border-glint-accent/50 text-left text-xs text-glint-text-secondary hover:text-glint-text hover:bg-glint-surface-2 transition-colors"
        >
          <LayoutTemplate size={14} className="text-glint-accent shrink-0" />
          <span>
            <span className="font-semibold text-glint-text block">
              Start blank · {blankTarget.label}
            </span>
            <span className="text-[10px] text-glint-text-tertiary">
              {blankTarget.width}×{blankTarget.height}, no pack
            </span>
          </span>
        </button>
      )}
      {filtered.length === 0 ? (
        <p className="text-xs text-glint-text-tertiary py-4 text-center">
          No templates for this size yet.
        </p>
      ) : (
        <div className="space-y-2 overflow-hidden">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              data-template-id={t.id}
              title={t.name || t.id}
              onClick={() => handlePickTemplate(t)}
              className="group w-full rounded-xl overflow-hidden border border-glint-border hover:border-glint-accent/50 hover:shadow-md transition-all bg-glint-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-glint-accent/40"
            >
              <TemplateSetPreview template={t} compact />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
