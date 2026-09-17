#!/usr/bin/env node
/**
 * Self-check: compose device layout isolation + caption clearance.
 * Run: node scripts/check-polish-layout.mjs
 */
import { compose, FRAMES } from '../lib/compose.js';
import assert from 'node:assert/strict';

const r = compose({
  templateId: 'mint-tags-play',
  screenshots: ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'],
  overrides: {
    slides: {
      0: {
        headline: 'Calm in one minute',
        position: 'top',
        marginTop: 56,
        bg: '#DAEBFE',
        color: '#0F172A',
        deviceScale: 0.46,
        deviceMarginTop: 220,
        frame: 'pixel9',
      },
    },
  },
});

const slide = r.slides[0];
const text = slide.composables.find((c) => c.type === 'text');
const device = slide.composables.find((c) => c.type === 'device');

assert.ok(text, 'headline missing');
assert.ok(device, 'device missing');
assert.equal(text.y, 56, 'headline should use slide marginTop');
assert.equal(device.y, 220, 'device must NOT inherit headline marginTop');
assert.ok(device.y > text.y + 80, 'caption band must sit above device');
assert.ok(device.y + device.h <= 1920 - 40, 'device must fit on canvas');
assert.ok(FRAMES.pixel9.rx >= 180, 'pixel9 rx must cover real corner curve');

console.log('check-polish-layout: ok', {
  textY: text.y,
  deviceY: device.y,
  deviceH: device.h,
  rx: FRAMES.pixel9.rx,
});
