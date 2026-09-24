/** Graphics catalog - icons, brands, shapes from /public/graphics/. */

function labelFromFilename(file) {
  return file
    .replace(/\.svg$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const DEFAULT_PLACEMENT = { left: 80, top: 400, width: 120 };

function icon(id, src, label, use) {
  return {
    id,
    src: `icons/${src}`,
    label: label || labelFromFilename(src),
    use: use || '',
    mono: true,
    defaultPlacement: { ...DEFAULT_PLACEMENT },
  };
}

function brand(id, src, label) {
  return {
    id,
    src: `brands/${src}`,
    label: label || labelFromFilename(src),
    mono: true,
    defaultPlacement: { ...DEFAULT_PLACEMENT },
  };
}

function shape(id, src, label) {
  return {
    id,
    src: `shapes/${src}`,
    label: label || labelFromFilename(src),
    mono: true,
    defaultPlacement: { ...DEFAULT_PLACEMENT },
  };
}

function blob(id, src, label, placement) {
  return {
    id,
    src: `blobs/${src}`,
    label: label || labelFromFilename(src),
    mono: false,
    defaultPlacement: { ...(placement || { left: -40, top: 200, width: 520 }) },
    credit: creditOf('glint'),
  };
}

function badge(id, src, label, placement) {
  return {
    id,
    src: `badges/${src}`,
    label: label || labelFromFilename(src),
    mono: false,
    defaultPlacement: { ...(placement || { left: 80, top: 120, width: 280 }) },
    credit: creditOf('glint'),
  };
}

function illustration(id, src, label, placement, credit) {
  return {
    id,
    src: src.includes('/') ? src : `illustrations/${src}`,
    label: label || labelFromFilename(src.split('/').pop()),
    mono: false,
    defaultPlacement: { ...(placement || { left: 60, top: 160, width: 280 }) },
    credit: credit || null,
  };
}

/** Colorful accent pack entry (hands, charts, promo, color icons, …). */
function accent(id, src, label, placement, creditKey = 'glint') {
  return {
    id,
    src,
    label: label || labelFromFilename(src.split('/').pop()),
    mono: false,
    defaultPlacement: { ...(placement || { left: 80, top: 160, width: 200 }) },
    credit: creditOf(creditKey),
  };
}

/** Shared credit cards for third-party packs (shown on hover in GraphicPicker). */
export const GRAPHIC_CREDITS = {
  glint: {
    collection: 'Glint',
    author: 'Glint',
    license: 'MIT',
    url: 'https://github.com/darkmintis/Glint-Org',
    blurb: 'Original Glint artwork',
  },
  humaaans: {
    collection: 'Humaaans',
    author: 'Pablo Stanley',
    license: 'CC0',
    url: 'https://www.humaaans.com/',
    blurb: 'Mix-&-match people illustrations',
  },
  undraw: {
    collection: 'unDraw',
    author: 'Katerina Limpitsouni',
    license: 'MIT',
    url: 'https://undraw.co/',
    blurb: 'Open-source illustrations (not used in store packs — too scene-heavy)',
  },
  stickers: {
    collection: 'Stickers',
    author: 'Glint',
    license: 'MIT',
    url: 'https://github.com/darkmintis/Glint-Org',
    blurb: 'Tiny accents for store frames (stars, checks, underlines)',
  },
  hands: {
    collection: 'Hands',
    author: 'Glint',
    license: 'MIT',
    url: 'https://github.com/darkmintis/Glint-Org',
    blurb: 'Gestures for taps, swipes, and CTAs',
  },
  charts: {
    collection: 'Charts',
    author: 'Glint',
    license: 'MIT',
    url: 'https://github.com/darkmintis/Glint-Org',
    blurb: 'Bars, rings, sparklines for growth slides',
  },
  notifications: {
    collection: 'Notifications',
    author: 'Glint',
    license: 'MIT',
    url: 'https://github.com/darkmintis/Glint-Org',
    blurb: 'Store-style notification pills',
  },
  promo: {
    collection: 'Promo',
    author: 'Glint',
    license: 'MIT',
    url: 'https://github.com/darkmintis/Glint-Org',
    blurb: 'Sale / free / editors-choice chips',
  },
  colorIcons: {
    collection: 'Color Icons',
    author: 'Glint',
    license: 'MIT',
    url: 'https://github.com/darkmintis/Glint-Org',
    blurb: 'Filled feature icons — exact color in every theme',
  },
  doodles: {
    collection: 'Doodles',
    author: 'Glint',
    license: 'MIT',
    url: 'https://github.com/darkmintis/Glint-Org',
    blurb: 'Scribbles and accent marks',
  },
};

function creditOf(key) {
  return GRAPHIC_CREDITS[key] || null;
}

export const ICONS = [
  icon('icon-add', 'add.svg', 'Add'),
  icon('icon-ai-sparkle', 'ai-sparkle.svg', 'Ai Sparkle'),
  icon('icon-align-center-vertical', 'align-center-vertical.svg', 'Align Center Vertical'),
  icon('icon-align-center', 'align-center.svg', 'Align Center'),
  icon('icon-align-end-vertical', 'align-end-vertical.svg', 'Align End Vertical'),
  icon('icon-align-left', 'align-left.svg', 'Align Left'),
  icon('icon-align-right', 'align-right.svg', 'Align Right'),
  icon('icon-align-start-vertical', 'align-start-vertical.svg', 'Align Start Vertical'),
  icon('icon-archive', 'archive.svg', 'Archive'),
  icon('icon-arrow-down', 'arrow-down.svg', 'Arrow Down'),
  icon('icon-arrow-left', 'arrow-left.svg', 'Arrow Left'),
  icon('icon-arrow-right', 'arrow-right.svg', 'Arrow Right', 'Next step, more, CTA'),
  icon('icon-arrow-up', 'arrow-up.svg', 'Arrow Up', 'Growth, upload, increase'),
  icon('icon-auto-fit', 'auto-fit.svg', 'Auto Fit'),
  icon('icon-background-fill', 'background-fill.svg', 'Background Fill'),
  icon('icon-bell', 'bell.svg', 'Bell', 'Notifications, alerts'),
  icon('icon-blend', 'blend.svg', 'Blend'),
  icon('icon-bold', 'bold.svg', 'Bold'),
  icon('icon-bookmark', 'bookmark.svg', 'Bookmark', 'Save, remember, collection'),
  icon('icon-bot', 'bot.svg', 'Bot'),
  icon('icon-brain', 'brain.svg', 'Brain'),
  icon('icon-bring-to-front', 'bring-to-front.svg', 'Bring To Front'),
  icon('icon-calendar-check', 'calendar-check.svg', 'Calendar Check'),
  icon('icon-calendar-plus', 'calendar-plus.svg', 'Calendar Plus'),
  icon('icon-calendar-range', 'calendar-range.svg', 'Calendar Range'),
  icon('icon-calendar-x', 'calendar-x.svg', 'Calendar X'),
  icon('icon-calendar', 'calendar.svg', 'Calendar', 'Schedule, time, events'),
  icon('icon-camera', 'camera.svg', 'Camera', 'Photo, scan, capture'),
  icon('icon-check-circle', 'check-circle.svg', 'Check Circle', 'Feature checkmark, validation'),
  icon('icon-check', 'check.svg', 'Check'),
  icon('icon-chevron-down', 'chevron-down.svg', 'Chevron Down'),
  icon('icon-chevron-left', 'chevron-left.svg', 'Chevron Left'),
  icon('icon-chevron-right', 'chevron-right.svg', 'Chevron Right'),
  icon('icon-chevron-up', 'chevron-up.svg', 'Chevron Up'),
  icon('icon-clipboard', 'clipboard.svg', 'Clipboard'),
  icon('icon-clock', 'clock.svg', 'Clock', 'History, recent, timer'),
  icon('icon-cloud-download', 'cloud-download.svg', 'Cloud Download'),
  icon('icon-cloud-upload', 'cloud-upload.svg', 'Cloud Upload'),
  icon('icon-cloud', 'cloud.svg', 'Cloud'),
  icon('icon-code', 'code.svg', 'Code'),
  icon('icon-compare-variants', 'compare-variants.svg', 'Compare Variants'),
  icon('icon-copy', 'copy.svg', 'Copy'),
  icon('icon-crop', 'crop.svg', 'Crop'),
  icon('icon-cursor', 'cursor.svg', 'Cursor'),
  icon('icon-database', 'database.svg', 'Database'),
  icon('icon-device-frame', 'device-frame.svg', 'Device Frame'),
  icon('icon-device-tablet', 'device-tablet.svg', 'Device Tablet'),
  icon('icon-download', 'download.svg', 'Download', 'Download CTA, save'),
  icon('icon-expand', 'expand.svg', 'Expand'),
  icon('icon-export-download', 'export-download.svg', 'Export Download'),
  icon('icon-external-link', 'external-link.svg', 'External Link'),
  icon('icon-eye-off', 'eye-off.svg', 'Eye Off'),
  icon('icon-eye', 'eye.svg', 'Eye'),
  icon('icon-file-check', 'file-check.svg', 'File Check'),
  icon('icon-file-code', 'file-code.svg', 'File Code'),
  icon('icon-file-json', 'file-json.svg', 'File Json'),
  icon('icon-file-plus', 'file-plus.svg', 'File Plus'),
  icon('icon-file', 'file.svg', 'File'),
  icon('icon-filter', 'filter.svg', 'Filter'),
  icon('icon-flip-horizontal-2', 'flip-horizontal-2.svg', 'Flip Horizontal'),
  icon('icon-flip-vertical-2', 'flip-vertical-2.svg', 'Flip Vertical'),
  icon('icon-focus', 'focus.svg', 'Focus'),
  icon('icon-folder-plus', 'folder-plus.svg', 'Folder Plus'),
  icon('icon-folder', 'folder.svg', 'Folder'),
  icon('icon-fullscreen', 'fullscreen.svg', 'Fullscreen'),
  icon('icon-funnel', 'funnel.svg', 'Funnel'),
  icon('icon-gallery', 'gallery.svg', 'Gallery'),
  icon('icon-generate-caption', 'generate-caption.svg', 'Generate Caption'),
  icon('icon-generate-layout', 'generate-layout.svg', 'Generate Layout'),
  icon('icon-grid-2x2', 'grid-2x2.svg', 'Grid 2x2'),
  icon('icon-grid-3x3', 'grid-3x3.svg', 'Grid 3x3'),
  icon('icon-hand', 'hand.svg', 'Hand'),
  icon('icon-heading', 'heading.svg', 'Heading'),
  icon('icon-help-circle', 'help-circle.svg', 'Help Circle'),
  icon('icon-history', 'history.svg', 'History'),
  icon('icon-home', 'home.svg', 'Home'),
  icon('icon-image-plus', 'image-plus.svg', 'Image Plus'),
  icon('icon-image', 'image.svg', 'Image'),
  icon('icon-images', 'images.svg', 'Images'),
  icon('icon-info', 'info.svg', 'Info'),
  icon('icon-italic', 'italic.svg', 'Italic'),
  icon('icon-key', 'key.svg', 'Key'),
  icon('icon-layers', 'layers.svg', 'Layers'),
  icon('icon-layout-template', 'layout-template.svg', 'Layout Template'),
  icon('icon-lightbulb', 'lightbulb.svg', 'Lightbulb'),
  icon('icon-link', 'link.svg', 'Link'),
  icon('icon-list-filter', 'list-filter.svg', 'List Filter'),
  icon('icon-list-ordered', 'list-ordered.svg', 'List Ordered'),
  icon('icon-list', 'list.svg', 'List'),
  icon('icon-lock', 'lock.svg', 'Lock', 'Privacy, secure, premium'),
  icon('icon-manifest-file', 'manifest-file.svg', 'Manifest File'),
  icon('icon-maximize', 'maximize.svg', 'Maximize'),
  icon('icon-menu', 'menu.svg', 'Menu'),
  icon('icon-minimize', 'minimize.svg', 'Minimize'),
  icon('icon-minus', 'minus.svg', 'Minus'),
  icon('icon-more-horizontal', 'more-horizontal.svg', 'More Horizontal'),
  icon('icon-more-vertical', 'more-vertical.svg', 'More Vertical'),
  icon('icon-mouse-pointer-2', 'mouse-pointer-2.svg', 'Mouse Pointer'),
  icon('icon-move', 'move.svg', 'Move'),
  icon('icon-paintbrush', 'paintbrush.svg', 'Paintbrush'),
  icon('icon-palette', 'palette.svg', 'Palette'),
  icon('icon-paperclip', 'paperclip.svg', 'Paperclip'),
  icon('icon-pause', 'pause.svg', 'Pause'),
  icon('icon-pencil', 'pencil.svg', 'Pencil'),
  icon('icon-pin', 'pin.svg', 'Pin'),
  icon('icon-play', 'play.svg', 'Play', 'Video, demo, media'),
  icon('icon-plus', 'plus.svg', 'Plus'),
  icon('icon-preview-eye', 'preview-eye.svg', 'Preview Eye'),
  icon('icon-project-duplicate', 'project-duplicate.svg', 'Project Duplicate'),
  icon('icon-project-folder', 'project-folder.svg', 'Project Folder'),
  icon('icon-project-save', 'project-save.svg', 'Project Save'),
  icon('icon-quote', 'quote.svg', 'Quote'),
  icon('icon-redo-2', 'redo-2.svg', 'Redo'),
  icon('icon-refresh-cw', 'refresh-cw.svg', 'Refresh'),
  icon('icon-rocket', 'rocket.svg', 'Rocket', 'Launch, speed, new'),
  icon('icon-rotate-ccw', 'rotate-ccw.svg', 'Rotate Ccw'),
  icon('icon-rotate-cw', 'rotate-cw.svg', 'Rotate Cw'),
  icon('icon-rtl-direction', 'rtl-direction.svg', 'Rtl Direction'),
  icon('icon-ruler', 'ruler.svg', 'Ruler'),
  icon('icon-save', 'save.svg', 'Save'),
  icon('icon-scaling', 'scaling.svg', 'Scaling'),
  icon('icon-screen-upload', 'screen-upload.svg', 'Screen Upload'),
  icon('icon-search', 'search.svg', 'Search', 'Discover, find, explore'),
  icon('icon-send-to-back', 'send-to-back.svg', 'Send To Back'),
  icon('icon-send', 'send.svg', 'Send'),
  icon('icon-settings', 'settings.svg', 'Settings', 'Preferences, configure'),
  icon('icon-share-2', 'share-2.svg', 'Share', 'Sharing, social, viral'),
  icon('icon-sparkles', 'sparkles.svg', 'Sparkles'),
  icon('icon-stop-circle', 'stop-circle.svg', 'Stop Circle'),
  icon('icon-stop', 'stop.svg', 'Stop'),
  icon('icon-strikethrough', 'strikethrough.svg', 'Strikethrough'),
  icon('icon-tag', 'tag.svg', 'Tag'),
  icon('icon-terminal', 'terminal.svg', 'Terminal'),
  icon('icon-timer', 'timer.svg', 'Timer'),
  icon('icon-translate-globe', 'translate-globe.svg', 'Translate Globe'),
  icon('icon-trash-2', 'trash-2.svg', 'Trash'),
  icon('icon-type', 'type.svg', 'Type'),
  icon('icon-underline', 'underline.svg', 'Underline'),
  icon('icon-undo-2', 'undo-2.svg', 'Undo'),
  icon('icon-unlock', 'unlock.svg', 'Unlock'),
  icon('icon-upload', 'upload.svg', 'Upload'),
  icon('icon-validate-check', 'validate-check.svg', 'Validate Check'),
  icon('icon-video', 'video.svg', 'Video'),
  icon('icon-volume-2', 'volume-2.svg', 'Volume'),
  icon('icon-wand-sparkles', 'wand-sparkles.svg', 'Wand Sparkles'),
  icon('icon-warning-triangle', 'warning-triangle.svg', 'Warning'),
  icon('icon-webhook', 'webhook.svg', 'Webhook'),
  icon('icon-workflow', 'workflow.svg', 'Workflow'),
  icon('icon-x', 'x.svg', 'Close'),
  icon('icon-zoom-in', 'zoom-in.svg', 'Zoom In'),
  icon('icon-zoom-out', 'zoom-out.svg', 'Zoom Out'),
];

export const BRANDS = [
  brand('brand-android', 'android.svg', 'Android'),
  brand('brand-apple', 'apple.svg', 'Apple'),
  brand('brand-appstore', 'appstore.svg', 'App Store'),
  brand('brand-googleplay', 'googleplay.svg', 'Google Play'),
];

export const SHAPES_SVG = [
  shape('shape-rating-apple', 'rating-apple.svg', 'Rating Apple'),
  shape('shape-rating-award', 'rating-award.svg', 'Rating Award'),
  shape('shape-rating-badge-check', 'rating-badge-check.svg', 'Rating Badge Check'),
  shape('shape-rating-calendar', 'rating-calendar.svg', 'Rating Calendar'),
  shape('shape-rating-crown', 'rating-crown.svg', 'Rating Crown'),
  shape('shape-rating-download', 'rating-download.svg', 'Rating Download'),
  shape('shape-rating-heart-off', 'rating-heart-off.svg', 'Rating Heart Off'),
  shape('shape-rating-heart', 'rating-heart.svg', 'Rating Heart'),
  shape('shape-rating-medal', 'rating-medal.svg', 'Rating Medal'),
  shape('shape-rating-search', 'rating-search.svg', 'Rating Search'),
  shape('shape-rating-sparkle', 'rating-sparkle.svg', 'Rating Sparkle'),
  shape('shape-rating-star-half', 'rating-star-half.svg', 'Rating Star Half'),
  shape('shape-rating-star-off', 'rating-star-off.svg', 'Rating Star Off'),
  shape('shape-rating-star', 'rating-star.svg', 'Rating Star'),
  shape('shape-rating-trophy', 'rating-trophy.svg', 'Rating Trophy'),
  shape('shape-rating-upload', 'rating-upload.svg', 'Rating Upload'),
  shape('shape-arrow-right', 'shape-arrow-right.svg', 'Arrow Right'),
  shape('shape-arrow-up-right', 'shape-arrow-up-right.svg', 'Arrow Up Right'),
  shape('shape-badge', 'shape-badge.svg', 'Badge'),
  shape('shape-check-circle', 'shape-check-circle.svg', 'Check Circle'),
  shape('shape-circle', 'shape-circle.svg', 'Circle'),
  shape('shape-cloud', 'shape-cloud.svg', 'Cloud'),
  shape('shape-diamond', 'shape-diamond.svg', 'Diamond'),
  shape('shape-heart', 'shape-heart.svg', 'Heart'),
  shape('shape-hexagon', 'shape-hexagon.svg', 'Hexagon'),
  shape('shape-minus', 'shape-minus.svg', 'Minus'),
  shape('shape-octagon', 'shape-octagon.svg', 'Octagon'),
  shape('shape-pentagon', 'shape-pentagon.svg', 'Pentagon'),
  shape('shape-plus', 'shape-plus.svg', 'Plus'),
  shape('shape-square', 'shape-square.svg', 'Square'),
  shape('shape-star', 'shape-star.svg', 'Star'),
  shape('shape-triangle', 'shape-triangle.svg', 'Triangle'),
  shape('shape-star-filled', 'star-filled.svg', 'Star Filled'),
  shape('shape-star-half', 'star-half.svg', 'Star Half'),
  shape('shape-star-outline', 'star-outline.svg', 'Star Outline'),
];

/** Legacy: decorative spark overlays. */
export const GRAPHICS = [
  { id: 'spark-mini', src: 'icons/sparkles.svg', label: 'Sparkles', defaultPlacement: { left: 48, top: 120, width: 200 } },
];

export const BLOBS = [
  blob('blob-organic-1', 'blob-organic-1.svg', 'Organic Blob'),
  blob('blob-organic-2', 'blob-organic-2.svg', 'Soft Orbs'),
  blob('blob-wave', 'blob-wave.svg', 'Wave', { left: -40, top: 1400, width: 1160 }),
  blob('blob-frosted', 'blob-frosted.svg', 'Frosted Glow', { left: 200, top: 400, width: 640 }),
  blob('blob-cluster', 'blob-cluster.svg', 'Blob Cluster'),
  blob('blob-hill', 'blob-hill.svg', 'Hill', { left: -20, top: 1500, width: 1120 }),
];

export const BADGES = [
  badge('badge-new', 'badge-new.svg', 'New'),
  badge('badge-rating', 'badge-rating.svg', 'Rating 4.9'),
  badge('badge-7day', 'badge-7day.svg', '7-Day Free'),
  badge('badge-verified', 'badge-verified.svg', 'Verified'),
  badge('badge-notification', 'badge-notification.svg', 'Notification', { left: 80, top: 100, width: 360 }),
  badge('badge-trending', 'badge-trending.svg', 'Trending'),
  badge('badge-pro', 'badge-pro.svg', 'Pro', { left: 80, top: 120, width: 140 }),
  // Promo chips
  ...[
    ['promo-sale', '50% Off', { left: 80, top: 100, width: 220 }],
    ['promo-free', '100% Free', { left: 80, top: 100, width: 200 }],
    ['promo-hot', 'Hot', { left: 80, top: 100, width: 180 }],
    ['promo-editors', "Editors' Choice", { left: 80, top: 100, width: 300 }],
  ].map(([file, label, place]) =>
    accent(`promo-${file}`, `promo/${file}.svg`, label, place, 'promo'),
  ),
  // Notification pills
  ...[
    ['notif-export', 'Export Ready', { left: 60, top: 80, width: 420 }],
    ['notif-update', 'New Update', { left: 60, top: 80, width: 420 }],
    ['notif-success', 'All Set', { left: 60, top: 80, width: 420 }],
    ['notif-rating', 'Review Stars', { left: 60, top: 80, width: 420 }],
  ].map(([file, label, place]) =>
    accent(file, `notifications/${file}.svg`, label, place, 'notifications'),
  ),
];

export const HANDS = [
  ['hand-point', 'Point'],
  ['hand-thumbs-up', 'Thumbs Up'],
  ['hand-wave', 'Wave'],
  ['hand-swipe', 'Swipe'],
  ['hand-tap', 'Tap'],
].map(([file, label]) =>
  accent(file, `hands/${file}.svg`, label, { left: 80, top: 900, width: 220 }, 'hands'),
);

export const CHARTS = [
  ['chart-bars', 'Bar Chart', { left: 80, top: 200, width: 360 }],
  ['chart-ring', 'Progress Ring', { left: 100, top: 200, width: 280 }],
  ['chart-sparkline', 'Sparkline', { left: 80, top: 200, width: 400 }],
  ['chart-growth', 'Growth', { left: 80, top: 200, width: 360 }],
].map(([file, label, place]) =>
  accent(file, `charts/${file}.svg`, label, place, 'charts'),
);

export const COLOR_ICONS = [
  ['ci-zap', 'Zap'],
  ['ci-lock', 'Lock'],
  ['ci-cloud', 'Cloud'],
  ['ci-share', 'Share'],
  ['ci-shield', 'Shield'],
  ['ci-heart', 'Heart'],
  ['ci-star', 'Star'],
  ['ci-rocket', 'Rocket'],
].map(([file, label]) =>
  accent(file, `color-icons/${file}.svg`, label, { left: 80, top: 160, width: 120 }, 'colorIcons'),
);

export const ILLUSTRATIONS = [
  // Glint originals (lightweight)
  illustration('illust-spark-burst', 'illustrations/illust-spark-burst.svg', 'Spark Burst', null, creditOf('glint')),
  illustration('illust-chat-bubbles', 'illustrations/illust-chat-bubbles.svg', 'Chat Bubbles', null, creditOf('glint')),
  illustration('illust-mountain', 'illustrations/illust-mountain.svg', 'Mountain', null, creditOf('glint')),
  illustration('illust-person-wave', 'illustrations/illust-person-wave.svg', 'Person Wave', null, creditOf('glint')),
  illustration('illust-stars-orbit', 'illustrations/illust-stars-orbit.svg', 'Stars Orbit', null, creditOf('glint')),
  illustration('illust-rocket', 'illustrations/illust-rocket.svg', 'Rocket', null, creditOf('glint')),
  illustration('illust-heart-float', 'illustrations/illust-heart-float.svg', 'Heart Float', null, creditOf('glint')),
  // Stickers — tiny accents for store frames (not scene mockups)
  ...[
    ['sticker-stars-row', 'Stars Row', { left: 80, top: 100, width: 280 }],
    ['sticker-sparkle', 'Sparkle', { left: 80, top: 120, width: 100 }],
    ['sticker-underline', 'Underline', { left: 100, top: 280, width: 360 }],
    ['sticker-arrow-curve', 'Curve Arrow', { left: 80, top: 200, width: 160 }],
    ['sticker-check', 'Check', { left: 80, top: 120, width: 96 }],
    ['sticker-heart', 'Heart', { left: 80, top: 120, width: 96 }],
    ['sticker-confetti', 'Confetti', { left: 60, top: 100, width: 200 }],
    ['sticker-burst', 'Burst', { left: 80, top: 100, width: 120 }],
    ['sticker-dot-ring', 'Dot Ring', { left: 80, top: 140, width: 140 }],
    ['sticker-wiggle', 'Wiggle', { left: 100, top: 260, width: 320 }],
  ].map(([file, label, place]) =>
    illustration(file, `stickers/${file}.svg`, label, place, creditOf('stickers')),
  ),
  // Doodle accents
  ...[
    ['doodle-scribble', 'Scribble', { left: 80, top: 240, width: 320 }],
    ['doodle-circle', 'Circle', { left: 80, top: 160, width: 140 }],
    ['doodle-exclaim', 'Exclaim', { left: 80, top: 120, width: 80 }],
  ].map(([file, label, place]) =>
    illustration(file, `doodles/${file}.svg`, label, place, creditOf('doodles')),
  ),
  // Humaaans (CC0) — people beside devices; useful on store frames
  ...[
    'sitting-1', 'sitting-2', 'sitting-3', 'sitting-4', 'sitting-5', 'sitting-6', 'sitting-7', 'sitting-8',
    'standing-1', 'standing-2', 'standing-3', 'standing-4', 'standing-5', 'standing-6', 'standing-7',
    'standing-8', 'standing-9', 'standing-10', 'standing-11', 'standing-12', 'standing-13', 'standing-14',
    'standing-15', 'standing-16', 'standing-17', 'standing-18', 'standing-19', 'standing-20',
    'standing-21', 'standing-22', 'standing-23', 'standing-24',
  ].map((file) =>
    illustration(
      `humaaans-${file}`,
      `humaaans/${file}.svg`,
      file.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      file.startsWith('sitting')
        ? { left: 80, top: 200, width: 340 }
        : { left: 80, top: 160, width: 300 },
      creditOf('humaaans'),
    ),
  ),
];

/** Stickers + doodle accents for store frames. */
export const STICKERS = ILLUSTRATIONS.filter(
  (g) => g.credit?.collection === 'Stickers' || g.credit?.collection === 'Doodles',
);

export function creditLabel(credit) {
  if (!credit) return '';
  return `${credit.collection} · ${credit.author} · ${credit.license}`;
}

export function illustrationsByCollection(collection) {
  if (!collection || collection === 'all') return ILLUSTRATIONS;
  return ILLUSTRATIONS.filter((g) => g.credit?.collection === collection);
}

export const SLOT_COLORS = { a: '#FF6B4A', b: '#FFD166', c: '#FFF7F2' };

const ALL_CATALOGS = [
  ICONS,
  BRANDS,
  SHAPES_SVG,
  BLOBS,
  BADGES,
  HANDS,
  CHARTS,
  COLOR_ICONS,
  ILLUSTRATIONS,
  GRAPHICS,
];

export function getGraphicById(id) {
  for (const list of ALL_CATALOGS) {
    const hit = list.find((g) => g.id === id);
    if (hit) return hit;
  }
  return null;
}

export function getGraphicBySrc(src) {
  const file = (src || '').split('/').pop();
  for (const list of ALL_CATALOGS) {
    const hit = list.find((g) => g.src.endsWith(file));
    if (hit) return hit;
  }
  return null;
}

// ─── Color contrast helpers ─────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDark(hex) {
  return luminance(hex) < 0.4;
}

export function contrastingIconColor(themeColor, bgColor) {
  if (!bgColor) return themeColor;
  const themeDark = isDark(themeColor);
  const bgDark = isDark(bgColor);
  if (themeDark !== bgDark) return themeColor;
  return bgDark ? '#FFFFFF' : '#1A1A2E';
}
