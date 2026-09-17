#!/usr/bin/env node
/**
 * polish-session.mjs — Agent path: Bridge output/ → store-ready ZIP.
 *
 * 1. Crop status / nav chrome (content-aware ratios)
 * 2. Read theme.json (from Bridge) or sample brand colors from shots
 * 3. Place captions ABOVE a fitted device (never under the bezel)
 * 4. Remap slide background to the soft app palette color
 * 5. Render via compose + render.mjs (silhouette-masked device frames)
 *
 * Usage:
 *   node scripts/polish-session.mjs \
 *     --session ../Glint-Bridge/output \
 *     --out breath-play.zip \
 *     --template mint-tags-play \
 *     --headlines "Calm in one minute,Box breathing,Find your rhythm,Stay present,Start anytime"
 *
 * Flags:
 *   --keep-status   leave Android status bar
 *   --keep-nav      leave Android nav bar
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FRAMES } from '../lib/compose.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function contrastText(hex) {
  const h = String(hex || '#FFFFFF').replace('#', '');
  if (h.length < 6) return '#FFFFFF';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.58 ? '#0F172A' : '#FFFFFF';
}

/** Prefer a calm store field: light neutral background over saturated soft/primary. */
function pickField(theme) {
  const hex = (h) => {
    const s = String(h || '').replace('#', '');
    if (s.length < 6) return null;
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  };
  const score = (h) => {
    const rgb = hex(h);
    if (!rgb) return -1;
    const [r, g, b] = rgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Light + calm wins for Play Store fields.
    return L * 2 - sat * 1.5;
  };
  const candidates = [theme.background, theme.soft, '#F4F7FB'].filter(Boolean);
  return candidates.sort((a, b) => score(b) - score(a))[0];
}

/** Content-aware chrome crop (mirrors Bridge chrome_crop heuristics). */
async function cropChrome(srcPath, destPath, { status = true, nav = true } = {}) {
  const img = await loadImage(await readFile(srcPath));
  const w = img.width;
  const h = img.height;
  const canvasFull = createCanvas(w, h);
  const ctxFull = canvasFull.getContext('2d');
  ctxFull.drawImage(img, 0, 0);
  const { data } = ctxFull.getImageData(0, 0, w, h);

  const sample = (y) => {
    const pixels = [];
    for (let x = 0; x < w; x += 8) {
      const i = (y * w + x) * 4;
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    return pixels;
  };
  const mean = (pixels) => {
    const n = pixels.length || 1;
    return [
      pixels.reduce((s, p) => s + p[0], 0) / n,
      pixels.reduce((s, p) => s + p[1], 0) / n,
      pixels.reduce((s, p) => s + p[2], 0) / n,
    ];
  };
  const isBlack = (pixels) => {
    const dark = pixels.filter(([r, g, b]) => r <= 28 && g <= 28 && b <= 28).length;
    return dark / pixels.length >= 0.86;
  };

  let top = 0;
  let bottom = h;
  if (status) {
    const lo = Math.round(h * 0.028);
    const hi = Math.round(h * 0.08);
    const ref = mean(sample(Math.min(h - 1, Math.round(h * 0.12))));
    let cut = Math.round(h * 0.042);
    for (let y = lo; y < hi; y++) {
      const m = mean(sample(y));
      const delta = Math.abs(m[0] - ref[0]) + Math.abs(m[1] - ref[1]) + Math.abs(m[2] - ref[2]);
      cut = y;
      if (delta < 35) break;
    }
    top = Math.max(cut, Math.round(h * 0.042));
  }
  if (nav) {
    const limit = Math.round(h * 0.12);
    let navH = 0;
    for (let dy = 0; dy < limit; dy++) {
      if (isBlack(sample(h - 1 - dy))) navH = dy + 1;
      else if (navH > 4) break;
      else navH = 0;
    }
    bottom = h - Math.max(navH, Math.round(h * 0.068));
  }

  const ch = bottom - top;
  const canvas = createCanvas(w, ch);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, top, w, ch, 0, 0, w, ch);
  await writeFile(destPath, canvas.toBuffer('image/png'));
  return destPath;
}

/** Sample brand colors from PNGs (Node-native; Bridge also writes theme.json). */
async function extractTheme(paths) {
  const accent = new Map();
  const neutral = new Map();
  const SKIP_TOP = 0.1;
  const SKIP_BOTTOM = 0.12;
  const SKIP_SIDE = 0.06;

  const sat = (r, g, b) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  };
  const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const neutralRgb = (r, g, b) => {
    if (r > 245 && g > 245 && b > 245) return true;
    if (r < 18 && g < 18 && b < 18) return true;
    const s = sat(r, g, b);
    const L = lum(r, g, b);
    return s < 0.16 && L > 0.1 && L < 0.92;
  };
  const key = (r, g, b) => `${r >> 3},${g >> 3},${b >> 3}`;
  const toHex = (r, g, b) =>
    `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

  for (const p of paths) {
    const img = await loadImage(await readFile(p));
    const maxSide = 256;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const tw = Math.max(1, Math.round(img.width * scale));
    const th = Math.max(1, Math.round(img.height * scale));
    const c = createCanvas(tw, th);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, tw, th);
    const { data } = ctx.getImageData(0, 0, tw, th);
    const step = Math.max(1, Math.floor(Math.min(tw, th) / 80));
    for (let y = 0; y < th; y += step) {
      for (let x = 0; x < tw; x += step) {
        if (x < tw * SKIP_SIDE || x > tw * (1 - SKIP_SIDE)) continue;
        if (y < th * SKIP_TOP || y > th * (1 - SKIP_BOTTOM)) continue;
        const i = (y * tw + x) * 4;
        if (data[i + 3] < 160) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const k = key(r, g, b);
        neutral.set(k, (neutral.get(k) || 0) + 1);
        if (!neutralRgb(r, g, b)) accent.set(k, (accent.get(k) || 0) + 1 + Math.round(sat(r, g, b) * 4));
      }
    }
  }

  const best = [...accent.entries()].sort((a, b) => b[1] - a[1])[0]
    || [...neutral.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) {
    return {
      primary: '#4A90C8',
      secondary: '#2F5F8A',
      accent: '#7EB6E0',
      soft: '#D6E8F5',
      background: '#F7FBFE',
    };
  }
  const [kr] = best;
  const [qr, qg, qb] = kr.split(',').map((n) => Math.min(255, Number(n) * 8 + 4));
  const primary = toHex(qr, qg, qb);
  const soft = toHex(
    Math.min(255, Math.round(qr * 0.28 + 200)),
    Math.min(255, Math.round(qg * 0.28 + 200)),
    Math.min(255, Math.round(qb * 0.28 + 200)),
  );
  const secondary = toHex(
    Math.max(0, Math.round(qr * 0.65)),
    Math.max(0, Math.round(qg * 0.65)),
    Math.max(0, Math.round(qb * 0.65)),
  );
  return { primary, secondary, accent: primary, soft, background: soft };
}

/** Fit device under a caption band so text never intersects the bezel. */
function storeDeviceLayout(canvasW, canvasH, frameId = 'pixel9') {
  const meta = FRAMES[frameId] || FRAMES.pixel9;
  const CAPTION_TOP = 56;
  const CAPTION_BAND = 210;
  const BOTTOM_PAD = 56;
  const SIDE_PAD = 0.06;
  const maxH = canvasH - CAPTION_BAND - BOTTOM_PAD;
  const maxW = canvasW * (1 - SIDE_PAD * 2);
  const scale = Math.min(maxH / meta.h, maxW / meta.w);
  const deviceH = meta.h * scale;
  const deviceMarginTop = CAPTION_BAND + Math.round((maxH - deviceH) / 2);
  return {
    CAPTION_TOP,
    deviceScale: Number(scale.toFixed(4)),
    deviceMarginTop,
    frameId,
  };
}

function runRender(designPath, shotsDir, outZip) {
  return new Promise((resolveP, reject) => {
    const child = spawn(
      process.execPath,
      [join(WEB_ROOT, 'scripts/render.mjs'), '--design', designPath, '--screenshots', shotsDir, '--out', outZip, '--json'],
      { cwd: WEB_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(err || out || `render exit ${code}`));
      else resolveP(out);
    });
  });
}

async function main() {
  const sessionDir = resolve(arg('session', '.'));
  const outZip = resolve(arg('out', 'glint-polished.zip'));
  const template = arg('template', 'mint-tags-play');
  const headlinesRaw = arg('headlines', '');
  const cropStatus = !hasFlag('keep-status');
  const cropNav = !hasFlag('keep-nav');
  const frameId = arg('frame', 'pixel9');

  const sessionPath = join(sessionDir, 'session.json');
  await access(sessionPath);
  const session = JSON.parse(await readFile(sessionPath, 'utf8'));
  const screens = (session.screens || []).map((s) => basename(s));
  if (!screens.length) throw new Error('session.json has no screens');

  const work = join(sessionDir, '.polish');
  await mkdir(work, { recursive: true });

  const cleaned = [];
  for (const name of screens) {
    const src = join(sessionDir, name);
    const dest = join(work, name);
    await cropChrome(src, dest, { status: cropStatus, nav: cropNav });
    cleaned.push(dest);
  }

  let theme;
  try {
    const themeFile = join(sessionDir, 'theme.json');
    await access(themeFile);
    theme = JSON.parse(await readFile(themeFile, 'utf8')).theme;
  } catch {
    theme = await extractTheme(cleaned);
  }
  if (!theme.soft) theme.soft = theme.background || theme.primary;
  if (!theme.background) theme.background = theme.soft;
  await writeFile(join(work, 'theme.json'), JSON.stringify({ theme }, null, 2));

  const headlines = headlinesRaw
    ? headlinesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : screens.map((_, i) => `Screen ${i + 1}`);

  const canvasW = 1080;
  const canvasH = 1920;
  const layout = storeDeviceLayout(canvasW, canvasH, frameId);
  const bg = pickField(theme);
  const textColor = contrastText(bg);

  const slides = {};
  for (let i = 0; i < Math.min(screens.length, 5); i++) {
    slides[String(i)] = {
      headline: headlines[i] || `Screen ${i + 1}`,
      position: 'top',
      marginTop: layout.CAPTION_TOP,
      fontSize: 48,
      bg,
      color: textColor,
      deviceScale: layout.deviceScale,
      deviceMarginTop: layout.deviceMarginTop,
      frame: layout.frameId,
      // Full shot inside the hole — same as Studio Contain (frame never crops shot borders).
      fitMode: 'contain',
    };
  }

  const design = {
    template,
    screenshots: screens,
    store: session.store || 'play/phone',
    theme,
    overrides: { slides },
  };

  const designPath = join(work, 'design.json');
  await writeFile(designPath, JSON.stringify(design, null, 2));

  const log = await runRender(designPath, work, outZip);
  console.log(log.trim());
  console.log(JSON.stringify({
    ok: true,
    out: outZip,
    theme,
    layout,
    screens: screens.length,
    template,
    work,
  }, null, 2));
}

main().catch((err) => {
  console.error('polish-session failed:', err.message || err);
  process.exit(1);
});
