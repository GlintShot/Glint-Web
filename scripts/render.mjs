#!/usr/bin/env node
/**
 * render.mjs - Headless PNG renderer for Glint.
 *
 * Reads design.json + screenshots → composites via @napi-rs/canvas → ZIP.
 * No browser, no Playwright, no Fabric. Pure Node.js.
 *
 * Usage:
 *   node scripts/render.mjs --design design.json --screenshots ./shots --out out.zip
 *
 * design.json format:
 *   {
 *     "template": "blink-play",
 *     "screenshots": ["home.png", "profile.png"],
 *     "overrides": {
 *       "slides": {
 *         "0": { "headline": "Your Best Day", "subheadline": "Every moment captured" }
 *       }
 *     },
 *     "store": "play/phone"
 *   }
 */
import { readFile, writeFile, readdir, access, mkdir } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { compose, framePngPath, STORES, FRAMES } from '../lib/compose.js';

// ─── ZIP (inline minimal impl - avoids JSZip dependency for CLI) ────────────
// We'll use JSZip since it's already a dependency of Glint-Web.
async function buildZip(entries) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const { name, data } of entries) {
    zip.file(name, data);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

// ─── Arg parsing ────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1] ?? fallback;
}

// ─── SVG → PNG via data URL + loadImage ─────────────────────────────────────
async function loadSvgAsImage(svgPath, fills = {}) {
  let svg = await readFile(svgPath, 'utf8');
  // Recolor the 3-slot system: #A10000 → fill, #B10000 → fill2, #C10000 → fill3
  if (fills.fill)  svg = svg.replaceAll('#A10000', fills.fill);
  if (fills.fill2) svg = svg.replaceAll('#B10000', fills.fill2);
  if (fills.fill3) svg = svg.replaceAll('#C10000', fills.fill3);
  const buf = Buffer.from(svg);
  return loadImage(buf);
}

// ─── Drawing helpers ────────────────────────────────────────────────────────

function drawBackground(ctx, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

function drawText(ctx, c) {
  const { text, x, y, w, fontSize, fontWeight, color, align, fontFamily, lineHeight, charSpacing, shadow } = c;
  if (!text) return;

  const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.font = font;
  ctx.fillStyle = color || '#FFFFFF';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'top';

  if (shadow) {
    ctx.shadowColor = shadow.color || 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = shadow.blur || 5;
    ctx.shadowOffsetX = shadow.offsetX || 8;
    ctx.shadowOffsetY = shadow.offsetY || 8;
  }

  // compose() sets x = block center when align is center (NOT left edge).
  const boxLeft = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const lines = wrapText(ctx, text, w);
  const lh = fontSize * (lineHeight || 1.14);
  const startX = align === 'center' ? x : align === 'right' ? x : boxLeft;

  for (let i = 0; i < lines.length; i++) {
    const ly = y + i * lh;
    if (charSpacing) {
      drawSpacedText(ctx, lines[i], startX, ly, charSpacing);
    } else {
      ctx.fillText(lines[i], startX, ly);
    }
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawSpacedText(ctx, text, x, y, spacing) {
  ctx.textAlign = 'left';
  let cx = x;
  // Center the spaced text
  const totalW = text.length * (ctx.measureText('A').width + spacing) - spacing;
  const align = ctx.textAlign;
  if (align === 'center' || ctx.textAlign === 'center') {
    cx = x - totalW / 2;
  }
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = 'center';
}

function wrapText(ctx, text, maxWidth) {
  const paragraphs = text.split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Build mask from bezel PNG. holeOnly → just the screen opening; else phone∪bezel. */
function phoneSilhouetteMask(frameImg, lw, lh, seedX, seedY, { holeOnly = false } = {}) {
  const mask = createCanvas(lw, lh);
  const mctx = mask.getContext('2d');
  mctx.drawImage(frameImg, 0, 0, lw, lh);
  const img = mctx.getImageData(0, 0, lw, lh);
  const d = img.data;
  const sx = Math.max(0, Math.min(lw - 1, Math.round(seedX)));
  const sy = Math.max(0, Math.min(lh - 1, Math.round(seedY)));
  const out = mctx.createImageData(lw, lh);
  const o = out.data;
  if (!holeOnly) {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) {
        o[i] = o[i + 1] = o[i + 2] = 255;
        o[i + 3] = 255;
      }
    }
  }
  const stack = [[sx, sy]];
  const seen = new Uint8Array(lw * lh);
  while (stack.length) {
    const [x, y] = stack.pop();
    const idx = y * lw + x;
    if (seen[idx]) continue;
    seen[idx] = 1;
    const p = idx * 4;
    if (d[p + 3] > 0) continue;
    o[p] = o[p + 1] = o[p + 2] = 255;
    o[p + 3] = 255;
    if (x > 0) stack.push([x - 1, y]);
    if (x + 1 < lw) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y + 1 < lh) stack.push([x, y + 1]);
  }
  mctx.putImageData(out, 0, 0);
  return mask;
}

async function drawDevice(ctx, c, screenshots, publicDir) {
  const { x, y, w, h, frameId, screenshotIndex } = c;
  const framePath = framePngPath(frameId);
  const meta = FRAMES[frameId] || FRAMES.pixel9;
  const scaleX = w / meta.w;
  const scaleY = h / meta.h;
  const screenX = meta.inset.l * scaleX;
  const screenY = meta.inset.t * scaleY;
  const screenW = (meta.w - meta.inset.l - meta.inset.r) * scaleX;
  const screenH = (meta.h - meta.inset.t - meta.inset.b) * scaleY;
  const lw = Math.max(1, Math.round(w));
  const lh = Math.max(1, Math.round(h));

  const layer = createCanvas(lw, lh);
  const lctx = layer.getContext('2d');

  let frameImg = null;
  try {
    frameImg = await loadImage(await readFile(framePath));
  } catch {
    frameImg = null;
  }

  // Hole-only mask (flood-fill) so the shot cannot leave the real screen opening.
  let holeMask = null;
  if (frameImg) {
    holeMask = phoneSilhouetteMask(
      frameImg,
      lw,
      lh,
      screenX + screenW / 2,
      screenY + screenH / 2,
      { holeOnly: true },
    );
  }

  const shotPath = screenshots[screenshotIndex] || screenshots[0];
  if (shotPath) {
    try {
      const shotImg = await loadImage(await readFile(shotPath));
      // contain = full shot inside the hole (Studio default). cover crops shot borders.
      const fitMode = c.fitMode || 'contain';
      const imgRatio = shotImg.width / shotImg.height;
      const holeRatio = screenW / screenH;
      let sw, sh, sx, sy;
      if (fitMode === 'cover') {
        if (imgRatio > holeRatio) {
          sh = screenH;
          sw = sh * imgRatio;
          sx = screenX - (sw - screenW) / 2;
          sy = screenY;
        } else {
          sw = screenW;
          sh = sw / imgRatio;
          sx = screenX;
          sy = screenY - (sh - screenH) / 2;
        }
      } else {
        // contain - fit inside, letterbox with white; frame never crops shot edges
        if (imgRatio > holeRatio) {
          sw = screenW;
          sh = sw / imgRatio;
          sx = screenX;
          sy = screenY + (screenH - sh) / 2;
        } else {
          sh = screenH;
          sw = sh * imgRatio;
          sx = screenX + (screenW - sw) / 2;
          sy = screenY;
        }
      }
      lctx.fillStyle = '#ffffff';
      lctx.fillRect(screenX, screenY, screenW, screenH);
      lctx.drawImage(shotImg, sx, sy, sw, sh);
      if (holeMask) {
        lctx.globalCompositeOperation = 'destination-in';
        lctx.drawImage(holeMask, 0, 0);
        lctx.globalCompositeOperation = 'source-over';
      }
    } catch {
      lctx.fillStyle = '#E5E7EB';
      lctx.fillRect(screenX, screenY, screenW, screenH);
    }
  }

  // Bezel last - always covers shot edges / AA fringe.
  if (frameImg) {
    lctx.drawImage(frameImg, 0, 0, lw, lh);
  } else {
    lctx.strokeStyle = '#1a1a1a';
    lctx.lineWidth = 8;
    roundRect(lctx, 0, 0, lw, lh, 40);
    lctx.stroke();
  }

  // Soft drop shadow under the device (matches editor DEFAULT_SCREENSHOT_STYLE).
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.40)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 22;
  ctx.drawImage(layer, x, y);
  ctx.restore();
  // Redraw sharp (no shadow bleed on transparent edges).
  ctx.drawImage(layer, x, y);
}

async function drawGraphic(ctx, c, publicDir) {
  const { src, x, y, w, h, fill, fill2, fill3, angle } = c;
  try {
    const svgPath = join(publicDir, 'graphics', src);
    const img = await loadSvgAsImage(svgPath, { fill, fill2, fill3 });
    ctx.save();
    if (angle) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
    ctx.restore();
  } catch {
    // Graphic not found - skip silently
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Main render pipeline ───────────────────────────────────────────────────

async function renderSlide(slide, screenshots, publicDir) {
  const { composables, background } = slide;
  let canvasW = 1080, canvasH = 1920;
  if (slide.canvas) {
    canvasW = slide.canvas.w;
    canvasH = slide.canvas.h;
  }

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  // Captions must paint AFTER the device so they never sit under the bezel.
  const z = { background: 0, graphic: 1, shape: 2, device: 3, text: 4 };
  const ordered = [...composables].sort((a, b) => (z[a.type] ?? 9) - (z[b.type] ?? 9));

  for (const c of ordered) {
    switch (c.type) {
      case 'background':
        drawBackground(ctx, canvasW, canvasH, c.color || background || '#FFFFFF');
        break;
      case 'text':
        drawText(ctx, c);
        break;
      case 'device':
        await drawDevice(ctx, c, screenshots, publicDir);
        break;
      case 'graphic':
        await drawGraphic(ctx, c, publicDir);
        break;
    }
  }

  return canvas.toBuffer('image/png');
}

// ─── Entry point ────────────────────────────────────────────────────────────

async function main() {
  const designPath = arg('design');
  const screenshotsDir = arg('screenshots', '.');
  const outPath = arg('out', 'glint.zip');
  const jsonFlag = process.argv.includes('--json');

  if (!designPath) {
    console.error('Usage: node scripts/render.mjs --design design.json --screenshots ./shots --out out.zip');
    process.exit(1);
  }

  const design = JSON.parse(await readFile(resolve(designPath), 'utf8'));
  const publicDir = join(import.meta.dirname, '..', 'public');

  // Collect screenshots
  let screenshots = [];
  if (design.screenshots && design.screenshots.length) {
    for (const s of design.screenshots) {
      const abs = resolve(screenshotsDir, s);
      try {
        await access(abs);
        screenshots.push(abs);
      } catch {
        // Try basename in screenshotsDir
        const alt = join(resolve(screenshotsDir), basename(s));
        try {
          await access(alt);
          screenshots.push(alt);
        } catch {
          screenshots.push(null);
        }
      }
    }
  } else {
    // Auto-discover PNGs in screenshots dir
    try {
      const files = (await readdir(resolve(screenshotsDir))).filter(f => /\.png$/i.test(f)).sort();
      screenshots = files.map(f => join(resolve(screenshotsDir), f));
    } catch {
      // No screenshots dir
    }
  }

  // Compose geometry
  const result = compose({
    templateId: design.template,
    screenshots,
    overrides: design.overrides || {},
    store: design.store,
  });

  // Render each slide
  const entries = [];
  for (let i = 0; i < result.slides.length; i++) {
    const slide = result.slides[i];
    slide.canvas = result.canvas;
    const png = await renderSlide(slide, screenshots, publicDir);
    const name = `Frame_${i + 1}.png`;
    entries.push({ name, data: png });
    console.log(`  rendered ${name} (${result.canvas.w}x${result.canvas.h})`);
  }

  // Write ZIP
  if (entries.length === 0) {
    console.error('No slides to render');
    process.exit(1);
  }

  const zipBuf = await buildZip(entries);
  await writeFile(resolve(outPath), zipBuf);
  console.log(`Wrote ${outPath} (${entries.length} files, template=${design.template})`);

  if (jsonFlag) {
    console.log(JSON.stringify({
      ok: true,
      out: resolve(outPath),
      count: entries.length,
      template: design.template,
      canvas: result.canvas,
      slides: result.slides.map(s => s.name),
    }, null, 2));
  }
}

main().catch(err => {
  console.error('Render failed:', err.message || err);
  process.exit(1);
});
