#!/usr/bin/env node
/**
 * Headless ZIP export for agents / CI.
 *
 * Usage:
 *   node scripts/headless-export.mjs \
 *     --session ../path/to/glint_screenshots \
 *     --template blink-play \
 *     --out ./out.zip \
 *     [--app MyApp] \
 *     [--layout flat|fastlane] [--locale en-US] \
 *     [--base http://127.0.0.1:4173]
 *
 * ZIP entries: flat → Frame_1.png …; fastlane → deliver/supply folders for --locale.
 * Requires a running Glint Web build (`npm run build && npm run preview`)
 * and Playwright (`npx playwright install chromium`).
 */
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function loadSessionScreenshots(sessionDir) {
  const sessionPath = path.join(sessionDir, 'session.json');
  await access(sessionPath);
  const session = JSON.parse(await readFile(sessionPath, 'utf8'));
  const screens = session.screens || session.screenshots || [];
  const urls = [];

  for (const s of screens) {
    const rel = s.path || s.file || s.filename || s;
    if (typeof rel !== 'string') continue;
    if (rel.startsWith('data:')) {
      urls.push(rel);
      continue;
    }
    const abs = path.isAbsolute(rel) ? rel : path.join(sessionDir, rel);
    try {
      const buf = await readFile(abs);
      const b64 = buf.toString('base64');
      urls.push(`data:image/png;base64,${b64}`);
    } catch {
      // try basename under sessionDir
      const alt = path.join(sessionDir, path.basename(rel));
      const buf = await readFile(alt);
      urls.push(`data:image/png;base64,${buf.toString('base64')}`);
    }
  }

  if (!urls.length) {
    // Fallback: any PNG in folder (sorted)
    const files = (await readdir(sessionDir))
      .filter((f) => /\.png$/i.test(f))
      .sort();
    for (const f of files) {
      const buf = await readFile(path.join(sessionDir, f));
      urls.push(`data:image/png;base64,${buf.toString('base64')}`);
    }
  }
  return { session, urls };
}

async function main() {
  const sessionDir = arg('session');
  const template = arg('template', 'blink-play');
  const out = arg('out', 'glint.zip');
  const app = arg('app', 'glint');
  const base = arg('base', process.env.GLINT_WEB_BASE || 'http://127.0.0.1:4173');

  if (!sessionDir) {
    console.error('Missing --session <dir with session.json + PNGs>');
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Install Playwright: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }

  const { urls } = await loadSessionScreenshots(path.resolve(sessionDir));
  if (!urls.length) {
    console.error('No screenshots found in session folder');
    process.exit(1);
  }

  const qs = new URLSearchParams({
    template,
    app,
    layout: arg('layout', 'flat'),
    locale: arg('locale', 'en-US'),
  });
  const url = `${base.replace(/\/$/, '')}/export?${qs}`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });

  await page.evaluate((screenshots) => {
    window.__GLINT_HEADLESS__ = { screenshots };
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'glint-export', screenshots },
    }));
  }, urls);

  // Also postMessage from page context
  await page.evaluate((screenshots) => {
    window.postMessage({ type: 'glint-export', screenshots }, '*');
  }, urls);

  const result = await page.waitForFunction(() => {
    const r = window.__GLINT_EXPORT_READY__;
    return r && r.pending !== true && (r.ok === true || r.error);
  }, { timeout: 180000 }).then(() => page.evaluate(() => window.__GLINT_EXPORT_READY__));

  await browser.close();

  if (!result?.ok) {
    console.error('Export failed:', result?.error || result);
    process.exit(1);
  }

  const buf = Buffer.from(result.zipBase64, 'base64');
  await writeFile(path.resolve(out), buf);
  console.log(`Wrote ${out} (${result.count} files, template=${result.templateId})`);
  if (hasFlag('json')) {
    console.log(JSON.stringify({ ...result, zipBase64: undefined }, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
