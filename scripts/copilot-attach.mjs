#!/usr/bin/env node
/**
 * Attach to a live Copilot board and run a multi-frame board pass.
 *
 * Prerequisites:
 *   1. Glint Web open with your project loaded
 *   2. Click Allow agent → copy the board code (e.g. K7MP)
 *   3. Chrome/Chromium with remote debugging:
 *        google-chrome --remote-debugging-port=9222
 *        # or: chromium --remote-debugging-port=9222
 *
 * Usage:
 *   node scripts/copilot-attach.mjs --pair K7MP
 *   node scripts/copilot-attach.mjs --pair K7MP --cdp http://127.0.0.1:9222
 *   node scripts/copilot-attach.mjs --pair K7MP --state-only
 *
 * Never opens a new Glint editor. Finds the tab titled [Glint CODE] ….
 */
import { chromium } from 'playwright';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const pair = String(arg('pair', '') || '').trim().toUpperCase();
const cdp = arg('cdp', 'http://127.0.0.1:9222');
const stateOnly = hasFlag('state-only');

if (!pair || pair.length < 4) {
  console.error('Usage: node scripts/copilot-attach.mjs --pair K7MP [--cdp http://127.0.0.1:9222] [--state-only]');
  process.exit(1);
}

let browser;
try {
  browser = await chromium.connectOverCDP(cdp);
} catch (err) {
  console.error(`Cannot connect to CDP at ${cdp}`);
  console.error('Start Chrome with: google-chrome --remote-debugging-port=9222');
  console.error(String(err?.message || err));
  process.exit(1);
}

const pages = browser.contexts().flatMap((c) => c.pages());
let target = null;

for (const p of pages) {
  try {
    const title = await p.title();
    if (title.includes(`[Glint ${pair}]`)) {
      target = p;
      break;
    }
  } catch {
    /* ignore closed pages */
  }
}

if (!target) {
  for (const p of pages) {
    const ok = await p
      .evaluate((code) => {
        const g = window.__GLINT_COPILOT__;
        return !!(g && g.isThisBoard && g.isThisBoard(code));
      }, pair)
      .catch(() => false);
    if (ok) {
      target = p;
      break;
    }
  }
}

if (!target) {
  console.error(`No open board for pair ${pair}.`);
  console.error('Open Glint Web → Allow agent → confirm tab title is [Glint ' + pair + '] …');
  console.error(`CDP pages seen: ${pages.length}`);
  process.exit(2);
}

await target.bringToFront();

const probe = await target.evaluate((code) => {
  const g = window.__GLINT_COPILOT__;
  if (!g) return { ok: false, error: 'no_bridge' };
  if (!g.isThisBoard(code)) return { ok: false, error: 'wrong_board', pairCode: g.pairCode };
  return {
    ok: true,
    pairCode: g.pairCode,
    generation: g.generation,
    boards: typeof g.listBoards === 'function' ? g.listBoards() : [],
  };
}, pair);

if (!probe.ok) {
  console.error('Attach failed:', probe);
  process.exit(3);
}

console.log(`Attached to board ${probe.pairCode} (gen ${probe.generation})`);

if (stateOnly) {
  const state = await target.evaluate(async () => window.__GLINT_COPILOT__.getEditorState());
  console.log('Editor state frames:', state?.state?.frameCount, 'active', state?.state?.activeIndex);
} else {
  const result = await target.evaluate(async (code) => {
    const g = window.__GLINT_COPILOT__;
    return g.boardPass({ pairCode: code, paceMs: 420 });
  }, pair);
  console.log('Board pass:', JSON.stringify(result, null, 2));
}

process.exit(0);
