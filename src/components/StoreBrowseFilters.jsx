import { Smartphone, Tablet, Tv, Watch, Laptop } from 'lucide-react';
import { resolveStoreKey } from '../utils/storeCatalog';

/**
 * Device-based filter chips for template browsing.
 * Users pick by device type (iPhone, Android, iPad) not by store.
 */

const DEVICE_FILTERS = [
  { id: 'android-phone', label: 'Android Phone', icon: Smartphone, stores: ['play/phone'] },
  { id: 'iphone', label: 'iPhone', icon: Smartphone, stores: ['ios/iphone'] },
  { id: 'ipad', label: 'iPad', icon: Tablet, stores: ['ios/ipad'] },
  { id: 'tablet', label: 'Tablet', icon: Tablet, stores: ['play/tablet-7', 'play/tablet-10'], disabled: true },
  { id: 'tv', label: 'TV', icon: Tv, stores: ['play/tv'], disabled: true },
  { id: 'wear', label: 'Wear OS', icon: Watch, stores: ['play/wear'], disabled: true },
  { id: 'chromebook', label: 'Chromebook', icon: Laptop, stores: ['play/chromebook'], disabled: true },
];

export { DEVICE_FILTERS };

/** Map export store key → sidebar device chip id. */
export function storeToDeviceFilter(store) {
  const key = resolveStoreKey(store);
  if (key === 'ios/iphone') return 'iphone';
  if (key === 'ios/ipad') return 'ipad';
  return 'android-phone';
}

/** Map device chip id → canonical store key for blank boards / export. */
export function deviceFilterToStore(deviceFilter) {
  const filter = DEVICE_FILTERS.find((d) => d.id === deviceFilter);
  const first = filter?.stores?.[0];
  return resolveStoreKey(first || 'play/phone');
}

/**
 * Filter templates by selected device filter.
 * @param {Array} templates - loaded template objects
 * @param {string} deviceFilter - selected device filter id
 * @returns {Array} filtered templates
 */
export function filterByDevice(templates, deviceFilter) {
  if (!deviceFilter || deviceFilter === 'all') return templates;

  const filter = DEVICE_FILTERS.find((d) => d.id === deviceFilter);
  if (!filter?.stores) return templates;

  return templates.filter((t) => {
    const store = t.store || '';
    return filter.stores.some((s) => store.startsWith(s.split('/')[0]) && store.includes(s.split('/')[1]));
  });
}

export default function DeviceBrowseFilters({ device, onDeviceChange, size = 'md' }) {
  const chip =
    size === 'sm'
      ? 'px-2.5 py-1.5 rounded-lg text-[11px] font-medium'
      : 'px-4 py-2 rounded-full text-sm font-medium';
  const active = size === 'sm'
    ? 'bg-glint-accent text-glint-text-on-accent shadow-md shadow-glint-accent/20'
    : 'bg-glint-accent text-glint-text-on-accent shadow-md shadow-glint-accent/20';
  const idle = size === 'sm'
    ? 'bg-glint-surface-2 text-glint-text-secondary hover:text-glint-text hover:bg-glint-surface-2/80'
    : 'bg-glint-surface/80 text-glint-text-secondary hover:bg-glint-surface hover:text-glint-text border border-glint-border hover:border-glint-accent/30';

  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {DEVICE_FILTERS.map((f) => {
        const Icon = f.icon;
        const isDisabled = f.disabled;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => !isDisabled && onDeviceChange(f.id)}
            disabled={isDisabled}
            className={`${chip} transition-all duration-300 inline-flex items-center gap-1.5
              ${device === f.id ? active : idle}
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
            title={isDisabled ? 'Coming soon' : f.label}
          >
            {Icon && <Icon size={size === 'sm' ? 12 : 14} />}
            <span>{f.label}</span>
            {isDisabled && <span className="text-[9px] opacity-60">soon</span>}
          </button>
        );
      })}
    </div>
  );
}
