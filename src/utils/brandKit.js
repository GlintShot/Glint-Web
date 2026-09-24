/** Account-local brand kit (Primary / Secondary / Accent). */

const STORAGE_KEY = 'glint.brandKit';

const DEFAULTS = {
  primary: '#7C3AED',
  secondary: '#2563EB',
  accent: '#F59E0B',
};

export function loadBrandKit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      primary: normalize(parsed.primary) || DEFAULTS.primary,
      secondary: normalize(parsed.secondary) || DEFAULTS.secondary,
      accent: normalize(parsed.accent) || DEFAULTS.accent,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveBrandKit(kit) {
  const next = {
    primary: normalize(kit.primary) || DEFAULTS.primary,
    secondary: normalize(kit.secondary) || DEFAULTS.secondary,
    accent: normalize(kit.accent) || DEFAULTS.accent,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function brandKitAsPresets(kit = loadBrandKit()) {
  return [
    { id: 'primary', label: 'Primary', color: kit.primary },
    { id: 'secondary', label: 'Secondary', color: kit.secondary },
    { id: 'accent', label: 'Accent', color: kit.accent },
  ];
}

function normalize(hex) {
  if (typeof hex !== 'string') return null;
  const v = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase();
  }
  return null;
}
