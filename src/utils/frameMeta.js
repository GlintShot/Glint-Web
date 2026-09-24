/**
 * Screen insets for curated device frames (`public/frames/*`).
 * Photo-real PNGs use native pixel sizes from device-frames-media template.json.
 * `ext`: asset extension. `rx`: screen corner radius in frame pixels.
 */
export const FRAME_INSETS = {
  pixel9: {
    ext: 'png',
    top: 142,
    right: 170,
    bottom: 138,
    left: 170,
    rx: 200,
    width: 1620,
    height: 3136,
  },
  'galaxy-s24': {
    ext: 'png',
    top: 200,
    right: 200,
    bottom: 200,
    left: 200,
    rx: 160,
    width: 1480,
    height: 2800,
  },
  'iphone16-pro': {
    ext: 'png',
    top: 100,
    right: 98,
    bottom: 100,
    left: 102,
    rx: 140,
    width: 1406,
    height: 2822,
  },
  'iphone16-pro-max': {
    ext: 'png',
    top: 100,
    right: 100,
    bottom: 100,
    left: 100,
    rx: 145,
    width: 1520,
    height: 3068,
  },
  'iphone13-pro': {
    ext: 'png',
    top: 155,
    right: 160,
    bottom: 155,
    left: 160,
    rx: 140,
    width: 1570,
    height: 2932,
  },
  'iphone13-pro-max': {
    ext: 'png',
    top: 155,
    right: 160,
    bottom: 160,
    left: 160,
    rx: 145,
    width: 1684,
    height: 3178,
  },
  'ipad-pro-13': {
    ext: 'png',
    top: 115,
    right: 115,
    bottom: 115,
    left: 115,
    rx: 70,
    width: 2448,
    height: 3132,
  },
  'ipad-pro': {
    ext: 'png',
    top: 116,
    right: 116,
    bottom: 116,
    left: 116,
    rx: 65,
    width: 2068,
    height: 2788,
  },
  'ipad-air-2020': {
    ext: 'png',
    top: 55,
    right: 55,
    bottom: 55,
    left: 55,
    rx: 55,
    width: 1940,
    height: 2660,
  },
  'galaxy-s21': {
    ext: 'png',
    top: 200,
    right: 200,
    bottom: 200,
    left: 200,
    rx: 160,
    width: 1480,
    height: 2800,
  },
  'galaxy-s21-ultra': {
    ext: 'png',
    top: 170,
    right: 170,
    bottom: 170,
    left: 170,
    rx: 180,
    width: 1840,
    height: 3600,
  },
  /** Landscape TV / monitor bezel for Play TV listings. */
  tv: {
    ext: 'svg',
    top: 40,
    right: 48,
    bottom: 176,
    left: 48,
    rx: 8,
    width: 1920,
    height: 1200,
  },
};

/**
 * Per-device status bar assets (`public/frames/status-bars/{profile}-{theme}.svg`).
 * refW/refH = SVG viewBox (logical pt). refScreenH = device logical height for hole-fit.
 */
export const STATUS_BAR_SPECS = {
  pixel9: { profile: 'android-pixel', refW: 412, refH: 36, refScreenH: 915 },
  'galaxy-s24': { profile: 'android-samsung', refW: 412, refH: 36, refScreenH: 915 },
  'galaxy-s21': { profile: 'android-samsung', refW: 412, refH: 36, refScreenH: 915 },
  'galaxy-s21-ultra': { profile: 'android-samsung', refW: 412, refH: 36, refScreenH: 960 },
  'iphone16-pro': { profile: 'ios-island', refW: 393, refH: 59, refScreenH: 852 },
  'iphone16-pro-max': { profile: 'ios-island', refW: 430, refH: 59, refScreenH: 932 },
  'iphone13-pro': { profile: 'ios-notch', refW: 390, refH: 47, refScreenH: 844 },
  'iphone13-pro-max': { profile: 'ios-notch', refW: 428, refH: 47, refScreenH: 926 },
  'ipad-pro-13': { profile: 'ipados', refW: 1024, refH: 24, refScreenH: 1366 },
  'ipad-pro': { profile: 'ipados', refW: 1024, refH: 24, refScreenH: 1194 },
  'ipad-air-2020': { profile: 'ipados', refW: 1024, refH: 24, refScreenH: 1180 },
};

export function getStatusBarMeta(frameId) {
  if (!frameId) return STATUS_BAR_SPECS.pixel9;
  return STATUS_BAR_SPECS[frameId] ?? null;
}

/** Status bar height in screen-hole pixels - tracks frame inset height when available. */
export function statusBarHeightForFrame(screenW, frameId, screenH = 0) {
  const sb = getStatusBarMeta(frameId);
  if (!sb || !(screenW > 0)) return 0;
  if (screenH > 0 && sb.refScreenH) {
    return Math.max(1, Math.round((screenH * sb.refH) / sb.refScreenH));
  }
  return Math.max(1, Math.round((screenW * sb.refH) / sb.refW));
}

/** Screen-hole size for a curated frame (native frame pixels). */
export function frameScreenSize(frameId) {
  const meta = getFrameMeta(frameId);
  return {
    w: meta.width - meta.left - meta.right,
    h: meta.height - meta.top - meta.bottom,
  };
}

/**
 * Curated bezels tagged by store platform + form factor.
 * FrameSelector only offers options allowed for the active store target.
 */
export const DEVICE_FRAME_OPTIONS = [
  { id: null, label: 'None' },
  { id: 'pixel9', label: 'Pixel 9', platforms: ['play'], formFactors: ['phone'] },
  { id: 'galaxy-s24', label: 'Galaxy S24', platforms: ['play'], formFactors: ['phone'] },
  { id: 'galaxy-s21', label: 'Galaxy S21', platforms: ['play'], formFactors: ['phone'] },
  { id: 'galaxy-s21-ultra', label: 'Galaxy S21 Ultra', platforms: ['play'], formFactors: ['phone'] },
  { id: 'tv', label: 'TV', platforms: ['play'], formFactors: ['tv'] },
  { id: 'iphone16-pro-max', label: 'iPhone 16 Pro Max', platforms: ['ios'], formFactors: ['iphone'] },
  { id: 'iphone16-pro', label: 'iPhone 16 Pro', platforms: ['ios'], formFactors: ['iphone'] },
  { id: 'iphone13-pro-max', label: 'iPhone 13 Pro Max', platforms: ['ios'], formFactors: ['iphone'] },
  { id: 'iphone13-pro', label: 'iPhone 13 Pro', platforms: ['ios'], formFactors: ['iphone'] },
  { id: 'ipad-pro-13', label: 'iPad Pro 13"', platforms: ['ios', 'play'], formFactors: ['ipad', 'tablet', 'chromebook'] },
  { id: 'ipad-pro', label: 'iPad Pro 11"', platforms: ['ios', 'play'], formFactors: ['ipad', 'tablet'] },
  { id: 'ipad-air-2020', label: 'iPad Air', platforms: ['ios', 'play'], formFactors: ['ipad', 'tablet'] },
];

/** Map store target device → form factor used by DEVICE_FRAME_OPTIONS. */
export const STORE_FORM_FACTOR = {
  phone: 'phone',
  'tablet-7': 'tablet',
  'tablet-10': 'tablet',
  tv: 'tv',
  wear: 'wear',
  chromebook: 'chromebook',
  iphone: 'iphone',
  ipad: 'ipad',
};

/** Fallback when an unknown frame id is requested. */
const DEFAULT_FRAME = 'pixel9';

/** Minimum device size as a fraction of the store frame (canvas). */
export const MIN_DEVICE_COVERAGE = 0.6;
export const MAX_DEVICE_COVERAGE = 0.92;

export function getFrameMeta(frameId) {
  return FRAME_INSETS[frameId] || FRAME_INSETS[DEFAULT_FRAME];
}

/**
 * Device bezels allowed for a store target (platform/device).
 * Always includes None (user can still clear chrome in Design).
 * Play tablets / Chromebook share iPad-class bezels; Wear uses Simple Dark.
 */
export function framesForStore(storeOrTarget) {
  let platform = null;
  let device = null;
  if (typeof storeOrTarget === 'string') {
    const [p, d] = storeOrTarget.split('/');
    platform = p;
    device = d;
  } else if (storeOrTarget && typeof storeOrTarget === 'object') {
    platform = storeOrTarget.platform;
    device = storeOrTarget.device;
  }

  const formFactor = STORE_FORM_FACTOR[device] || device || null;
  return DEVICE_FRAME_OPTIONS.filter((opt) => {
    if (opt.id == null) return true;
    if (!platform || !formFactor) return false;
    if (!opt.platforms?.includes(platform)) return false;
    return opt.formFactors?.includes(formFactor);
  });
}

/** Whether a bezel id (including null) is valid for the active store. */
export function isFrameAllowedForStore(frameId, storeOrTarget) {
  return framesForStore(storeOrTarget).some((f) => f.id === frameId);
}

/** Prefer store defaultFrame when allowed; otherwise None. */
export function resolveFrameForStore(frameId, storeOrTarget, preferredDefault = null) {
  if (isFrameAllowedForStore(frameId, storeOrTarget)) return frameId ?? null;
  if (preferredDefault != null && isFrameAllowedForStore(preferredDefault, storeOrTarget)) {
    return preferredDefault;
  }
  return null;
}

/** Public URL for a curated frame asset. */
export function getFrameSrc(frameId) {
  const meta = getFrameMeta(frameId);
  const ext = meta.ext || 'png';
  return `/frames/${frameId}.${ext}`;
}

/**
 * Convert canvas coverage (e.g. 0.6 = 60% of frame) into SVG/PNG unit scale.
 * Device keeps aspect ratio; size is limited by the tighter canvas axis.
 */
export function resolveDeviceScale(
  frameId,
  canvasW,
  canvasH,
  coverage = MIN_DEVICE_COVERAGE,
  { minCoverage = MIN_DEVICE_COVERAGE, maxCoverage = MAX_DEVICE_COVERAGE } = {},
) {
  const meta = getFrameMeta(frameId);
  const fraction = Math.min(
    maxCoverage,
    Math.max(minCoverage, coverage ?? minCoverage),
  );
  return Math.min((canvasW * fraction) / meta.width, (canvasH * fraction) / meta.height);
}

/** Default chrome for screenshots (no bezel) and drop shadow (any device). */
export const DEFAULT_SCREENSHOT_STYLE = {
  cornerRadius: 28,
  strokeWidth: 0,
  strokeColor: '#FFFFFF',
  scale: 0.58,
  /** Drop shadow - works on framed devices and bare screenshots. */
  shadowEnabled: true,
  shadowBlur: 48,
  shadowOffsetX: 0,
  shadowOffsetY: 28,
  shadowOpacity: 0.45,
  shadowColor: '#000000',
  /** Fake OS status bar: reserved top strip; shot fills the remaining hole. */
  statusBarEnabled: false,
  /** "dark" = light icons on dark strip; "light" = dark icons on light strip. */
  statusBarTheme: 'dark',
  /** Screenshot fit mode inside device frame: 'cover' | 'contain' | 'custom'.
   * contain = full shot inside the hole (frame never crops shot borders) - Studio default. */
  fitMode: 'contain',
  /** Custom mode offset (-1 to 1, 0 = centered). */
  fitOffsetX: 0,
  fitOffsetY: 0,
};

export function computeFrameLayout(frameId, targetScale) {
  const meta = getFrameMeta(frameId);
  const frameW = meta.width * targetScale;
  const frameH = meta.height * targetScale;
  const insetL = meta.left * targetScale;
  const insetT = meta.top * targetScale;
  const insetR = meta.right * targetScale;
  const insetB = meta.bottom * targetScale;
  const screenW = frameW - insetL - insetR;
  const screenH = frameH - insetT - insetB;
  const rx = meta.rx * targetScale;
  return { meta, frameW, frameH, insetL, insetT, screenW, screenH, rx };
}

/**
 * Base scale so a new bezel fills the previous display box (contain, uniform).
 * Swap Pixel → iPhone (etc.) without jumping size or position.
 */
export function scaleToMatchDisplayBox(frameId, displayW, displayH) {
  const meta = getFrameMeta(frameId);
  const mw = meta?.width || 0;
  const mh = meta?.height || 0;
  if (mw <= 0 || mh <= 0 || !(displayW > 0) || !(displayH > 0)) return null;
  return Math.min(displayW / mw, displayH / mh);
}
